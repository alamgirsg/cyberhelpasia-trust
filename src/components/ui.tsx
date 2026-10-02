export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2 4 7v8c0 7.2 5 13.2 12 15 7-1.8 12-7.8 12-15V7L16 2Z" fill="#0b3d6b" />
        <path d="m10.5 16.2 3.8 3.8 7.4-8" fill="none" stroke="#3fd0b8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        CyberHELP Asia <span className="font-normal text-muted">Trust</span>
      </span>
    </span>
  );
}

export function ScoreRing({ value, size = 120, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "#0f8f7e" : value >= 50 ? "#b7791f" : "#b42318";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e3e7ee" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold">{value}%</div>
        {label && <div className="text-xs text-muted">{label}</div>}
      </div>
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-accent" : value >= 50 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2 w-full rounded-full bg-line">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  met: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  not_met: "bg-red-50 text-red-800 border-red-200",
  na: "bg-slate-50 text-slate-600 border-slate-200",
  not_started: "bg-white text-slate-500 border-slate-200",
  open: "bg-red-50 text-red-800 border-red-200",
  in_progress: "bg-amber-50 text-amber-800 border-amber-200",
  done: "bg-emerald-50 text-emerald-800 border-emerald-200",
  high: "bg-red-50 text-red-800 border-red-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

export function Badge({ kind, children }: { kind: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[kind] ?? STATUS_STYLE.na}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
