import { getDb, schema } from "@/db";

export async function audit(
  tenantId: string,
  actorId: string | null,
  action: string,
  objectType: string,
  objectId: string | null,
  detail?: Record<string, unknown>,
) {
  const db = await getDb();
  await db.insert(schema.auditEvents).values({ tenantId, actorId, action, objectType, objectId, detail });
}
