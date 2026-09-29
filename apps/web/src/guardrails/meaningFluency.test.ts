import { describe, expect, it } from "vitest";
import {
  MEANING_CHANGED_REASON,
  meaningFluencyGuardrail,
  NOT_FLUENT_REASON,
} from "./meaningFluency";
import { ctx } from "../test/fakes";

describe("meaning-fluency guardrail", () => {
  it("is remote", () => expect(meaningFluencyGuardrail.local).toBe(false));

  it("passes when both flags are true", async () => {
    const result = await meaningFluencyGuardrail.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: true, fluent: true },
    });
    expect(result).toEqual({ pass: true });
  });

  it("fails with the meaning reason first when meaning is not preserved", async () => {
    const result = await meaningFluencyGuardrail.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: false, fluent: false },
    });
    expect(result).toEqual({ pass: false, reason: MEANING_CHANGED_REASON });
  });

  it("fails with the fluency reason when only fluency is false", async () => {
    const result = await meaningFluencyGuardrail.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: true, fluent: false },
    });
    expect(result).toEqual({ pass: false, reason: NOT_FLUENT_REASON });
  });

  it("passes when the score or raw payload is missing or lacks the fields", async () => {
    expect(await meaningFluencyGuardrail.check(ctx())).toEqual({ pass: true });
    expect(await meaningFluencyGuardrail.check(ctx(), { score: 0 })).toEqual({ pass: true });
    expect(await meaningFluencyGuardrail.check(ctx(), { score: 0, raw: {} })).toEqual({
      pass: true,
    });
  });
});
