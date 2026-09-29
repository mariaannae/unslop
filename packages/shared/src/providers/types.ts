import type { ProviderRequest, ProviderResponse } from "../tasks/types";

/** Narrow adapter over an LLM provider. The task handler only depends on this. */
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
