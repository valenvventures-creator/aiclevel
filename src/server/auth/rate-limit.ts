import "server-only";

/**
 * Fixed-window rate limiter. In-memory per instance — adequate for a single
 * node and for demo mode. Production deployments should back this with a
 * shared store (e.g. Upstash Redis or a Postgres table); the interface is
 * intentionally small so the backend can be swapped.
 */
interface Bucket { count: number; resetAt: number }
const g = globalThis as unknown as { __taRate?: Map<string, Bucket> };
const buckets = (g.__taRate ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfterMs: b.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}
