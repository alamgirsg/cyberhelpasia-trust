import Link from "next/link";
import { Logo } from "@/components/ui";

const features = [
  ["Risk profile wizard", "Answer five questions and get a clear recommendation: Cyber Essentials or Cyber Trust."],
  ["Gap assessment", "Work through each control in plain language, with guidance and the evidence auditors expect."],
  ["Automatic remediation plan", "Every gap becomes a task with an owner, a due date and a priority."],
  ["Evidence vault", "Upload and link evidence to controls. Every file is hashed and every action is logged."],
  ["Readiness score", "See where you stand overall and by domain, and track progress to certification."],
  ["Auditor-ready report", "Export a clean readiness report for management or your certification body."],
];

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn-primary">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">For Singapore SMEs and cybersecurity providers</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Get certification-ready for Cyber Essentials and Cyber Trust, without the spreadsheet chaos.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">
          One workspace for your gap assessment, remediation plan and evidence, guided by CISA/CISM-certified practitioners
          from CyberHELP Asia.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">Start your readiness check</Link>
          <a href="mailto:hello@cyberhelpasia.com" className="btn-ghost px-6 py-3 text-base">Talk to a consultant</a>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([t, d]) => (
            <div key={t}>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="card p-8">
          <h2 className="text-xl font-bold">Coming next: AI Assurance</h2>
          <p className="mt-2 max-w-2xl text-ink-2">
            Inventory your AI systems, rate their risk, and run LLM red-team tests mapped to MAS and IMDA expectations, in the
            same workspace.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
        CyberHELP Asia is not affiliated with the Cyber Security Agency of Singapore. Certification is granted only by
        CSA-appointed certification bodies.
      </footer>
    </main>
  );
}
