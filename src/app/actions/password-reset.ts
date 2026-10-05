"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { appUrl, resetEmail, sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE } from "@/lib/session";
import { anyTenant, findReset } from "@/lib/password-reset";

const RESET_MINUTES = 60;

export type RequestState = { done?: boolean; error?: string } | undefined;

export async function requestReset(_: RequestState, form: FormData): Promise<RequestState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  // Always show the same confirmation, so the page never reveals whether an email exists.
  const generic: RequestState = { done: true };
  if (!email.success) return generic;
  if (!rateLimit(`reset-req:${email.data}`, 3, 60 * 60 * 1000).ok) return generic;

  const db = await getDb();
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.data)).limit(1);
  if (u) {
    // Invalidate earlier unused tokens for this user.
    await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(and(eq(schema.passwordResets.userId, u.id), isNull(schema.passwordResets.usedAt)));
    const token = randomToken();
    await db.insert(schema.passwordResets).values({ userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) });
    await sendEmail({ to: email.data, ...resetEmail(`${appUrl()}/reset/${token}`) });
    const tenantId = await anyTenant(u.id);
    if (tenantId) await audit(tenantId, u.id, "user.reset_requested", "user", u.id);
  }
  return generic;
}

export type ResetState = { error?: string } | undefined;

export async function completeReset(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (!rateLimit(`reset-complete:${sha256(token).slice(0, 16)}`, 10, 60 * 60 * 1000).ok) return { error: "Too many attempts. Request a new link." };
  if (password.length < 12) return { error: "Use at least 12 characters." };

  const reset = await findReset(token);
  if (!reset) return { error: "This link is invalid or has expired. Request a new one." };

  const db = await getDb();
  const claimed = await db
    .update(schema.passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.passwordResets.id, reset.id), isNull(schema.passwordResets.usedAt)))
    .returning({ id: schema.passwordResets.id });
  if (!claimed.length) return { error: "This link has already been used." };

  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(schema.users.id, reset.userId));
  const tenantId = await anyTenant(reset.userId);
  if (tenantId) await audit(tenantId, reset.userId, "user.password_reset", "user", reset.userId);
  // Do not auto-sign-in: if MFA is on, the login flow must still ask for it.
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?reset=1");
}
