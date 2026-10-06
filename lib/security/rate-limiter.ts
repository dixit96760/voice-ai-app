import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deployment-Safe Rate Limiter Interface
 * Provides distributed sliding-window / token-bucket rate limiting backed by PostgreSQL
 * to ensure reliability across serverless instances and horizontally scaled containers.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string, capacity: number, refillRatePerSec: number, cost?: number): Promise<RateLimitResult>;
}

/**
 * In-memory token bucket for test environments or offline fallbacks
 */
class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  async consume(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    cost: number = 1
  ): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillRatePerSec);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfterMs: 0,
      };
    }

    const deficit = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / refillRatePerSec) * 1000);

    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/**
 * PostgreSQL-backed distributed rate limiter using check_rate_limit RPC
 */
class PostgresRateLimiter implements RateLimiter {
  private fallbackMemory = new MemoryRateLimiter();

  async consume(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    cost: number = 1
  ): Promise<RateLimitResult> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: key,
        p_capacity: capacity,
        p_refill_rate: refillRatePerSec,
        p_cost: cost,
      });

      const res = data as { allowed?: boolean; remaining?: number; retry_after_ms?: number } | null;

      if (error || !res) {
        // Graceful fallback to memory on database connectivity issue
        return this.fallbackMemory.consume(key, capacity, refillRatePerSec, cost);
      }

      return {
        allowed: Boolean(res.allowed),
        remaining: Number(res.remaining || 0),
        retryAfterMs: Number(res.retry_after_ms || 0),
      };
    } catch {
      return this.fallbackMemory.consume(key, capacity, refillRatePerSec, cost);
    }
  }
}

export const memoryRateLimiter = new MemoryRateLimiter();
export const distributedRateLimiter: RateLimiter = new PostgresRateLimiter();

/**
 * Convenience helper for rate limiting critical API routes
 */
export async function assertRateLimit(
  key: string,
  capacity: number = 60,
  refillRatePerSec: number = 1,
  cost: number = 1
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test") {
    return memoryRateLimiter.consume(key, capacity, refillRatePerSec, cost);
  }
  return distributedRateLimiter.consume(key, capacity, refillRatePerSec, cost);
}
