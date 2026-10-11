// Fixed-window, in-memory rate limiter for the public Coach endpoint. One PM2
// process serves the app, so process memory is an adequate store; it resets on
// restart, which is acceptable for abuse protection (not billing).
export type RateLimiter = (key: string, now?: number) => { ok: boolean; retryAfterSec: number };

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  return (key, now = Date.now()) => {
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return { ok: true, retryAfterSec: 0 };
    }
    entry.count++;
    if (entry.count <= limit) return { ok: true, retryAfterSec: 0 };
    return { ok: false, retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000) };
  };
}
