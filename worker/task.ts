import type { TaskErrorCode, TaskFailure, TaskRequest, TaskSuccess } from "../shared/api";
import { callableTasks, runTask, type TaskCache } from "../shared/runTask";
import { ProviderError, TaskError, type Provider } from "../shared/types";

export type TaskHandlerDeps = {
  provider: Provider;
  cache: TaskCache;
  rateLimiter: RateLimiter;
  log?: (message: string, detail?: unknown) => void;
};

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/task
 *
 * rate limit -> decode body -> resolve task -> runTask (validate, cache, call,
 * parse, store) -> respond. Every failure becomes a structured error body.
 */
export async function handleTask(request: Request, deps: TaskHandlerDeps): Promise<Response> {
  try {
    if (request.method !== "POST") {
      throw new HttpError("bad_request", "use POST", { allow: "POST" });
    }

    const clientKey = request.headers.get("cf-connecting-ip") ?? "unknown";
    const decision = await deps.rateLimiter.check(clientKey);
    if (!decision.allowed) {
      throw new HttpError("rate_limited", "too many requests; slow down", {
        "retry-after": String(decision.retryAfterSeconds),
      });
    }

    const body = await readTaskRequest(request);
    const task = callableTasks.get(body.taskId);
    if (!task) {
      throw new HttpError("unknown_task", `unknown task "${body.taskId}"`);
    }

    const { result, cached } = await runTask(task, body.payload, deps);
    const success: TaskSuccess<unknown> = {
      ok: true,
      taskId: task.id,
      version: task.version,
      result,
      cached,
    };
    return jsonResponse(success);
  } catch (error) {
    return errorResponse(toHttpError(error, deps.log));
  }
}

function toHttpError(error: unknown, log: TaskHandlerDeps["log"]): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof TaskError) return new HttpError(error.code, error.message);
  if (error instanceof ProviderError) {
    // Full detail goes to the log; players get a short, non-leaky message.
    log?.("provider error", { status: error.status, message: error.message });
    return new HttpError(
      "provider_error",
      `The judge is unavailable right now${error.status ? ` (HTTP ${error.status})` : ""}. Try again in a moment.`,
    );
  }
  log?.("unhandled error in /api/task", error);
  return new HttpError("provider_error", "unexpected server error");
}

async function readTaskRequest(request: Request): Promise<TaskRequest> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    throw new HttpError("bad_request", "request body too large");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError("bad_request", "body must be JSON");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new HttpError("bad_request", "body must be a JSON object");
  }
  const { taskId, payload } = json as Record<string, unknown>;
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new HttpError("bad_request", '"taskId" must be a non-empty string');
  }
  return { taskId, payload };
}

// ---------------------------------------------------------------------------
// JSON responses and structured errors

const STATUS_BY_CODE: Record<TaskErrorCode, number> = {
  bad_request: 400,
  invalid_payload: 400,
  unknown_task: 404,
  rate_limited: 429,
  provider_error: 502,
  parse_error: 502,
  server_misconfigured: 500,
};

const RETRYABLE: ReadonlySet<TaskErrorCode> = new Set([
  "rate_limited",
  "provider_error",
  "parse_error",
]);

export class HttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    readonly code: TaskErrorCode,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.status = STATUS_BY_CODE[code];
    this.retryable = RETRYABLE.has(code);
  }
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function errorResponse(error: HttpError): Response {
  const body: TaskFailure = {
    ok: false,
    error: { code: error.code, message: error.message, retryable: error.retryable },
  };
  return jsonResponse(body, error.status, error.headers);
}

// ---------------------------------------------------------------------------
// KV-backed cache and rate limiter

/**
 * The slice of Cloudflare's KVNamespace used here. Tests substitute an
 * in-memory implementation.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export function createKvTaskCache(kv: KvStore, ttlSeconds: number): TaskCache {
  return {
    async get(key) {
      const stored = await kv.get(key);
      if (stored === null) return undefined;
      try {
        return JSON.parse(stored) as unknown;
      } catch {
        // A corrupt entry is treated as a miss and overwritten on the next put.
        return undefined;
      }
    },
    async put(key, value) {
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    },
  };
}

export interface RateLimiter {
  check(
    clientKey: string,
    nowMs?: number,
  ): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>;
}

/**
 * Fixed-window counter per client key stored in KV.
 *
 * KV is eventually consistent, so this is a best-effort brake against abuse
 * rather than an exact quota. It can be swapped for Cloudflare's rate-limit
 * binding later without touching the task handler.
 */
export function createKvRateLimiter(
  kv: KvStore,
  options: { limit: number; windowSeconds: number },
): RateLimiter {
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
