import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { FACTORS, RATING_LABEL, factorLabel, rateAiSystem, suggestedTests } from "@/lib/ai-risk";
import { effectiveRating, reviewDue } from "@/lib/ai-review";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(schema.aiSystems).where(eq(schema.aiSystems.tenantId, ctx.tenantId)).orderBy(asc(schema.aiSystems.name));

  const csv = toCsv(
    [
      "Name", "Description", "Business owner", "Vendor", "Model", "Status",
      ...FACTORS.map((f) => f.question),
      "Computed rating", "Override rating", "Override reason", "Effective rating", "Why (computed)",
      "Suggested tests (OWASP LLM 2025)", "Last reviewed", "Next review",
    ],
    rows.map((s) => {
      const r = effectiveRating(s);
      return [
        s.name, s.description ?? "", s.businessOwner ?? "", s.vendor ?? "", s.model ?? "", s.status,
        ...FACTORS.map((f) => factorLabel(f.key, s.factors[f.key])),
        RATING_LABEL[s.computedRating], s.overrideRating ? RATING_LABEL[s.overrideRating] : "", s.overrideReason ?? "", RATING_LABEL[r],
        rateAiSystem(s.factors).reasons.join(" "),
        suggestedTests(s.factors).map((t) => `${t.id} ${t.name}`).join("; "),
        s.lastReviewedAt.toISOString().slice(0, 10), reviewDue(s.lastReviewedAt, r).due.toISOString().slice(0, 10),
      ];
    }),
  );
  await audit(ctx.tenantId, ctx.userId, "ai_inventory.exported", "tenant", ctx.tenantId, { rows: rows.length });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-inventory_${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
