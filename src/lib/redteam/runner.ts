import "server-only";
import { randomBytes } from "node:crypto";
import { PROBES, type Probe } from "./probes";
import { safeRequest, TargetRejected } from "./ssrf";

export const MAX_REQUESTS = 60;
const DELAY_MS = 700; // polite pacing between requests to the target
const TIMEOUT_MS = 15000;
const MAX_BYTES = 1_000_000;

export type TargetConfig = {
  url: string;
  reqField: string; // JSON field to carry the prompt
  resPath: string | null; // dot-path to the reply text; null → best-effort
  authHeader: string | null;
  authValue: string | null; // already decrypted by the caller
};

export type ProbeResult = {
  id: string;
  owaspId: string;
  name: string;
  severity: Probe["severity"];
  status: "pass" | "fail" | "error";
  detail: string;
  remediation: string;
};

export type RunResult = {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  requestsMade: number;
  results: ProbeResult[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Walk a dot-path (supports numeric array indices) through parsed JSON. */
function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) return acc[Number(key)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const COMMON_FIELDS = ["output", "reply", "text", "content", "message", "completion", "answer", "response", "result"];

/** Pull the model's text reply out of an HTTP response body. */
export function extractReply(bodyText: string, resPath: string | null): string {
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return bodyText; // plain-text endpoint
  }
  if (resPath) {
    const v = pick(json, resPath);
    if (typeof v === "string") return v;
    if (v != null) return JSON.stringify(v);
  }
  if (json && typeof json === "object") {
    for (const f of COMMON_FIELDS) {
      const v = (json as Record<string, unknown>)[f];
      if (typeof v === "string") return v;
    }
    // OpenAI-style fallback
    const choice = pick(json, "choices.0.message.content") ?? pick(json, "choices.0.text");
    if (typeof choice === "string") return choice;
  }
  return typeof json === "string" ? json : bodyText;
}

/** Send one probe prompt to the target and return the extracted reply text. */
async function ask(target: TargetConfig, prompt: string): Promise<string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (target.authHeader && target.authValue) headers[target.authHeader] = target.authValue;
  const body = JSON.stringify({ [target.reqField]: prompt });
  const res = await safeRequest(target.url, { method: "POST", headers, body, timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES });
  if (res.status < 200 || res.status >= 300) throw new Error(`endpoint returned HTTP ${res.status}`);
  return extractReply(res.bodyText, target.resPath);
}

/**
 * Run the probe suite against a target. The caller MUST have confirmed the engagement is
 * authorised and the target is ownership-verified before calling this.
 */
export async function runProbes(target: TargetConfig): Promise<RunResult> {
  const results: ProbeResult[] = [];
  let requestsMade = 0;

  for (const probe of PROBES) {
    if (requestsMade >= MAX_REQUESTS) {
      results.push({ ...meta(probe), status: "error", detail: "Per-run request budget reached; probe skipped." });
      continue;
    }
    const ctx = { canary: `CHT-${randomBytes(6).toString("hex")}`, secret: `SECRET-${randomBytes(8).toString("hex")}` };
    try {
      if (requestsMade > 0) await sleep(DELAY_MS);
      const reply = await ask(target, probe.build(ctx));
      requestsMade++;
      const v = probe.evaluate(reply, ctx);
      results.push({ ...meta(probe), status: v.failed ? "fail" : "pass", detail: v.detail });
    } catch (e) {
      requestsMade++;
      const msg = e instanceof TargetRejected ? e.message : e instanceof Error ? e.message : "request failed";
      results.push({ ...meta(probe), status: "error", detail: `Could not complete this probe: ${msg}` });
    }
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    errored: results.filter((r) => r.status === "error").length,
    requestsMade,
    results,
  };
}

function meta(p: Probe) {
  return { id: p.id, owaspId: p.owaspId, name: p.name, severity: p.severity, remediation: p.remediation };
}
