"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

/** Echo non-secret fields back so the form keeps them after an error (React 19 resets forms after actions). */
function keep(form: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((f) => [f, String(form.get(f) ?? "")]));
}

const signupSchema = z.object({
  company: z.string().trim().min(2, "Company name is too short").max(120),
  uen: z.string().trim().max(20).optional(),
  name: z.string().trim().min(2, "Your name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(12, "Use at least 12 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  const values = keep(form, ["company", "uen", "name", "email"]);
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
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  const values = keep(form, ["email"]);
  if (!parsed.success) return { error: "Enter your email and password.", values };
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await bcrypt.compare(parsed.data.password, u?.passwordHash ?? (await dummyHash()));
  if (!u || !ok) return { error: "Email or password is incorrect.", values };

  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, u.id)).limit(1);
  if (!m) return { error: "Your account is not linked to any organisation.", values };

  await audit(m.tenantId, u.id, "user.login", "user", u.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: u.id, tid: m.tenantId }), sessionCookieOptions);
  redirect("/app");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
