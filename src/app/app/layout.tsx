import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { switchWorkspace } from "@/app/actions/team";
import { Logo } from "@/components/ui";

const nav = [
  ["/app", "Dashboard"],
  ["/app/tasks", "Remediation tasks"],
  ["/app/policies", "Policies"],
  ["/app/evidence", "Evidence vault"],
  ["/app/audit", "Activity log"],
  ["/app/settings/security", "Settings"],
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const db = await getDb();
  const workspaces = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.memberships)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.memberships.tenantId))
    .where(eq(schema.memberships.userId, ctx.userId))
    .orderBy(schema.tenants.name);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-4 lg:block">
          <Link href="/app"><Logo className="text-sm" /></Link>
          {workspaces.length > 1 ? (
            <form action={switchWorkspace} className="mt-0 flex gap-1 lg:mt-3">
              <select name="tenantId" defaultValue={ctx.tenantId} className="input py-1 text-xs" aria-label="Workspace">
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button className="text-xs font-semibold text-brand-2">Go</button>
            </form>
          ) : (
            <p className="mt-0 truncate text-xs text-muted lg:mt-3">{ctx.tenantName}</p>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:pb-0">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-paper">
              {label}
            </Link>
          ))}
          <div className="mx-3 my-2 hidden border-t border-line lg:block" />
          <Link href="/app/ai" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-paper">
            AI Assurance <span className="ml-1 rounded bg-brand-2/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-2">Preview</span>
          </Link>
        </nav>
        <div className="mt-auto hidden px-4 py-4 lg:block">
          <p className="truncate text-sm font-medium">{ctx.userName}</p>
          <p className="truncate text-xs text-muted">{ctx.userEmail} · {ctx.role}</p>
          <form action={logout} className="mt-2">
            <button className="text-xs font-semibold text-brand-2 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
