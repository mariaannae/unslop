import { describe, expect, it } from "vitest";
import { ProviderError, type Provider } from "../shared/types";
import {
  createKvRateLimiter,
  createKvTaskCache,
  handleTask,
  type KvStore,
  type TaskHandlerDeps,
} from "./task";

/** In-memory KvStore with TTL support driven by an injectable clock. */
function createMemoryKv(clock: () => number = Date.now): KvStore & {
  entries: Map<string, { value: string; expiresAt?: number }>;
} {
  const entries = new Map<string, { value: string; expiresAt?: number }>();
  return {
    entries,
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt <= clock()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, options) {
      entries.set(key, {
        value,
        expiresAt: options?.expirationTtl ? clock() + options.expirationTtl * 1000 : undefined,
      });
    },
  };
}

const payload = {
  original: "In today's fast-paced world, sourdough is a testament to patience.",
  current: "My starter smells like beer and I still don't trust it.",
};

const goodJson = JSON.stringify({
  score: 4,
  tells: [{ label: "beer", quote: "smells like beer" }],
  meaning_preserved: true,
  grammatically_correct: true,
});

function fakeProvider(respond: () => Promise<string>): Provider & { calls: number } {
  const provider = {
    calls: 0,
    async complete() {
      provider.calls += 1;
      return { text: await respond(), stopReason: "end_turn" };
    },
  };
  return provider;
}

function makeDeps(overrides: Partial<TaskHandlerDeps> = {}) {
  const provider = fakeProvider(async () => goodJson);
  const deps: TaskHandlerDeps & { provider: typeof provider } = {
    provider,
    cache: createKvTaskCache(createMemoryKv(), 60),
    rateLimiter: createKvRateLimiter(createMemoryKv(), { limit: 100, windowSeconds: 60 }),
    log: () => {},
    ...overrides,
  } as TaskHandlerDeps & { provider: typeof provider };
  return deps;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (res: Response) => res.json() as Promise<any>;

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://worker/api/task", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/task", () => {
  it("runs the task, parses, and caches on success", async () => {
    const deps = makeDeps();
    const res = await handleTask(post({ taskId: "score-v1", payload }), deps);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toEqual({
      ok: true,
      taskId: "score-v1",
      version: 2,
      cached: false,
      result: {
        score: 4,
        tells: [{ label: "beer", quote: "smells like beer" }],
        meaning_preserved: true,
        grammatically_correct: true,
        warnings: [],
      },
    });

    const again = await handleTask(post({ taskId: "score-v1", payload }), deps);
    const secondBody = await readJson(again);
    expect(secondBody.cached).toBe(true);
    expect(secondBody.result.score).toBe(4);
    expect(deps.provider.calls).toBe(1);
  });

  it("rejects non-POST", async () => {
    const res = await handleTask(new Request("http://worker/api/task"), makeDeps());
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON and malformed envelopes", async () => {
    const deps = makeDeps();
    expect((await handleTask(post("{nope"), deps)).status).toBe(400);
    expect((await handleTask(post([1, 2]), deps)).status).toBe(400);
    expect((await handleTask(post({ payload }), deps)).status).toBe(400);
    expect(deps.provider.calls).toBe(0);
  });

  it("returns 404 for an unregistered task", async () => {
    const deps = makeDeps();
    const res = await handleTask(post({ taskId: "generate-v1", payload }), deps);
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect(body.error.code).toBe("unknown_task");
    expect(body.error.retryable).toBe(false);
    expect(deps.provider.calls).toBe(0);
  });

  it("returns 400 for a payload the task rejects", async () => {
    const deps = makeDeps();
    const res = await handleTask(post({ taskId: "score-v1", payload: { original: "x" } }), deps);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error.code).toBe("invalid_payload");
    expect(deps.provider.calls).toBe(0);
  });

  it("returns 502 provider_error and caches nothing when the provider fails", async () => {
    const provider = fakeProvider(async () => {
      throw new ProviderError("Anthropic API error 529: overloaded", 529);
    });
    const cache = createKvTaskCache(createMemoryKv(), 60);
    const deps = makeDeps({ provider, cache });
    const res = await handleTask(post({ taskId: "score-v1", payload }), deps);
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error.code).toBe("provider_error");
    expect(body.error.retryable).toBe(true);
    expect(body.error.message).toBe(
      "The judge is unavailable right now (HTTP 529). Try again in a moment.",
    );
    expect(body.error.message).not.toContain("overloaded");

    // A later successful call should still hit the provider, not a poisoned cache.
    const okDeps = makeDeps({ cache });
    const retry = await handleTask(post({ taskId: "score-v1", payload }), okDeps);
    expect((await readJson(retry)).cached).toBe(false);
    expect(okDeps.provider.calls).toBe(1);
  });

  it("returns 502 parse_error and caches nothing when the model output is unparseable", async () => {
    const provider = fakeProvider(async () => "Sorry, I cannot rate this.");
    const cache = createKvTaskCache(createMemoryKv(), 60);
    const deps = makeDeps({ provider, cache });
    const res = await handleTask(post({ taskId: "score-v1", payload }), deps);
    expect(res.status).toBe(502);
    expect((await readJson(res)).error.code).toBe("parse_error");

    const okDeps = makeDeps({ cache });
    const retry = await handleTask(post({ taskId: "score-v1", payload }), okDeps);
    expect((await readJson(retry)).cached).toBe(false);
  });

  it("rate-limits per client IP with a retry-after header", async () => {
    const deps = makeDeps({
      rateLimiter: createKvRateLimiter(createMemoryKv(), { limit: 2, windowSeconds: 60 }),
    });
    expect((await handleTask(post({ taskId: "score-v1", payload }), deps)).status).toBe(200);
    expect((await handleTask(post({ taskId: "score-v1", payload }), deps)).status).toBe(200);
    const blocked = await handleTask(post({ taskId: "score-v1", payload }), deps);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await readJson(blocked)).error.code).toBe("rate_limited");

    const other = await handleTask(
      post({ taskId: "score-v1", payload }, { "cf-connecting-ip": "5.6.7.8" }),
      deps,
    );
    expect(other.status).toBe(200);
  });

  it("rejects oversized bodies before parsing", async () => {
    const res = await handleTask(
      post({ taskId: "score-v1", payload }, { "content-length": String(1024 * 1024) }),
      makeDeps(),
    );
    expect(res.status).toBe(400);
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
