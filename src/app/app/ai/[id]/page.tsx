import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { FACTORS, RATING_BADGE, RATING_LABEL, factorLabel, rateAiSystem, suggestedTests } from "@/lib/ai-risk";
import { effectiveRating, reviewDue } from "@/lib/ai-review";
import { markReviewed } from "@/app/actions/ai";
import { Badge, PageHeader } from "@/components/ui";
import { AiForm } from "../ai-form";
import { OverrideForm } from "./override-form";

export const metadata = { title: "AI system" };

export default async function AiSystemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [s] = await db
    .select()
    .from(schema.aiSystems)
    .where(and(eq(schema.aiSystems.id, id), eq(schema.aiSystems.tenantId, ctx.tenantId)))
    .limit(1);
  if (!s) notFound();

  const canWrite = ctx.role !== "viewer";
  const canOverride = ctx.role === "owner" || ctx.role === "admin";
  const risk = rateAiSystem(s.factors);
  const rating = effectiveRating(s);
  const rv = reviewDue(s.lastReviewedAt, rating);
  const tests = suggestedTests(s.factors);

  if (edit === "1" && canWrite) {
    return (
      <div className="max-w-3xl">
        <Link href={`/app/ai/${id}`} className="text-sm text-brand-2 hover:underline">← Back</Link>
        <PageHeader title={`Edit: ${s.name}`} />
        <AiForm
          initial={{ id: s.id, name: s.name, description: s.description, businessOwner: s.businessOwner, vendor: s.vendor, model: s.model, status: s.status, factors: s.factors }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/app/ai" className="text-sm text-brand-2 hover:underline">← AI inventory</Link>
      <PageHeader
        title={s.name}
        sub={[s.vendor, s.model, s.businessOwner && `Owner: ${s.businessOwner}`].filter(Boolean).join(" · ") || undefined}
        action={canWrite ? <Link href={`/app/ai/${id}?edit=1`} className="btn-ghost">Edit</Link> : undefined}
      />
      {s.description && <p className="-mt-3 mb-6 text-sm text-ink-2">{s.description}</p>}

      <div className="card mb-6 p-6" data-testid="risk-card">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Risk rating</h2>
          <Badge kind={RATING_BADGE[rating]}>{RATING_LABEL[rating]}</Badge>
          {s.overrideRating && <span className="text-xs text-muted">Overridden from {RATING_LABEL[s.computedRating]}</span>}
        </div>
        {s.overrideRating && (
          <p className="mt-2 rounded-lg bg-paper p-3 text-sm" data-testid="override-reason"><span className="font-medium">Override reason:</span> {s.overrideReason}</p>
        )}
        <p className="mt-3 text-sm font-medium">Why the computed rating is {RATING_LABEL[s.computedRating]}:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {FACTORS.map((f) => (
            <div key={f.key} className="flex gap-2"><dt className="text-muted">{f.question}</dt><dd className="font-medium">{factorLabel(f.key, s.factors[f.key])}</dd></div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
          <span className={rv.overdue ? "font-semibold text-bad" : "text-muted"}>
            Last reviewed {s.lastReviewedAt.toLocaleDateString("en-SG")} · next review {rv.due.toLocaleDateString("en-SG")}{rv.overdue ? " (overdue)" : ""}
          </span>
          {canWrite && (
            <form action={markReviewed}>
              <input type="hidden" name="id" value={id} />
              <button className="text-xs font-semibold text-brand-2 hover:underline">Mark reviewed today</button>
            </form>
          )}
        </div>
      </div>

      {canOverride && <OverrideForm id={id} hasOverride={Boolean(s.overrideRating)} computed={s.computedRating} />}

      <div className="card p-6" data-testid="suggested-tests">
        <h2 className="text-lg font-semibold">What to test</h2>
        <p className="mt-1 text-sm text-ink-2">Areas from the OWASP Top 10 for LLM Applications (2025) that fit how this system is used.</p>
        {tests.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {tests.map((t) => (
              <li key={t.id} className="flex gap-3"><span className="w-14 shrink-0 font-mono text-xs text-muted">{t.id}</span><span><span className="font-medium">{t.name}</span> — {t.why}</span></li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No specific LLM security tests suggested for this profile.</p>
        )}
        <p className="mt-4 text-xs text-muted">Automated red-team runs against verified endpoints are the next phase of AI Assurance.</p>
      </div>
    </div>
  );
}
