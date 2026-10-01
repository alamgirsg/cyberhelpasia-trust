import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const db = await getDb();
  const [ev] = await db
    .select()
    .from(schema.evidence)
    .where(and(eq(schema.evidence.id, id), eq(schema.evidence.tenantId, ctx.tenantId)))
    .limit(1);
  if (!ev) return new Response("Not found", { status: 404 });

  const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  const full = path.resolve(root, ev.storageKey);
  if (!full.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });

  const data = await readFile(full);
  await audit(ctx.tenantId, ctx.userId, "evidence.downloaded", "evidence", ev.id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": ev.mimeType,
      "Content-Disposition": `attachment; filename="${ev.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
