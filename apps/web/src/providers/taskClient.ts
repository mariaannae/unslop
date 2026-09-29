import type { TaskRequest, TaskResponse } from "@unslop/shared";

/**
 * The browser's only path to a model (spec §15–16). It posts `{taskId, payload}`
 * to the Worker and returns the typed result. It knows nothing about prompts,
 * models, or providers.
 */
export interface TaskClient {
  run<Result>(taskId: string, payload: unknown): Promise<TaskRunResult<Result>>;
}

export type TaskRunResult<Result> = {
  result: Result;
  version: number;
  cached: boolean;
};

export class TaskClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TaskClientError";
  }
}

export type TaskClientOptions = {
  /** Origin of the Worker (for example "https://unslop-worker.example.workers.dev"). Empty means same origin. */
  baseUrl?: string;
  fetch?: typeof fetch;
};

/**
 * Turns whatever was configured into a bare origin: trailing slashes and a
 * trailing "/api" are stripped, so both "https://host" and "https://host/api/"
 * end up posting to "https://host/api/task".
 */
export function normalizeApiOrigin(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
}

/** Build-time override for split hosting (spec B.8). Empty means same origin, which the Vite proxy serves in dev. */
export const DEFAULT_API_ORIGIN: string = normalizeApiOrigin(
  import.meta.env?.VITE_API_BASE_URL as string | undefined,
);

export function createTaskClient(options: TaskClientOptions = {}): TaskClient {
  const origin = normalizeApiOrigin(options.baseUrl ?? DEFAULT_API_ORIGIN);
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    async run<Result>(taskId: string, payload: unknown) {
      const body: TaskRequest = { taskId, payload };
      let response: Response;
      try {
        response = await fetchFn(`${origin}/api/task`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new TaskClientError(
          "network",
          `Could not reach the judge (${error instanceof Error ? error.message : String(error)}).`,
          true,
        );
      }

      let json: TaskResponse<Result>;
      try {
        json = (await response.json()) as TaskResponse<Result>;
      } catch {
        throw new TaskClientError(
          "bad_response",
          `Judge returned a non-JSON response (HTTP ${response.status}).`,
          true,
        );
      }

      if (!json || typeof json !== "object" || !("ok" in json)) {
        throw new TaskClientError(
          "bad_response",
          `Judge returned an unexpected response (HTTP ${response.status}).`,
          true,
        );
      }
      if (!json.ok) {
        const { code, message, retryable } = json.error;
        throw new TaskClientError(code, message, retryable);
      }
      return { result: json.result, version: json.version, cached: json.cached };
    },
  };
}
