import Link from "next/link";
import { Logo } from "@/components/ui";

/* Split auth layout: a navy guilloché "promise" panel paired with the form.
 * The panel states the one thing the product does and why it can be trusted. */

function Tick() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="m5 12.5 4 4 10-11" stroke="#7fe9d2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DEFAULT_POINTS = [
  "Gap assessment, remediation and evidence in one workspace",
  "Every file hashed and every action logged for your auditor",
  "Guided by CISA and CISM-certified practitioners",
];

export function AuthShell({
  promise = "Readiness for Singapore's cyber marks, measured and auditor-ready.",
  points = DEFAULT_POINTS,
  children,
}: {
  promise?: string;
  points?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* promise panel */}
      <aside className="guilloche relative hidden flex-col justify-between p-12 lg:flex" style={{ background: "var(--color-field)" }}>
        <Link href="/" className="text-white"><Logo /></Link>
        <div>
          <h2 className="max-w-md text-balance text-3xl font-bold leading-tight text-white">{promise}</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-white/80">
                <Tick />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/45">© CyberHELP Asia. Not affiliated with the Cyber Security Agency of Singapore.</p>
      </aside>

      {/* form panel */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex lg:hidden"><Logo /></Link>
          {children}
        </div>
      </div>
    </div>
  );
}
