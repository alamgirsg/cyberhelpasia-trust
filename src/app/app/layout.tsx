import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/ui";

const nav = [
  ["/app", "Dashboard"],
  ["/app/tasks", "Remediation tasks"],
  ["/app/evidence", "Evidence vault"],
  ["/app/audit", "Activity log"],
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print border-b border-line bg-white lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href="/app"><Logo className="text-sm" /></Link>
          <p className="mt-0 truncate text-xs text-muted lg:mt-3">{ctx.tenantName}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:pb-0">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-paper">
              {label}
            </Link>
          ))}
          <div className="mx-3 my-2 hidden border-t border-line lg:block" />
          <span className="hidden px-3 py-2 text-sm text-muted lg:block" title="Module 2 — coming soon">AI Assurance · soon</span>
        </nav>
        <div className="hidden px-4 py-4 lg:absolute lg:bottom-0 lg:block lg:w-60">
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
