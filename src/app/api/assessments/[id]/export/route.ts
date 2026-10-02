import { getCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildAuditorPack } from "@/lib/auditor-pack";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  if (!rateLimit(`export:${ctx.tenantId}`, 20, 60 * 60 * 1000).ok) {
    return new Response("Too many exports. Try again later.", { status: 429 });
  }

  const pack = await buildAuditorPack(ctx.tenantId, ctx.tenantName, id, `${ctx.userName} <${ctx.userEmail}>`);
  if (!pack) return new Response("Not found", { status: 404 });

  await audit(ctx.tenantId, ctx.userId, "assessment.exported", "assessment", id, {
    evidenceFiles: pack.evidenceCount,
    integrityFailures: pack.integrityFailures,
  });

  return new Response(Buffer.from(pack.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
