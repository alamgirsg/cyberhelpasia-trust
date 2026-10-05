"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { AI_STATUSES, RISK_RATINGS } from "@/db/schema";
import { requireCtx, requireWriter, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { FACTOR_KEYS, rateAiSystem, validFactors } from "@/lib/ai-risk";

export type AiFormState = { error?: string; values?: Record<string, string> } | undefined;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const baseSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2, "Give the AI system a name").max(120),
  description: text(1000),
  businessOwner: text(120),
  vendor: text(120),
  model: text(120),
  status: z.enum(AI_STATUSES),
});

async function own(ctx: Ctx, id: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.aiSystems)
    .where(and(eq(schema.aiSystems.id, id), eq(schema.aiSystems.tenantId, ctx.tenantId)))
    .limit(1);
  if (!row) throw new Error("AI system not found");
  return row;
}

export async function saveAiSystem(_: AiFormState, form: FormData): Promise<AiFormState> {
  const ctx = await requireWriter();
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details", values: raw };
  const factors = Object.fromEntries(FACTOR_KEYS.map((k) => [k, raw[k]]));
  if (!validFactors(factors)) return { error: "Answer every risk question.", values: raw };

  const { id, ...fields } = parsed.data;
  const risk = rateAiSystem(factors);
  const db = await getDb();
  const now = new Date();

  if (id) {
    const before = await own(ctx, id);
    // If the answers change the computed rating, an earlier override no longer applies.
    const clearOverride = before.overrideRating !== null && before.computedRating !== risk.rating;
    await db
      .update(schema.aiSystems)
      .set({
        ...fields,
        factors,
        computedRating: risk.rating,
        updatedAt: now,
        lastReviewedAt: now,
        ...(clearOverride ? { overrideRating: null, overrideReason: null } : {}),
      })
      .where(eq(schema.aiSystems.id, id));
    await audit(ctx.tenantId, ctx.userId, "ai_system.updated", "ai_system", id, {
      from: before.computedRating,
      to: risk.rating,
      overrideCleared: clearOverride,
    });
    revalidatePath(`/app/ai/${id}`);
    revalidatePath("/app/ai");
    redirect(`/app/ai/${id}`);
  }

  const [row] = await db
    .insert(schema.aiSystems)
    .values({ tenantId: ctx.tenantId, ...fields, factors, computedRating: risk.rating, createdBy: ctx.userId })
    .returning({ id: schema.aiSystems.id });
  await audit(ctx.tenantId, ctx.userId, "ai_system.created", "ai_system", row.id, { rating: risk.rating });
  revalidatePath("/app/ai");
  redirect(`/app/ai/${row.id}`);
}

export type OverrideState = { error?: string; ok?: string; values?: { rating: string; reason: string } } | undefined;

export async function setOverride(_: OverrideState, form: FormData): Promise<OverrideState> {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin") return { error: "Only owners and admins can override a risk rating." };
  const id = z.string().uuid().parse(form.get("id"));
  const sys = await own(ctx, id);
  const db = await getDb();

  if (form.get("clear") === "1") {
    await db.update(schema.aiSystems).set({ overrideRating: null, overrideReason: null, updatedAt: new Date() }).where(eq(schema.aiSystems.id, id));
    await audit(ctx.tenantId, ctx.userId, "ai_system.override_cleared", "ai_system", id);
    revalidatePath(`/app/ai/${id}`);
    revalidatePath("/app/ai");
    return { ok: "Override removed." };
  }

  const parsed = z
    .object({ rating: z.enum(RISK_RATINGS), reason: z.string().trim().min(20, "Explain the override in at least 20 characters.").max(1000) })
    .safeParse({ rating: form.get("rating"), reason: form.get("reason") });
  const values = { rating: String(form.get("rating") ?? ""), reason: String(form.get("reason") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  if (parsed.data.rating === sys.computedRating) return { error: "That is already the computed rating; no override needed.", values };

  await db
    .update(schema.aiSystems)
    .set({ overrideRating: parsed.data.rating, overrideReason: parsed.data.reason, updatedAt: new Date() })
    .where(eq(schema.aiSystems.id, id));
  await audit(ctx.tenantId, ctx.userId, "ai_system.override_set", "ai_system", id, {
    computed: sys.computedRating,
    override: parsed.data.rating,
    reason: parsed.data.reason,
  });
  revalidatePath(`/app/ai/${id}`);
  revalidatePath("/app/ai");
  return { ok: "Override saved." };
}

export async function markReviewed(form: FormData) {
  const ctx = await requireWriter();
  const id = z.string().uuid().parse(form.get("id"));
  await own(ctx, id);
  const db = await getDb();
  await db.update(schema.aiSystems).set({ lastReviewedAt: new Date() }).where(eq(schema.aiSystems.id, id));
  await audit(ctx.tenantId, ctx.userId, "ai_system.reviewed", "ai_system", id);
  revalidatePath(`/app/ai/${id}`);
  revalidatePath("/app/ai");
}

/** Opens the workspace's AI governance assessment, creating it on first use. */
export async function openAiAssessment() {
  const ctx = await requireWriter();
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.assessments.id })
    .from(schema.assessments)
    .where(and(eq(schema.assessments.tenantId, ctx.tenantId), eq(schema.assessments.frameworkId, "AIGOV")))
    .limit(1);
  if (existing) redirect(`/app/assessments/${existing.id}`);

  const [fw] = await db.select().from(schema.frameworks).where(eq(schema.frameworks.id, "AIGOV")).limit(1);
  if (!fw) throw new Error("AI governance controls are not loaded. Run the seed script.");
  const ctrls = await db.select({ id: schema.controls.id }).from(schema.controls).where(eq(schema.controls.frameworkId, "AIGOV"));
  const id = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(schema.assessments)
      .values({ tenantId: ctx.tenantId, frameworkId: "AIGOV", name: fw.name })
      .returning({ id: schema.assessments.id });
    await tx.insert(schema.controlResponses).values(ctrls.map((c) => ({ tenantId: ctx.tenantId, assessmentId: a.id, controlId: c.id })));
    return a.id;
  });
  await audit(ctx.tenantId, ctx.userId, "assessment.created", "assessment", id, { frameworkId: "AIGOV" });
  redirect(`/app/assessments/${id}`);
}
