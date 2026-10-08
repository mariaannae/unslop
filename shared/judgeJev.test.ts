import { afterEach, describe, expect, it, vi } from "vitest";
import { judgeJevTask } from "./judgeJev";
import { callableTasks } from "./runTask";
import { ProviderError, TaskError } from "./types";

const payload = {
  original: "The kettle switches off when it boils.",
  current: "Kettle off at boil.",
};

/** Replaces fetch with a fake Jev that answers the two questions with these probabilities. */
function stubJev(meaning: number, grammar: number) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: {
            meaning: { type: "noul", noul: meaning },
            grammar: { type: "noul", noul: grammar },
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function judge() {
  return judgeJevTask.parse(
    await judgeJevTask.call(payload, { typesafeApiKey: "test-key" }),
    payload,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("judge-jev", () => {
  it("is callable through the Worker", () => {
    expect(callableTasks.get("judge-jev")).toBe(judgeJevTask);
  });

  it("asks both questions in one request that shows Jev both texts", async () => {
    const fetch = stubJev(0.9, 0.9);
    await judge();
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.state).toEqual(payload);
    expect(Object.keys(body.questions)).toEqual(["meaning", "grammar"]);
  });

  it.each([
    [0.5, 0.49, true, false],
    [0.49, 0.5, false, true],
  ])("passes a verdict at 0.5 or more (meaning %s, grammar %s)", async (m, g, meaning, grammar) => {
    stubJev(m, g);
    expect(await judge()).toEqual({
      meaning_preserved: meaning,
      grammatically_correct: grammar,
      meaning_probability: m,
      grammar_probability: g,
      model: "jev-1.13.0",
    });
  });

  it("rejects a result missing an answer", () => {
    expect(() => judgeJevTask.parse({ answers: { meaning: 1 } }, payload)).toThrow(TaskError);
    expect(() => judgeJevTask.parse(null, payload)).toThrow(TaskError);
  });

  it("needs the TypeSafe key", async () => {
    await expect(judgeJevTask.call(payload, {})).rejects.toThrow(ProviderError);
  });
});
