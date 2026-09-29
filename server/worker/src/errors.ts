import type { TaskErrorCode, TaskFailure } from "@unslop/shared";

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
