import {
  ProviderError,
  TaskError,
  type AnyTask,
  type Provider,
  type TaskRequest,
  type TaskSuccess,
} from "@unslop/shared";
import type { TaskCache } from "../cache";
import { buildCacheKey } from "../cache";
import { HttpError, errorResponse, jsonResponse } from "../errors";
import type { RateLimiter } from "../rateLimit";

export type TaskHandlerDeps = {
  getTask(taskId: string): AnyTask | undefined;
  provider: Provider;
  cache: TaskCache;
  rateLimiter: RateLimiter;
  log?: (message: string, detail?: unknown) => void;
};

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/task
 *
 * rate limit -> decode body -> resolve task -> validate payload -> cache lookup
 * -> provider call -> parse -> cache store -> respond.
 *
 * Only successfully parsed results are cached, so a provider or parse failure
 * is always retryable and never poisons the cache.
 */
export async function handleTask(request: Request, deps: TaskHandlerDeps): Promise<Response> {
  try {
    return await run(request, deps);
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    deps.log?.("unhandled error in /api/task", error);
    return errorResponse(new HttpError("provider_error", "unexpected server error"));
  }
}

async function run(request: Request, deps: TaskHandlerDeps): Promise<Response> {
  if (request.method !== "POST") {
    throw new HttpError("bad_request", "use POST", { allow: "POST" });
  }

  const clientKey = clientIdentifier(request);
  const decision = await deps.rateLimiter.check(clientKey);
  if (!decision.allowed) {
    throw new HttpError("rate_limited", "too many requests; slow down", {
      "retry-after": String(decision.retryAfterSeconds),
    });
  }

  const body = await readTaskRequest(request);
  const task = deps.getTask(body.taskId);
  if (!task) {
    throw new HttpError("unknown_task", `unknown task "${body.taskId}"`);
  }

  let payload: unknown;
  try {
    payload = task.validatePayload(body.payload);
  } catch (error) {
    if (error instanceof TaskError) throw new HttpError("invalid_payload", error.message);
    throw error;
  }

  const cacheKey = await buildCacheKey(task.id, task.version, payload);
  const cached = await deps.cache.get(cacheKey);
  if (cached !== undefined) {
    return jsonResponse(success(task, cached, true));
  }

  let response;
  try {
    response = await deps.provider.complete(task.buildRequest(payload));
  } catch (error) {
    if (error instanceof ProviderError) {
      // Full detail goes to the log; players get a short, non-leaky message.
      deps.log?.("provider error", { status: error.status, message: error.message });
      throw new HttpError(
        "provider_error",
        `The judge is unavailable right now${error.status ? ` (HTTP ${error.status})` : ""}. Try again in a moment.`,
      );
    }
    throw error;
  }

  let result: unknown;
  try {
    result = task.parse(response.text, payload);
  } catch (error) {
    if (error instanceof TaskError) {
      deps.log?.("parse error", { message: error.message, text: response.text });
      throw new HttpError("parse_error", error.message);
    }
    throw error;
  }

  const warnings = (result as { warnings?: unknown }).warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    deps.log?.(`task ${task.id} parse warnings`, warnings);
  }

  await deps.cache.put(cacheKey, result);
  return jsonResponse(success(task, result, false));
}

function success(task: AnyTask, result: unknown, cached: boolean): TaskSuccess<unknown> {
  return { ok: true, taskId: task.id, version: task.version, result, cached };
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

function clientIdentifier(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
