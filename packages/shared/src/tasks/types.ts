/**
 * Provider-neutral request shape produced by a task definition.
 * Only the Worker and Node scripts translate this into a concrete provider call.
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
  /** Omit for models that reject non-default sampling (Claude Sonnet 5.5 and newer). */
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

// Helper type aliases for extracting the generics from a task definition.
export type TaskPayload<T> = T extends TaskDefinition<infer P, unknown> ? P : never;
export type TaskResult<T> = T extends TaskDefinition<unknown, infer R> ? R : never;
