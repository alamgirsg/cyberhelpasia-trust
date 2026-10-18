import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Evidence/file storage behind one interface, so files can live on the local disk (default) or
 * in an S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO, …). Pick with
 * STORAGE_DRIVER; `local` keeps the existing on-disk behaviour and is the default, so nothing
 * changes until S3 is configured. Storage keys are always server-generated as `<tenantId>/<uuid>`.
 *
 * S3 config: S3_BUCKET (required), S3_REGION, S3_ENDPOINT (for S3-compatible providers),
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE.
 */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

export class ObjectNotFound extends Error {}

/** Keys are generated internally, but validate anyway so a stored value can never traverse out. */
function assertSafeKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\0")) throw new ObjectNotFound("bad key");
}

class LocalStorage implements Storage {
  private root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
  async put(key: string, body: Buffer): Promise<void> {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new ObjectNotFound("bad key");
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { mode: 0o600 });
  }
  async get(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new ObjectNotFound("bad key");
    try {
      return await readFile(full);
    } catch {
      throw new ObjectNotFound(key);
    }
  }
}

class S3Storage implements Storage {
  private bucket = process.env.S3_BUCKET!;
  private clientPromise = this.makeClient();
  private async makeClient() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const creds =
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
        : undefined;
    return new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(process.env.S3_ENDPOINT),
      credentials: creds,
      // We verify integrity with our own SHA-256, so skip the SDK's added checksums; this also
      // keeps requests plain (no aws-chunked) for broad S3-compatible provider support.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      throw new ObjectNotFound(key);
    }
  }
}

let instance: Storage | undefined;

export function getStorage(): Storage {
  if (instance) return instance;
  if ((process.env.STORAGE_DRIVER || "local") === "s3") {
    if (!process.env.S3_BUCKET) throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET");
    return (instance = new S3Storage());
  }
  return (instance = new LocalStorage());
}
