import type { RiskRating } from "@/db/schema";

/**
 * Explainable AI risk-materiality rating.
 *
 * The factors follow the themes regulators use for AI risk materiality (impact on customers,
 * degree of autonomy, sensitivity of data, scale of use), for example in MAS's proposed AI Risk
 * Management Guidelines. This is CyberHELP's own heuristic, not a regulatory formula: it gives a
 * consistent first rating with reasons, which a person can override with a written justification.
 */

type Option = { value: string; label: string; points: number };
export type FactorDef = { key: string; question: string; help?: string; options: Option[] };

export const FACTORS: FactorDef[] = [
  {
    key: "use",
    question: "What is the AI used for?",
    options: [
      { value: "internal_productivity", label: "Internal productivity (drafting, summarising, coding help)", points: 0 },
      { value: "internal_decision", label: "Supports internal decisions (HR, operations, risk)", points: 2 },
      { value: "customer_info", label: "Talks to customers or the public (chatbot, support)", points: 2 },
      { value: "customer_decision", label: "Affects decisions about customers (credit, claims, pricing, eligibility)", points: 4 },
    ],
  },
  {
    key: "autonomy",
    question: "How much does it act on its own?",
    options: [
      { value: "assistive", label: "Suggests only; a person does the action", points: 0 },
      { value: "human_approval", label: "Prepares actions that a person approves", points: 1 },
      { value: "autonomous", label: "Acts without a person checking each action", points: 3 },
    ],
  },
  {
    key: "tools",
    question: "Can it use tools or connect to other systems?",
    help: "For example an agent that sends emails, updates records or calls APIs.",
    options: [
      { value: "none", label: "No tools", points: 0 },
      { value: "read_only", label: "Read-only tools (search, look up records)", points: 1 },
      { value: "write", label: "Tools that change things (send, update, pay, delete)", points: 3 },
    ],
  },
  {
    key: "data",
    question: "What is the most sensitive data it handles?",
    options: [
      { value: "public", label: "Public information only", points: 0 },
      { value: "internal", label: "Internal business information", points: 1 },
      { value: "personal", label: "Personal data (PDPA)", points: 2 },
      { value: "sensitive", label: "Sensitive personal or financial data (NRIC, health, account data)", points: 3 },
    ],
  },
  {
    key: "untrusted_input",
    question: "Does it read content from outside the organisation?",
    help: "Emails, uploaded documents, web pages or customer messages can carry hidden instructions (prompt injection).",
    options: [
      { value: "no", label: "No, only trusted internal input", points: 0 },
      { value: "yes", label: "Yes", points: 1 },
    ],
  },
  {
    key: "scale",
    question: "How widely is it used?",
    options: [
      { value: "team", label: "One team (under 50 people)", points: 0 },
      { value: "organisation", label: "Across the organisation", points: 1 },
      { value: "customers", label: "By customers or the public", points: 2 },
    ],
  },
];

export const FACTOR_KEYS = FACTORS.map((f) => f.key);
export const MAX_SCORE = FACTORS.reduce((s, f) => s + Math.max(...f.options.map((o) => o.points)), 0);

export type Factors = Record<string, string>;
export type RiskResult = { rating: RiskRating; score: number; reasons: string[] };

function opt(key: string, value: string): Option | undefined {
  return FACTORS.find((f) => f.key === key)?.options.find((o) => o.value === value);
}

export function validFactors(f: Record<string, unknown>): f is Factors {
  return FACTORS.every((d) => typeof f[d.key] === "string" && d.options.some((o) => o.value === f[d.key]));
}

export function rateAiSystem(f: Factors): RiskResult {
  const score = FACTORS.reduce((s, d) => s + (opt(d.key, f[d.key])?.points ?? 0), 0);
  const reasons: string[] = [];
  let rating: RiskRating = score >= 8 ? "high" : score >= 4 ? "medium" : "low";

  // Escalation rules: some combinations are high risk whatever the total.
  if (f.use === "customer_decision" && f.autonomy !== "assistive") {
    rating = "high";
    reasons.push("It influences decisions about customers and is not purely advisory.");
  }
  if (f.tools === "write" && f.autonomy === "autonomous") {
    rating = "high";
    reasons.push("It can take actions that change things without a person approving each one.");
  }
  if (f.tools === "write" && f.untrusted_input === "yes") {
    if (rating === "low") rating = "medium";
    reasons.push("It reads outside content and can take actions, so a hidden instruction could trigger an action.");
  }
  if (f.data === "sensitive" && f.scale === "customers") {
    rating = "high";
    reasons.push("It handles sensitive data and is used by customers or the public.");
  }

  // Plain-language drivers for the total.
  if (f.use === "customer_decision") reasons.push("Decisions about customers carry fairness and accountability duties.");
  else if (f.use === "customer_info") reasons.push("It speaks to customers, so wrong or harmful answers reach them directly.");
  if (f.autonomy === "autonomous" && !reasons.some((r) => r.includes("without a person"))) reasons.push("It acts without per-action human review.");
  if (f.data === "personal" || f.data === "sensitive") reasons.push("It processes personal data, so PDPA obligations apply.");
  if (f.untrusted_input === "yes" && f.tools !== "write") reasons.push("It reads outside content, which can carry prompt-injection attempts.");
  if (!reasons.length) reasons.push("Internal, advisory use with limited data and reach.");
  reasons.push(`Combined factor score: ${score} of ${MAX_SCORE} (medium from 4, high from 8).`);

  return { rating, score, reasons: [...new Set(reasons)] };
}

/** OWASP Top 10 for LLM Applications (2025) categories worth testing, given the factors. */
export function suggestedTests(f: Factors): { id: string; name: string; why: string }[] {
  const t: { id: string; name: string; why: string }[] = [];
  if (f.untrusted_input === "yes" || f.scale === "customers")
    t.push({ id: "LLM01", name: "Prompt injection", why: "It receives text it does not control." });
  if (f.data !== "public") t.push({ id: "LLM02", name: "Sensitive information disclosure", why: "It can see non-public data." });
  if (f.tools !== "none") t.push({ id: "LLM06", name: "Excessive agency", why: "It can use tools or other systems." });
  if (f.tools === "write" || f.use !== "internal_productivity")
    t.push({ id: "LLM05", name: "Improper output handling", why: "Its output feeds actions or reaches people." });
  if (f.scale === "customers") t.push({ id: "LLM07", name: "System prompt leakage", why: "Outsiders can probe it directly." });
  if (f.use === "customer_info" || f.use === "customer_decision")
    t.push({ id: "LLM09", name: "Misinformation", why: "People may rely on what it says." });
  if (f.scale === "customers") t.push({ id: "LLM10", name: "Unbounded consumption", why: "Public use can be abused to run up cost." });
  return t.sort((a, b) => a.id.localeCompare(b.id));
}

export const RATING_LABEL: Record<RiskRating, string> = { low: "Low", medium: "Medium", high: "High" };
export const RATING_BADGE: Record<RiskRating, string> = { low: "met", medium: "partial", high: "not_met" };

export function factorLabel(key: string, value: string): string {
  return opt(key, value)?.label ?? value;
}
