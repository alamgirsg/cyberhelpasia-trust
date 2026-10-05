import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { suggestedTests } from "@/lib/ai-risk";
import { completeEngagement, reopenEngagement, setEngagementStatus, setFindingStatus } from "@/app/actions/engagements";
import { Badge, PageHeader } from "@/components/ui";
import { FindingForm } from "./finding-form";

export const metadata = { title: "Red-team engagement" };

const SEV_BADGE: Record<string, string> = { info: "na", low: "low", medium: "medium", high: "not_met", critical: "not_met" };
const FIND_BADGE: Record<string, string> = { open: "not_met", fixed: "met", accepted: "na" };
const ENG_LABEL: Record<string, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed" };

export default async function EngagementPage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const ctx = await requireCtx();
  const { id, eid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eid)) notFound();
  const db = await getDb();
  const [e] = await db
    .select()
    .from(schema.engagements)
    .where(and(eq(schema.engagements.id, eid), eq(schema.engagements.tenantId, ctx.tenantId), eq(schema.engagements.aiSystemId, id)))
    .limit(1);
  if (!e) notFound();
  const [sys] = await db.select().from(schema.aiSystems).where(eq(schema.aiSystems.id, id)).limit(1);
  const fs = await db.select().from(schema.findings).where(eq(schema.findings.engagementId, eid)).orderBy(asc(schema.findings.createdAt));

  const canWrite = ctx.role !== "viewer";
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const done = e.status === "completed";
  const checklist = sys ? suggestedTests(sys.factors) : [];
  const covered = new Set(fs.map((f) => f.testId).filter(Boolean));

  return (
    <div className="max-w-3xl">
      <Link href={`/app/ai/${id}`} className="text-sm text-brand-2 hover:underline">← {sys?.name}</Link>
      <PageHeader title={e.title} action={<Badge kind={done ? "met" : "partial"}>{ENG_LABEL[e.status]}</Badge>} />

      <div className="card mb-6 space-y-2 p-6 text-sm">
        <p><span className="font-medium">In scope:</span> {e.scopeIn}</p>
        {e.scopeOut && <p><span className="font-medium">Out of scope:</span> {e.scopeOut}</p>}
        <p className="text-ink-2" data-testid="authorisation">
          Authorised by <span className="font-medium">{e.authorisedByName}</span> on {e.authorisedAt.toLocaleDateString("en-SG")}
          {e.completedAt && ` · completed ${e.completedAt.toLocaleDateString("en-SG")}`}
        </p>
      </div>

      {checklist.length > 0 && (
        <div className="card mb-6 p-6">
          <h2 className="font-semibold">Suggested test checklist</h2>
          <p className="mt-1 text-sm text-muted">From this system&apos;s risk profile (OWASP Top 10 for LLM Applications 2025). A tick means a finding is recorded against it.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {checklist.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className={covered.has(t.id) ? "text-accent" : "text-muted"}>{covered.has(t.id) ? "☑" : "☐"}</span>
                <span className="font-mono text-xs text-muted">{t.id}</span> {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-semibold">Findings ({fs.length})</h2>
        </div>
        {fs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No findings recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {fs.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0 align-top" data-testid={`finding-${f.title}`}>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge kind={SEV_BADGE[f.severity]}>{f.severity.toUpperCase()}</Badge>
                      {f.testId && <span className="font-mono text-xs text-muted">{f.testId}</span>}
                      <span className="font-medium">{f.title}</span>
                    </div>
                    {f.detail && <p className="mt-1 text-ink-2">{f.detail}</p>}
                    {f.remediation && <p className="mt-1 text-xs text-ink-2"><span className="font-medium">Fix:</span> {f.remediation}</p>}
                    {f.evidenceId && <a href={`/api/evidence/${f.evidenceId}`} className="mt-1 inline-block text-xs font-semibold text-brand-2 hover:underline" download>Evidence</a>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <Badge kind={FIND_BADGE[f.status]}>{f.status}</Badge>
                    {canWrite && !done && (
                      <form action={setFindingStatus} className="mt-2 flex items-center gap-1">
                        <input type="hidden" name="id" value={f.id} />
                        <select name="status" defaultValue={f.status} className="input w-auto py-1 text-xs" aria-label="Finding status">
                          {["open", "fixed", "accepted"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button className="text-xs font-semibold text-brand-2 hover:underline">Set</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canWrite && !done && <FindingForm engagementId={eid} suggested={checklist} />}

      {canManage && (
        <div className="mt-6 flex flex-wrap gap-2">
          {e.status === "planned" && (
            <form action={setEngagementStatus}><input type="hidden" name="id" value={eid} /><input type="hidden" name="status" value="in_progress" /><button className="btn-ghost">Mark in progress</button></form>
          )}
          {!done ? (
            <form action={completeEngagement}><input type="hidden" name="id" value={eid} /><button className="btn-primary">Complete &amp; file report as evidence</button></form>
          ) : (
            <form action={reopenEngagement}><input type="hidden" name="id" value={eid} /><button className="btn-ghost">Reopen</button></form>
          )}
        </div>
      )}
      {done && <p className="mt-3 text-sm text-accent">Report filed as evidence for control AIG-09 in your AI governance assessment.</p>}
    </div>
  );
}
