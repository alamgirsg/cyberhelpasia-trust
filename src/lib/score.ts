import type { ResponseStatus } from "@/db/schema";

const WEIGHT: Record<ResponseStatus, number | null> = {
  met: 1,
  partial: 0.5,
  not_met: 0,
  not_started: 0,
  na: null, // excluded from the score
};

export type ScoreInput = { domain: string; status: ResponseStatus };
export type DomainScore = { domain: string; score: number; total: number; met: number; answered: number };

/** Readiness score 0–100. "Not applicable" controls are excluded. */
export function readiness(items: ScoreInput[]): { overall: number; byDomain: DomainScore[]; answered: number; total: number } {
  const byDomain = new Map<string, { sum: number; n: number; met: number; answered: number }>();
  let sum = 0;
  let n = 0;
  let answered = 0;
  for (const it of items) {
    const w = WEIGHT[it.status];
    const d = byDomain.get(it.domain) ?? { sum: 0, n: 0, met: 0, answered: 0 };
    if (it.status !== "not_started") {
      answered++;
      d.answered++;
    }
    if (w !== null) {
      d.sum += w;
      d.n += 1;
      sum += w;
      n += 1;
    }
    if (it.status === "met") d.met += 1;
    byDomain.set(it.domain, d);
  }
  return {
    overall: n ? Math.round((sum / n) * 100) : 0,
    byDomain: [...byDomain.entries()].map(([domain, d]) => ({
      domain,
      score: d.n ? Math.round((d.sum / d.n) * 100) : 100,
      total: d.n,
      met: d.met,
      answered: d.answered,
    })),
    answered,
    total: items.length,
  };
}

export const STATUS_LABEL: Record<ResponseStatus, string> = {
  not_started: "Not started",
  not_met: "Not met",
  partial: "Partially met",
  met: "Met",
  na: "Not applicable",
};
