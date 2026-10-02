import { describe, expect, it } from "vitest";
import { callableTasks } from "../shared/runTask";
import { createGenerateV1Task, GENERATE_V1_MODELS, type GenerationModel } from "./generateV1";
import { TaskError } from "../shared/types";

const generateV1Task = createGenerateV1Task("claude-haiku-4-5");

describe("generate-v1", () => {
  it("is never callable through the Worker", () => {
    expect(callableTasks.has(generateV1Task.id)).toBe(false);
  });

  it("validates topic and register", () => {
    expect(generateV1Task.validatePayload({ topic: " cats ", register: "FAQ answer" })).toEqual({
      topic: "cats",
      register: "FAQ answer",
    });
    expect(() => generateV1Task.validatePayload({ topic: "cats" })).toThrow(/"register"/);
    expect(() => generateV1Task.validatePayload({ topic: "", register: "x" })).toThrow(/"topic"/);
  });

  it("builds a temperature-0 request on Haiku 4.5", () => {
    const request = generateV1Task.buildRequest({ topic: "cats", register: "FAQ answer" });
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.temperature).toBe(0);
    expect(request.outputSchema).toBeUndefined();
    expect(request.messages[0]?.content).toContain("about: cats");
    expect(request.messages[0]?.content).toContain("Register: FAQ answer");
  });

  it("sends every model the same prompt, at temperature 0 when the model takes one", () => {
    const payload = { topic: "cats", register: "FAQ answer" };
    const haiku = generateV1Task.buildRequest(payload);
    for (const model of Object.keys(GENERATE_V1_MODELS) as GenerationModel[]) {
      const request = createGenerateV1Task(model).buildRequest(payload);
      expect(request.model).toBe(model);
      expect(request.system).toBe(haiku.system);
      expect(request.messages).toEqual(haiku.messages);
    }
    expect(createGenerateV1Task("claude-opus-4-6").buildRequest(payload).temperature).toBe(0);
    expect(createGenerateV1Task("claude-opus-5").buildRequest(payload).temperature).toBeUndefined();
    expect(
      createGenerateV1Task("claude-sonnet-5-5").buildRequest(payload).temperature,
    ).toBeUndefined();
    expect(createGenerateV1Task("gpt-4o").buildRequest(payload).temperature).toBe(0);
    expect(createGenerateV1Task("gpt-5.6-sol").buildRequest(payload).temperature).toBeUndefined();
  });

  it("calls GPT models through OpenAI and Claude models through Anthropic", () => {
    for (const [model, settings] of Object.entries(GENERATE_V1_MODELS)) {
      expect(settings.provider).toBe(model.startsWith("gpt-") ? "openai" : "anthropic");
    }
  });

  it("parses plain text, strips fences and quotes, and collapses newlines", () => {
    const result = generateV1Task.parse('```\n"Line one.\nLine two."\n```', {
      topic: "t",
      register: "r",
    });
    expect(result).toEqual({ text: "Line one. Line two.", wordCount: 4 });
  });

  it("rejects non-text, empty, and markdown-structured responses", () => {
    const payload = { topic: "t", register: "r" };
    expect(() => generateV1Task.parse({ text: "x" }, payload)).toThrowError(TaskError);
    expect(() => generateV1Task.parse("   ", payload)).toThrow(/empty/);
    expect(() => generateV1Task.parse("Intro\n- one\n- two", payload)).toThrow(/markdown/);
  });
});
