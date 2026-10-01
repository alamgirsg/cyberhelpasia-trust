"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";
import { checkSecondFactor, hashRecovery, newRecoveryCodes } from "@/lib/mfa";
import { newSecret, verify } from "@/lib/totp";
import { rateLimit } from "@/lib/ratelimit";

export type MfaState = { error?: string; codes?: string[]; done?: string } | undefined;

async function me() {
  const ctx = await requireCtx();
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.userId)).limit(1);
  return { ctx, u, db };
}

export async function startMfa() {
  const { ctx, u, db } = await me();
  if (u.mfaEnabledAt) return;
  await db.update(schema.users).set({ mfaSecretEnc: encrypt(newSecret()), mfaLastStep: null }).where(eq(schema.users.id, u.id));
  await audit(ctx.tenantId, u.id, "user.mfa_enrol_started", "user", u.id);
  revalidatePath("/app/settings/security");
}

export async function confirmMfa(_: MfaState, form: FormData): Promise<MfaState> {
  const { ctx, u, db } = await me();
  if (u.mfaEnabledAt) return { error: "Two-step verification is already on." };
  if (!u.mfaSecretEnc) return { error: "Start setup first." };
  if (!rateLimit(`mfa-enrol:${u.id}`, 10, 10 * 60 * 1000).ok) return { error: "Too many attempts. Wait a few minutes." };

  const step = verify(decrypt(u.mfaSecretEnc), String(form.get("code") ?? "").trim());
  if (step === null) return { error: "That code doesn't match. Check your phone's clock and try the newest code." };

  const codes = newRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ mfaEnabledAt: new Date(), mfaLastStep: step }).where(eq(schema.users.id, u.id));
    await tx.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, u.id));
    await tx.insert(schema.mfaRecoveryCodes).values(codes.map((c) => ({ userId: u.id, codeHash: hashRecovery(c) })));
  });
  await audit(ctx.tenantId, u.id, "user.mfa_enabled", "user", u.id);
  return { codes };
}

export async function disableMfa(_: MfaState, form: FormData): Promise<MfaState> {
  const { ctx, u, db } = await me();
  if (!u.mfaEnabledAt) return { error: "Two-step verification is not on." };
  if (!rateLimit(`mfa-disable:${u.id}`, 5, 10 * 60 * 1000).ok) return { error: "Too many attempts. Wait a few minutes." };
  const method = await checkSecondFactor(u, String(form.get("code") ?? ""));
  if (!method) return { error: "Enter a current code or a recovery code to turn this off." };

  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ mfaSecretEnc: null, mfaEnabledAt: null, mfaLastStep: null }).where(eq(schema.users.id, u.id));
    await tx.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, u.id));
  });
  await audit(ctx.tenantId, u.id, "user.mfa_disabled", "user", u.id);
  revalidatePath("/app/settings/security");
  return { done: "Two-step verification is off." };
}
