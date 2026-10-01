import { afterEach, describe, expect, it, vi } from "vitest";
import { callableTasks, runTask, type TaskCache } from "./runTask";
import { measure, scoreJevTask } from "./scoreJev";
import { ProviderError, TaskError } from "./types";

const P1 = "My starter smells like beer, and I still do not trust it to raise a loaf.";
const P2 = "The second rise took nine hours because the kitchen sat at sixty degrees.";
/** One paragraph of 208 words: over the 200-word line for the long-form tells. */
const LONG = Array(13).fill(P1).join(" ");
const LONG_FORM = ["fence_sitting", "reasons_list", "bold_labels", "emoji_bullets"];

/**
 * Replaces fetch with a fake Jev that answers every noul with `noul(id, state)`
 * and every score with `level(id)`.
 */
function stubJev(
  noul: (id: string, state: Record<string, string>) => number,
  level: (id: string) => number = () => 0,
) {
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { state, questions } = JSON.parse(init!.body as string) as {
      state: Record<string, string>;
      questions: Record<string, { type: string }>;
    };
    const answers = Object.fromEntries(
      Object.entries(questions).map(([id, q]) => [
        id,
        q.type === "noul"
          ? { type: "noul", noul: noul(id, state) }
          : { type: "score", score: level(id) },
      ]),
    );
    return new Response(JSON.stringify({ model: "jev-1.13.0", answers }));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function scoreText(current: string) {
  const payload = { original: current, current };
  const raw = await scoreJevTask.call(payload, { typesafeApiKey: "test-key" });
  return scoreJevTask.parse(raw, payload);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("measure", () => {
  it("skips rhythm and long-form tells on short text but counts vocabulary and em dashes", () => {
    const { tells, stockHits } = measure(`${P1} It is crucial — truly.`);
    // 20 words: one stock phrase and one em dash are each 50 per 1,000 words.
    expect(stockHits).toEqual(["crucial"]);
    expect(tells.stock_vocab).toEqual({ value: 50, strength: 1 });
    expect(tells.em_dash).toEqual({ value: 50, strength: 1 });
    for (const id of ["low_burstiness", "uniform_paragraphs", "bold_labels", "emoji_bullets"]) {
      expect(tells[id]!.strength).toBeNull();
    }
  });

  it("counts stock vocabulary and em dashes per 1,000 words", () => {
    // 10 words, then 150 more: 160 in all.
    const text = "In today’s world we delve into it — and delve again. " + "word ".repeat(150);
    const { tells, stockHits } = measure(text);
    expect(stockHits).toEqual(["delve", "in today's"]);
    expect(tells.stock_vocab).toEqual({ value: 18.75, strength: 1 });
    expect(tells.em_dash).toEqual({ value: 6.25, strength: 0.53125 });
  });

  it("flags uniform sentences, bold labels and emoji bullets", () => {
    expect(measure("The dog ran home. ".repeat(8)).tells.low_burstiness).toEqual({
      value: 0,
      strength: 1,
    });
    const bold = measure(`- **Speed:** fast\n- **Cost:** low\n\n${LONG}`).tells.bold_labels;
    expect(bold).toEqual({ value: 2, strength: 2 / 3 });
    const emoji = measure(`✅ Done\n🚀 Shipped\n\n${LONG}`).tells.emoji_bullets;
    expect(emoji).toEqual({ value: 2, strength: 1 });
  });
});

describe("score-jev", () => {
  it("is a Worker task", () => {
    expect(callableTasks.get("score-jev")).toBe(scoreJevTask);
  });

  it("asks the whole text once and each paragraph of 12+ words separately", async () => {
    const fetch = stubJev(() => 0);
    const current = `${P1}\n\nToo short to ask.\n\n${P2}`;
    await scoreText(current);

    expect(fetch).toHaveBeenCalledTimes(3);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    const bodies = fetch.mock.calls.map(([, i]) => JSON.parse(i!.body as string));
    expect(bodies[0].model).toBe("jev-1.13.0");
    expect(bodies[0].state).toEqual({ text: current });
    expect(bodies[0].questions.gut_check.type).toBe("score");
    expect(bodies[0].questions.gut_check.criteria).toHaveLength(4);
    expect(bodies[0].questions.chatbot_residue.criteria.true).toMatch(/assistant-to-user/);
    expect(bodies.slice(1).map((b) => b.state)).toEqual([{ paragraph: P1 }, { paragraph: P2 }]);
    expect(Object.keys(bodies[1].questions)).toHaveLength(8);
  });

  it("scores 0 when Jev finds nothing", async () => {
    stubJev(() => 0);
    expect(await scoreText(P1)).toMatchObject({ score: 0, composite: 0, tells: [] });
  });

  it("is jevslop's weighted mean of every measured tell", async () => {
    stubJev(
      () => 1,
      (id) => (id === "no_voice" ? 2 : 3),
    );
    // Short text, so no long-form tells. Jev weights 5 + 2.6 + 8.8 at strength 1; stock
    // vocabulary and em dash (weight 2.2) at 0: 16.4 / 18.6.
    const result = await scoreText(P1);
    expect(result.composite).toBe(88.2);
    expect(result.score).toBe(8.8);
    expect(result.tells).toHaveLength(14);
  });

  it("asks and measures the long-form tells only from 200 words up", async () => {
    const fetch = stubJev(() => 1);
    const short = await scoreText(P1);
    const long = await scoreText(LONG);

    const asked = fetch.mock.calls.map(([, i]) => JSON.parse(i!.body as string).questions);
    expect(asked[0]).not.toHaveProperty("reasons_list");
    expect(asked[0]).not.toHaveProperty("fence_sitting");
    expect(asked[2]).toHaveProperty("reasons_list");
    expect(asked[2]).toHaveProperty("fence_sitting");
    const strengths = (r: typeof short) =>
      LONG_FORM.map((id) => r.breakdown.find((t) => t.id === id)!.strength);
    expect(strengths(short)).toEqual([null, null, null, null]);
    expect(strengths(long)).toEqual([1, 1, 0, 0]);
  });

  it("scores a paragraph tell as the share of paragraphs that show it", async () => {
    stubJev((id, state) => (id === "contrast_reframe" && state.paragraph === P1 ? 0.9 : 0));
    const result = await scoreText(`${P1}\n\n${P2}`);
    expect(result.breakdown.find((t) => t.id === "contrast_reframe")!.strength).toBe(0.5);
  });

  it("lists tells at strength 0.5 or more, strongest first", async () => {
    stubJev(
      (id) => ({ chatbot_residue: 0.9, generic_filler: 0.6 })[id] ?? 0.2,
      (id) => (id === "gut_check" ? 3 : 1),
    );
    expect((await scoreText(P1)).tells).toEqual([
      { label: "Jev's overall impression" },
      { label: "Generic filler" },
      { label: "Chatbot residue" },
      { label: "Absent personal voice" },
    ]);
  });

  it("caches through runTask like any other task", async () => {
    const fetch = stubJev(() => 0);
    const store = new Map<string, unknown>();
    const cache: TaskCache = {
      async get(key) {
        return store.get(key);
      },
      async put(key, value) {
        store.set(key, value);
      },
    };
    const deps = { provider: { complete: vi.fn() }, typesafeApiKey: "test-key", cache };
    const payload = { original: P1, current: P1 };

    expect((await runTask(scoreJevTask, payload, deps)).cached).toBe(false);
    expect((await runTask(scoreJevTask, payload, deps)).cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deps.provider.complete).not.toHaveBeenCalled();
  });

  it("reports Jev failures and a missing key as provider errors", async () => {
    const payload = { original: P1, current: P1 };
    await expect(scoreJevTask.call(payload, {})).rejects.toThrow(/TYPESAFE_API_KEY/);

    vi.stubGlobal("fetch", async () => new Response("bad key", { status: 401 }));
    const failure = scoreJevTask.call(payload, { typesafeApiKey: "test-key" });
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a result with a missing answer", () => {
    const payload = { original: P1, current: P1 };
    expect(() => scoreJevTask.parse({ model: "jev", doc: {}, paragraphs: [] }, payload)).toThrow(
      TaskError,
    );
  });
});
