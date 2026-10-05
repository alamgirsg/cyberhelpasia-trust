"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { SEVERITIES, FINDING_STATUSES } from "@/db/schema";
import { requireCtx, requireWriter, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type EngagementState = { error?: string; values?: Record<string, string> } | undefined;

async function ownSystem(ctx: Ctx, aiSystemId: string) {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(schema.aiSystems)
    .where(and(eq(schema.aiSystems.id, aiSystemId), eq(schema.aiSystems.tenantId, ctx.tenantId)))
    .limit(1);
  if (!s) throw new Error("AI system not found");
  return s;
}

async function ownEngagement(ctx: Ctx, id: string) {
  const db = await getDb();
  const [e] = await db
    .select()
    .from(schema.engagements)
    .where(and(eq(schema.engagements.id, id), eq(schema.engagements.tenantId, ctx.tenantId)))
    .limit(1);
  if (!e) throw new Error("Engagement not found");
  return e;
}

const createSchema = z.object({
  aiSystemId: z.string().uuid(),
  title: z.string().trim().min(3, "Give the engagement a title").max(160),
  scopeIn: z.string().trim().min(5, "Describe what is in scope").max(2000),
  scopeOut: z.string().trim().max(2000).optional().transform((v) => v || null),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((v) => v || null),
});

/**
 * Creating an engagement is the authorisation gate: only owners/admins, and only with an explicit
 * confirmation that they are authorised to test this system. Who confirmed and when is recorded.
 */
export async function createEngagement(_: EngagementState, form: FormData): Promise<EngagementState> {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin")
    return { error: "Only an owner or admin can authorise a red-team engagement." };
  const raw = Object.fromEntries(form) as Record<string, string>;
  if (raw.authorise !== "on")
    return { error: "You must confirm you are authorised to test this system.", values: raw };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details", values: raw };

  const sys = await ownSystem(ctx, parsed.data.aiSystemId);
  const db = await getDb();
  const [row] = await db
    .insert(schema.engagements)
    .values({
      tenantId: ctx.tenantId,
      aiSystemId: sys.id,
      title: parsed.data.title,
      scopeIn: parsed.data.scopeIn,
      scopeOut: parsed.data.scopeOut,
      startedOn: parsed.data.startedOn,
      status: "planned",
      authorisedBy: ctx.userId,
      authorisedByName: ctx.userName,
      createdBy: ctx.userId,
    })
    .returning({ id: schema.engagements.id });
  await audit(ctx.tenantId, ctx.userId, "engagement.created", "engagement", row.id, {
    aiSystemId: sys.id,
    authorisedBy: ctx.userName,
  });
  redirect(`/app/ai/${sys.id}/engagements/${row.id}`);
}

export async function setEngagementStatus(form: FormData) {
  const ctx = await requireWriter();
  const id = z.string().uuid().parse(form.get("id"));
  const status = z.enum(["planned", "in_progress"]).parse(form.get("status"));
  const e = await ownEngagement(ctx, id);
  const db = await getDb();
  await db.update(schema.engagements).set({ status, updatedAt: new Date() }).where(eq(schema.engagements.id, e.id));
  await audit(ctx.tenantId, ctx.userId, "engagement.status", "engagement", id, { status });
  revalidatePath(`/app/ai/${e.aiSystemId}/engagements/${id}`);
}

const findingSchema = z.object({
  engagementId: z.string().uuid(),
  testId: z.string().trim().max(20).optional().transform((v) => v || null),
  title: z.string().trim().min(3, "Give the finding a title").max(200),
  severity: z.enum(SEVERITIES),
  detail: z.string().trim().max(5000).optional().transform((v) => v || null),
  remediation: z.string().trim().max(5000).optional().transform((v) => v || null),
});

export async function addFinding(_: EngagementState, form: FormData): Promise<EngagementState> {
  const ctx = await requireWriter();
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = findingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the finding", values: raw };
  const e = await ownEngagement(ctx, parsed.data.engagementId);
  if (e.status === "completed") return { error: "This engagement is completed. Reopen it to add findings.", values: raw };
  const db = await getDb();

  // Optional evidence upload with the finding.
  let evidenceId: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const ALLOWED = new Map([["application/pdf", ".pdf"], ["image/png", ".png"], ["image/jpeg", ".jpg"], ["text/plain", ".txt"]]);
    const ext = ALLOWED.get(file.type);
    if (!ext) return { error: "Evidence must be PDF, PNG, JPG or TXT.", values: raw };
    if (file.size > 10 * 1024 * 1024) return { error: "Evidence must be 10 MB or smaller.", values: raw };
    const buf = Buffer.from(await file.arrayBuffer());
    const storageKey = path.posix.join(ctx.tenantId, `${randomUUID()}${ext}`);
    const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
    await mkdir(path.join(root, ctx.tenantId), { recursive: true });
    await writeFile(path.join(root, storageKey), buf, { mode: 0o600 });
    const [ev] = await db
      .insert(schema.evidence)
      .values({
        tenantId: ctx.tenantId,
        controlId: "AIG-09",
        fileName: file.name.slice(0, 200),
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256: createHash("sha256").update(buf).digest("hex"),
        description: `Red-team finding: ${parsed.data.title}`,
        uploadedBy: ctx.userId,
      })
      .returning({ id: schema.evidence.id });
    evidenceId = ev.id;
  }

  const { engagementId, ...f } = parsed.data;
  await db.insert(schema.findings).values({ tenantId: ctx.tenantId, engagementId, ...f, evidenceId, createdBy: ctx.userId });
  if (e.status === "planned") await db.update(schema.engagements).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.engagements.id, e.id));
  await audit(ctx.tenantId, ctx.userId, "finding.added", "engagement", engagementId, { severity: f.severity, testId: f.testId });
  revalidatePath(`/app/ai/${e.aiSystemId}/engagements/${engagementId}`);
  return {};
}

export async function setFindingStatus(form: FormData) {
  const ctx = await requireWriter();
  const id = z.string().uuid().parse(form.get("id"));
  const status = z.enum(FINDING_STATUSES).parse(form.get("status"));
  const db = await getDb();
  const [f] = await db
    .update(schema.findings)
    .set({ status })
    .where(and(eq(schema.findings.id, id), eq(schema.findings.tenantId, ctx.tenantId)))
    .returning({ engagementId: schema.findings.engagementId });
  if (f) {
    const e = await ownEngagement(ctx, f.engagementId);
    await audit(ctx.tenantId, ctx.userId, "finding.status", "finding", id, { status });
    revalidatePath(`/app/ai/${e.aiSystemId}/engagements/${f.engagementId}`);
  }
}

/** Completing files a Markdown report as evidence for AIG-09 across the tenant's assessments. */
export async function completeEngagement(form: FormData) {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only an owner or admin can complete an engagement.");
  const id = z.string().uuid().parse(form.get("id"));
  const e = await ownEngagement(ctx, id);
  if (e.status === "completed") redirect(`/app/ai/${e.aiSystemId}/engagements/${id}`);
  const db = await getDb();
  const [sys] = await db.select().from(schema.aiSystems).where(eq(schema.aiSystems.id, e.aiSystemId)).limit(1);
  const fs = await db.select().from(schema.findings).where(eq(schema.findings.engagementId, id)).orderBy(asc(schema.findings.createdAt));

  const now = new Date();
  const esc = (s: unknown) => String(s ?? "");
  const report = [
    `# Red-team report: ${e.title}`,
    "",
    `AI system: ${sys?.name ?? ""}`,
    `Scope (in): ${e.scopeIn}`,
    e.scopeOut ? `Scope (out): ${e.scopeOut}` : "",
    `Authorised by: ${e.authorisedByName} on ${e.authorisedAt.toISOString().slice(0, 10)}`,
    `Completed: ${now.toISOString().slice(0, 10)} by ${ctx.userName}`,
    "",
    `## Findings (${fs.length})`,
    ...(fs.length
      ? fs.flatMap((f) => [
          `### [${f.severity.toUpperCase()}] ${esc(f.title)}${f.testId ? ` (${f.testId})` : ""} — ${f.status}`,
          f.detail ? esc(f.detail) : "",
          f.remediation ? `Remediation: ${esc(f.remediation)}` : "",
          "",
        ])
      : ["No findings recorded."]),
    "---",
    "Manual red-team engagement recorded in the CyberHELP Asia Trust Platform. Not a certification.",
    "",
  ].join("\n");

  const buf = Buffer.from(report, "utf8");
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const storageKey = path.posix.join(ctx.tenantId, `${randomUUID()}.md`);
  const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  await mkdir(path.join(root, ctx.tenantId), { recursive: true });
  await writeFile(path.join(root, storageKey), buf, { mode: 0o600 });

  const targets = await db
    .select({ assessmentId: schema.controlResponses.assessmentId })
    .from(schema.controlResponses)
    .where(and(eq(schema.controlResponses.tenantId, ctx.tenantId), eq(schema.controlResponses.controlId, "AIG-09")));
  const fileName = `redteam-${e.title.replace(/[^\w\- ]/g, "").replace(/\s+/g, "-")}.md`.slice(0, 120);

  await db.transaction(async (tx) => {
    await tx.update(schema.engagements).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(schema.engagements.id, id));
    if (targets.length) {
      await tx.insert(schema.evidence).values(
        targets.map((t) => ({
          tenantId: ctx.tenantId,
          assessmentId: t.assessmentId,
          controlId: "AIG-09",
          fileName,
          storageKey,
          mimeType: "text/markdown",
          sizeBytes: buf.length,
          sha256,
          description: `Red-team report: ${e.title}`,
          uploadedBy: ctx.userId,
        })),
      );
    }
  });
  await audit(ctx.tenantId, ctx.userId, "engagement.completed", "engagement", id, { findings: fs.length, filedAgainst: targets.length });
  revalidatePath(`/app/ai/${e.aiSystemId}/engagements/${id}`);
  revalidatePath("/app/evidence");
  redirect(`/app/ai/${e.aiSystemId}/engagements/${id}`);
}

export async function reopenEngagement(form: FormData) {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only an owner or admin can reopen an engagement.");
  const id = z.string().uuid().parse(form.get("id"));
  const e = await ownEngagement(ctx, id);
  const db = await getDb();
  await db.update(schema.engagements).set({ status: "in_progress", completedAt: null, updatedAt: new Date() }).where(eq(schema.engagements.id, id));
  await audit(ctx.tenantId, ctx.userId, "engagement.reopened", "engagement", id);
  revalidatePath(`/app/ai/${e.aiSystemId}/engagements/${id}`);
}
