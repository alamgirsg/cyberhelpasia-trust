"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireWriter } from "@/lib/auth";
import { audit } from "@/lib/audit";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["text/plain", ".txt"],
  ["text/csv", ".csv"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

export type UploadState = { error?: string; ok?: string } | undefined;

const metaSchema = z.object({
  assessmentId: z.string().uuid().or(z.literal("")),
  controlId: z.string().max(40).or(z.literal("")),
  description: z.string().max(500).optional(),
});

export async function uploadEvidence(_: UploadState, form: FormData): Promise<UploadState> {
  const ctx = await requireWriter();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "Files must be 10 MB or smaller." };
  const ext = ALLOWED.get(file.type);
  if (!ext) return { error: "Allowed types: PDF, PNG, JPG, TXT, CSV, DOCX, XLSX." };

  const meta = metaSchema.safeParse({
    assessmentId: form.get("assessmentId") ?? "",
    controlId: form.get("controlId") ?? "",
    description: (form.get("description") as string) || undefined,
  });
  if (!meta.success) return { error: "Invalid details." };

  const db = await getDb();
  if (meta.data.assessmentId) {
    const own = await db
      .select({ id: schema.assessments.id })
      .from(schema.assessments)
      .where(and(eq(schema.assessments.id, meta.data.assessmentId), eq(schema.assessments.tenantId, ctx.tenantId)))
      .limit(1);
    if (!own.length) return { error: "Assessment not found." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  // Storage key never uses the client file name, so it cannot be used for path traversal.
  const storageKey = path.posix.join(ctx.tenantId, `${randomUUID()}${ext}`);
  const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  await mkdir(path.join(root, ctx.tenantId), { recursive: true });
  await writeFile(path.join(root, storageKey), buf, { mode: 0o600 });

  const [row] = await db
    .insert(schema.evidence)
    .values({
      tenantId: ctx.tenantId,
      assessmentId: meta.data.assessmentId || null,
      controlId: meta.data.controlId || null,
      fileName: file.name.slice(0, 200),
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256,
      description: meta.data.description ?? null,
      uploadedBy: ctx.userId,
    })
    .returning({ id: schema.evidence.id });

  await audit(ctx.tenantId, ctx.userId, "evidence.uploaded", "evidence", row.id, {
    fileName: file.name,
    sha256,
    controlId: meta.data.controlId || null,
  });
  revalidatePath("/app/evidence");
  if (meta.data.assessmentId) revalidatePath(`/app/assessments/${meta.data.assessmentId}`);
  return { ok: `Uploaded ${file.name}` };
}
