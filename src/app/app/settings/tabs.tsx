import Link from "next/link";

export function SettingsTabs({ active, canManage }: { active: "security" | "team"; canManage: boolean }) {
  const tabs: Array<[string, string, string]> = [["security", "/app/settings/security", "Security"]];
  tabs.push(["team", "/app/settings/team", canManage ? "Team" : "Team members"]);
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active === key ? "border-brand-2 text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
