"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import {
  MFA_PENDING_COOKIE,
  SESSION_COOKIE,
  mfaPendingCookieOptions,
  sessionCookieOptions,
  signMfaPending,
  signSession,
  verifyMfaPending,
} from "@/lib/session";
import { audit } from "@/lib/audit";
import { rateLimit, resetLimit } from "@/lib/ratelimit";
import { checkSecondFactor } from "@/lib/mfa";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

/** Echo non-secret fields back so the form keeps them after an error (React 19 resets forms after actions). */
function keep(form: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((f) => [f, String(form.get(f) ?? "")]));
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

const signupSchema = z.object({
  company: z.string().trim().min(2, "Company name is too short").max(120),
  uen: z.string().trim().max(20).optional(),
  name: z.string().trim().min(2, "Your name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(12, "Use at least 12 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const values = keep(form, ["company", "uen", "name", "email"]);
  const rl = rateLimit(`signup:${await clientIp()}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return { error: "Too many sign-ups from this network. Try again later.", values };

  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input", values };
  const { company, uen, name, email, password } = parsed.data;

  const db = await getDb();
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing.length) return { error: "An account with this email already exists. Sign in instead.", values };

  const passwordHash = await bcrypt.hash(password, 12);
  const { userId, tenantId } = await db.transaction(async (tx) => {
    const [t] = await tx.insert(schema.tenants).values({ name: company, uen: uen || null }).returning({ id: schema.tenants.id });
    const [u] = await tx.insert(schema.users).values({ email, name, passwordHash }).returning({ id: schema.users.id });
    await tx.insert(schema.memberships).values({ tenantId: t.id, userId: u.id, role: "owner" });
    return { userId: u.id, tenantId: t.id };
  });
  await audit(tenantId, userId, "tenant.created", "tenant", tenantId, { company });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: userId, tid: tenantId }), sessionCookieOptions);
  redirect("/app/start");
}

let dummy: Promise<string> | undefined;
function dummyHash() {
  dummy ??= bcrypt.hash("timing-equaliser-not-a-real-password", 12);
  return dummy;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const values = keep(form, ["email"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password.", values };

  // 5 attempts per email per 15 minutes, and 30 per IP.
  const byEmail = rateLimit(`login:${parsed.data.email}`, 5, 15 * 60 * 1000);
  const byIp = rateLimit(`login-ip:${await clientIp()}`, 30, 15 * 60 * 1000);
  if (!byEmail.ok || !byIp.ok) {
    return { error: `Too many attempts. Try again in ${Math.ceil(Math.max(byEmail.retryInSec, byIp.retryInSec) / 60)} minutes.`, values };
  }

  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await bcrypt.compare(parsed.data.password, u?.passwordHash ?? (await dummyHash()));
  if (!u || !ok) return { error: "Email or password is incorrect.", values };

  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, u.id)).limit(1);
  if (!m) return { error: "Your account is not linked to any organisation.", values };
  resetLimit(`login:${parsed.data.email}`);

  const jar = await cookies();
  if (u.mfaEnabledAt) {
    jar.set(MFA_PENDING_COOKIE, await signMfaPending({ uid: u.id, tid: m.tenantId }), mfaPendingCookieOptions);
    redirect("/login/mfa");
  }
  await audit(m.tenantId, u.id, "user.login", "user", u.id, { mfa: false });
  jar.set(SESSION_COOKIE, await signSession({ uid: u.id, tid: m.tenantId }), sessionCookieOptions);
  redirect("/app");
}

export async function verifyMfaLogin(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const pending = await verifyMfaPending(jar.get(MFA_PENDING_COOKIE)?.value);
  if (!pending) redirect("/login");

  const rl = rateLimit(`mfa:${pending.uid}`, 5, 5 * 60 * 1000);
  if (!rl.ok) return { error: "Too many attempts. Sign in again in a few minutes." };

  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, pending.uid)).limit(1);
  if (!u?.mfaEnabledAt) redirect("/login");

  const method = await checkSecondFactor(u, String(form.get("code") ?? ""));
  if (!method) {
    await audit(pending.tid, u.id, "user.mfa_failed", "user", u.id);
    return { error: "That code is not valid. Use the current code from your app, or a recovery code." };
  }
  resetLimit(`mfa:${pending.uid}`);
  jar.delete(MFA_PENDING_COOKIE);
  jar.set(SESSION_COOKIE, await signSession(pending), sessionCookieOptions);
  await audit(pending.tid, u.id, "user.login", "user", u.id, { mfa: method });
  redirect("/app");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
