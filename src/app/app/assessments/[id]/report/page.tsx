import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { getAssessment } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/score";
import { PrintButton } from "./print-button";

export const metadata = { title: "Readiness report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  const data = await getAssessment(ctx.tenantId, id);
  if (!data) notFound();
  const { assessment, items, evidenceCount, score } = data;
  const gaps = items.filter((i) => i.status === "not_met" || i.status === "partial");

  return (
    <article className="mx-auto max-w-3xl bg-white p-8 text-sm print:p-0">
      <div className="no-print mb-6 flex justify-end gap-2">
        <a href={`/api/assessments/${id}/export`} className="btn-ghost" download>Download auditor pack (ZIP)</a>
        <PrintButton />
      </div>
      <header className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-wider text-muted">Readiness report · CyberHELP Asia Trust Platform</p>
        <h1 className="mt-1 text-2xl font-bold">{ctx.tenantName}</h1>
        <p className="text-ink-2">{assessment.name} · generated {new Date().toLocaleDateString("en-SG", { dateStyle: "long" })}</p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <div><div className="text-3xl font-bold">{score.overall}%</div><div className="text-muted">Overall readiness</div></div>
        <div><div className="text-3xl font-bold">{score.answered}/{score.total}</div><div className="text-muted">Controls assessed</div></div>
        <div><div className="text-3xl font-bold">{gaps.length}</div><div className="text-muted">Open gaps</div></div>
      </section>

      <h2 className="mt-8 text-base font-semibold">Readiness by domain</h2>
      <table className="mt-2 w-full border-collapse">
        <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Domain</th><th className="py-2 text-right">Met</th><th className="py-2 text-right">Score</th></tr></thead>
        <tbody>
          {score.byDomain.map((d) => (
            <tr key={d.domain} className="border-b border-line"><td className="py-1.5">{d.domain}</td><td className="py-1.5 text-right">{d.met}/{d.total}</td><td className="py-1.5 text-right font-medium">{d.score}%</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8 text-base font-semibold">Control status</h2>
      <table className="mt-2 w-full border-collapse">
        <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 pr-2">ID</th><th className="py-2 pr-2">Control</th><th className="py-2 pr-2">Status</th><th className="py-2 text-right">Evidence</th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.controlId} className="border-b border-line align-top">
              <td className="py-1.5 pr-2 font-mono text-xs">{c.controlId}</td>
              <td className="py-1.5 pr-2">{c.title}{c.notes && <div className="text-xs text-muted">{c.notes}</div>}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap">{STATUS_LABEL[c.status]}</td>
              <td className="py-1.5 text-right">{evidenceCount.get(c.controlId) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-muted">
        This report reflects the organisation&apos;s self-assessment in the CyberHELP Asia Trust Platform. It is not a certification.
        Cyber Essentials and Cyber Trust marks are awarded only by CSA-appointed certification bodies.
      </p>
    </article>
  );
}
