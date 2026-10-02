"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireCtx, requireWriter, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { policyById } from "@/content/policies";
import { generateDraft } from "@/lib/policy-ai";

async function requireManager(): Promise<Ctx> {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can do this.");
  return ctx;
}

export async function setAiEnabled(form: FormData) {
  const ctx = await requireManager();
  const enabled = form.get("enabled") === "on";
  const db = await getDb();
  await db.update(schema.tenants).set({ aiEnabled: enabled }).where(eq(schema.tenants.id, ctx.tenantId));
  await audit(ctx.tenantId, ctx.userId, enabled ? "tenant.ai_enabled" : "tenant.ai_disabled", "tenant", ctx.tenantId);
  revalidatePath("/app/policies");
  revalidatePath("/app/settings/security");
}

export type GenerateState = { error?: string; values?: Record<string, string> } | undefined;

const field = (max: number) => z.string().trim().max(max).default("");
const inputSchema = z.object({
  policyType: z.string().min(1),
  companyName: z.string().trim().min(2).max(120),
  industry: field(80),
  staffCount: field(20),
  itEnvironment: field(400),
  policyOwnerRole: field(80),
  reviewFrequency: field(40),
  extraNotes: field(600),
});

export async function generatePolicy(_: GenerateState, form: FormData): Promise<GenerateState> {
  const ctx = await requireWriter();
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { error: "Check the details: the company name is required and fields have length limits.", values: raw };
  const { policyType, ...inputs } = parsed.data;
  const def = policyById(policyType);
  if (!def) return { error: "Unknown policy type.", values: raw };

  const db = await getDb();
  const [tenant] = await db.select({ aiEnabled: schema.tenants.aiEnabled }).from(schema.tenants).where(eq(schema.tenants.id, ctx.tenantId)).limit(1);
  const useAi = tenant.aiEnabled;
  if (useAi && !rateLimit(`policy-ai:${ctx.tenantId}`, 30, 24 * 60 * 60 * 1000).ok) {
    return { error: "Daily AI drafting limit reached. Try again tomorrow, or write the draft from the template.", values: raw };
  }

  let draft;
  try {
    draft = await generateDraft(def, inputs, useAi);
  } catch (e) {
    console.error("policy generation failed", e);
    await audit(ctx.tenantId, ctx.userId, "policy.generation_failed", "policy", null, { policyType });
    return { error: "The AI draft could not be created right now. Try again in a minute.", values: raw };
  }

  const [{ v }] = await db
    .select({ v: max(schema.policies.version) })
    .from(schema.policies)
    .where(and(eq(schema.policies.tenantId, ctx.tenantId), eq(schema.policies.policyType, def.id)));
  const [row] = await db
    .insert(schema.policies)
    .values({
      tenantId: ctx.tenantId,
      policyType: def.id,
      title: def.name,
      version: (v ?? 0) + 1,
      content: draft.content,
      source: draft.source,
      model: draft.model,
      inputs,
      createdBy: ctx.userId,
    })
    .returning({ id: schema.policies.id });
  // Log what was used, never the content.
  await audit(ctx.tenantId, ctx.userId, "policy.drafted", "policy", row.id, { policyType: def.id, source: draft.source, model: draft.model });
  redirect(`/app/policies/${row.id}`);
}

async function ownPolicy(ctx: Ctx, id: string) {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(schema.policies)
    .where(and(eq(schema.policies.id, id), eq(schema.policies.tenantId, ctx.tenantId)))
    .limit(1);
  if (!p) throw new Error("Policy not found");
  return p;
}

export type SaveState = { error?: string; ok?: string } | undefined;

export async function saveDraft(_: SaveState, form: FormData): Promise<SaveState> {
  const ctx = await requireWriter();
  const id = z.string().uuid().parse(form.get("policyId"));
  const content = String(form.get("content") ?? "").replace(/\r\n/g, "\n");
  if (content.trim().length < 20) return { error: "The policy is too short." };
  if (content.length > 60_000) return { error: "The policy is too long (60,000 characters max)." };
  const p = await ownPolicy(ctx, id);
  if (p.status !== "draft") return { error: "Only drafts can be edited. Create a new version instead." };
  const db = await getDb();
  await db.update(schema.policies).set({ content, updatedAt: new Date() }).where(eq(schema.policies.id, id));
  await audit(ctx.tenantId, ctx.userId, "policy.edited", "policy", id);
  revalidatePath(`/app/policies/${id}`);
  return { ok: "Saved" };
}

/**
 * Human approval gate. Only owners and admins can approve. On approval the policy is
 * frozen, any earlier approved version is superseded, and a Markdown copy is filed as
 * evidence against the mapped controls in every assessment of this workspace.
 */
export async function approvePolicy(form: FormData) {
  const ctx = await requireManager();
  const id = z.string().uuid().parse(form.get("policyId"));
  if (form.get("confirm") !== "on") throw new Error("Confirm that you have reviewed the policy.");
  const stored = await ownPolicy(ctx, id);
  if (stored.status !== "draft") throw new Error("Only drafts can be approved.");
  // Approve exactly what the approver sees: the submitted text, if any.
  const submitted = form.get("content");
  let content = stored.content;
  if (typeof submitted === "string") {
    content = submitted.replace(/\r\n/g, "\n");
    if (content.trim().length < 20 || content.length > 60_000) throw new Error("The policy text is empty or too long.");
  }
  const p = { ...stored, content };
  const def = policyById(p.policyType);
  const db = await getDb();
  const now = new Date();

  const approvedText = `${p.content.trim()}\n\n---\nApproved by ${ctx.userName} on ${now.toISOString().slice(0, 10)} · version ${p.version} · ${ctx.tenantName}\n`;
  const buf = Buffer.from(approvedText, "utf8");
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const storageKey = path.posix.join(ctx.tenantId, `${randomUUID()}.md`);
  const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  await mkdir(path.join(root, ctx.tenantId), { recursive: true });
  await writeFile(path.join(root, storageKey), buf, { mode: 0o600 });

  // Controls this policy supports, in the assessments this workspace actually has.
  const targets = def?.controls.length
    ? await db
        .select({ assessmentId: schema.controlResponses.assessmentId, controlId: schema.controlResponses.controlId })
        .from(schema.controlResponses)
        .where(and(eq(schema.controlResponses.tenantId, ctx.tenantId), inArray(schema.controlResponses.controlId, def.controls)))
    : [];

  const fileName = `${p.title.replace(/[^\w\- ]/g, "").replace(/\s+/g, "-")}-v${p.version}.md`;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.policies)
      .set({ status: "superseded", updatedAt: now })
      .where(and(eq(schema.policies.tenantId, ctx.tenantId), eq(schema.policies.policyType, p.policyType), eq(schema.policies.status, "approved")));
    await tx
      .update(schema.policies)
      .set({ status: "approved", approvedBy: ctx.userId, approvedAt: now, updatedAt: now, content: approvedText, fileKey: storageKey, fileSha256: sha256, fileSize: buf.length })
      .where(eq(schema.policies.id, id));
    if (targets.length) {
      await tx.insert(schema.evidence).values(
        targets.map((t) => ({
          tenantId: ctx.tenantId,
          assessmentId: t.assessmentId,
          controlId: t.controlId,
          fileName,
          storageKey,
          mimeType: "text/markdown",
          sizeBytes: buf.length,
          sha256,
          description: `Approved policy: ${p.title} v${p.version}`,
          uploadedBy: ctx.userId,
        })),
      );
    }
  });
  await audit(ctx.tenantId, ctx.userId, "policy.approved", "policy", id, {
    policyType: p.policyType,
    version: p.version,
    source: p.source,
    filedAgainst: targets.map((t) => t.controlId),
  });
  revalidatePath("/app/policies");
  revalidatePath("/app/evidence");
  redirect(`/app/policies/${id}`);
}

export async function newVersion(form: FormData) {
  const ctx = await requireWriter();
  const id = z.string().uuid().parse(form.get("policyId"));
  const p = await ownPolicy(ctx, id);
  const db = await getDb();
  const [{ v }] = await db
    .select({ v: max(schema.policies.version) })
    .from(schema.policies)
    .where(and(eq(schema.policies.tenantId, ctx.tenantId), eq(schema.policies.policyType, p.policyType)));
  const content = p.content.replace(/\n---\nApproved by [^\n]*\n?$/, "").trim();
  const [row] = await db
    .insert(schema.policies)
    .values({
      tenantId: ctx.tenantId,
      policyType: p.policyType,
      title: p.title,
      version: (v ?? 0) + 1,
      content,
      source: "edit",
      inputs: p.inputs,
      createdBy: ctx.userId,
    })
    .returning({ id: schema.policies.id });
  await audit(ctx.tenantId, ctx.userId, "policy.new_version", "policy", row.id, { from: id });
  redirect(`/app/policies/${row.id}`);
}
