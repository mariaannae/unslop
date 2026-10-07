import type { TaskRequest, TaskResponse } from "../../shared/api";
import type { ScoreJevResult } from "../../shared/scoreJev";
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
    const result = await transport<ScoreV1Result>("score-v1", {
      original: ctx.original,
      current: ctx.current,
    });
    return { score: result.score, tells: result.tells, raw: result };
  },
};

/**
 * The Jev scorer's display scale (spec B.30). score-jev's composite puts most AI
 * passages at 3–5 out of 10, because Jev rarely calls a single tell clearly
 * present, where the Haiku judge puts them at 8–10. This stretches the range above
 * 2 so AI passages read high too. It is piecewise linear through these points and
 * increasing, and leaves 0–2 as they are, so it changes no ranking and, with the
 * win line at 2, no win.
 */
const JEV_SCALE: ReadonlyArray<readonly [raw: number, shown: number]> = [
  [0, 0],
  [2, 2],
  [4, 8],
  [7, 10],
];

/** score-jev's 0–10 score on the Jev scorer's display scale, to one decimal. */
export function scaleJevScore(raw: number): number {
  for (let k = 1; k < JEV_SCALE.length; k++) {
    const [x1, y1] = JEV_SCALE[k]!;
    if (raw <= x1) {
      const [x0, y0] = JEV_SCALE[k - 1]!;
      return Math.round(10 * (y0 + ((raw - x0) * (y1 - y0)) / (x1 - x0))) / 10;
    }
  }
  return JEV_SCALE[JEV_SCALE.length - 1]![1];
}

/**
 * The jevslop port (shared/scoreJev.ts): Jev's composite score, on the display
 * scale above, and tells. `raw` keeps the task's own score. Jev has no meaning or
 * grammar verdict, so score-v1 runs alongside it and only its two verdicts are
 * copied into `raw` for the meaning and grammar guardrails.
 */
export const jev: Scorer = {
  async score(ctx) {
    const payload = { original: ctx.original, current: ctx.current };
    const [result, judge] = await Promise.all([
      transport<ScoreJevResult>("score-jev", payload),
      transport<ScoreV1Result>("score-v1", payload),
    ]);
    return {
      score: scaleJevScore(result.score),
      tells: result.tells,
      raw: {
        ...result,
        meaning_preserved: judge.meaning_preserved,
        grammatically_correct: judge.grammatically_correct,
      },
    };
  },
};

type TaskTransport = <Result>(taskId: string, payload: unknown) => Promise<Result>;

let transport: TaskTransport = callTask;

/**
 * Sends the scorers' task calls somewhere other than the Worker. The Node scripts
 * use it to run the configured scorer locally with runTask (scripts/common.ts),
 * so bank generation and the harness score exactly as the game does (spec B.29).
 */
export function setTaskTransport(next: TaskTransport): void {
  transport = next;
}

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
