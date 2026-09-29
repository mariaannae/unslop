import type { KvStore } from "./kv";

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window ends. */
  retryAfterSeconds: number;
};

export interface RateLimiter {
  check(clientKey: string, nowMs?: number): Promise<RateLimitDecision>;
}

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
};

/**
 * Fixed-window counter per client key stored in KV.
 *
 * KV is eventually consistent, so this is a best-effort brake against abuse
 * rather than an exact quota. It can be swapped for Cloudflare's rate-limit
 * binding later without touching the task handler.
 */
export function createKvRateLimiter(kv: KvStore, options: RateLimitOptions): RateLimiter {
  const windowMs = options.windowSeconds * 1000;
  return {
    async check(clientKey, nowMs = Date.now()) {
      const windowStart = Math.floor(nowMs / windowMs) * windowMs;
      const key = `rl:${clientKey}:${windowStart}`;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000));

      const current = Number.parseInt((await kv.get(key)) ?? "0", 10) || 0;
      if (current >= options.limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }

      const next = current + 1;
      // KV requires expirationTtl >= 60s; keep the counter around a little past the window.
      await kv.put(key, String(next), { expirationTtl: Math.max(60, options.windowSeconds * 2) });
      return { allowed: true, remaining: options.limit - next, retryAfterSeconds };
    },
  };
}
