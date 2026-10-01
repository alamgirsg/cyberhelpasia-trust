import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { getAssessment } from "@/lib/queries";
import { saveResponse, deleteAssessment } from "@/app/actions/assessments";
import { STATUS_LABEL } from "@/lib/score";
import { recommend, type Profile } from "@/lib/profile";
import { RESPONSE_STATUSES } from "@/db/schema";
import { Badge, Bar, PageHeader, ScoreRing } from "@/components/ui";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  const data = await getAssessment(ctx.tenantId, id);
  if (!data) notFound();
  const { assessment, items, evidenceCount, score } = data;
  const canWrite = ctx.role !== "viewer";

  const profile = assessment.profile as (Profile & { recommended?: string }) | null;
  const rec = profile ? recommend(profile) : null;

  const groups = new Map<string, typeof items>();
  for (const it of items) groups.set(it.domain, [...(groups.get(it.domain) ?? []), it]);

  return (
    <div>
      <PageHeader
        title={assessment.name}
        sub={`${score.answered} of ${score.total} controls answered`}
        action={
          <div className="flex gap-2">
            <Link href={`/app/assessments/${id}/report`} className="btn-ghost">Readiness report</Link>
          </div>
        }
      />

      <div className="card mb-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <ScoreRing value={score.overall} label="ready" />
        <div className="flex-1 text-sm text-ink-2">
          {rec && (
            <>
              <p className="font-medium text-ink">
                Recommended: {rec.frameworkId === "CTM" ? "Cyber Trust" : "Cyber Essentials"}
                {profile?.recommended && profile.recommended !== assessment.frameworkId ? " (you chose a different mark)" : ""}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {rec.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-muted">Score: Met = 100%, Partially met = 50%, Not applicable excluded.</p>
        </div>
      </div>

      <div className="space-y-8">
        {[...groups.entries()].map(([domain, list]) => {
          const d = score.byDomain.find((x) => x.domain === domain);
          return (
            <section key={domain}>
              <div className="mb-3 flex items-center gap-4">
                <h2 className="text-base font-semibold">{domain}</h2>
                <div className="w-32"><Bar value={d?.score ?? 0} /></div>
                <span className="text-xs text-muted">{d?.score ?? 0}%</span>
              </div>
              <div className="space-y-3">
                {list.map((c) => (
                  <details key={c.controlId} className="card group p-0">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                      <span className="mt-0.5 font-mono text-xs text-muted">{c.controlId}</span>
                      <span className="flex-1 font-medium">{c.title}</span>
                      {(evidenceCount.get(c.controlId) ?? 0) > 0 && (
                        <span className="text-xs text-muted">{evidenceCount.get(c.controlId)} file(s)</span>
                      )}
                      <Badge kind={c.status}>{STATUS_LABEL[c.status]}</Badge>
                    </summary>
                    <div className="border-t border-line p-4 text-sm">
                      <p className="text-ink-2">{c.guidance}</p>
                      <p className="mt-2"><span className="font-medium">Evidence auditors look for:</span> <span className="text-ink-2">{c.evidenceHint}</span></p>
                      {c.isoRefs && <p className="mt-1 text-xs text-muted">ISO/IEC 27001:2022 (indicative): {c.isoRefs}</p>}
                      {canWrite ? (
                        <form action={saveResponse} className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-start">
                          <input type="hidden" name="assessmentId" value={id} />
                          <input type="hidden" name="controlId" value={c.controlId} />
                          <select name="status" defaultValue={c.status} className="input" aria-label="Status">
                            {RESPONSE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                          <textarea name="notes" defaultValue={c.notes ?? ""} rows={2} placeholder="What is in place today? Any gaps?" className="input" aria-label="Notes" />
                          <button className="btn-primary">Save</button>
                        </form>
                      ) : (
                        c.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-paper p-3">{c.notes}</p>
                      )}
                      {canWrite && (
                        <Link href={`/app/evidence?assessment=${id}&control=${c.controlId}`} className="mt-3 inline-block text-xs font-semibold text-brand-2 hover:underline">
                          + Add evidence for {c.controlId}
                        </Link>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {(ctx.role === "owner" || ctx.role === "admin") && (
        <form action={deleteAssessment} className="mt-12 border-t border-line pt-6">
          <input type="hidden" name="assessmentId" value={id} />
          <button className="text-xs font-semibold text-bad hover:underline">Delete this assessment</button>
        </form>
      )}
    </div>
  );
}
