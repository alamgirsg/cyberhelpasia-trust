import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { requireCtx } from "@/lib/auth";
import { changeRole, removeMember, revokeInvite } from "@/app/actions/team";
import { Badge, PageHeader } from "@/components/ui";
import { SettingsTabs } from "../tabs";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Team" };

const ROLE_HELP: Record<string, string> = {
  owner: "Full control, including owners and deleting assessments",
  admin: "Manage team and all content",
  contributor: "Answer controls, upload evidence, update tasks",
  viewer: "Read-only (e.g. management or auditors)",
};

export default async function TeamPage() {
  const ctx = await requireCtx();
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const db = await getDb();
  const members = await db
    .select({
      id: schema.memberships.id,
      role: schema.memberships.role,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      mfa: schema.users.mfaEnabledAt,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.tenantId, ctx.tenantId))
    .orderBy(schema.users.name);
  const pending = canManage
    ? await db
        .select()
        .from(schema.invites)
        .where(
          and(
            eq(schema.invites.tenantId, ctx.tenantId),
            isNull(schema.invites.acceptedAt),
            isNull(schema.invites.revokedAt),
            gt(schema.invites.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(schema.invites.createdAt))
    : [];

  const grantable = ROLES.filter((r) => ctx.role === "owner" || r !== "owner");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" sub="Your account and workspace" />
      <SettingsTabs active="team" canManage={canManage} />

      {canManage && <InviteForm roles={grantable} />}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted"><th className="p-3">Member</th><th className="p-3">2-step</th><th className="p-3">Role</th>{canManage && <th className="p-3" />}</tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const editable = canManage && (ctx.role === "owner" || m.role !== "owner");
              return (
                <tr key={m.id} className="border-b border-line last:border-0" data-testid={`member-${m.email}`}>
                  <td className="p-3"><div className="font-medium">{m.name}{m.userId === ctx.userId ? " (you)" : ""}</div><div className="text-xs text-muted">{m.email}</div></td>
                  <td className="p-3">{m.mfa ? <Badge kind="met">On</Badge> : <Badge kind="not_started">Off</Badge>}</td>
                  <td className="p-3">
                    {editable ? (
                      <form action={changeRole} className="flex items-center gap-2">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input w-auto py-1" aria-label={`Role for ${m.name}`}>
                          {grantable.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button className="text-xs font-semibold text-brand-2 hover:underline">Save</button>
                      </form>
                    ) : (
                      <span className="capitalize">{m.role}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="p-3 text-right">
                      {editable && (
                        <form action={removeMember}>
                          <input type="hidden" name="membershipId" value={m.id} />
                          <button className="text-xs font-semibold text-bad hover:underline">Remove</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Pending invitations</h2>
          <div className="card divide-y divide-line">
            {pending.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 text-sm">
                <div><span className="font-medium">{i.email}</span> <span className="text-muted">· {i.role} · expires {i.expiresAt.toLocaleDateString("en-SG")}</span></div>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button className="text-xs font-semibold text-bad hover:underline">Revoke</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-muted">
        {Object.entries(ROLE_HELP).map(([r, h]) => <p key={r}><span className="font-semibold capitalize">{r}:</span> {h}</p>)}
      </div>
    </div>
  );
}
