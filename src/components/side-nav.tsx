"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN: [string, string][] = [
  ["/app", "Dashboard"],
  ["/app/tasks", "Remediation tasks"],
  ["/app/policies", "Policies"],
  ["/app/evidence", "Evidence vault"],
  ["/app/audit", "Activity log"],
  ["/app/settings/security", "Settings"],
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/settings/security") return pathname.startsWith("/app/settings");
  return pathname === href || pathname.startsWith(href + "/");
}

function Item({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" aria-hidden="true" />}
      {label}
      {badge && (
        <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7fe9d2]">{badge}</span>
      )}
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname() || "/app";
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {MAIN.map(([href, label]) => (
        <Item key={href} href={href} label={label} active={isActive(pathname, href)} />
      ))}
      <div className="mx-3 my-2 hidden border-t border-white/10 lg:block" />
      <Item href="/app/ai" label="AI Assurance" active={isActive(pathname, "/app/ai")} badge="Preview" />
    </nav>
  );
}
