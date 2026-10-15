import "server-only";
import { assertSafeTarget, safeRequest, TargetRejected } from "./ssrf";
import { randomToken } from "@/lib/crypto";

/**
 * Ownership verification: before any automated run, the customer must prove they control the
 * host behind the target endpoint by serving a token we generated at a well-known path. A run
 * is only ever allowed against a host that has passed this check — this is what makes the
 * runner "authorised only".
 */

export const WELL_KNOWN_PATH = "/.well-known/cyberhelp-trust-verification.txt";

export function newVerificationToken(): string {
  return `cht-verify-${randomToken(24)}`;
}

/** The exact URL the customer must serve the token from, derived from the target's origin. */
export function verificationUrlFor(targetUrl: string): string {
  const u = new URL(targetUrl);
  return `${u.origin}${WELL_KNOWN_PATH}`;
}

export type VerifyResult = { ok: boolean; detail: string };

export async function verifyOwnership(targetUrl: string, token: string): Promise<VerifyResult> {
  let checkUrl: string;
  try {
    await assertSafeTarget(targetUrl); // same egress rules as a run
    checkUrl = verificationUrlFor(targetUrl);
  } catch (e) {
    return { ok: false, detail: e instanceof TargetRejected ? e.message : "The endpoint URL is not valid." };
  }
  try {
    const res = await safeRequest(checkUrl, { method: "GET", timeoutMs: 10000, maxBytes: 64 * 1024 });
    if (res.status !== 200) return { ok: false, detail: `The verification file returned HTTP ${res.status}. Serve the token at ${WELL_KNOWN_PATH} and try again.` };
    if (!res.bodyText.includes(token)) return { ok: false, detail: "The verification file was reached but did not contain the current token." };
    return { ok: true, detail: "Ownership verified." };
  } catch (e) {
    return { ok: false, detail: e instanceof TargetRejected ? e.message : "Could not reach the verification file on that host." };
  }
}
