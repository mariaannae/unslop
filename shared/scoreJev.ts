import { scoreV1Task, type ScoreV1Payload } from "./scoreV1";
import { ProviderError, TaskError, type CallTask } from "./types";

/**
 * `score-jev` — a TypeScript port of jevslop (github.com/togelius/various, folder
 * jevslop). TypeSafe's Jev answers narrow questions about the text with
 * probabilities, a few more tells are measured in code, and the weighted mean of
 * all tell strengths is a 0–100 composite. The game score is that divided by 10.
 *
 * Questions, weights and thresholds are copied from jevslop's tells.py; the
 * weights are its hand-picked starting points, not calibrated. Changes so far:
 * stock vocabulary and em dashes are counted at any length (spec B.20), and the
 * `longForm` tells are skipped on texts under LONG_TEXT_WORDS (spec B.21). Bump
 * `version` when any of them change.
 */

// ---------------------------------------------------------------------------
// The tells (jevslop tells.py)

/** A Jev probability above this counts as "the tell is present". */
const YES = 0.5;

/** Paragraphs shorter than this (in words) are not asked the paragraph tells. */
const MIN_PARAGRAPH_WORDS = 12;

/**
 * Texts with fewer words than this skip the `longForm` tells, which look for
 * essay structure or formatting that a one-paragraph passage doesn't have. A tell
 * that cannot fire would still count at strength 0 and drag the score down.
 * Game passages stay below this: the longest has 132 words and length-ratio
 * allows 1.3 times that, so a player cannot cross it.
 */
const LONG_TEXT_WORDS = 200;

function isLong(text: string): boolean {
  return words(text).length >= LONG_TEXT_WORDS;
}

type NoulTell = {
  id: string;
  name: string;
  weight: number;
  instructions: string;
  true: string;
  false: string;
  /** Only asked of texts with LONG_TEXT_WORDS or more. */
  longForm?: boolean;
};

/** A Jev Score question. `levels` run from least to most slop-like. */
type ScoreTell = {
  id: string;
  name: string;
  weight: number;
  instructions: string;
  levels: string[];
};

/**
 * Measured in code. Strength is 0 at `lo` and 1 at `hi`, linear in between;
 * lo > hi means a low value is the tell.
 */
type CodeTell = {
  id: string;
  name: string;
  weight: number;
  lo: number;
  hi: number;
  unit: string;
  /** Only measured on texts with LONG_TEXT_WORDS or more. */
  longForm?: boolean;
};

/** Asked of each paragraph; strength is the share of paragraphs that show the tell. */
const PARAGRAPH_TELLS: NoulTell[] = [
  {
    id: "contrast_reframe",
    name: "“Not X, but Y” reframing",
    weight: 1.5,
    instructions:
      "Does `paragraph` contain a sentence that denies a claim nobody made in " +
      "order to state the real point, such as “It's not just X, it's Y”, " +
      "“This isn't about X. It's about Y.” or “X is not merely A but B”?",
    true: "At least one sentence uses the deny-then-reveal construction.",
    false: "No sentence sets up and knocks down an unstated claim.",
  },
  {
    id: "inflated_significance",
    name: "Inflated significance",
    weight: 1.2,
    instructions:
      "Does `paragraph` describe something as important, pivotal, " +
      "transformative, a testament, a turning point, or as reshaping its " +
      "field, without giving concrete evidence for that importance?",
    true:
      "Grand claims of significance with no supporting specifics, e.g. " +
      "“stands as a testament to”, “plays a pivotal role in”, “marks a " +
      "significant shift”.",
    false: "Importance is either not claimed or is backed up by specifics.",
  },
  {
    id: "trailing_participle",
    name: "Tacked-on “-ing” commentary",
    weight: 1.0,
    instructions:
      "Does a sentence in `paragraph` end with a comma followed by a phrase " +
      "starting with an -ing verb that comments on the meaning of what was " +
      "just said, such as “, highlighting the importance of X”, " +
      "“, underscoring its role in Y” or “, reflecting a broader trend”?",
    true: "At least one sentence ends with an evaluative -ing tail.",
    false: "No sentence ends with an evaluative -ing tail.",
  },
  {
    id: "triplet",
    name: "Reflexive rule of three",
    weight: 0.8,
    instructions:
      "Does `paragraph` use a list of three parallel words or phrases for " +
      "rhythm, where the three items are near-synonyms or vague qualities " +
      "rather than three distinct, concrete things, as in “fast, reliable, " +
      "and secure” or “innovation, collaboration, and growth”?",
    true: "Contains a rhythmic triplet of vague or overlapping items.",
    false: "No such triplet; any lists name distinct concrete things.",
  },
  {
    id: "signposting",
    name: "Signposting and throat-clearing",
    weight: 1.0,
    instructions:
      "Does `paragraph` contain a phrase that announces what the text is " +
      "about to do or that something deserves attention, instead of just " +
      "saying it, such as “Let's dive in”, “It's worth noting that”, " +
      "“Here's the thing”, “It is important to remember that” or " +
      "“Let's break it down”?",
    true: "Contains at least one announcing or throat-clearing phrase.",
    false: "Gets straight to the point.",
  },
  {
    id: "vague_attribution",
    name: "Vague attribution",
    weight: 1.0,
    instructions:
      "Does `paragraph` attribute a claim to an unnamed authority, such as " +
      "“experts say”, “studies show”, “many believe”, “research suggests” or " +
      "“critics argue”, without naming who or what?",
    true: "Cites unnamed experts, studies or groups.",
    false: "Claims are either unattributed or attributed to a named source.",
  },
  {
    id: "rhetorical_qa",
    name: "Self-answered rhetorical question",
    weight: 0.8,
    instructions:
      "Does `paragraph` ask a short question and immediately answer it " +
      "itself, as in “The result? A faster app.” or “Why does this matter? " +
      "Because…”?",
    true: "Contains a question that the text answers in the next breath.",
    false: "No self-answered question.",
  },
  {
    id: "generic_filler",
    name: "Generic filler",
    weight: 1.5,
    instructions:
      "Does `paragraph` consist mostly of abstract statements that could be " +
      "pasted into a text on a different topic without seeming out of " +
      "place, with no specific names, numbers, places, dates, events, " +
      "quotations or examples?",
    true: "Mostly interchangeable generalities with nothing concrete.",
    false: "Anchored in concrete, topic-specific details.",
  },
];

/** Asked once of the whole text; strength is Jev's probability. */
const DOCUMENT_TELLS: NoulTell[] = [
  {
    id: "generic_opener",
    name: "Scene-setting opener",
    weight: 1.0,
    instructions:
      "Does the first sentence of `text` open with a broad statement about " +
      "the world, the present era or a whole field, such as “In today's " +
      "fast-paced digital landscape”, “Throughout history” or “Imagine a " +
      "world where”, rather than starting on its specific subject?",
    true: "Opens with sweeping scene-setting.",
    false: "Opens directly on the specific subject.",
  },
  {
    id: "summary_closer",
    name: "Recap conclusion",
    weight: 1.0,
    instructions:
      "Does the last paragraph of `text` mainly restate points that were " +
      "already made earlier in `text`, for example starting with “In " +
      "conclusion”, “Ultimately”, “In summary” or “At the end of the day”, " +
      "without adding new information?",
    true: "The ending is a recap of what was already said.",
    false: "The ending adds something new, or there is no recap.",
  },
  {
    id: "chatbot_residue",
    name: "Chatbot residue",
    weight: 2.0,
    instructions:
      "Does `text` contain words addressed to the person who requested it " +
      "rather than to the reader, such as “Certainly!”, “Great question”, " +
      "“Here is a draft”, “I hope this helps”, “Let me know if you'd like " +
      "me to” or “As an AI”?",
    true: "Contains assistant-to-user chatter left in the text.",
    false: "No assistant chatter.",
  },
  {
    id: "fence_sitting",
    name: "Fence-sitting balance",
    // Low: encyclopedic writing is neutral by policy.
    weight: 0.5,
    longForm: true,
    instructions:
      "Does `text` lay out several sides or pros and cons of a question and " +
      "then end without the author committing to a position of their own?",
    true: "Balanced survey of views with no committed conclusion.",
    false: "The author takes a clear position, or the text is not weighing sides.",
  },
  {
    id: "reasons_list",
    name: "Reasons-list structure",
    weight: 1.5,
    longForm: true,
    instructions:
      "Is `text` organised as a list of separate reasons, factors, benefits " +
      "or tips, where each paragraph presents one item and the paragraphs " +
      "are introduced by words like “First”, “Another”, “Additionally”, " +
      "“Finally”, or by a bold label?",
    true: "Body is a sequence of one-item-per-paragraph points.",
    false: "Paragraphs build on each other, or follow a narrative or argument.",
  },
  {
    id: "promotional_tone",
    name: "Brochure tone",
    weight: 1.0,
    instructions:
      "Is `text` written in a promotional register, using words like " +
      "“vibrant”, “seamless”, “cutting-edge”, “rich tapestry”, “nestled”, " +
      "“unparalleled” or “game-changer” about a subject that is not being " +
      "sold?",
    true: "Reads like marketing copy.",
    false: "Plain descriptive register, or genuinely an advertisement.",
  },
];

/** Asked once of the whole text; strength is Jev's score / (levels - 1). */
const SCORE_TELLS: ScoreTell[] = [
  {
    id: "no_voice",
    name: "Absent personal voice",
    // Low: reference and technical writing is impersonal by design.
    weight: 0.6,
    instructions: "How much of a particular writer's personality comes through in `text`?",
    levels: [
      "A distinct voice: personal experience, strong opinions, humor, " +
        "odd or memorable word choices.",
      "Some personality, but mostly neutral.",
      "Neutral and impersonal; any competent writer or none could have written it.",
    ],
  },
  {
    // jevslop's GUT_CHECK: catches slop that dodges every specific tell.
    id: "gut_check",
    name: "Jev's overall impression",
    weight: 2.0,
    instructions:
      "How closely does `text` resemble the default prose style of an AI chat assistant?",
    levels: [
      "Clearly not chatbot prose.",
      "Some resemblance.",
      "Strong resemblance.",
      "Unmistakably default chatbot prose.",
    ],
  },
];

const CODE_TELLS: CodeTell[] = [
  { id: "stock_vocab", name: "Stock AI vocabulary", weight: 1.5, lo: 0.0, hi: 8.0, unit: "hits per 1k words" },
  { id: "em_dash", name: "Em-dash habit", weight: 0.7, lo: 2.0, hi: 10.0, unit: "per 1k words" },
  { id: "low_burstiness", name: "Uniform sentence length", weight: 1.0, lo: 0.6, hi: 0.3, unit: "coefficient of variation" },
  { id: "uniform_paragraphs", name: "Uniform paragraph length", weight: 0.4, lo: 0.3, hi: 0.1, unit: "coefficient of variation" },
  { id: "bold_labels", name: "Bold labels and lead-ins", weight: 1.0, lo: 0.0, hi: 3.0, unit: "paragraphs", longForm: true },
  { id: "emoji_bullets", name: "Emoji bullets/headings", weight: 1.0, lo: 0.0, hi: 2.0, unit: "lines", longForm: true },
]; // prettier-ignore

/**
 * Matched case-insensitively on word boundaries. Single words common in
 * ordinary prose ("robust", "landscape") are included because the tell is
 * their density, not their presence.
 */
const STOCK_PHRASES = [
  "delve", "delves", "delving", "tapestry", "testament", "realm",
  "multifaceted", "pivotal", "underscore", "underscores", "underscoring",
  "showcase", "showcases", "showcasing", "foster", "fosters", "fostering",
  "intricate", "intricacies", "vibrant", "bustling", "seamless",
  "seamlessly", "robust", "leverage", "leveraging", "landscape",
  "navigate", "navigating", "embark", "unlock", "unleash", "elevate",
  "resonate", "resonates", "paramount", "meticulous", "meticulously",
  "commendable", "nuanced", "holistic", "synergy", "ever-evolving",
  "ever-changing", "game-changer", "cutting-edge", "groundbreaking",
  "in today's", "it's important to note", "it is important to note",
  "it's worth noting", "it is worth noting", "a testament to",
  "plays a crucial role", "plays a pivotal role", "in the realm of",
  "at the end of the day", "in conclusion", "furthermore", "moreover",
  "additionally", "crucial", "enhance", "enhancing", "comprehensive",
  "valuable insights", "stands as", "serves as",
]; // prettier-ignore

// ---------------------------------------------------------------------------
// Code-measured tells (jevslop textstats.py)

const WORD = /[A-Za-z0-9'’-]+/g;
const SENTENCE_END = /(?<=[.!?])["'”’)]*\s+(?=["'“‘(]*[A-Z0-9])/;
// A bold span (**x** or __x__) anywhere in a paragraph or list item.
const BOLD = /(?<![\w*])(\*\*|__)(?=\S)[^*_\n]{1,80}?(?<=\S)\1(?![\w*])/;
const EMOJI = /^\s*(?:[-*•#]+\s*)?[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/u;
const STOCK = STOCK_PHRASES.map(
  (phrase) => new RegExp(`(?<![\\w-])${phrase.replace(/'/g, "['’]")}(?![\\w-])`, "gi"),
);

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

function sentences(text: string): string[] {
  // Ignore headings and list items: their lengths say nothing about prose rhythm.
  const prose = paragraphs(text).filter((p) => !/^\s*(#|[-*•]\s|\d+[.)]\s)/.test(p));
  return prose.flatMap((p) =>
    p
      .split(/\s+/)
      .join(" ")
      .split(SENTENCE_END)
      .filter((s) => words(s).length > 0),
  );
}

/** Coefficient of variation (population stdev / mean), or null when undefined. */
function cv(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function ramp(value: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

export type Measurement = {
  value: number | null;
  /** 0–1, or null when the text is too short for the measure to mean anything. */
  strength: number | null;
};

/** Measures every code tell. Stock-vocabulary hits are returned separately for the tell list. */
export function measure(text: string): {
  tells: Record<string, Measurement>;
  stockHits: string[];
} {
  const nWords = Math.max(1, words(text).length);
  const perK = 1000 / nWords;
  const lines = text.split(/\r\n|\r|\n/);
  // Paragraphs, with each list item counted as its own block.
  const blocks = paragraphs(text).flatMap((p) =>
    /^\s*([-*•]|\d+[.)])\s/.test(p) ? p.split(/\r\n|\r|\n/) : [p],
  );

  const stockHits: string[] = [];
  let stockCount = 0;
  STOCK.forEach((rx, i) => {
    const n = text.match(rx)?.length ?? 0;
    if (n > 0) stockHits.push(STOCK_PHRASES[i]!);
    stockCount += n;
  });

  const sentLengths = sentences(text).map((s) => words(s).length);
  const paraLengths = paragraphs(text).map((p) => words(p).length);
  const emDashes = text.split("—").length - 1;

  const raw: Record<string, [value: number | null, enough: boolean]> = {
    // jevslop skips these two under 150 words. Every game passage is shorter, so
    // they are counted at any length (spec B.20).
    stock_vocab: [stockCount * perK, true],
    em_dash: [emDashes * perK, true],
    low_burstiness: [cv(sentLengths), sentLengths.length >= 8],
    uniform_paragraphs: [cv(paraLengths), paraLengths.length >= 4],
    bold_labels: [blocks.filter((b) => BOLD.test(b)).length, true],
    emoji_bullets: [lines.filter((l) => EMOJI.test(l)).length, true],
  };

  const long = isLong(text);
  const tells: Record<string, Measurement> = {};
  for (const tell of CODE_TELLS) {
    const [value, enough] = raw[tell.id]!;
    const applies = enough && value !== null && (long || !tell.longForm);
    tells[tell.id] = { value, strength: applies ? ramp(value, tell.lo, tell.hi) : null };
  }
  return { tells, stockHits };
}

// ---------------------------------------------------------------------------
// Jev (TypeSafe System One API)

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

type JevQuestion =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "score"; instructions: string; criteria: string[] };

type JevAnswers = Record<string, number>;

const noul = (t: NoulTell): JevQuestion => ({
  type: "noul",
  instructions: t.instructions,
  criteria: { true: t.true, false: t.false },
});

const score = (t: ScoreTell): JevQuestion => ({
  type: "score",
  instructions: t.instructions,
  criteria: t.levels,
});

/** One System One request. Returns each answer's noul or score by question id. */
async function systemOne(
  apiKey: string,
  model: string,
  state: Record<string, string>,
  questions: Record<string, JevQuestion>,
): Promise<{ model: string; answers: JevAnswers }> {
  let response: Response;
  try {
    response = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ state, model, questions }),
    });
  } catch (error) {
    throw new ProviderError(
      `TypeSafe API unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new ProviderError(
      `TypeSafe API error ${response.status}: ${await response.text()}`,
      response.status,
    );
  }
  const json = (await response.json()) as {
    model?: string;
    answers?: Record<string, { noul?: number; score?: number }>;
  };
  const answers: JevAnswers = {};
  for (const [id, answer] of Object.entries(json.answers ?? {})) {
    const value = answer.noul ?? answer.score;
    if (typeof value === "number") answers[id] = value;
  }
  return { model: json.model ?? model, answers };
}

// ---------------------------------------------------------------------------
// The task

export type ScoreJevTell = { label: string; quote?: string };

export type ScoreJevResult = {
  /** 0–10 with one decimal: the composite divided by 10. */
  score: number;
  /** jevslop's 0–100 weighted mean of tell strengths, one decimal. */
  composite: number;
  /** Tells with strength >= 0.5, strongest first. */
  tells: ScoreJevTell[];
  /** Every tell, for tuning. `strength` is null when the tell was skipped. */
  breakdown: Array<{
    id: string;
    name: string;
    weight: number;
    strength: number | null;
    value?: number | null;
  }>;
  /** Jev model version that answered. */
  model: string;
};

type JevRaw = { model: string; doc: JevAnswers; paragraphs: JevAnswers[] };

function answer(answers: JevAnswers | undefined, id: string): number {
  const value = answers?.[id];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TaskError("parse_error", `Jev returned no answer for "${id}"`);
  }
  return value;
}

export const scoreJevTask: CallTask<ScoreV1Payload, ScoreJevResult> = {
  id: "score-jev",
  version: 3,
  model: "jev-1.13.0",

  // Same {original, current} payload as score-v1; only `current` is scored.
  validatePayload: (input) => scoreV1Task.validatePayload(input),

  async call(payload, { typesafeApiKey }): Promise<JevRaw> {
    if (!typesafeApiKey) {
      throw new ProviderError(
        "TYPESAFE_API_KEY is not set (local: worker/.dev.vars; production: wrangler secret put)",
      );
    }
    const ask = (state: Record<string, string>, questions: Record<string, JevQuestion>) =>
      systemOne(typesafeApiKey, this.model, state, questions);

    const long = isLong(payload.current);
    const docQuestions = Object.fromEntries([
      ...DOCUMENT_TELLS.filter((t) => long || !t.longForm).map((t) => [t.id, noul(t)]),
      ...SCORE_TELLS.map((t) => [t.id, score(t)]),
    ]);
    const paraQuestions = Object.fromEntries(PARAGRAPH_TELLS.map((t) => [t.id, noul(t)]));
    const eligible = paragraphs(payload.current).filter(
      (p) => words(p).length >= MIN_PARAGRAPH_WORDS,
    );

    const [doc, ...paras] = await Promise.all([
      ask({ text: payload.current }, docQuestions),
      ...eligible.map((p) => ask({ paragraph: p }, paraQuestions)),
    ]);
    return { model: doc!.model, doc: doc!.answers, paragraphs: paras.map((p) => p.answers) };
  },

  parse(raw: unknown, payload): ScoreJevResult {
    const jev = raw as Partial<JevRaw> | null;
    if (!jev || !Array.isArray(jev.paragraphs)) {
      throw new TaskError("parse_error", "Jev result is missing its paragraph answers");
    }
    const paras = jev.paragraphs;
    const long = isLong(payload.current);
    const { tells: measured, stockHits } = measure(payload.current);

    const breakdown: ScoreJevResult["breakdown"] = [
      ...CODE_TELLS.map((t) => ({ id: t.id, name: t.name, weight: t.weight, ...measured[t.id]! })),
      ...DOCUMENT_TELLS.map((t) => ({
        ...pick(t),
        strength: long || !t.longForm ? answer(jev.doc, t.id) : null,
      })),
      ...SCORE_TELLS.map((t) => ({
        ...pick(t),
        strength: answer(jev.doc, t.id) / (t.levels.length - 1),
      })),
      ...PARAGRAPH_TELLS.map((t) => ({
        ...pick(t),
        strength: paras.length
          ? paras.filter((p) => answer(p, t.id) > YES).length / paras.length
          : null,
      })),
    ];

    const scored = breakdown.filter((t) => t.strength !== null && t.weight > 0);
    const totalWeight = scored.reduce((sum, t) => sum + t.weight, 0);
    const weighted = scored.reduce((sum, t) => sum + t.weight * t.strength!, 0);
    const composite = totalWeight ? (100 * weighted) / totalWeight : 0;

    const tells = breakdown
      .filter((t) => (t.strength ?? 0) >= YES)
      .sort((a, b) => b.strength! - a.strength!)
      .map((t) =>
        t.id === "stock_vocab" ? { label: t.name, quote: stockHits.join(", ") } : { label: t.name },
      );

    return {
      score: Math.round(composite) / 10,
      composite: Math.round(composite * 10) / 10,
      tells,
      breakdown,
      model: jev.model ?? this.model,
    };
  },
};

function pick(t: { id: string; name: string; weight: number }) {
  return { id: t.id, name: t.name, weight: t.weight };
}
