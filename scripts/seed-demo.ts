/**
 * Demo data: one command spins up a believable, fully-populated workspace so the platform can be
 * shown live in a sales call. Re-running resets the demo (it deletes the previous demo workspace
 * first), so the login below always works.
 *
 *   npm run db:demo
 *
 * Honours DATABASE_URL (Postgres) or falls back to the embedded PGlite dev database, exactly like
 * the app. It only ever touches the demo tenant — real workspaces are left alone.
 */
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DEMO_EMAIL = "demo@cyberhelpasia.com";
const DEMO_PASSWORD = "TrustDemo2026!";

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const { getDb, schema } = await import("../src/db");
  const { FRAMEWORKS } = await import("../src/content/frameworks");
  const { rateAiSystem } = await import("../src/lib/ai-risk");
  const { and, asc, eq, inArray, sql } = await import("drizzle-orm");
  const db = await getDb();

  const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

  // 1) Make sure the control library exists (idempotent upsert, same as the normal seed).
  for (const fw of FRAMEWORKS) {
    await db
      .insert(schema.frameworks)
      .values({ id: fw.id, name: fw.name, version: fw.version, description: fw.description, refLabel: fw.refLabel ?? "ISO/IEC 27001:2022 (indicative)" })
      .onConflictDoUpdate({ target: schema.frameworks.id, set: { name: fw.name, version: fw.version, description: fw.description } });
    for (const [i, c] of fw.controls.entries()) {
      await db
        .insert(schema.controls)
        .values({ ...c, isoRefs: c.isoRefs ?? null, frameworkId: fw.id, sortOrder: i })
        .onConflictDoUpdate({
          target: schema.controls.id,
          set: { domain: sql`excluded.domain`, ref: sql`excluded.ref`, title: sql`excluded.title`, guidance: sql`excluded.guidance`, evidenceHint: sql`excluded.evidence_hint`, isoRefs: sql`excluded.iso_refs`, sortOrder: sql`excluded.sort_order` },
        });
    }
  }

  // 2) Reset any previous demo (delete tenants the demo user owns, then the user).
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, DEMO_EMAIL)).limit(1);
  if (existing) {
    const owned = await db
      .select({ tid: schema.memberships.tenantId })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.userId, existing.id), eq(schema.memberships.role, "owner")));
    if (owned.length) await db.delete(schema.tenants).where(inArray(schema.tenants.id, owned.map((o) => o.tid)));
    await db.delete(schema.users).where(eq(schema.users.id, existing.id));
  }

  // 3) Tenant + owner.
  const [tenant] = await db.insert(schema.tenants).values({ name: "Marina Bay Diagnostics Pte Ltd", uen: "201912345K" }).returning({ id: schema.tenants.id });
  const [owner] = await db
    .insert(schema.users)
    .values({ email: DEMO_EMAIL, name: "Dr Priya Nair", passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12) })
    .returning({ id: schema.users.id });
  await db.insert(schema.memberships).values({ tenantId: tenant.id, userId: owner.id, role: "owner" });
  const T = tenant.id;
  const U = owner.id;

  async function writeFileEvidence(name: string, body: string) {
    const storageKey = path.posix.join(T, `${randomUUID()}${path.extname(name) || ".txt"}`);
    await mkdir(path.join(UPLOAD_DIR, T), { recursive: true });
    const buf = Buffer.from(body, "utf8");
    await writeFile(path.join(UPLOAD_DIR, storageKey), buf, { mode: 0o600 });
    return { storageKey, sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
  }

  // 4) Cyber Trust assessment with a realistic spread of answers (+ auto tasks for the gaps).
  const [ctm] = await db.insert(schema.assessments).values({ tenantId: T, frameworkId: "CTM", name: "Cyber Trust readiness" }).returning({ id: schema.assessments.id });
  const ctmControls = await db.select().from(schema.controls).where(eq(schema.controls.frameworkId, "CTM")).orderBy(asc(schema.controls.sortOrder));
  // 18 of ~22 answered; a believable mix. (met ≈ 60%, with real gaps to remediate.)
  const pattern = ["met", "met", "partial", "met", "not_met", "met", "met", "partial", "met", "not_met", "met", "met", "partial", "met", "met", "na", "met", "not_met"];
  const NOTE: Record<string, string> = {
    met: "In place and evidenced.",
    partial: "Partially in place; rollout in progress.",
    not_met: "Gap identified during this assessment.",
    na: "Not applicable to our environment.",
  };
  for (let i = 0; i < Math.min(pattern.length, ctmControls.length); i++) {
    const c = ctmControls[i];
    const status = pattern[i] as "met" | "partial" | "not_met" | "na";
    await db.insert(schema.controlResponses).values({ tenantId: T, assessmentId: ctm.id, controlId: c.id, status, notes: NOTE[status], ownerId: U });
    if (status === "not_met" || status === "partial") {
      await db.insert(schema.tasks).values({
        tenantId: T,
        assessmentId: ctm.id,
        controlId: c.id,
        title: `Close gap: ${c.title}`,
        priority: status === "not_met" ? "high" : "medium",
        dueDate: new Date(Date.now() + (status === "not_met" ? 30 : 60) * 864e5).toISOString().slice(0, 10),
      });
    }
  }

  // 5) Evidence for two met controls.
  const metControls = ctmControls.filter((_, i) => pattern[i] === "met").slice(0, 2);
  for (const c of metControls) {
    const ev = await writeFileEvidence(`${c.id}-evidence.txt`, `Evidence for ${c.id} — ${c.title}\nMarina Bay Diagnostics Pte Ltd\nCollected ${new Date().toISOString().slice(0, 10)}.`);
    await db.insert(schema.evidence).values({ tenantId: T, assessmentId: ctm.id, controlId: c.id, fileName: `${c.id}-evidence.txt`, storageKey: ev.storageKey, mimeType: "text/plain", sizeBytes: ev.size, sha256: ev.sha256, description: `Evidence for ${c.title}`, uploadedBy: U });
  }

  // 6) An approved Information Security Policy, filed as evidence for its controls.
  const policyBody = [
    "# Information Security Policy",
    "",
    "Marina Bay Diagnostics Pte Ltd is committed to protecting the confidentiality, integrity and",
    "availability of patient and business information. Leadership owns cyber risk, reviews it quarterly,",
    "and ensures security controls are approved, resourced and measured.",
    "",
    "This policy applies to all staff, contractors and systems, and is reviewed at least annually.",
  ].join("\n");
  const polFile = await writeFileEvidence("Information-Security-Policy-v1.md", policyBody);
  const [policy] = await db
    .insert(schema.policies)
    .values({ tenantId: T, policyType: "infosec", title: "Information Security Policy", version: 1, status: "approved", content: policyBody, source: "template", createdBy: U, approvedBy: U, approvedAt: new Date(), fileKey: polFile.storageKey, fileSha256: polFile.sha256, fileSize: polFile.size })
    .returning({ id: schema.policies.id });
  for (const cid of ["CTM-01", "CTM-02", "CTM-03"]) {
    await db.insert(schema.evidence).values({ tenantId: T, assessmentId: ctm.id, controlId: cid, fileName: "Information-Security-Policy-v1.md", storageKey: polFile.storageKey, mimeType: "text/markdown", sizeBytes: polFile.size, sha256: polFile.sha256, description: "Approved policy: Information Security Policy", uploadedBy: U });
  }
  void policy;

  // 7) AI inventory at three risk levels.
  const systems: Array<{ name: string; desc: string; owner: string; vendor: string; model: string; status: "proposed" | "pilot" | "production" | "retired"; factors: Record<string, string> }> = [
    { name: "Patient Triage Chatbot", desc: "Public-facing assistant that triages symptoms and books appointments.", owner: "Head of Digital", vendor: "In-house + Anthropic", model: "claude-sonnet", status: "production", factors: { use: "customer_decision", autonomy: "autonomous", tools: "write", data: "sensitive", untrusted_input: "yes", scale: "customers" } },
    { name: "Clinic Scheduling Copilot", desc: "Helps staff optimise appointment scheduling.", owner: "Operations Manager", vendor: "Microsoft", model: "Copilot", status: "pilot", factors: { use: "internal_decision", autonomy: "human_approval", tools: "read_only", data: "personal", untrusted_input: "no", scale: "organisation" } },
    { name: "Marketing Copy Assistant", desc: "Drafts website and campaign copy for review.", owner: "Marketing Lead", vendor: "In-house", model: "open-source", status: "pilot", factors: { use: "internal_productivity", autonomy: "assistive", tools: "none", data: "public", untrusted_input: "no", scale: "team" } },
  ];
  const sysIds: Record<string, string> = {};
  for (const s of systems) {
    const rating = rateAiSystem(s.factors as never).rating;
    const [row] = await db.insert(schema.aiSystems).values({ tenantId: T, name: s.name, description: s.desc, businessOwner: s.owner, vendor: s.vendor, model: s.model, status: s.status, factors: s.factors, computedRating: rating, createdBy: U }).returning({ id: schema.aiSystems.id });
    sysIds[s.name] = row.id;
  }

  // 8) AI governance assessment (so the AI module is populated).
  const [aigov] = await db.insert(schema.assessments).values({ tenantId: T, frameworkId: "AIGOV", name: "AI governance readiness" }).returning({ id: schema.assessments.id });
  const aigControls = await db.select().from(schema.controls).where(eq(schema.controls.frameworkId, "AIGOV")).orderBy(asc(schema.controls.sortOrder));
  const aigPattern = ["met", "met", "met", "met", "partial", "partial", "met", "not_met", "met", "partial", "met", "not_met"];
  for (let i = 0; i < Math.min(aigPattern.length, aigControls.length); i++) {
    const c = aigControls[i];
    const status = aigPattern[i] as "met" | "partial" | "not_met";
    await db.insert(schema.controlResponses).values({ tenantId: T, assessmentId: aigov.id, controlId: c.id, status, notes: NOTE[status], ownerId: U });
    if (status === "not_met" || status === "partial") {
      await db.insert(schema.tasks).values({ tenantId: T, assessmentId: aigov.id, controlId: c.id, title: `Close gap: ${c.title}`, priority: status === "not_met" ? "high" : "medium", dueDate: new Date(Date.now() + (status === "not_met" ? 30 : 60) * 864e5).toISOString().slice(0, 10) });
    }
  }

  // 9) A completed, authorised red-team engagement on the high-risk system, with findings,
  //    and its report filed as AIG-09 evidence.
  const [eng] = await db
    .insert(schema.engagements)
    .values({ tenantId: T, aiSystemId: sysIds["Patient Triage Chatbot"], title: "Red-team: Patient Triage Chatbot", scopeIn: "Prompt-injection, data-disclosure and output-handling testing of the public triage endpoint.", scopeOut: "No production patient data; not the model provider's platform.", status: "completed", authorisedBy: U, authorisedByName: "Dr Priya Nair", authorisedAt: new Date(Date.now() - 6 * 864e5), startedOn: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), completedAt: new Date(Date.now() - 2 * 864e5), createdBy: U })
    .returning({ id: schema.engagements.id });
  const findings: Array<{ testId: string; title: string; severity: "info" | "low" | "medium" | "high" | "critical"; detail: string; remediation: string; status: "open" | "fixed" | "accepted" }> = [
    { testId: "LLM01", title: "Direct prompt injection", severity: "high", detail: "A crafted message overrode the assistant's instructions and changed its behaviour.", remediation: "Treat user input as data; isolate system instructions and validate against overrides.", status: "open" },
    { testId: "LLM02", title: "Sensitive-data guardrail", severity: "high", detail: "The assistant repeated a value it had been told to keep confidential.", remediation: "Enforce data protection in the application, not only by instruction.", status: "open" },
    { testId: "LLM05", title: "Improper output handling", severity: "medium", detail: "The assistant emitted active HTML verbatim; a renderer without escaping would be an XSS sink.", remediation: "Escape/sanitise model output before rendering.", status: "fixed" },
    { testId: "LLM07", title: "System-prompt leakage", severity: "low", detail: "Parts of the system instructions were disclosed on request.", remediation: "Assume the system prompt is extractable; keep secrets out of it.", status: "accepted" },
  ];
  for (const f of findings) await db.insert(schema.findings).values({ tenantId: T, engagementId: eng.id, ...f, createdBy: U });

  const report = `# Red-team report: Patient Triage Chatbot\n\nAI system: Patient Triage Chatbot\nAuthorised by: Dr Priya Nair\n\n## Findings (${findings.length})\n${findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title} (${f.testId}) — ${f.status}`).join("\n")}\n`;
  const repFile = await writeFileEvidence("redteam-Patient-Triage-Chatbot.md", report);
  await db.insert(schema.evidence).values({ tenantId: T, assessmentId: aigov.id, controlId: "AIG-09", fileName: "redteam-Patient-Triage-Chatbot.md", storageKey: repFile.storageKey, mimeType: "text/markdown", sizeBytes: repFile.size, sha256: repFile.sha256, description: "Red-team report: Patient Triage Chatbot", uploadedBy: U });

  console.log("\n✓ Demo workspace ready — Marina Bay Diagnostics Pte Ltd");
  console.log("  Sign in:   " + (process.env.APP_URL || "http://localhost:3000") + "/login");
  console.log("  Email:     " + DEMO_EMAIL);
  console.log("  Password:  " + DEMO_PASSWORD);
  console.log("  Contains:  Cyber Trust assessment (18 answered) + remediation tasks, evidence, an approved policy,");
  console.log("             3 AI systems (low/medium/high), an AI governance assessment, and a completed red-team engagement.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
