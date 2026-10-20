import { scoreJevTask, systemOne, type JevQuestion } from "./scoreJev";
import { validateTexts } from "./scoreV1";
import { ProviderError, TaskError, type CallTask } from "./types";

/**
 * `judge-jev` — the meaning and grammar verdicts from TypeSafe's Jev instead of
 * the Haiku judge (spec B.41). One System One request shows Jev both texts and
 * asks two yes/no questions; each verdict passes at probability 0.5 or more.
 * The verdicts have score-v1's field names, so a guardrail reads either alike.
 * Bump `version` when a question or the threshold changes.
 */

/**
 * Both texts, since meaning is judged against the original. The scorers take the
 * current text alone (spec B.51); this guardrail task is the exception.
 */
export type JudgeJevPayload = { original: string; current: string };

/** A verdict passes when Jev's probability for it is at least this. */
const PASS = 0.5;

const QUESTIONS: Record<"meaning" | "grammar", JevQuestion> = {
  meaning: {
    type: "noul",
    instructions:
      "Does `current` keep the meaning of `original`: the same facts, claims and " +
      "intent, with nothing important added, dropped or contradicted? Rewording, a " +
      "different tone or style, and cutting filler do not change the meaning.",
    criteria: {
      true: "`current` says essentially what `original` says.",
      false:
        "`current` adds, drops or changes facts or claims, says something else, or is nonsense.",
    },
  },
  grammar: {
    type: "noul",
    instructions:
      "Is `current` well-formed English that a careful native speaker would accept? " +
      "Casual style, contractions and an occasional small slip are fine. Scrambled " +
      "word order, missing words, repeated misspellings or gibberish are not.",
    criteria: {
      true: "Well-formed English.",
      false: "Broken English: scrambled, missing words, misspelled or gibberish.",
    },
  },
};

export type JudgeJevResult = {
  meaning_preserved: boolean;
  grammatically_correct: boolean;
  /** Jev's probability that the meaning is kept. */
  meaning_probability: number;
  /** Jev's probability that the text is well-formed English. */
  grammar_probability: number;
  /** Jev model version that answered. */
  model: string;
};

type JudgeJevRaw = { model: string; answers: Record<string, number> };

function probability(answers: Record<string, number>, id: string): number {
  const value = answers[id];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TaskError("parse_error", `Jev returned no answer for "${id}"`);
  }
  return value;
}

export const judgeJevTask: CallTask<JudgeJevPayload, JudgeJevResult> = {
  id: "judge-jev",
  version: 1,
  model: scoreJevTask.model,

  validatePayload: (input) => validateTexts(input, ["original", "current"]),

  async call(payload, { typesafeApiKey }): Promise<JudgeJevRaw> {
    if (!typesafeApiKey) {
      throw new ProviderError(
        "TYPESAFE_API_KEY is not set (local: worker/.dev.vars; production: wrangler secret put)",
      );
    }
    return systemOne(
      typesafeApiKey,
      this.model,
      { original: payload.original, current: payload.current },
      QUESTIONS,
    );
  },

  parse(raw: unknown): JudgeJevResult {
    const jev = raw as Partial<JudgeJevRaw> | null;
    if (!jev?.answers) throw new TaskError("parse_error", "Jev result has no answers");
    const meaning = probability(jev.answers, "meaning");
    const grammar = probability(jev.answers, "grammar");
    return {
      meaning_preserved: meaning >= PASS,
      grammatically_correct: grammar >= PASS,
      meaning_probability: meaning,
      grammar_probability: grammar,
      model: jev.model ?? this.model,
    };
  },
};
