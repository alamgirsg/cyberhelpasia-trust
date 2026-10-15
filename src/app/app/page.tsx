import Link from "next/link";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { listAssessments } from "@/lib/queries";
import { Bar, PageHeader, ScoreRing } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const ctx = await requireCtx();
  const assessments = await listAssessments(ctx.tenantId);
  const db = await getDb();
  const [open] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.tenantId, ctx.tenantId), ne(schema.tasks.status, "done")));
  const [ev] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.evidence).where(eq(schema.evidence.tenantId, ctx.tenantId));

  if (!assessments.length) {
    return (
      <div>
        <PageHeader title={`Welcome, ${ctx.userName.split(" ")[0]}`} sub="Let's find out which mark fits you and where you stand." />
        <div className="card overflow-hidden">
          <div className="guilloche px-8 py-10 text-center" style={{ background: "var(--color-field)" }}>
            <h2 className="text-xl font-bold text-white">Start your first readiness check</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/75">
              Five quick questions, then a guided gap assessment. Most teams finish the first pass in under an hour.
            </p>
            <Link href="/app/start" className="mt-7 inline-flex rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
              Start now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" sub={ctx.tenantName} action={<Link href="/app/start" className="btn-ghost">New assessment</Link>} />
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <Stat label="Assessments" value={assessments.length} />
        <Stat label="Open remediation tasks" value={open?.n ?? 0} href="/app/tasks" />
        <Stat label="Evidence files" value={ev?.n ?? 0} href="/app/evidence" />
      </div>
      <div className="space-y-4">
        {assessments.map((a) => (
          <Link key={a.id} href={`/app/assessments/${a.id}`} className="card group flex flex-col gap-6 p-6 transition hover:border-[#b9c6d6] sm:flex-row sm:items-center">
            <ScoreRing value={a.score.overall} label="ready" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight">{a.name}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {a.score.answered} of {a.score.total} controls answered · started {a.createdAt.toLocaleDateString("en-SG")}
              </p>
              <p className="mt-5 text-xs font-semibold text-muted">Weakest domains first</p>
              <div className="mt-2.5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {weakest(a.score.byDomain).map((d) => (
                  <div key={d.domain}>
                    <div className="mb-1 flex justify-between text-xs"><span className="truncate pr-2 text-ink-2">{d.domain}</span><span className="tnum font-semibold">{d.score}%</span></div>
                    <Bar value={d.score} />
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Answered domains with the lowest score first, then unanswered ones. */
function weakest<T extends { score: number; answered: number }>(domains: T[]) {
  return [...domains].sort((x, y) => (y.answered > 0 ? 1 : 0) - (x.answered > 0 ? 1 : 0) || x.score - y.score).slice(0, 6);
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <div className={`card p-5 transition ${href ? "hover:border-[#b9c6d6]" : ""}`}>
      <div className="font-display tnum text-[2.5rem] font-bold leading-none">{value}</div>
      <div className="mt-2 text-sm text-ink-2">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
