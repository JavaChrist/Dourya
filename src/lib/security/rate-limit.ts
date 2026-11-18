/**
 * Fixed-window rate limiter. The store is an interface so the logic can be
 * tested in memory; in production it is a Firestore collection written by the
 * Admin SDK only (see firestore-rate-limit-store.ts).
 */
export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export interface RateLimitStore {
  /** Atomically increments the counter of `key` for the window starting at `windowStart`, returns the new count. */
  increment(key: string, windowStart: number, expiresAt: number): Promise<number>;
}

/** Limits per sensitive action (per IP, plus per account when relevant). */
export const RATE_LIMITS = {
  "session:customer": { limit: 10, windowMs: 15 * 60_000 },
  "session:admin": { limit: 5, windowMs: 15 * 60_000 },
  "account:write": { limit: 30, windowMs: 15 * 60_000 },
  "account:data-request": { limit: 3, windowMs: 24 * 60 * 60_000 },
  "account:export": { limit: 5, windowMs: 60 * 60_000 },
  // E-mails: per IP and per account / per address (hashed), so nobody can flood an inbox.
  "email:verify:ip": { limit: 10, windowMs: 60 * 60_000 },
  "email:verify:uid": { limit: 3, windowMs: 60 * 60_000 },
  "email:reset:ip": { limit: 5, windowMs: 15 * 60_000 },
  "email:reset:address": { limit: 3, windowMs: 60 * 60_000 },
  "email:unsubscribe": { limit: 30, windowMs: 15 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export async function checkRateLimit(
  store: RateLimitStore,
  action: string,
  subject: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = now - (now % rule.windowMs);
  const windowEnd = windowStart + rule.windowMs;
  const count = await store.increment(`${action}:${subject}`, windowStart, windowEnd);
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterMs: count <= rule.limit ? 0 : windowEnd - now };
}

/** In-memory store, for tests only (not shared between server instances). */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, { windowStart: number; count: number }>();

  async increment(key: string, windowStart: number): Promise<number> {
    const current = this.counters.get(key);
    const next = current && current.windowStart === windowStart ? current.count + 1 : 1;
    this.counters.set(key, { windowStart, count: next });
    return next;
  }
}
