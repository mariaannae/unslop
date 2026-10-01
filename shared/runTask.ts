import { scoreV1Task } from "./scoreV1";
import { TaskError, type AnyTask, type Provider, type TaskDefinition } from "./types";

/**
 * Tasks the Worker is allowed to execute. Anything not listed here is rejected
 * with `unknown_task`. Script-only tasks (for example `generate-v1`) must not be
 * listed here.
 */
export const callableTasks: ReadonlyMap<string, AnyTask> = new Map<string, AnyTask>([
  [scoreV1Task.id, scoreV1Task],
]);

/** Where parsed results are kept: KV in the Worker, files on disk in the scripts. */
export interface TaskCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export type RunTaskDeps = {
  provider: Provider;
  cache: TaskCache;
  log?: (message: string, detail?: unknown) => void;
};

/**
 * Runs one task: validate payload -> cache lookup -> provider call -> parse ->
 * cache store. The Worker and the Node scripts both use this.
 *
 * Only successfully parsed results are cached, so a provider or parse failure
 * never poisons the cache. TaskError and ProviderError propagate to the caller.
 */
export async function runTask<Payload, Result>(
  task: TaskDefinition<Payload, Result>,
  input: unknown,
  deps: RunTaskDeps,
): Promise<{ result: Result; cached: boolean }> {
  const payload = task.validatePayload(input);
  const key = await buildCacheKey(task.id, task.version, payload);
  const hit = await deps.cache.get(key);
  if (hit !== undefined) return { result: hit as Result, cached: true };

  const response = await deps.provider.complete(task.buildRequest(payload));

  let result: Result;
  try {
    result = task.parse(response.text, payload);
  } catch (error) {
    if (error instanceof TaskError) {
      deps.log?.("parse error", { message: error.message, text: response.text });
    }
    throw error;
  }

  const warnings = (result as { warnings?: unknown }).warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    deps.log?.(`task ${task.id} parse warnings`, warnings);
  }

  await deps.cache.put(key, result);
  return { result, cached: false };
}

/**
 * Cache key = task id + task version + SHA-256 of the canonical payload, for
 * example `task:score-v1@1:<64 hex chars>`. Bumping a task's version therefore
 * invalidates every cached result for it.
 */
export async function buildCacheKey(
  taskId: string,
  version: number,
  payload: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `task:${taskId}@${version}:${hex}`;
}

/**
 * Deterministic JSON serialization: object keys sorted recursively, so `{a,b}`
 * and `{b,a}` payloads share a cache entry.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
