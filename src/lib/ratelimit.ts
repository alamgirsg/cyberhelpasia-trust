import "server-only";

/**
 * Small fixed-window rate limiter kept in process memory.
 * Fine for a single app instance; move to Redis when running more than one instance.
 */
type Bucket = { count: number; resetAt: number };
const g = globalThis as typeof globalThis & { __rl?: Map<string, Bucket> };
const buckets = (g.__rl ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryInSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryInSec: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryInSec: Math.ceil((b.resetAt - now) / 1000) };
}

export function resetLimit(key: string) {
  buckets.delete(key);
}
