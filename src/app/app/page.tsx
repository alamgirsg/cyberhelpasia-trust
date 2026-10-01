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
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold">Start your first readiness check</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">Five quick questions, then a guided gap assessment. Most teams finish the first pass in under an hour.</p>
          <Link href="/app/start" className="btn-primary mt-6">Start now</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" sub={ctx.tenantName} action={<Link href="/app/start" className="btn-ghost">New assessment</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Assessments" value={assessments.length} />
        <Stat label="Open remediation tasks" value={open?.n ?? 0} href="/app/tasks" />
        <Stat label="Evidence files" value={ev?.n ?? 0} href="/app/evidence" />
      </div>
      <div className="space-y-4">
        {assessments.map((a) => (
          <Link key={a.id} href={`/app/assessments/${a.id}`} className="card flex flex-col gap-6 p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center">
            <ScoreRing value={a.score.overall} label="ready" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{a.name}</h2>
              <p className="text-sm text-muted">
                {a.score.answered} of {a.score.total} controls answered · started {a.createdAt.toLocaleDateString("en-SG")}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Progress by domain (lowest first)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {weakest(a.score.byDomain).map((d) => (
                  <div key={d.domain}>
                    <div className="mb-1 flex justify-between text-xs"><span className="truncate pr-2 text-ink-2">{d.domain}</span><span>{d.score}%</span></div>
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
    <div className="card p-5">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
