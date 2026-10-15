/* Shared UI primitives for the Trust platform.
 * The readiness gauge is the signature object: a 270° instrument arc with
 * tick marks and a "ready" threshold, sweeping to value once on load. */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <path d="M16 2 4 7v8c0 7.2 5 13.2 12 15 7-1.8 12-7.8 12-15V7L16 2Z" fill="var(--color-brand)" />
        <path d="M16 2 4 7v8c0 7.2 5 13.2 12 15 7-1.8 12-7.8 12-15V7L16 2Z" fill="none" stroke="rgba(255,255,255,0.14)" />
        <path d="m10.4 16.3 3.9 3.9 7.6-8.3" fill="none" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-[0.98rem] font-bold leading-none tracking-tight">
        CyberHELP Asia{" "}
        <span className="font-semibold text-accent">Trust</span>
      </span>
    </span>
  );
}

/* ---- gauge geometry ---- */
const GAP = 90; // degrees of open arc at the bottom
const SWEEP = 360 - GAP; // 270°
const START = 90 + GAP / 2; // 135° — lower-left

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const [x0, y0] = polar(cx, cy, r, startDeg);
  const [x1, y1] = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function readyTone(value: number) {
  if (value >= 80) return "var(--color-accent)";
  if (value >= 50) return "var(--color-warn)";
  return "var(--color-bad)";
}

/**
 * Readiness instrument. API preserved: { value, size, label }.
 * `threshold` optionally marks the certification-ready target line.
 */
export function ScoreRing({
  value,
  size = 120,
  label,
  threshold,
}: {
  value: number;
  size?: number;
  label?: string;
  threshold?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = Math.max(7, Math.round(size * 0.075));
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcLen = (2 * Math.PI * r * SWEEP) / 360;
  const tone = readyTone(v);

  const ticks = [0, 25, 50, 75, 100].map((p) => {
    const [ox, oy] = polar(cx, cy, r + stroke * 0.65, START + (SWEEP * p) / 100);
    const [ix, iy] = polar(cx, cy, r + stroke * 0.2, START + (SWEEP * p) / 100);
    return { ox, oy, ix, iy, p };
  });

  const numSize = Math.round(size * 0.3);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${v}% ready`}>
        {/* tick marks — the instrument scale */}
        {ticks.map((t) => (
          <line key={t.p} x1={t.ix} y1={t.iy} x2={t.ox} y2={t.oy} stroke="var(--color-line)" strokeWidth={t.p % 50 === 0 ? 2 : 1} strokeLinecap="round" />
        ))}
        {/* track */}
        <path d={arcPath(cx, cy, r, START, SWEEP)} fill="none" stroke="var(--color-line)" strokeWidth={stroke} strokeLinecap="round" />
        {/* value arc, swept once on load */}
        <path
          className="gauge-arc"
          d={arcPath(cx, cy, r, START, SWEEP)}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          style={
            {
              ["--dash-empty" as string]: `${arcLen}`,
              ["--dash-value" as string]: `${arcLen * (1 - v / 100)}`,
              strokeDashoffset: arcLen * (1 - v / 100),
            } as React.CSSProperties
          }
        />
        {/* ready threshold marker */}
        {threshold != null && (() => {
          const [tx, ty] = polar(cx, cy, r, START + (SWEEP * threshold) / 100);
          const [tx2, ty2] = polar(cx, cy, r + stroke * 0.9, START + (SWEEP * threshold) / 100);
          return <line x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" />;
        })()}
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-display tnum font-bold" style={{ fontSize: numSize, color: "var(--color-ink)" }}>
          {v}
          <span className="align-top" style={{ fontSize: numSize * 0.42, color: "var(--color-muted)" }}>%</span>
        </span>
        {label && <span className="mt-1 text-[0.72rem] font-medium text-muted">{label}</span>}
      </div>
    </div>
  );
}

/** Horizontal readiness bar with an optional ready-threshold tick. */
export function Bar({ value, threshold }: { value: number; threshold?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 80 ? "var(--color-accent)" : v >= 50 ? "var(--color-warn)" : "var(--color-bad)";
  return (
    <div className="relative h-2 w-full rounded-full" style={{ background: "var(--color-line)" }}>
      <div className="h-2 rounded-full transition-[width] duration-700" style={{ width: `${v}%`, background: color }} />
      {threshold != null && (
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2" style={{ left: `${threshold}%`, background: "var(--color-ink)" }} aria-hidden="true" />
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, { dot: string; text: string; bg: string; ring: string }> = {
  met: { dot: "#0e7c66", text: "#0a5a49", bg: "#e7f4f0", ring: "#bfe3d9" },
  partial: { dot: "#9a6700", text: "#7a5200", bg: "#fbf3e2", ring: "#eed9ad" },
  not_met: { dot: "#b42318", text: "#8f1c14", bg: "#fbeceb", ring: "#f0c7c3" },
  na: { dot: "#7d8aa0", text: "#53617a", bg: "#eef1f6", ring: "#d7dfea" },
  not_started: { dot: "#9aa6ba", text: "#53617a", bg: "#f4f7fb", ring: "#d7dfea" },
  open: { dot: "#b42318", text: "#8f1c14", bg: "#fbeceb", ring: "#f0c7c3" },
  in_progress: { dot: "#9a6700", text: "#7a5200", bg: "#fbf3e2", ring: "#eed9ad" },
  done: { dot: "#0e7c66", text: "#0a5a49", bg: "#e7f4f0", ring: "#bfe3d9" },
  high: { dot: "#b42318", text: "#8f1c14", bg: "#fbeceb", ring: "#f0c7c3" },
  medium: { dot: "#9a6700", text: "#7a5200", bg: "#fbf3e2", ring: "#eed9ad" },
  low: { dot: "#7d8aa0", text: "#53617a", bg: "#eef1f6", ring: "#d7dfea" },
};

export function Badge({ kind, children }: { kind: string; children: React.ReactNode }) {
  const t = STATUS_TONE[kind] ?? STATUS_TONE.na;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: t.bg, color: t.text, borderColor: t.ring }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="text-[1.65rem] font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
