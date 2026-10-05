import type { RiskRating } from "@/db/schema";

/** Review cadence by rating: high every 6 months, medium every 12, low every 24. */
export const REVIEW_MONTHS: Record<RiskRating, number> = { high: 6, medium: 12, low: 24 };

export function reviewDue(lastReviewedAt: Date, rating: RiskRating, now = new Date()): { due: Date; overdue: boolean } {
  const due = new Date(lastReviewedAt);
  due.setMonth(due.getMonth() + REVIEW_MONTHS[rating]);
  return { due, overdue: due < now };
}

export function effectiveRating(s: { computedRating: RiskRating; overrideRating: RiskRating | null }): RiskRating {
  return s.overrideRating ?? s.computedRating;
}
