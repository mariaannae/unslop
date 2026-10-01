/**
 * Wire contract for `POST /api/task`.
 *
 * The client only ever sends a task id and a payload. Prompts, models, and
 * parsing rules live in the task definitions and run on the server.
 */
export type TaskRequest = {
  taskId: string;
  payload: unknown;
};

export type TaskErrorCode =
  | "bad_request"
  | "unknown_task"
  | "invalid_payload"
  | "rate_limited"
  | "provider_error"
  | "parse_error"
  | "server_misconfigured";

export type TaskSuccess<Result> = {
  ok: true;
  taskId: string;
  version: number;
  result: Result;
  cached: boolean;
};

export type TaskFailure = {
  ok: false;
  error: {
    code: TaskErrorCode;
    message: string;
    /** True when the same request may succeed if retried (network, provider, parse). */
    retryable: boolean;
  };
};

export type TaskResponse<Result> = TaskSuccess<Result> | TaskFailure;
