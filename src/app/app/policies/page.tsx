import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { POLICIES } from "@/content/policies";
import { aiConfigured } from "@/lib/policy-ai";
import { setAiEnabled } from "@/app/actions/policies";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Policies" };

const STATUS: Record<string, [string, string]> = {
  draft: ["partial", "Draft — needs approval"],
  approved: ["met", "Approved"],
  superseded: ["na", "Superseded"],
};

export default async function PoliciesPage() {
  const ctx = await requireCtx();
  const db = await getDb();
  const [tenant] = await db.select({ aiEnabled: schema.tenants.aiEnabled }).from(schema.tenants).where(eq(schema.tenants.id, ctx.tenantId)).limit(1);
  const rows = await db
    .select({ id: schema.policies.id, policyType: schema.policies.policyType, version: schema.policies.version, status: schema.policies.status, source: schema.policies.source, updatedAt: schema.policies.updatedAt })
    .from(schema.policies)
    .where(eq(schema.policies.tenantId, ctx.tenantId))
    .orderBy(desc(schema.policies.version));
  const byType = new Map<string, typeof rows>();
  for (const r of rows) byType.set(r.policyType, [...(byType.get(r.policyType) ?? []), r]);
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const canWrite = ctx.role !== "viewer";

  return (
    <div>
      <PageHeader title="Policies" sub="Draft, review and approve the policies auditors ask for. Approved policies are filed as evidence automatically." />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5" data-testid="ai-panel">
        <div className="max-w-xl text-sm">
          <p className="font-semibold">AI drafting is {tenant.aiEnabled ? "on" : "off"}</p>
          <p className="mt-1 text-ink-2">
            {tenant.aiEnabled
              ? "The details you type in the draft form are sent to Anthropic's Claude API to write the first draft. Nothing else from your workspace is sent."
              : "Drafts start from a built-in template. Turn AI on to have Claude write a tailored first draft from the details you enter."}{" "}
            Every draft must be reviewed and approved by an owner or admin before it counts as evidence.
          </p>
          {tenant.aiEnabled && !aiConfigured() && <p className="mt-1 text-warn">AI is on but no API key is set on the server, so templates are used.</p>}
        </div>
        {canManage && (
          <form action={setAiEnabled} className="flex items-center gap-3">
            <input type="hidden" name="enabled" value={tenant.aiEnabled ? "off" : "on"} />
            <button className={tenant.aiEnabled ? "btn-ghost" : "btn-primary"}>{tenant.aiEnabled ? "Turn AI drafting off" : "Turn AI drafting on"}</button>
          </form>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {POLICIES.map((def) => {
          const versions = byType.get(def.id) ?? [];
          const current = versions.find((v) => v.status === "approved");
          const draft = versions.find((v) => v.status === "draft");
          return (
            <div key={def.id} className="card flex flex-col p-5" data-testid={`policy-${def.id}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{def.name}</h2>
                {current ? <Badge kind="met">v{current.version} approved</Badge> : draft ? <Badge kind="partial">Draft</Badge> : <Badge kind="not_started">Not started</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-ink-2">{def.purpose}</p>
              <p className="mt-2 font-mono text-xs text-muted">Evidence for {def.controls.join(", ")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {draft && <Link href={`/app/policies/${draft.id}`} className="btn-primary">Review draft v{draft.version}</Link>}
                {current && <Link href={`/app/policies/${current.id}`} className="btn-ghost">View v{current.version}</Link>}
                {!draft && canWrite && <Link href={`/app/policies/new?type=${def.id}`} className={current ? "btn-ghost" : "btn-primary"}>{current ? "Redraft" : "Create draft"}</Link>}
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3">Policy</th><th className="p-3">Version</th><th className="p-3">Status</th><th className="p-3">Source</th><th className="p-3">Updated</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="p-3"><Link href={`/app/policies/${r.id}`} className="font-medium text-brand-2 hover:underline">{POLICIES.find((p) => p.id === r.policyType)?.name ?? r.policyType}</Link></td>
                  <td className="p-3">v{r.version}</td>
                  <td className="p-3"><Badge kind={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge></td>
                  <td className="p-3 text-xs text-muted">{r.source === "ai" ? "AI (Claude)" : r.source === "template" ? "Template" : "Edited copy"}</td>
                  <td className="p-3 text-xs text-muted">{r.updatedAt.toLocaleDateString("en-SG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
