import Link from "next/link";
import { Logo, ScoreRing, Badge } from "@/components/ui";

const features: [string, string][] = [
  ["Risk profile", "Answer five questions and get a clear recommendation: Cyber Essentials or Cyber Trust, with the reasoning shown."],
  ["Gap assessment", "Work through each control in plain language, with the guidance and the evidence a certification body expects."],
  ["Remediation plan", "Every gap becomes a task with an owner, a due date and a priority. Close the gap and the task closes with it."],
  ["Evidence vault", "Link evidence to controls. Every file is hashed on upload and re-checked on export, so tampering shows up."],
  ["Readiness score", "See where you stand overall and by domain, and watch the number move as you close controls."],
  ["Auditor pack", "Export a signed ZIP — report, controls, tasks and evidence — ready for management or your certification body."],
];

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="11" fill="var(--color-accent)" opacity="0.12" />
      <path d="m7.5 12.3 3 3 6-6.6" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      {/* ---------------- hero: a readiness instrument on a navy field ---------------- */}
      <div className="guilloche" style={{ background: "var(--color-field)" }}>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <span className="text-white">
            <Logo />
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:bg-white/90"
            >
              Start free
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:pb-28 lg:pt-16">
          <div>
            <p className="eyebrow">Built for Singapore's Cyber Trust marks</p>
            <h1 className="mt-5 max-w-xl text-balance text-[2.6rem] font-extrabold leading-[1.04] text-white sm:text-6xl">
              Know exactly how close you are to the mark.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
              CyberHELP Asia Trust turns the spreadsheet scramble of Cyber Essentials and Cyber Trust into one measured
              path — assessment, remediation and auditor-ready evidence — guided by CISA and CISM practitioners.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white shadow-[0_1px_2px_rgba(7,26,48,0.4)] transition hover:brightness-110">
                Start your readiness check
              </Link>
              <a href="mailto:hello@cyberhelpasia.com" className="rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10">
                Talk to a consultant
              </a>
            </div>
          </div>

          {/* instrument plate — the gauge reads out a representative workspace */}
          <div className="mx-auto w-full max-w-sm">
            <div className="card p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-2">Readiness</span>
                <Badge kind="in_progress">In progress</Badge>
              </div>
              <div className="mt-4 flex justify-center">
                <ScoreRing value={72} size={208} label="to Cyber Trust" threshold={80} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 text-center">
                <div>
                  <div className="font-display tnum text-2xl font-bold">18<span className="text-muted">/22</span></div>
                  <div className="text-xs text-muted">controls answered</div>
                </div>
                <div>
                  <div className="font-display tnum text-2xl font-bold">6</div>
                  <div className="text-xs text-muted">gaps to close</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/55">
              The black mark is the certification-ready target.
            </p>
          </div>
        </section>
      </div>

      {/* ---------------- what's inside: a schedule of controls, not a card grid ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-[2.4rem]">
          Everything a readiness project needs, kept in one place.
        </h2>
        <div className="mt-12 grid gap-x-12 gap-y-px sm:grid-cols-2">
          {features.map(([term, desc], i) => (
            <div
              key={term}
              className={`flex gap-4 py-6 ${i < features.length - (features.length % 2 === 0 ? 2 : 1) ? "border-b border-line" : ""}`}
            >
              <Check />
              <div>
                <h3 className="text-base font-bold">{term}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- module 2 teaser ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="guilloche overflow-hidden rounded-2xl px-8 py-12 sm:px-12" style={{ background: "var(--color-brand)" }}>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-[#7fe9d2]">Preview</span>
            <span className="text-sm font-medium text-white/55">Module two</span>
          </div>
          <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">
            Govern your AI in the same workspace.
          </h2>
          <p className="mt-4 max-w-xl text-white/75">
            Inventory your AI systems, rate their risk with a transparent model, and run authorised LLM red-team
            engagements — mapped to the governance expectations of MAS and IMDA.
          </p>
          <Link href="/signup" className="mt-8 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-white/90">
            See the AI Assurance preview
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="text-ink-2"><Logo className="opacity-80" /></span>
          <p className="max-w-md sm:text-right">
            CyberHELP Asia is not affiliated with the Cyber Security Agency of Singapore. Certification is granted only
            by CSA-appointed certification bodies.
          </p>
        </div>
      </footer>
    </main>
  );
}
