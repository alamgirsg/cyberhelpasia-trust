import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Evidence vault" };

function size(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ assessment?: string; control?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const db = await getDb();

  const assessments = await db
    .select({ id: schema.assessments.id, name: schema.assessments.name, frameworkId: schema.assessments.frameworkId })
    .from(schema.assessments)
    .where(eq(schema.assessments.tenantId, ctx.tenantId));
  const controls = await db
    .select({ id: schema.controls.id, title: schema.controls.title, frameworkId: schema.controls.frameworkId })
    .from(schema.controls)
    .orderBy(schema.controls.frameworkId, schema.controls.sortOrder);

  const files = await db
    .select({
      id: schema.evidence.id,
      fileName: schema.evidence.fileName,
      sizeBytes: schema.evidence.sizeBytes,
      sha256: schema.evidence.sha256,
      controlId: schema.evidence.controlId,
      description: schema.evidence.description,
      createdAt: schema.evidence.createdAt,
      uploader: schema.users.name,
    })
    .from(schema.evidence)
    .leftJoin(schema.users, eq(schema.users.id, schema.evidence.uploadedBy))
    .where(eq(schema.evidence.tenantId, ctx.tenantId))
    .orderBy(desc(schema.evidence.createdAt));

  const usedFrameworks = new Set(assessments.map((a) => a.frameworkId));
  const controlOptions = controls.filter((c) => usedFrameworks.has(c.frameworkId));

  return (
    <div>
      <PageHeader title="Evidence vault" sub="Files are hashed (SHA-256) on upload and every upload and download is logged." />
      {ctx.role !== "viewer" && (
        <UploadForm
          assessments={assessments.map(({ id, name }) => ({ id, name }))}
          controls={controlOptions.map(({ id, title }) => ({ id, title }))}
          defaultAssessment={sp.assessment ?? assessments[0]?.id ?? ""}
          defaultControl={sp.control ?? ""}
        />
      )}
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="p-3">File</th><th className="p-3">Control</th><th className="p-3">Uploaded</th><th className="p-3">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} className="border-b border-line last:border-0 align-top">
                <td className="p-3">
                  <a href={`/api/evidence/${f.id}`} className="font-medium text-brand-2 hover:underline">{f.fileName}</a>
                  <div className="text-xs text-muted">{size(f.sizeBytes)}{f.description ? ` · ${f.description}` : ""}</div>
                </td>
                <td className="p-3 font-mono text-xs">{f.controlId ?? "—"}</td>
                <td className="p-3 text-xs text-muted">{f.createdAt.toLocaleString("en-SG")}<br />{f.uploader ?? ""}</td>
                <td className="p-3 font-mono text-xs text-muted" title={f.sha256}>{f.sha256.slice(0, 12)}…</td>
              </tr>
            ))}
            {!files.length && (
              <tr><td colSpan={4} className="p-6 text-center text-muted">No evidence yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
