/**
 * The contracts shared across folders: tasks and providers, used by the Worker
 * and the Node scripts, and the `/api/task` wire types at the end, which the web
 * app imports as types only.
 *
 * A task definition produces a provider-neutral request; only a provider
 * adapter (anthropic.ts, or the scripts' OpenAI adapter in scripts/common.ts)
 * translates it into a concrete API call.
 */
export type ProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderRequest = {
  /** Provider-specific model id (for example "claude-haiku-4-5"). */
  model: string;
  system: string;
  messages: ProviderMessage[];
  maxTokens: number;
  /** Omit for models that reject non-default sampling (Claude Sonnet 5.5 and newer, GPT-5). */
  temperature?: number;
  /** JSON Schema the provider should constrain its output to, when it supports that. */
  outputSchema?: Record<string, unknown>;
};

export type ProviderResponse = {
  /** Concatenated text output of the model. */
  text: string;
  stopReason: string | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

/**
 * Thrown by task definitions for invalid payloads and unparseable responses.
 * The Worker maps `code` onto an HTTP status and a structured error body.
 */
export class TaskError extends Error {
  constructor(
    public readonly code: "invalid_payload" | "parse_error",
    message: string,
  ) {
    super(message);
    this.name = "TaskError";
  }
}

export interface TaskDefinition<Payload, Result> {
  id: string;
  /** Bumped whenever prompt, model, schema, or parser changes. Part of the cache key. */
  version: number;
  model: string;
  /** Validates untrusted input from the client. Throws TaskError("invalid_payload"). */
  validatePayload(input: unknown): Payload;
  buildRequest(payload: Payload): ProviderRequest;
  /** Turns the raw provider text (or an already-parsed object) into a typed result. Throws TaskError("parse_error"). */
  parse(raw: unknown, payload: Payload): Result;
}

/**
 * A task that makes its own API calls (for example `score-jev`, which calls
 * TypeSafe's Jev) instead of building one Anthropic request. `call` returns the
 * raw result that `parse` turns into the typed result.
 */
export interface CallTask<Payload, Result> extends Omit<
  TaskDefinition<Payload, Result>,
  "buildRequest"
> {
  call(payload: Payload, deps: { typesafeApiKey?: string }): Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = TaskDefinition<any, any> | CallTask<any, any>;

/** Narrow adapter over an LLM provider. Task running only depends on this. */
export interface Provider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

/** Thrown by providers for any failure to obtain a usable completion. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// ---------------------------------------------------------------------------
// Wire contract for `POST /api/task`

/**
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
