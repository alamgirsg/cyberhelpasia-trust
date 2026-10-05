import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { getDb, schema } from "@/db";
import { getAssessment } from "./queries";
import { STATUS_LABEL } from "./score";
import { toCsv } from "./csv";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Safe name inside the ZIP: no path separators, no traversal, bounded length. */
function safeName(name: string): string {
  const base = name.replace(/[\\/]/g, "_").replace(/[^\w.\- ()]/g, "_").replace(/^\.+/, "_").trim();
  return (base || "file").slice(0, 120);
}

export type PackResult = { zip: Uint8Array; fileName: string; evidenceCount: number; integrityFailures: number };

/**
 * Builds the auditor pack for one assessment. Everything is filtered by tenantId.
 * Each evidence file is re-hashed on export and compared with the hash stored at upload,
 * so tampering with stored files shows up as INTEGRITY FAILURE in the manifest.
 */
export async function buildAuditorPack(tenantId: string, tenantName: string, assessmentId: string, generatedBy: string): Promise<PackResult | null> {
  const data = await getAssessment(tenantId, assessmentId);
  if (!data) return null;
  const { assessment, items, score, refLabel } = data;
  const db = await getDb();

  const evidence = await db
    .select({
      id: schema.evidence.id,
      controlId: schema.evidence.controlId,
      fileName: schema.evidence.fileName,
      storageKey: schema.evidence.storageKey,
      sizeBytes: schema.evidence.sizeBytes,
      sha256: schema.evidence.sha256,
      description: schema.evidence.description,
      createdAt: schema.evidence.createdAt,
      uploader: schema.users.name,
    })
    .from(schema.evidence)
    .leftJoin(schema.users, eq(schema.users.id, schema.evidence.uploadedBy))
    .where(and(eq(schema.evidence.tenantId, tenantId), eq(schema.evidence.assessmentId, assessmentId)))
    .orderBy(asc(schema.evidence.controlId), asc(schema.evidence.createdAt));

  const tasks = await db
    .select({
      controlId: schema.tasks.controlId,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      dueDate: schema.tasks.dueDate,
      assignee: schema.users.name,
    })
    .from(schema.tasks)
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(and(eq(schema.tasks.tenantId, tenantId), eq(schema.tasks.assessmentId, assessmentId)))
    .orderBy(asc(schema.tasks.controlId));

  const audit = await db
    .select({
      at: schema.auditEvents.createdAt,
      actor: schema.users.name,
      action: schema.auditEvents.action,
      objectType: schema.auditEvents.objectType,
      objectId: schema.auditEvents.objectId,
      detail: schema.auditEvents.detail,
    })
    .from(schema.auditEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditEvents.actorId))
    .where(eq(schema.auditEvents.tenantId, tenantId))
    .orderBy(asc(schema.auditEvents.createdAt));

  const files: Record<string, Uint8Array> = {};
  const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  const manifest: unknown[][] = [];
  const evidenceByControl = new Map<string, string[]>();
  let integrityFailures = 0;
  const used = new Set<string>();

  for (const ev of evidence) {
    const folder = ev.controlId ? safeName(ev.controlId) : "general";
    let zipPath = `evidence/${folder}/${safeName(ev.fileName)}`;
    for (let i = 2; used.has(zipPath); i++) zipPath = `evidence/${folder}/${i}-${safeName(ev.fileName)}`;
    used.add(zipPath);

    let status = "OK";
    const full = path.resolve(root, ev.storageKey);
    if (!full.startsWith(root + path.sep)) {
      status = "MISSING";
    } else {
      try {
        const buf = await readFile(full);
        if (createHash("sha256").update(buf).digest("hex") !== ev.sha256) status = "INTEGRITY FAILURE";
        files[zipPath] = new Uint8Array(buf);
      } catch {
        status = "MISSING";
      }
    }
    if (status !== "OK") integrityFailures++;
    manifest.push([zipPath, ev.controlId ?? "", ev.sizeBytes, ev.sha256, status, ev.uploader ?? "", ev.createdAt, ev.description ?? ""]);
    if (ev.controlId) evidenceByControl.set(ev.controlId, [...(evidenceByControl.get(ev.controlId) ?? []), zipPath]);
  }

  const generatedAt = new Date();
  files["controls.csv"] = strToU8(
    toCsv(
      ["Control ID", "Domain", "Control", "Status", "Notes", "Last updated", "Evidence files", refLabel],
      items.map((c) => [
        c.controlId,
        c.domain,
        c.title,
        STATUS_LABEL[c.status],
        c.notes ?? "",
        c.status === "not_started" ? "" : c.updatedAt,
        (evidenceByControl.get(c.controlId) ?? []).join("; "),
        c.isoRefs ?? "",
      ]),
    ),
  );
  files["remediation-tasks.csv"] = strToU8(
    toCsv(["Control ID", "Task", "Status", "Priority", "Due", "Assignee"], tasks.map((t) => [t.controlId ?? "", t.title, t.status, t.priority, t.dueDate ?? "", t.assignee ?? ""])),
  );
  files["evidence-manifest.csv"] = strToU8(
    toCsv(["Path in this pack", "Control ID", "Size (bytes)", "SHA-256 recorded at upload", "Integrity check", "Uploaded by", "Uploaded at", "Description"], manifest),
  );
  files["activity-log.csv"] = strToU8(
    toCsv(
      ["Time (UTC)", "Who", "Action", "Object", "Object ID", "Detail"],
      audit.map((a) => [a.at, a.actor ?? "", a.action, a.objectType, a.objectId ?? "", a.detail ? JSON.stringify(a.detail) : ""]),
    ),
  );
  files["report.html"] = strToU8(reportHtml({ tenantName, assessmentName: assessment.name, generatedAt, generatedBy, items, score, evidenceByControl, integrityFailures }));
  files["README.txt"] = strToU8(
    [
      `Auditor pack — ${tenantName}`,
      `Assessment: ${assessment.name}`,
      `Generated: ${generatedAt.toISOString()} by ${generatedBy}`,
      "",
      "Contents",
      "  report.html             Readiness summary (open in a browser; print to PDF if needed)",
      "  controls.csv            Every control with status, notes and linked evidence",
      "  remediation-tasks.csv   Open and closed remediation tasks",
      "  evidence/<control>/     Evidence files grouped by control",
      "  evidence-manifest.csv   SHA-256 of each file as recorded at upload, and the result of re-checking it",
      "  activity-log.csv        Workspace activity log",
      "",
      integrityFailures
        ? `WARNING: ${integrityFailures} evidence file(s) failed the integrity check. See evidence-manifest.csv.`
        : "Integrity: every evidence file matched the hash recorded at upload.",
      "",
      "This pack reflects the organisation's self-assessment in the CyberHELP Asia Trust Platform. It is not a certification.",
      "Cyber Essentials and Cyber Trust marks are awarded only by CSA-appointed certification bodies.",
      "",
    ].join("\r\n"),
  );

  // Files inside are written with the export time; evidence is already compressed (PDF/PNG/DOCX), so level 6 is enough.
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { mtime: generatedAt }]])), { level: 6 });
  const slug = safeName(tenantName).replace(/\s+/g, "-").toLowerCase();
  return {
    zip,
    fileName: `auditor-pack_${slug}_${assessment.frameworkId}_${generatedAt.toISOString().slice(0, 10)}.zip`,
    evidenceCount: evidence.length,
    integrityFailures,
  };
}

function reportHtml(p: {
  tenantName: string;
  assessmentName: string;
  generatedAt: Date;
  generatedBy: string;
  items: { controlId: string; domain: string; title: string; status: keyof typeof STATUS_LABEL; notes: string | null }[];
  score: { overall: number; answered: number; total: number; byDomain: { domain: string; score: number; met: number; total: number }[] };
  evidenceByControl: Map<string, string[]>;
  integrityFailures: number;
}) {
  const gaps = p.items.filter((i) => i.status === "not_met" || i.status === "partial").length;
  const rows = p.items
    .map((c) => {
      const ev = p.evidenceByControl.get(c.controlId) ?? [];
      const links = ev.map((e) => `<a href="${esc(e)}">${esc(e.split("/").pop())}</a>`).join("<br>");
      return `<tr><td class="mono">${esc(c.controlId)}</td><td>${esc(c.title)}${c.notes ? `<div class="muted">${esc(c.notes)}</div>` : ""}</td><td class="s-${esc(c.status)}">${esc(STATUS_LABEL[c.status])}</td><td>${links || "—"}</td></tr>`;
    })
    .join("");
  const domains = p.score.byDomain
    .map((d) => `<tr><td>${esc(d.domain)}</td><td class="r">${d.met}/${d.total}</td><td class="r"><b>${d.score}%</b></td></tr>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Readiness report — ${esc(p.tenantName)}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0e1726;max-width:900px;margin:32px auto;padding:0 16px}
h1{font-size:24px;margin:4px 0}h2{font-size:16px;margin:28px 0 8px}.muted{color:#6b7486;font-size:12px}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.kpis{display:flex;gap:32px;margin:20px 0}.kpis b{display:block;font-size:28px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e3e7ee;padding:6px 8px;text-align:left;vertical-align:top}
th{color:#6b7486;font-weight:500}.r{text-align:right}.s-met{color:#0f8f7e}.s-partial{color:#b7791f}.s-not_met{color:#b42318}.warn{background:#fef3f2;border:1px solid #fecdca;padding:10px;border-radius:8px}
</style></head><body>
<p class="muted">Readiness report · CyberHELP Asia Trust Platform</p>
<h1>${esc(p.tenantName)}</h1>
<p>${esc(p.assessmentName)} · generated ${esc(p.generatedAt.toISOString().slice(0, 16).replace("T", " "))} UTC by ${esc(p.generatedBy)}</p>
${p.integrityFailures ? `<p class="warn"><b>Warning:</b> ${p.integrityFailures} evidence file(s) failed the integrity check. See evidence-manifest.csv.</p>` : ""}
<div class="kpis"><div><b>${p.score.overall}%</b>Overall readiness</div><div><b>${p.score.answered}/${p.score.total}</b>Controls assessed</div><div><b>${gaps}</b>Open gaps</div></div>
<h2>Readiness by domain</h2><table><tr><th>Domain</th><th class="r">Met</th><th class="r">Score</th></tr>${domains}</table>
<h2>Control status and evidence</h2><table><tr><th>ID</th><th>Control</th><th>Status</th><th>Evidence</th></tr>${rows}</table>
<p class="muted" style="margin-top:28px">This report reflects the organisation's self-assessment. It is not a certification. Cyber Essentials and Cyber Trust marks are awarded only by CSA-appointed certification bodies.</p>
</body></html>`;
}
