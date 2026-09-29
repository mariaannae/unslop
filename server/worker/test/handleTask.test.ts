import { scoreV1Task, type AnyTask } from "@unslop/shared";
import { describe, expect, it } from "vitest";
import { createKvTaskCache } from "../src/cache";
import { handleTask, type TaskHandlerDeps } from "../src/handlers/task";
import { ProviderError, type Provider } from "@unslop/shared";
import { createKvRateLimiter } from "../src/rateLimit";
import { createMemoryKv } from "./memoryKv";

const payload = {
  original: "In today's fast-paced world, sourdough is a testament to patience.",
  current: "My starter smells like beer and I still don't trust it.",
};

const goodJson = JSON.stringify({
  score: 4,
  tells: [{ label: "beer", quote: "smells like beer" }],
  meaning_preserved: true,
  fluent: true,
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
  const tasks = new Map<string, AnyTask>([[scoreV1Task.id, scoreV1Task]]);
  const provider = fakeProvider(async () => goodJson);
  const deps: TaskHandlerDeps & { provider: typeof provider } = {
    getTask: (id) => tasks.get(id),
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
      version: 1,
      cached: false,
      result: {
        score: 4,
        tells: [{ label: "beer", quote: "smells like beer" }],
        meaning_preserved: true,
        fluent: true,
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
