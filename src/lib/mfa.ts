import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { randomInt } from "node:crypto";
import { decrypt, sha256 } from "./crypto";
import { verify as verifyTotp } from "./totp";

const RC_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** Recovery codes look like "k7qm-x2pa" (~40 bits each); stored as SHA-256 of the normalised code. */
export function newRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const t = Array.from({ length: 8 }, () => RC_ALPHABET[randomInt(RC_ALPHABET.length)]).join("");
    return `${t.slice(0, 4)}-${t.slice(4)}`;
  });
}

export function hashRecovery(code: string): string {
  return sha256(code.trim().toLowerCase().replace(/-/g, ""));
}

type MfaUser = { id: string; mfaSecretEnc: string | null; mfaEnabledAt: Date | null; mfaLastStep: number | null };

/** Verifies a TOTP code (with replay protection) or an unused recovery code. Consumes whichever succeeds. */
export async function checkSecondFactor(user: MfaUser, input: string): Promise<"totp" | "recovery" | null> {
  const db = await getDb();
  const code = input.trim().replace(/\s/g, "");
  if (/^\d{6}$/.test(code) && user.mfaSecretEnc) {
    const step = verifyTotp(decrypt(user.mfaSecretEnc), code);
    if (step !== null && step > (user.mfaLastStep ?? -1)) {
      await db.update(schema.users).set({ mfaLastStep: step }).where(eq(schema.users.id, user.id));
      return "totp";
    }
    return null;
  }
  if (code.length >= 8) {
    const used = await db
      .update(schema.mfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.mfaRecoveryCodes.userId, user.id),
          eq(schema.mfaRecoveryCodes.codeHash, hashRecovery(code)),
          isNull(schema.mfaRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: schema.mfaRecoveryCodes.id });
    if (used.length) return "recovery";
  }
  return null;
}
