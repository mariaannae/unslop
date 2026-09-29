import Anthropic from "@anthropic-ai/sdk";
import type { ProviderRequest, ProviderResponse } from "../tasks/types";
import { ProviderError, type Provider } from "./types";

/**
 * Anthropic Messages API adapter. Maps the provider-neutral ProviderRequest
 * onto one `messages.create` call and returns the concatenated text output.
 */
export function createAnthropicProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  return {
    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create({
          model: request.model,
          max_tokens: request.maxTokens,
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          system: request.system,
          messages: request.messages,
          ...(request.outputSchema
            ? { output_config: { format: { type: "json_schema", schema: request.outputSchema } } }
            : {}),
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new ProviderError(
            `Anthropic API error ${error.status}: ${error.message}`,
            error.status,
          );
        }
        throw new ProviderError(error instanceof Error ? error.message : String(error));
      }

      if (message.stop_reason === "refusal") {
        throw new ProviderError("provider refused the request");
      }
      if (message.stop_reason === "max_tokens") {
        throw new ProviderError("provider output was truncated (max_tokens)");
      }

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        stopReason: message.stop_reason,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    },
  };
}
