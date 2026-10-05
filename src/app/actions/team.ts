"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ROLES, type Role } from "@/db/schema";
import { requireCtx, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { findInvite } from "@/lib/invites";
import { appUrl, inviteEmail, sendEmail } from "@/lib/email";
import {
  MFA_PENDING_COOKIE,
  SESSION_COOKIE,
  mfaPendingCookieOptions,
  sessionCookieOptions,
  signMfaPending,
  signSession,
} from "@/lib/session";

const INVITE_DAYS = 7;

async function requireManager(): Promise<Ctx> {
  const ctx = await requireCtx();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can manage the team.");
  return ctx;
}

/** Admins can grant up to admin; only owners can create or change owners. */
function canGrant(actor: Role, role: Role) {
  return actor === "owner" || role !== "owner";
}

export type InviteState = { error?: string; link?: string; email?: string; emailed?: boolean } | undefined;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
});

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const ctx = await requireManager();
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, role } = parsed.data;
  if (!canGrant(ctx.role, role)) return { error: "Only an owner can invite another owner." };
  if (!rateLimit(`invite:${ctx.tenantId}`, 50, 24 * 60 * 60 * 1000).ok) return { error: "Daily invite limit reached." };

  const db = await getDb();
  const already = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.tenantId, ctx.tenantId), eq(schema.users.email, email)))
    .limit(1);
  if (already.length) return { error: "This person is already a member." };

  // Revoke any earlier pending invite for the same email so only one link works.
  await db
    .update(schema.invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.invites.tenantId, ctx.tenantId), eq(schema.invites.email, email), isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt)));

  const token = randomToken();
  const [inv] = await db
    .insert(schema.invites)
    .values({
      tenantId: ctx.tenantId,
      email,
      role,
      tokenHash: sha256(token),
      invitedBy: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5),
    })
    .returning({ id: schema.invites.id });
  await audit(ctx.tenantId, ctx.userId, "invite.created", "invite", inv.id, { email, role });

  const link = `${appUrl()}/invite/${token}`;
  const mail = inviteEmail(ctx.tenantName, role, link);
  const { sent } = await sendEmail({ to: email, ...mail });
  if (sent) await audit(ctx.tenantId, ctx.userId, "invite.emailed", "invite", inv.id, { email });

  revalidatePath("/app/settings/team");
  return { link, email, emailed: sent };
}

export async function revokeInvite(form: FormData) {
  const ctx = await requireManager();
  const id = z.string().uuid().parse(form.get("inviteId"));
  const db = await getDb();
  await db
    .update(schema.invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.invites.id, id), eq(schema.invites.tenantId, ctx.tenantId)));
  await audit(ctx.tenantId, ctx.userId, "invite.revoked", "invite", id);
  revalidatePath("/app/settings/team");
}

async function ownerCount(tenantId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.tenantId, tenantId), eq(schema.memberships.role, "owner")));
  return rows.length;
}

async function targetMembership(ctx: Ctx, membershipId: string) {
  const db = await getDb();
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.tenantId, ctx.tenantId)))
    .limit(1);
  if (!m) throw new Error("Member not found");
  return m;
}

export async function changeRole(form: FormData) {
  const ctx = await requireManager();
  const membershipId = z.string().uuid().parse(form.get("membershipId"));
  const role = z.enum(ROLES).parse(form.get("role"));
  const m = await targetMembership(ctx, membershipId);
  if (!canGrant(ctx.role, role) || !canGrant(ctx.role, m.role)) throw new Error("Only an owner can change owner roles.");
  if (m.role === "owner" && role !== "owner" && (await ownerCount(ctx.tenantId)) <= 1) {
    throw new Error("A workspace needs at least one owner.");
  }
  const db = await getDb();
  await db.update(schema.memberships).set({ role }).where(eq(schema.memberships.id, m.id));
  await audit(ctx.tenantId, ctx.userId, "member.role_changed", "membership", m.id, { from: m.role, to: role });
  revalidatePath("/app/settings/team");
}

export async function removeMember(form: FormData) {
  const ctx = await requireManager();
  const membershipId = z.string().uuid().parse(form.get("membershipId"));
  const m = await targetMembership(ctx, membershipId);
  if (!canGrant(ctx.role, m.role)) throw new Error("Only an owner can remove an owner.");
  if (m.role === "owner" && (await ownerCount(ctx.tenantId)) <= 1) throw new Error("A workspace needs at least one owner.");
  const db = await getDb();
  await db.delete(schema.memberships).where(eq(schema.memberships.id, m.id));
  await audit(ctx.tenantId, ctx.userId, "member.removed", "membership", m.id, { userId: m.userId });
  if (m.userId === ctx.userId) {
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/login");
  }
  revalidatePath("/app/settings/team");
}

// ---------- Accepting an invite (public page) ----------

export type AcceptState = { error?: string; values?: Record<string, string> } | undefined;

export async function acceptInvite(_: AcceptState, form: FormData): Promise<AcceptState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { name };
  if (!rateLimit(`accept:${sha256(token).slice(0, 16)}`, 10, 15 * 60 * 1000).ok) return { error: "Too many attempts. Try again later.", values };

  const found = await findInvite(token);
  if (!found) return { error: "This invitation is invalid or has expired. Ask for a new one." };
  const { invite } = found;
  const db = await getDb();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, invite.email)).limit(1);

  let userId: string;
  if (existing) {
    if (!(await bcrypt.compare(password, existing.passwordHash))) return { error: "Password is incorrect for this account.", values };
    userId = existing.id;
  } else {
    if (name.length < 2) return { error: "Enter your name.", values };
    if (password.length < 12) return { error: "Use at least 12 characters for your password.", values };
    const [u] = await db
      .insert(schema.users)
      .values({ email: invite.email, name, passwordHash: await bcrypt.hash(password, 12) })
      .returning({ id: schema.users.id });
    userId = u.id;
  }

  // Mark accepted only if still open (prevents double use in a race).
  const claimed = await db
    .update(schema.invites)
    .set({ acceptedAt: new Date() })
    .where(and(eq(schema.invites.id, invite.id), isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt)))
    .returning({ id: schema.invites.id });
  if (!claimed.length) return { error: "This invitation has already been used." };

  await db
    .insert(schema.memberships)
    .values({ tenantId: invite.tenantId, userId, role: invite.role })
    .onConflictDoNothing();
  await audit(invite.tenantId, userId, "invite.accepted", "invite", invite.id, { role: invite.role });

  const jar = await cookies();
  if (existing?.mfaEnabledAt) {
    jar.set(MFA_PENDING_COOKIE, await signMfaPending({ uid: userId, tid: invite.tenantId }), mfaPendingCookieOptions);
    redirect("/login/mfa");
  }
  jar.set(SESSION_COOKIE, await signSession({ uid: userId, tid: invite.tenantId }), sessionCookieOptions);
  redirect("/app");
}

// ---------- Switching workspace ----------

export async function switchWorkspace(form: FormData) {
  const ctx = await requireCtx();
  const tenantId = z.string().uuid().parse(form.get("tenantId"));
  const db = await getDb();
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, ctx.userId), eq(schema.memberships.tenantId, tenantId)))
    .limit(1);
  if (!m) throw new Error("Not a member of that workspace.");
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: ctx.userId, tid: tenantId }), sessionCookieOptions);
  await audit(tenantId, ctx.userId, "user.switched_workspace", "tenant", tenantId);
  redirect("/app");
}
