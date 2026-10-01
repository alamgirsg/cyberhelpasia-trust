import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/**
 * Key for encrypting MFA secrets at rest. Use a dedicated MFA_ENC_KEY in production so that
 * rotating SESSION_SECRET (which logs everyone out) does not also break everyone's MFA.
 */
function key(): Buffer {
  const material = process.env.MFA_ENC_KEY || process.env.SESSION_SECRET;
  if (!material || material.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("MFA_ENC_KEY (32+ chars) must be set in production");
    return Buffer.from(hkdfSync("sha256", "dev-only-insecure-key-material-0000", "cha-trust", "mfa-secret", 32));
  }
  return Buffer.from(hkdfSync("sha256", material, "cha-trust", "mfa-secret", 32));
}

/** AES-256-GCM. Output: base64url(iv).base64url(tag).base64url(ciphertext) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, ct] = token.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
