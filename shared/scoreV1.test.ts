import { describe, expect, it } from "vitest";
import { TaskError } from "./types";
import {
  SCORE_V1_MAX_CHARS,
  SCORE_V1_RESPONSE_SCHEMA,
  SCORE_V1_SYSTEM_PROMPT,
  scoreV1Task,
  type ScoreV1Payload,
} from "./scoreV1";

const payload: ScoreV1Payload = {
  original: "In today's fast-paced world, sourdough is a testament to patience.",
  current: "My starter smells like beer and I still don't trust it.",
};

const valid = {
  score: 3,
  tells: [{ label: "generic-opener", quote: "My starter" }],
  meaning_preserved: true,
  grammatically_correct: true,
};

describe("score-v1 parse", () => {
  it("accepts a valid response as a JSON string", () => {
    const result = scoreV1Task.parse(JSON.stringify(valid), payload);
    expect(result).toEqual({ ...valid, warnings: [] });
  });

  it("accepts a valid response as an already-decoded object", () => {
    expect(scoreV1Task.parse(valid, payload)).toEqual({ ...valid, warnings: [] });
  });

  it("tolerates a ```json fence around the object", () => {
    const fenced = "```json\n" + JSON.stringify(valid) + "\n```";
    expect(scoreV1Task.parse(fenced, payload).score).toBe(3);
  });

  it("rejects malformed JSON", () => {
    expect(() => scoreV1Task.parse("{ score: 3", payload)).toThrowError(TaskError);
    expect(() => scoreV1Task.parse("{ score: 3", payload)).toThrow(/not valid JSON/);
  });

  it("rejects non-object JSON", () => {
    expect(() => scoreV1Task.parse("[1,2]", payload)).toThrow(/not a JSON object/);
    expect(() => scoreV1Task.parse("null", payload)).toThrow(/not a JSON object/);
    expect(() => scoreV1Task.parse(42, payload)).toThrow(/not a JSON object/);
  });

  it("rejects a response without a numeric score", () => {
    expect(() => scoreV1Task.parse({ tells: [] }, payload)).toThrow(/numeric "score"/);
    expect(() => scoreV1Task.parse({ score: "7" }, payload)).toThrow(/numeric "score"/);
    expect(() => scoreV1Task.parse({ score: NaN }, payload)).toThrow(/numeric "score"/);
  });

  describe("score clamping", () => {
    it.each([
      [12, 10],
      [10.4, 10],
      [-3, 0],
      [7.6, 8],
      [2.4, 2],
      [0, 0],
      [10, 10],
    ])("maps %s to %s", (input, expected) => {
      expect(scoreV1Task.parse({ score: input }, payload).score).toBe(expected);
    });
  });

  describe("tell validation", () => {
    it("defaults tells to [] when absent or not an array", () => {
      expect(scoreV1Task.parse({ score: 5 }, payload).tells).toEqual([]);
      expect(scoreV1Task.parse({ score: 5, tells: "nope" }, payload).tells).toEqual([]);
    });

    it("drops tells whose quote is not a substring of current", () => {
      const result = scoreV1Task.parse(
        {
          score: 5,
          tells: [
            { label: "keep", quote: "smells like beer" },
            { label: "drop", quote: "testament to patience" },
          ],
        },
        payload,
      );
      expect(result.tells).toEqual([{ label: "keep", quote: "smells like beer" }]);
    });

    it("matches quotes case-sensitively", () => {
      const result = scoreV1Task.parse(
        { score: 5, tells: [{ label: "case", quote: "my starter" }] },
        payload,
      );
      expect(result.tells).toEqual([]);
    });

    it("trims quotes and labels before matching", () => {
      const result = scoreV1Task.parse(
        { score: 5, tells: [{ label: "  trimmed ", quote: "  smells like beer\n" }] },
        payload,
      );
      expect(result.tells).toEqual([{ label: "trimmed", quote: "smells like beer" }]);
    });

    it("drops tells with empty or non-string fields", () => {
      const result = scoreV1Task.parse(
        {
          score: 5,
          tells: [
            { label: "", quote: "smells" },
            { label: "x", quote: "   " },
            { label: 3, quote: "smells" },
            { label: "y" },
            null,
            "string",
          ],
        },
        payload,
      );
      expect(result.tells).toEqual([]);
    });

    it("caps tells at 8, counting only valid ones", () => {
      const current = "a b c d e f g h i j k l";
      const tells = current.split(" ").map((word) => ({ label: `t-${word}`, quote: word }));
      // Insert an invalid tell at the front to make sure it does not use up a slot.
      tells.unshift({ label: "bad", quote: "zzz" });
      const result = scoreV1Task.parse({ score: 5, tells }, { ...payload, current });
      expect(result.tells).toHaveLength(8);
      expect(result.tells.map((t) => t.quote)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    });
  });

  describe("meaning_preserved / grammatically_correct defaults", () => {
    it("defaults both to true with a warning when absent", () => {
      const result = scoreV1Task.parse({ score: 5 }, payload);
      expect(result.meaning_preserved).toBe(true);
      expect(result.grammatically_correct).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toMatch(/meaning_preserved/);
      expect(result.warnings[1]).toMatch(/grammatically_correct/);
    });

    it("treats non-boolean values as absent", () => {
      const result = scoreV1Task.parse(
        { score: 5, meaning_preserved: "false", grammatically_correct: 0 },
        payload,
      );
      expect(result.meaning_preserved).toBe(true);
      expect(result.grammatically_correct).toBe(true);
      expect(result.warnings).toHaveLength(2);
    });

    it("preserves explicit false values without warnings", () => {
      const result = scoreV1Task.parse(
        { score: 5, meaning_preserved: false, grammatically_correct: false },
        payload,
      );
      expect(result.meaning_preserved).toBe(false);
      expect(result.grammatically_correct).toBe(false);
      expect(result.warnings).toEqual([]);
    });
  });
});

describe("score-v1 validatePayload", () => {
  it("returns only the two known fields", () => {
    expect(scoreV1Task.validatePayload({ ...payload, extra: 1 })).toEqual(payload);
  });

  it.each([
    [null, /must be an object/],
    ["text", /must be an object/],
    [{ original: "x" }, /"current" must be a string/],
    [{ original: 1, current: "x" }, /"original" must be a string/],
    [{ original: "x", current: "   " }, /"current" must not be empty/],
    [{ original: "x".repeat(SCORE_V1_MAX_CHARS + 1), current: "x" }, /exceeds/],
  ])("rejects %j", (input, message) => {
    expect(() => scoreV1Task.validatePayload(input)).toThrow(message);
  });
});

describe("score-v1 buildRequest", () => {
  it("builds a deterministic provider request with the shared prompt", () => {
    const request = scoreV1Task.buildRequest(payload);
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.temperature).toBe(0);
    expect(request.system).toBe(SCORE_V1_SYSTEM_PROMPT);
    expect(request.outputSchema).toBe(SCORE_V1_RESPONSE_SCHEMA);
    expect(request.messages).toEqual([
      {
        role: "user",
        content: `ORIGINAL:\n${payload.original}\n\nCURRENT:\n${payload.current}`,
      },
    ]);
  });
});
