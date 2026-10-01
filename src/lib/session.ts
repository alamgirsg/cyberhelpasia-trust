import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "cha_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionPayload = { uid: string; tid: string };

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-0000000000");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.tid !== "string") return null;
    return { uid: payload.uid, tid: payload.tid };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
