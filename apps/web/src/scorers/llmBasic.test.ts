import { describe, expect, it, vi } from "vitest";
import { createLlmBasicScorer, LLM_BASIC_TASK_ID } from "./llmBasic";
import type { TaskClient } from "../providers/taskClient";
import { ctx } from "../test/fakes";

const taskResult = {
  score: 4,
  tells: [{ label: "em-dash", quote: "—" }],
  meaning_preserved: false,
  fluent: true,
  warnings: [],
};

describe("llm-basic scorer", () => {
  it("runs score-v1 with original and current, and exposes the task result as raw", async () => {
    const run = vi.fn(async () => ({ result: taskResult, version: 1, cached: false }));
    const client = { run } as unknown as TaskClient;
    const scorer = createLlmBasicScorer(client);

    const result = await scorer.score(ctx({ original: "orig", current: "cur", checksUsed: 2 }));

    expect(scorer.id).toBe("llm-basic");
    expect(run).toHaveBeenCalledWith(LLM_BASIC_TASK_ID, { original: "orig", current: "cur" });
    expect(result).toEqual({ score: 4, tells: taskResult.tells, raw: taskResult });
  });

  it("lets client errors propagate untouched", async () => {
    const client = {
      run: vi.fn(async () => {
        throw new Error("provider_error: upstream down");
      }),
    } as unknown as TaskClient;
    await expect(createLlmBasicScorer(client).score(ctx())).rejects.toThrow("upstream down");
  });
});
