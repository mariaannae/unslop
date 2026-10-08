import { TaskError, type ProviderRequest, type TaskDefinition } from "./types";

/**
 * `score-v1` — the first scoring task (SPEC Appendix A.2).
 *
 * One Claude Haiku 5.5 call, schema-constrained JSON output. Haiku 5.5 rejects
 * `temperature`, so the request leaves it at the model's default.
 * Prompt text, model, schema, and parser rules all live here so the Worker
 * and Node scripts share one definition. Bump `version` when any of them change.
 */

export type ScoreV1Payload = {
  original: string;
  current: string;
};

export type ScoreV1Tell = {
  label: string;
  quote: string;
};

export type ScoreV1Result = {
  /** Integer 0–10. 10 = obviously AI-assistant prose, 0 = unmistakably human. */
  score: number;
  tells: ScoreV1Tell[];
  meaning_preserved: boolean;
  grammatically_correct: boolean;
  /** Parser notes (for example a defaulted field). Empty on a clean response. */
  warnings: string[];
};

export const SCORE_V1_MAX_CHARS = 4000;
export const SCORE_V1_MAX_TELLS = 8;

export const SCORE_V1_SYSTEM_PROMPT = `You are the judge in a game. Players are given a passage that was written by an AI assistant and edit it until it reads like a human wrote it. Rate how strongly the CURRENT passage still reads as AI-assistant prose to a careful, experienced reader.

Also judge whether the CURRENT passage preserves the meaning of the ORIGINAL, and whether it is grammatically correct. Typos, gibberish, deleted content, or nonsense do not make text "human"; mark grammatically_correct=false or meaning_preserved=false instead of lowering the score.

Respond with JSON only:
{
  "score": <integer 0-10; 10 = obviously AI-assistant prose, 0 = unmistakably human>,
  "tells": [ { "label": "<short-kebab-label>", "quote": "<exact short quote from CURRENT passage>" } ],
  "meaning_preserved": <true|false>,
  "grammatically_correct": <true|false>
}
List at most 8 tells. Quotes must appear verbatim in the CURRENT passage. If score <= 2, tells may be empty.`;

/*export const SCORE_V1_SYSTEM_PROMPT = `You are the judge in a game. Players are given a passage that was written by an AI assistant and edit it until it reads like a human wrote it. Rate how strongly the CURRENT passage still reads as AI-assistant prose to a careful, experienced reader.

Signals of AI-assistant prose include: generic importance-framing openers; "it's not X, it's Y" constructions; lists of exactly three parallel items; frequent em dashes; overused vocabulary (delve, tapestry, testament, pivotal, foster, landscape, robust, navigate, underscore, crucial, seamless, multifaceted, leverage, realm, embark); vague attribution ("experts agree"); false ranges ("from X to Y" with no real spectrum); puffery about significance; uniform sentence rhythm; a closing sentence that restates the opening. Human prose tends to have specific detail, uneven rhythm, idiosyncratic word choice, and no summarizing closer.

Also judge whether the CURRENT passage preserves the meaning of the ORIGINAL, and whether it is grammatically correct. Typos, gibberish, deleted content, or nonsense do not make text "human"; mark grammatically_correct=false or meaning_preserved=false instead of lowering the score.

Respond with JSON only:
{
  "score": <integer 0-10; 10 = obviously AI-assistant prose, 0 = unmistakably human>,
  "tells": [ { "label": "<short-kebab-label>", "quote": "<exact short quote from CURRENT passage>" } ],
  "meaning_preserved": <true|false>,
  "grammatically_correct": <true|false>
}
List at most 8 tells. Quotes must appear verbatim in the CURRENT passage. If score <= 2, tells may be empty.`;*/

/**
 * JSON Schema for the provider's structured-output mode. Numeric range and array
 * length limits are deliberately absent (the API rejects them); `parse` enforces them.
 */
export const SCORE_V1_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: "integer" },
    tells: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          quote: { type: "string" },
        },
        required: ["label", "quote"],
        additionalProperties: false,
      },
    },
    meaning_preserved: { type: "boolean" },
    grammatically_correct: { type: "boolean" },
  },
  required: ["score", "tells", "meaning_preserved", "grammatically_correct"],
  additionalProperties: false,
};

function buildUserMessage(payload: ScoreV1Payload): string {
  return `ORIGINAL:\n${payload.original}\n\nCURRENT:\n${payload.current}`;
}

function requireText(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new TaskError("invalid_payload", `"${field}" must be a string`);
  }
  if (value.trim().length === 0) {
    throw new TaskError("invalid_payload", `"${field}" must not be empty`);
  }
  if (value.length > SCORE_V1_MAX_CHARS) {
    throw new TaskError(
      "invalid_payload",
      `"${field}" exceeds ${SCORE_V1_MAX_CHARS} characters (${value.length})`,
    );
  }
  return value;
}

/**
 * Accepts the raw model text (optionally wrapped in a ```json fence) or an
 * already-decoded object. Returns the decoded object or throws a parse error.
 */
function decodeJsonObject(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      value = JSON.parse(stripped);
    } catch {
      throw new TaskError("parse_error", "response is not valid JSON");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TaskError("parse_error", "response is not a JSON object");
  }
  return value as Record<string, unknown>;
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TaskError("parse_error", 'response lacks a numeric "score"');
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

/**
 * Keeps only well-formed tells whose trimmed quote appears verbatim
 * (case-sensitive) in the current passage. Caps the list at 8.
 */
function sanitizeTells(value: unknown, current: string): ScoreV1Tell[] {
  if (!Array.isArray(value)) return [];
  const tells: ScoreV1Tell[] = [];
  for (const item of value) {
    if (tells.length >= SCORE_V1_MAX_TELLS) break;
    if (!item || typeof item !== "object") continue;
    const { label, quote } = item as Record<string, unknown>;
    if (typeof label !== "string" || typeof quote !== "string") continue;
    const trimmedQuote = quote.trim();
    const trimmedLabel = label.trim();
    if (trimmedQuote.length === 0 || trimmedLabel.length === 0) continue;
    if (!current.includes(trimmedQuote)) continue;
    tells.push({ label: trimmedLabel, quote: trimmedQuote });
  }
  return tells;
}

function booleanOrDefault(
  input: Record<string, unknown>,
  field: string,
  warnings: string[],
): boolean {
  const value = input[field];
  if (typeof value === "boolean") return value;
  warnings.push(`"${field}" missing or not boolean; defaulted to true`);
  return true;
}

export const scoreV1Task: TaskDefinition<ScoreV1Payload, ScoreV1Result> = {
  id: "score-v1",
  version: 3,
  model: "claude-haiku-5-5",

  validatePayload(input: unknown): ScoreV1Payload {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TaskError("invalid_payload", "payload must be an object");
    }
    const record = input as Record<string, unknown>;
    return {
      original: requireText(record, "original"),
      current: requireText(record, "current"),
    };
  },

  buildRequest(payload: ScoreV1Payload): ProviderRequest {
    return {
      model: this.model,
      system: SCORE_V1_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(payload) }],
      maxTokens: 512,
      outputSchema: SCORE_V1_RESPONSE_SCHEMA,
    };
  },

  parse(raw: unknown, payload: ScoreV1Payload): ScoreV1Result {
    const json = decodeJsonObject(raw);
    const warnings: string[] = [];
    return {
      score: clampScore(json.score),
      tells: sanitizeTells(json.tells, payload.current),
      meaning_preserved: booleanOrDefault(json, "meaning_preserved", warnings),
      grammatically_correct: booleanOrDefault(json, "grammatically_correct", warnings),
      warnings,
    };
  },
};
