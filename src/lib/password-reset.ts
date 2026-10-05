import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sha256 } from "./crypto";

/** Looks up an unused, unexpired password-reset row by its raw token (only the hash is stored). */
export async function findReset(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.passwordResets)
    .where(
      and(
        eq(schema.passwordResets.tokenHash, sha256(token)),
        isNull(schema.passwordResets.usedAt),
        gt(schema.passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function anyTenant(userId: string): Promise<string> {
  const db = await getDb();
  const [m] = await db.select({ t: schema.memberships.tenantId }).from(schema.memberships).where(eq(schema.memberships.userId, userId)).limit(1);
  return m?.t ?? "";
}
