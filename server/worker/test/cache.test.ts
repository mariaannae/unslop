import { describe, expect, it } from "vitest";
import { buildCacheKey, createKvTaskCache } from "../src/cache";
import { createMemoryKv } from "./memoryKv";

describe("buildCacheKey", () => {
  it("is stable across key order in the payload", async () => {
    const a = await buildCacheKey("score-v1", 1, { original: "x", current: "y" });
    const b = await buildCacheKey("score-v1", 1, { current: "y", original: "x" });
    expect(a).toBe(b);
    expect(a).toMatch(/^task:score-v1@1:[0-9a-f]{64}$/);
  });

  it("changes with payload, task id, and version", async () => {
    const base = await buildCacheKey("score-v1", 1, { original: "x", current: "y" });
    expect(await buildCacheKey("score-v1", 1, { original: "x", current: "z" })).not.toBe(base);
    expect(await buildCacheKey("score-v2", 1, { original: "x", current: "y" })).not.toBe(base);
    expect(await buildCacheKey("score-v1", 2, { original: "x", current: "y" })).not.toBe(base);
  });
});

describe("KV task cache", () => {
  it("round-trips JSON values with the configured TTL", async () => {
    const T0 = 1_700_000_000_000;
    const kv = createMemoryKv(() => T0);
    const cache = createKvTaskCache(kv, 3600);
    expect(await cache.get("k")).toBeUndefined();
    await cache.put("k", { score: 4, tells: [] });
    expect(await cache.get("k")).toEqual({ score: 4, tells: [] });
    expect(kv.entries.get("k")?.expiresAt).toBe(T0 + 3600 * 1000);
  });

  it("treats corrupt entries as misses", async () => {
    const kv = createMemoryKv();
    await kv.put("k", "{not json");
    expect(await createKvTaskCache(kv, 60).get("k")).toBeUndefined();
  });
});
