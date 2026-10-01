import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role } from "@/db/schema";

export type Ctx = {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  role: Role;
};

/** Loads the signed-in user and their tenant membership, or null. Membership is re-checked on every request. */
export async function getCtx(): Promise<Ctx | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const db = await getDb();
  const rows = await db
    .select({
      userId: schema.users.id,
      userName: schema.users.name,
      userEmail: schema.users.email,
      tenantId: schema.tenants.id,
      tenantName: schema.tenants.name,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.memberships.tenantId))
    .where(and(eq(schema.memberships.userId, s.uid), eq(schema.memberships.tenantId, s.tid)))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

const WRITE_ROLES: Role[] = ["owner", "admin", "contributor"];

export async function requireWriter(): Promise<Ctx> {
  const ctx = await requireCtx();
  if (!WRITE_ROLES.includes(ctx.role)) throw new Error("Your role is read-only.");
  return ctx;
}
