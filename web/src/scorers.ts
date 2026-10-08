import type { TaskRequest, TaskResponse } from "../../shared/types";
import { measure, type ScoreJevResult } from "../../shared/scoreJev";
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
 * Three tells are also measured here in code (codeTells below). Each one's weight
 * times its strength (0–1) is added to Haiku's score, capped at 10 (spec B.34,
 * B.38), and each is listed at strength 0.5 or more. Haiku's own tells about
 * sentence rhythm are always dropped (spec B.37), and its tells about lists of
 * three or tacked-on "-ing" phrases are dropped when the measured one is listed,
 * so no tell is reported twice. `raw` keeps score-v1's own result.
 *
 * offline scorer scorers.mock is rules based
 */
export const llmBasic: Scorer = {
  async score(ctx) {
    const result = await transport<ScoreV1Result>("score-v1", {
      original: ctx.original,
      current: ctx.current,
    });
    const measured = codeTells(ctx.current);
    const listed = measured.filter((t) => t.strength >= 0.5);
    const tells = result.tells.filter(
      (tell) =>
        !isSentenceRhythmLabel(tell.label) && !listed.some((t) => t.duplicates?.(tell.label)),
    );
    const added = measured.reduce((sum, t) => sum + t.weight * t.strength, 0);
    return {
      score: Math.min(10, Math.round(10 * (result.score + added)) / 10),
      tells: [
        ...tells,
        ...listed.map(({ label, quote }) => (quote ? { label, quote } : { label })),
      ],
      raw: result,
    };
  },
};

type CodeTell = {
  label: string;
  weight: number;
  strength: number;
  quote?: string;
  /** Recognizes Haiku's labels for the same tell. */
  duplicates?: (label: string) => boolean;
};

/** The tells the Haiku judge measures in code (spec B.34, B.38). */
function codeTells(text: string): CodeTell[] {
  const tails = [...text.matchAll(ING_TAIL)].filter((m) => !NOT_PARTICIPLE.test(m[2]!));
  const lists = [...text.matchAll(LIST_OF_THREE)];
  return [
    {
      label: "uniform-sentence-length",
      weight: 1,
      strength: measure(text).tells.low_burstiness!.strength ?? 0,
    },
    {
      label: "tacked-on-ing-phrase",
      weight: 1,
      strength: Math.min(1, tails.length / 2),
      quote: tails[0]?.[1]!.trim(),
      duplicates: (label) => {
        const words = labelWords(label);
        const ing = words.some((w) => /^(?:ing|participles?|participial)$/.test(w));
        return ing && !words.some((w) => /^open(?:er|ers|ing)$/.test(w));
      },
    },
    {
      // Weight 0.5: Haiku already scores lists of three, and at weight 1 this
      // lowered accuracy on texts it was not chosen on (spec B.38).
      label: "list-of-three",
      weight: 0.5,
      strength: Math.min(1, lists.length / 2),
      quote: lists[0] && listQuote(lists[0], text),
      duplicates: (label) =>
        labelWords(label).some((w) =>
          /^(?:three|triads?|triadic|tricolons?|triplets?|triple|trio)$/.test(w),
        ),
    },
  ];
}

/**
 * A comma, then a phrase starting with an -ing word that comments on the clause
 * before it: ", making it perfect for beginners". Group 1 is the phrase, up to the
 * next punctuation, and group 2 the -ing word.
 */
const ING_TAIL = /, ((?:[a-z]+ly )?([a-z]{3,}ing)\b[^,.;:!?—]*)/g;

/** -ing words that rarely start such a phrase: prepositions and nouns (spec B.38). */
const NOT_PARTICIPLE = /^(?:during|including|according|regarding|concerning|following|considering|excluding|notwithstanding|pending|\w*thing|morning|evening|ceiling|spring|string|bring|king|ring|wing|sing|sibling|duckling|pudding|building|clothing|wedding|meeting|painting|setting|ending|beginning|feeling|training|parking|housing|seating|lighting|shipping|shopping|camping|hiking|cooking|baking|boiling|roasting|frying|grilling|fishing|swimming|cycling|running|walking|skiing|sailing|climbing|driving)$/; // prettier-ignore

/**
 * Three items of one to three words with a comma before "and" or "or": "X, Y, and
 * Z". Without that comma, a clause boundary often passes for the first comma of a
 * list, and the tell fired on 45% of human texts instead of 17% (spec B.38).
 * Group 1 runs from the first item's last word to the conjunction; groups 2 and 3
 * are the second and third items.
 */
const LIST_OF_THREE =
  /\b(?:[A-Za-z'’-]+ ){0,2}([A-Za-z'’-]+, ([A-Za-z'’-]+(?: [A-Za-z'’-]+){0,2}), (?:and|or) )([A-Za-z'’-]+(?: [A-Za-z'’-]+){0,2})/g;

/**
 * The list as quoted to the player. The third item runs to punctuation when that
 * comes within three words, and otherwise is cut to the second item's length, so
 * "pothos, snake plant, and peace lily are" is quoted up to "lily".
 */
function listQuote(match: RegExpMatchArray, text: string): string {
  const [whole, head, second, third] = match as unknown as string[];
  const next = text[match.index! + whole!.length];
  const closed = next === undefined || /[,.;:!?—)]/.test(next);
  return head + (closed ? third! : third!.split(" ").slice(0, second!.split(" ").length).join(" "));
}

function labelWords(label: string): string[] {
  return label.toLowerCase().split(/[^a-z]+/);
}

const SAMENESS = new Set(["uniform", "uniformly", "uniformity", "even", "evenly", "monotone", "monotonous", "monotony", "unvaried", "consistent", "identical"]); // prettier-ignore
const RHYTHM = new Set(["sentence", "sentences", "rhythm", "rhythms", "length", "lengths", "cadence", "pacing"]); // prettier-ignore

/**
 * Whether one of Haiku's free-text tell labels is about uniform sentence length or
 * rhythm, such as "uniform-sentence-rhythm" or "even-rhythm-sentences": a word for
 * sameness with a word for sentences or rhythm, sentence length itself, or a lack
 * of sentence variety. Rhythm from lists of three ("triadic-rhythm"), parallelism,
 * tone ("uniform-polished-tone") and sentence openers do not count (spec B.37).
 */
function isSentenceRhythmLabel(label: string): boolean {
  const words = labelWords(label);
  const has = (set: Set<string>) => words.some((w) => set.has(w));
  const sentence = words.includes("sentence") || words.includes("sentences");
  const length = words.includes("length") || words.includes("lengths");
  const variety = words.includes("variety") || words.includes("variation");
  return (
    words.includes("burstiness") ||
    (has(SAMENESS) && has(RHYTHM)) ||
    (sentence && length) ||
    (variety && has(RHYTHM))
  );
}

/**
 * The Jev scorer's display scale (spec B.30). score-jev's composite puts most AI
 * passages at 3–5 out of 10, because Jev rarely calls a single tell clearly
 * present, where the Haiku judge puts them at 8–10. This stretches the range above
 * 2 so AI passages read high too. It is piecewise linear through these points and
 * increasing, so it changes no ranking. Jev's win line in config.ts is on this
 * scale: 3 shown is 2.33 from score-jev (spec B.36).
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
 * scale above, and tells. `raw` is the task's own result. It has no meaning or
 * grammar verdict: those come from Jev's guardrails (spec B.42), so this scorer
 * calls no Haiku.
 */
export const jev: Scorer = {
  async score(ctx) {
    const result = await transport<ScoreJevResult>("score-jev", {
      original: ctx.original,
      current: ctx.current,
    });
    return { score: scaleJevScore(result.score), tells: result.tells, raw: result };
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

/** Runs a task the way the scorers do, for guardrails that make their own call. */
export function runRemoteTask<Result>(taskId: string, payload: unknown): Promise<Result> {
  return transport<Result>(taskId, payload);
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
