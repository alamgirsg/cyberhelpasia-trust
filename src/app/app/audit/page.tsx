import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Activity log" };

export default async function AuditPage() {
  const ctx = await requireCtx();
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.auditEvents.id,
      action: schema.auditEvents.action,
      objectType: schema.auditEvents.objectType,
      objectId: schema.auditEvents.objectId,
      detail: schema.auditEvents.detail,
      createdAt: schema.auditEvents.createdAt,
      actor: schema.users.name,
    })
    .from(schema.auditEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditEvents.actorId))
    .where(eq(schema.auditEvents.tenantId, ctx.tenantId))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(200);

  return (
    <div>
      <PageHeader title="Activity log" sub="The latest 200 actions in your workspace." />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted"><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Object</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap p-3 text-xs text-muted">{r.createdAt.toLocaleString("en-SG")}</td>
                <td className="p-3">{r.actor ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 text-xs text-ink-2">
                  {r.objectType}{r.objectId ? ` · ${r.objectId.slice(0, 13)}` : ""}
                  {r.detail && "to" in r.detail ? ` → ${String(r.detail.to)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
