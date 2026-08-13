// Per-caller request ceiling for the chat endpoint.
//
// This is an in-memory bucket, so on Vercel it is per-instance: a user spread
// across N warm lambdas gets up to N× the limit, and the counter resets on a
// cold start. That is enough to stop one client hammering the endpoint in a
// loop, which is what this is for — it is NOT a durable quota and it will not
// stop a distributed attacker. Swap the body for Vercel KV / Upstash once
// there's a store to point at; the call site doesn't change.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const WINDOW_MS = 60_000;
export const MAX_REQUESTS = 20;

// A long-lived instance would otherwise hold every key it has ever seen.
const MAX_KEYS = 10_000;

const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: { windowMs?: number; max?: number } = {}
): RateLimitResult {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const max = opts.max ?? MAX_REQUESTS;

  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= max) {
    hits.set(key, recent);
    return {
      ok: false,
      remaining: 0,
      // recent[0] is the oldest hit still in the window; the caller is free
      // again one window after it.
      retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    for (const [k, timestamps] of hits) {
      if (timestamps.every((t) => t <= cutoff)) hits.delete(k);
    }
  }

  return { ok: true, remaining: max - recent.length, retryAfterSeconds: 0 };
}

// Test seam — the module-level Map otherwise leaks state between cases.
export function resetRateLimits() {
  hits.clear();
}
