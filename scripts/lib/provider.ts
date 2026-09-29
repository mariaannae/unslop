import { createAnthropicProvider } from "@unslop/shared/anthropic";
import type { Provider } from "@unslop/shared";

/** Scripts talk to the provider directly; the key comes from the environment only. */
export function createScriptProvider(): Provider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Export it in your shell (never commit it) and rerun.",
    );
  }
  return createAnthropicProvider(apiKey);
}
