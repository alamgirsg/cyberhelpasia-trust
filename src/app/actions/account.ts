"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type AccountState = { error?: string; ok?: string } | undefined;

export async function changeName(_: AccountState, form: FormData): Promise<AccountState> {
  const ctx = await requireCtx();
  const name = z.string().trim().min(2, "Name is too short").max(80).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const db = await getDb();
  await db.update(schema.users).set({ name: name.data }).where(eq(schema.users.id, ctx.userId));
  await audit(ctx.tenantId, ctx.userId, "user.name_changed", "user", ctx.userId);
  revalidatePath("/app/settings/account");
  return { ok: "Name updated." };
}

export async function changePassword(_: AccountState, form: FormData): Promise<AccountState> {
  const ctx = await requireCtx();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 12) return { error: "New password must be at least 12 characters." };
  const db = await getDb();
  const [u] = await db.select({ passwordHash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, ctx.userId)).limit(1);
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) return { error: "Your current password is incorrect." };
  if (await bcrypt.compare(next, u.passwordHash)) return { error: "The new password must be different." };
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(next, 12) }).where(eq(schema.users.id, ctx.userId));
  await audit(ctx.tenantId, ctx.userId, "user.password_changed", "user", ctx.userId);
  return { ok: "Password changed." };
}
