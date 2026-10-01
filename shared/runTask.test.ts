import { describe, expect, it } from "vitest";
import { buildCacheKey } from "./runTask";

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

  it("never changes format, so existing KV and disk caches stay valid", async () => {
    // SHA-256 of {"current":"y","original":"x"}. If this fails, every cached result is orphaned.
    expect(await buildCacheKey("score-v1", 1, { original: "x", current: "y" })).toBe(
      "task:score-v1@1:ed007e196ecf2622426593b77f3effacbe98ddbe06c741ab4abee4e085df9126",
    );
  });
});
