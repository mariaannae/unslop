import type { TaskRequest, TaskResponse } from "../../shared/api";
import type { ScoreV1Result } from "../../shared/scoreV1";
import type { Scorer, Tell } from "./game";

/**
 * Deterministic offline scorer (spec §10.1).
 *
 * Counts occurrences of a small set of stock AI-prose markers and scores two
 * points per hit, capped at 10, reporting each hit as a tell. This lets the
 * full loop be played without a network: delete the markers and the score
 * falls. It is not a real detector and is not meant to be one.
 */
const MARKERS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "em-dash", pattern: /—/g },
  { label: "not-x-but-y", pattern: /\b(?:it'?s|this is|that'?s) not (?:just|only|about)\b/gi },
  {
    label: "importance-opener",
    pattern: /\bin today'?s (?:fast-paced|digital|modern|ever-changing) world\b/gi,
  },
  {
    label: "stock-word",
    pattern:
      /\b(?:delve|tapestry|testament|pivotal|seamless(?:ly)?|multifaceted|leverage|realm|embark|underscores?|crucial|robust|landscape|navigate|foster)\b/gi,
  },
  {
    label: "vague-authority",
    pattern: /\b(?:experts|studies|research) (?:agree|show|suggest)s?\b/gi,
  },
  { label: "summary-closer", pattern: /\b(?:ultimately|in conclusion|at the end of the day)\b/gi },
];

export function mockScore(text: string): { score: number; tells: Tell[] } {
  const tells: Tell[] = [];
  for (const { label, pattern } of MARKERS) {
    for (const match of text.matchAll(pattern)) {
      tells.push({ label, quote: match[0] });
    }
  }
  return { score: Math.min(10, tells.length * 2), tells };
}

export const mock: Scorer = {
  async score(ctx) {
    return mockScore(ctx.current);
  },
};

/**
 * First real scorer (spec §15): one `score-v1` task call through the Worker.
 * Score and tells are returned as game values; the full task result rides along
 * in `raw` for remote guardrails (see meaning and grammar in guardrails.ts). Errors
 * propagate so the game can report them without spending a Check.
 *
 * offline scorer scorers.mock is rules based
 */
export const llmBasic: Scorer = {
  async score(ctx) {
    const result = await callTask<ScoreV1Result>("score-v1", {
      original: ctx.original,
      current: ctx.current,
    });
    return { score: result.score, tells: result.tells, raw: result };
  },
};

/** Worker origin set at build time (spec B.8, B.12). Empty means same origin, which the Vite proxy serves in dev. */
const API_ORIGIN = normalizeApiOrigin(import.meta.env?.VITE_API_BASE_URL as string | undefined);

/**
 * The browser's only path to a model (spec §15–16). Posts `{taskId, payload}`
 * to the Worker and returns the task's result. It knows nothing about prompts,
 * models, or providers. Every failure throws an Error whose message is safe to
 * show the player.
 */
export async function callTask<Result>(taskId: string, payload: unknown): Promise<Result> {
  const body: TaskRequest = { taskId, payload };
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/task`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Could not reach the judge (${error instanceof Error ? error.message : String(error)}).`,
    );
  }

  let json: TaskResponse<Result>;
  try {
    json = (await response.json()) as TaskResponse<Result>;
  } catch {
    throw new Error(`Judge returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!json || typeof json !== "object" || !("ok" in json)) {
    throw new Error(`Judge returned an unexpected response (HTTP ${response.status}).`);
  }
  if (!json.ok) throw new Error(json.error.message);
  return json.result;
}

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
