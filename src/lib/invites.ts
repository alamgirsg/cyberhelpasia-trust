import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sha256 } from "./crypto";

/** Looks up an open, unexpired invite by its raw token (only the SHA-256 hash is stored). */
export async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ invite: schema.invites, tenantName: schema.tenants.name })
    .from(schema.invites)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.invites.tenantId))
    .where(
      and(
        eq(schema.invites.tokenHash, sha256(token)),
        isNull(schema.invites.acceptedAt),
        isNull(schema.invites.revokedAt),
        gt(schema.invites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}
