import { TaskError, type ProviderRequest, type TaskDefinition } from "../shared/types";
import { countWords } from "./common";

/**
 * `generate-v1` — passage generation for the bank (SPEC Appendix A.3).
 *
 * Scripts only. It lives next to `generateBank.ts`, its only user, rather than
 * in `shared/`, so the Worker can never serve it (spec B.15).
 */

export type GenerateV1Payload = {
  topic: string;
  register: string;
};

export type GenerateV1Result = {
  text: string;
  wordCount: number;
};

export const GENERATE_V1_REGISTERS = [
  "product blurb",
  "LinkedIn post",
  "recipe intro",
  "history summary",
  "cover letter",
  "product review",
  "travel description",
  "motivational post",
  "event announcement",
  "FAQ answer",
] as const;

export const GENERATE_V1_SYSTEM_PROMPT = 'You write short passages on the given topic.'//`You write short passages in the most stereotypical "AI assistant" register, for use as game puzzles.`;

export function buildGenerateV1UserMessage(payload: GenerateV1Payload): string {
  /*return `Write one paragraph of 90–130 words about: ${payload.topic}
Register: ${payload.register}
Make it read as unmistakably AI-generated. Include ALL of the following:
- an opening sentence that frames the topic's importance
- at least one list of exactly three parallel items
- at least one "it's not X, it's Y" (or "not just X but Y") construction
- at least two em dashes
- at least three of these words: delve, tapestry, testament, pivotal, foster, landscape, robust, navigate, underscore, crucial, seamless, multifaceted, leverage, realm, embark
- sentences of roughly uniform length
- a closing sentence that summarizes or restates the opening
No headings, bullets, bold, or emoji. Plain prose only. Return only the paragraph.`;*/

return `Write one paragraph of 90–130 words about: ${payload.topic}
Register: ${payload.register}
No headings, bullets, bold, or emoji. Plain prose only. Return only the paragraph.`;

}

function requireShortText(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TaskError("invalid_payload", `"${field}" must be a non-empty string`);
  }
  if (value.length > 200) {
    throw new TaskError("invalid_payload", `"${field}" is too long`);
  }
  return value.trim();
}

export const generateV1Task: TaskDefinition<GenerateV1Payload, GenerateV1Result> = {
  id: "generate-v1",
  version: 3,
  model: "claude-haiku-4-5",

  validatePayload(input: unknown): GenerateV1Payload {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TaskError("invalid_payload", "payload must be an object");
    }
    const record = input as Record<string, unknown>;
    return {
      topic: requireShortText(record, "topic"),
      register: requireShortText(record, "register"),
    };
  },

  buildRequest(payload: GenerateV1Payload): ProviderRequest {
    return {
      model: this.model,
      system: GENERATE_V1_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildGenerateV1UserMessage(payload) }],
      maxTokens: 512,
      temperature: 0,
    };
  },

  parse(raw: unknown): GenerateV1Result {
    if (typeof raw !== "string") {
      throw new TaskError("parse_error", "response is not text");
    }
    const text = raw
      .trim()
      .replace(/^```[a-z]*\s*/i, "")
      .replace(/\s*```$/, "")
      .replace(/^["“]|["”]$/g, "")
      .replace(/\s*\n\s*/g, " ")
      .trim();
    if (text.length === 0) throw new TaskError("parse_error", "response is empty");
    if (/^\s*[-*#]/m.test(raw)) {
      throw new TaskError("parse_error", "response contains markdown structure");
    }
    return { text, wordCount: countWords(text) };
  },
};
