import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { switchWorkspace } from "@/app/actions/team";
import { Logo } from "@/components/ui";
import { SideNav } from "@/components/side-nav";

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
      <aside
        className="no-print border-b border-white/10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0"
        style={{ background: "var(--color-field)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/app" className="text-white"><Logo className="text-sm" /></Link>
          {workspaces.length > 1 ? (
            <form action={switchWorkspace} className="mt-0 flex gap-1 lg:mt-4">
              <select
                name="tenantId"
                defaultValue={ctx.tenantId}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/40 [&>option]:text-ink"
                aria-label="Workspace"
              >
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button className="rounded-lg px-2 text-xs font-semibold text-[#7fe9d2] hover:bg-white/10">Go</button>
            </form>
          ) : (
            <p className="mt-0 truncate text-xs text-white/55 lg:mt-4">{ctx.tenantName}</p>
          )}
        </div>

        <SideNav />

        <div className="mt-auto hidden px-5 py-5 lg:block">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="truncate text-sm font-medium text-white">{ctx.userName}</p>
            <p className="truncate text-xs text-white/55">{ctx.userEmail} · {ctx.role}</p>
            <form action={logout} className="mt-2">
              <button className="text-xs font-semibold text-[#7fe9d2] hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-5 py-9 lg:px-10">{children}</main>
    </div>
  );
}
