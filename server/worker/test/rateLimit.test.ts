import { describe, expect, it } from "vitest";
import { createKvRateLimiter } from "../src/rateLimit";
import { createMemoryKv } from "./memoryKv";

describe("KV rate limiter", () => {
  const T0 = 1_700_000_000_000;

  it("allows up to the limit within a window, then blocks", async () => {
    const limiter = createKvRateLimiter(
      createMemoryKv(() => T0),
      { limit: 3, windowSeconds: 60 },
    );
    expect((await limiter.check("ip-a", T0)).allowed).toBe(true);
    expect((await limiter.check("ip-a", T0 + 1000)).allowed).toBe(true);
    const third = await limiter.check("ip-a", T0 + 2000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = await limiter.check("ip-a", T0 + 3000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("keeps clients independent", async () => {
    const limiter = createKvRateLimiter(
      createMemoryKv(() => T0),
      { limit: 1, windowSeconds: 60 },
    );
    expect((await limiter.check("ip-a", T0)).allowed).toBe(true);
    expect((await limiter.check("ip-a", T0)).allowed).toBe(false);
    expect((await limiter.check("ip-b", T0)).allowed).toBe(true);
  });

  it("resets in the next window", async () => {
    const limiter = createKvRateLimiter(
      createMemoryKv(() => T0),
      { limit: 1, windowSeconds: 60 },
    );
    const windowStart = Math.floor(T0 / 60_000) * 60_000;
    expect((await limiter.check("ip-a", windowStart)).allowed).toBe(true);
    expect((await limiter.check("ip-a", windowStart + 59_000)).allowed).toBe(false);
    expect((await limiter.check("ip-a", windowStart + 60_000)).allowed).toBe(true);
  });

  it("stores counters with a TTL of at least 60 seconds", async () => {
    const kv = createMemoryKv(() => T0);
    const limiter = createKvRateLimiter(kv, { limit: 5, windowSeconds: 10 });
    await limiter.check("ip-a", T0);
    const [entry] = kv.entries.values();
    expect(entry?.expiresAt).toBe(T0 + 60_000);
  });
});
