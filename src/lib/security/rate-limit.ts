/**
 * Rate limiting (Feature A.14). Sliding-window limiter keyed by an arbitrary
 * identifier (IP, userId, or API key). In-memory for a single instance now;
 * for multi-instance production, swap the store for Redis (INCR + EXPIRE) — the
 * `checkRate` contract stays the same.
 */
type Stamp = number;
const store = new Map<string, Stamp[]>();

// Periodically prune old entries so the map doesn't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, stamps] of store) {
    const fresh = stamps.filter((t) => now - t < 3_600_000); // keep last hour
    if (fresh.length) store.set(k, fresh);
    else store.delete(k);
  }
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSec: number;
}

/**
 * Allow at most `limit` events per `windowSec` for `key`.
 * Returns whether this event is allowed (and records it if so).
 */
export function checkRate(
  key: string,
  limit: number,
  windowSec: number
): RateResult {
  const now = Date.now();
  sweep(now);
  const windowMs = windowSec * 1000;
  const stamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);

  if (stamps.length >= limit) {
    const oldest = stamps[0];
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    store.set(key, stamps);
    return { allowed: false, remaining: 0, limit, retryAfterSec };
  }

  stamps.push(now);
  store.set(key, stamps);
  return { allowed: true, remaining: limit - stamps.length, limit, retryAfterSec: 0 };
}

/** Best-effort client IP from a request (proxy-aware). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Thrown when a limit is exceeded; mapped to HTTP 429 in respond.ts. */
export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super("Too many requests. Please slow down.");
    this.name = "RateLimitError";
  }
}

/** Convenience: enforce a limit or throw RateLimitError. */
export function enforceRate(key: string, limit: number, windowSec: number) {
  const r = checkRate(key, limit, windowSec);
  if (!r.allowed) throw new RateLimitError(r.retryAfterSec);
  return r;
}
