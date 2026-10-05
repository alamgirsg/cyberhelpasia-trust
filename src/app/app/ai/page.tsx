import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { RATING_BADGE, RATING_LABEL } from "@/lib/ai-risk";
import { effectiveRating, reviewDue } from "@/lib/ai-review";
import { openAiAssessment } from "@/app/actions/ai";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "AI Assurance" };

const STATUS: Record<string, string> = { proposed: "Proposed", pilot: "Pilot", production: "In production", retired: "Retired" };

export default async function AiPage() {
  const ctx = await requireCtx();
  const db = await getDb();
  const systems = await db.select().from(schema.aiSystems).where(eq(schema.aiSystems.tenantId, ctx.tenantId)).orderBy(desc(schema.aiSystems.updatedAt));
  const [govAssessment] = await db
    .select({ id: schema.assessments.id })
    .from(schema.assessments)
    .where(and(eq(schema.assessments.tenantId, ctx.tenantId), eq(schema.assessments.frameworkId, "AIGOV")))
    .limit(1);

  const active = systems.filter((s) => s.status !== "retired");
  const counts = { high: 0, medium: 0, low: 0 };
  let overdue = 0;
  for (const s of active) {
    const r = effectiveRating(s);
    counts[r]++;
    if (reviewDue(s.lastReviewedAt, r).overdue) overdue++;
  }
  const canWrite = ctx.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="AI Assurance"
        sub="Inventory every AI system, rate its risk, and close the governance gaps regulators and boards ask about."
        action={
          <div className="flex flex-wrap gap-2">
            {systems.length > 0 && <a href="/api/ai/inventory" className="btn-ghost" download>Export CSV</a>}
            {canWrite && <Link href="/app/ai/new" className="btn-primary">Add AI system</Link>}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4" data-testid="ai-summary">
        {(["high", "medium", "low"] as const).map((r) => (
          <div key={r} className="card p-5">
            <div className="text-3xl font-bold">{counts[r]}</div>
            <div className="text-sm text-muted">{RATING_LABEL[r]} risk</div>
          </div>
        ))}
        <div className="card p-5">
          <div className={`text-3xl font-bold ${overdue ? "text-bad" : ""}`}>{overdue}</div>
          <div className="text-sm text-muted">Reviews overdue</div>
        </div>
      </div>

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-xl text-sm">
          <p className="font-semibold">AI governance assessment</p>
          <p className="mt-1 text-ink-2">15 controls on oversight, inventory and risk rating, testing and red-teaming, agent safeguards, monitoring and skills. Gaps become remediation tasks.</p>
        </div>
        {govAssessment ? (
          <Link href={`/app/assessments/${govAssessment.id}`} className="btn-ghost">Open assessment</Link>
        ) : (
          canWrite && <form action={openAiAssessment}><button className="btn-primary">Start assessment</button></form>
        )}
      </div>

      {systems.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-2">
          No AI systems recorded yet. Start with the ones staff already use: chat assistants, copilots, chatbots and any agents.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted"><th className="p-3">AI system</th><th className="p-3">Status</th><th className="p-3">Risk</th><th className="p-3">Next review</th></tr>
            </thead>
            <tbody>
              {systems.map((s) => {
                const r = effectiveRating(s);
                const rv = reviewDue(s.lastReviewedAt, r);
                return (
                  <tr key={s.id} className="border-b border-line last:border-0" data-testid={`ai-row-${s.name}`}>
                    <td className="p-3">
                      <Link href={`/app/ai/${s.id}`} className="font-medium text-brand-2 hover:underline">{s.name}</Link>
                      <div className="text-xs text-muted">{[s.vendor, s.businessOwner].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="p-3">{STATUS[s.status]}</td>
                    <td className="p-3">
                      <Badge kind={RATING_BADGE[r]}>{RATING_LABEL[r]}</Badge>
                      {s.overrideRating && <span className="ml-1 text-xs text-muted">(override)</span>}
                    </td>
                    <td className={`p-3 text-xs ${rv.overdue && s.status !== "retired" ? "font-semibold text-bad" : "text-muted"}`}>
                      {s.status === "retired" ? "—" : `${rv.due.toLocaleDateString("en-SG")}${rv.overdue ? " (overdue)" : ""}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Ratings use CyberHELP&apos;s explainable heuristic (impact, autonomy, tools, data, outside input, scale). They support, not replace,
        your own risk judgement; owners and admins can override with a written reason.
      </p>
    </div>
  );
}
