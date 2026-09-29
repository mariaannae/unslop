import { describe, expect, it } from "vitest";
import { registry } from "../config/registry";
import { gameConfig } from "../config/game.config";
import { createRegistry, UnknownIdError } from "./registry";
import { fakeGuardrail, fakeReferee, fakeScorer, sequentialSource } from "../test/fakes";

describe("createRegistry", () => {
  const scorer = fakeScorer();
  const referee = fakeReferee();
  const source = sequentialSource();
  const guardrailFactory = (params: unknown) => fakeGuardrail(`g:${JSON.stringify(params)}`, true);
  const reg = createRegistry({
    scorers: { fake: () => scorer },
    guardrails: { g: guardrailFactory },
    referees: { "fake-ref": () => referee },
    passageSources: { seq: () => source },
  });

  it("resolves a known scorer", () => {
    expect(reg.getScorer("fake")).toBe(scorer);
  });

  it("fails clearly on an unknown scorer", () => {
    expect(() => reg.getScorer("nope")).toThrowError(UnknownIdError);
    expect(() => reg.getScorer("nope")).toThrow(/Unknown scorer "nope". Known scorers: fake/);
  });

  it("resolves known guardrails in order and passes their params", () => {
    const guardrails = reg.getGuardrails(["g", "g"], { g: { min: 1 } });
    expect(guardrails.map((g) => g.id)).toEqual(['g:{"min":1}', 'g:{"min":1}']);
  });

  it("passes undefined params when none are configured", () => {
    expect(reg.getGuardrails(["g"])[0]!.id).toBe("g:undefined");
  });

  it("fails on any unknown guardrail id", () => {
    expect(() => reg.getGuardrails(["g", "missing"])).toThrow(/Unknown guardrail "missing"/);
  });

  it("resolves referees and passage sources, and rejects unknown ones", () => {
    expect(reg.getReferee("fake-ref")).toBe(referee);
    expect(reg.getPassageSource("seq")).toBe(source);
    expect(() => reg.getReferee("x")).toThrow(/Unknown referee/);
    expect(() => reg.getPassageSource("x")).toThrow(/Unknown passage source/);
  });

  it("does not treat Object.prototype members as registered ids", () => {
    expect(() => reg.getScorer("constructor")).toThrowError(UnknownIdError);
    expect(() => reg.getScorer("toString")).toThrowError(UnknownIdError);
  });
});

describe("built-in registry", () => {
  it("resolves every id used by the game config", () => {
    expect(registry.getScorer(gameConfig.scorer).id).toBe(gameConfig.scorer);
    expect(
      registry.getGuardrails(gameConfig.guardrails, gameConfig.guardrailParams).map((g) => g.id),
    ).toEqual([...gameConfig.guardrails]);
    expect(registry.getReferee(gameConfig.referee!).id).toBe(gameConfig.referee);
    expect(registry.getPassageSource(gameConfig.passageSource).id).toBe(gameConfig.passageSource);
  });

  it("resolves the opt-in LLM scorer and remote guardrail", () => {
    expect(registry.getScorer("llm-basic").id).toBe("llm-basic");
    expect(registry.getGuardrails(["meaning-fluency"])[0]).toMatchObject({
      id: "meaning-fluency",
      local: false,
    });
  });
});
