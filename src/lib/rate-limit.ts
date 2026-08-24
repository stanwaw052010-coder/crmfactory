import "server-only";

/**
 * Простий in-memory rate limiter — достатньо для одного інстансу
 * і для захисту логіну/реєстрації/публічного бронювання від brute force.
 *
 * Для горизонтального масштабування достатньо замінити `buckets`
 * на Redis (інтерфейс `consume()` лишається тим самим).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSec: number; remaining: number };

export function consume(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
      remaining: 0,
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0, remaining: limit - existing.count };
}

export const LIMITS = {
  login: { limit: 8, windowSec: 300 },
  register: { limit: 5, windowSec: 3600 },
  booking: { limit: 10, windowSec: 600 },
  search: { limit: 120, windowSec: 60 },
} as const;
