/**
 * Bank generator (SPEC §19 Milestone 3b, Appendix A.3). Generates candidate
 * passages with `generate-v1` and puts each through the game's own Check, with the
 * default scorer, its win line and the guardrails in web/src/config.ts (spec
 * B.29); `--scorer` picks another of the configured scorers. It keeps the
 * candidates that pass every guardrail and that the game would not already count
 * as won, so every passage needs editing. Writes data/passages.json with
 * provenance. The generation model is also set in web/src/config.ts; `--model`
 * overrides it for one run. `--topics` reads the topic list from a JSON array
 * instead of TOPICS.
 *
 *   pnpm generate [--count 60] [--out data/passages.json] [--append] [--concurrency 3]
 *                 [--model gpt-4o] [--topics data/test_topics.json] [--scorer jev]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runTask, type RunTaskDeps } from "../shared/runTask";
import {
  cacheDir,
  createDiskCache,
  createScriptProvider,
  dataDir,
  intArg,
  mapWithConcurrency,
  readArgs,
  runScorersLocally,
} from "./common";
import { gameConfig, generationModel } from "../web/src/config";
import { checkRules, runCheck } from "../web/src/game";
import {
  createGenerateV1Task,
  GENERATE_V1_MODELS,
  GENERATE_V1_REGISTERS,
  type GenerationModel,
} from "./generateV1";

const TOPICS = [
  "sourdough starter",
  "learning to swim as an adult",
  "a small town library",
  "repairing an old bicycle",
  "keeping a paper notebook",
  "houseplants for beginners",
  "a neighborhood farmers market",
  "cold brew coffee",
  "learning the ukulele",
  "a community garden",
  "winter hiking",
  "a family recipe for lentil soup",
  "the history of the pencil",
  "adopting a senior dog",
  "a weekend pottery class",
  "commuting by train",
  "a local chess club",
  "restoring a wooden canoe",
  "birdwatching in the city",
  "the first day at a new job",
  "a used bookstore",
  "making jam",
  "a beginner's running plan",
  "a hand-knitted scarf",
  "a neighborhood bakery opening",
  "the school science fair",
  "a rainy day at the beach",
  "a mechanical keyboard",
  "the invention of the bicycle",
  "a community theater production",
  "learning to bake bread",
  "a road trip playlist",
  "a backyard beehive",
  "volunteering at an animal shelter",
  "a thrift store find",
  "a sunrise hike",
  "a homemade pizza night",
  "the town's annual pumpkin festival",
  "a beginner's guide to composting",
  "a vintage film camera",
  "a language-exchange meetup",
  "a long-distance friendship",
  "planting a fruit tree",
  "a canoe trip on a slow river",
  "a neighborhood cleanup day",
  "a jigsaw puzzle marathon",
  "a first apartment",
  "a summer job at an ice cream shop",
  "a handwritten letter",
  "a night market",
  "teaching a grandparent to video call",
  "a rooftop garden",
  "a secondhand piano",
  "a rainy-season umbrella",
  "a morning walk routine",
  "a lighthouse on the coast",
  "a favorite pair of boots",
  "a pottery mug",
  "a Sunday crossword habit",
  "the last day of school",
];

const args = readArgs({
  count: { type: "string" },
  out: { type: "string" },
  append: { type: "boolean", default: false },
  concurrency: { type: "string" },
  "max-attempts": { type: "string" },
  model: { type: "string" },
  topics: { type: "string" },
  scorer: { type: "string" },
});
const rules = checkRules(gameConfig, args.scorer ?? gameConfig.defaultScorer);
const count = intArg(args.count, 60);
const concurrency = intArg(args.concurrency, 3);
const maxAttempts = intArg(args["max-attempts"], count * 2);
const outFile = path.resolve(args.out ?? path.join(dataDir, "passages.json"));

const model = (args.model ?? generationModel) as GenerationModel;
if (!(model in GENERATE_V1_MODELS)) {
  throw new Error(`Unknown model "${model}". Known: ${Object.keys(GENERATE_V1_MODELS).join(", ")}`);
}
const topics: string[] = args.topics
  ? (JSON.parse(await readFile(path.resolve(args.topics), "utf8")) as string[])
  : TOPICS;
if (!Array.isArray(topics) || topics.length === 0 || topics.some((t) => typeof t !== "string")) {
  throw new Error(`${args.topics} must be a JSON array of topic strings`);
}

type BankEntry = {
  id: string;
  topic: string;
  register: string;
  text: string;
  generatedWith: { task: string; model: string; scoredWith: string; score: number };
};

const generateV1Task = createGenerateV1Task(model);
// The configured scorer runs its tasks here (Claude for score-v1, TypeSafe for
// score-jev); generation goes to the model's own provider.
const scorerTasks = runScorersLocally({
  provider: createScriptProvider("anthropic"),
  typesafeApiKey: process.env.TYPESAFE_API_KEY,
  cache: createDiskCache(path.join(cacheDir, "results")),
});
// generate-v1's cache key doesn't name the model, so each model gets its own cache.
const generateDeps: RunTaskDeps = {
  provider: createScriptProvider(GENERATE_V1_MODELS[model].provider),
  cache: createDiskCache(path.join(cacheDir, "generations", model)),
};

const existing: BankEntry[] = args.append
  ? (JSON.parse(await readFile(outFile, "utf8")) as BankEntry[])
  : [];
const usedTexts = new Set(existing.map((e) => e.text));

/** Deterministic topic/register pairing: attempt i uses topic i and a rotating register. */
function combo(i: number) {
  return {
    topic: topics[i % topics.length]!,
    register:
      GENERATE_V1_REGISTERS[(i + Math.floor(i / topics.length)) % GENERATE_V1_REGISTERS.length]!,
  };
}

type Attempt = {
  topic: string;
  register: string;
  text?: string;
  score?: number;
  keep: boolean;
  why: string;
};

async function attempt(i: number): Promise<Attempt> {
  const { topic, register } = combo(i);
  try {
    const gen = (await runTask(generateV1Task, { topic, register }, generateDeps)).result;
    if (gen.wordCount < 80 || gen.wordCount > 140) {
      return { topic, register, text: gen.text, keep: false, why: `length ${gen.wordCount} words` };
    }
    if (usedTexts.has(gen.text))
      return { topic, register, text: gen.text, keep: false, why: "duplicate" };
    // The passage as the game first shows it: original and current are the same text.
    const outcome = await runCheck({ original: gen.text, current: gen.text }, rules);
    const score = outcome.score?.score;
    const failed = outcome.guardrails.find((g) => !g.result.pass);
    if (failed) {
      return { topic, register, text: gen.text, score, keep: false, why: `guardrail ${failed.id}` };
    }
    if (outcome.win) {
      return {
        topic,
        register,
        text: gen.text,
        score,
        keep: false,
        why: `already won (score at or below ${rules.win.scoreAtOrBelow})`,
      };
    }
    return { topic, register, text: gen.text, score, keep: true, why: "kept" };
  } catch (error) {
    return {
      topic,
      register,
      keep: false,
      why: error instanceof Error ? error.message : String(error),
    };
  }
}

console.error(`generating with ${model}, scoring with ${args.scorer ?? gameConfig.defaultScorer}`);
const kept: BankEntry[] = [...existing];
let attempts = 0;
const rejected: Attempt[] = [];
while (kept.length < count && attempts < maxAttempts) {
  const batch = Math.min(concurrency * 2, count - kept.length, maxAttempts - attempts);
  const indices = Array.from({ length: batch }, (_, k) => existing.length + attempts + k);
  attempts += batch;
  const results = await mapWithConcurrency(indices, concurrency, attempt);
  for (const r of results) {
    if (r.keep && r.text) {
      usedTexts.add(r.text);
      kept.push({
        id: "",
        topic: r.topic,
        register: r.register,
        text: r.text,
        generatedWith: {
          task: `${generateV1Task.id}@${generateV1Task.version}`,
          model: generateV1Task.model,
          scoredWith: [...scorerTasks].join(" + ") || "offline scorer",
          score: r.score!,
        },
      });
    } else {
      rejected.push(r);
    }
  }
  console.error(`attempts ${attempts}: kept ${kept.length}/${count}`);
}

const numbered = kept.map((e, i) => ({ ...e, id: `p${String(i + 1).padStart(4, "0")}` }));
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(numbered, null, 2) + "\n");
console.error(`wrote ${numbered.length} passages to ${outFile}`);
if (rejected.length) {
  const reasons = rejected.reduce<Record<string, number>>((acc, r) => {
    const key = r.why.replace(/\d+/g, "N");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.error("rejected:", reasons);
}
if (numbered.length < count) {
  console.error(`WARNING: only ${numbered.length} of ${count} requested passages were kept`);
  process.exit(1);
}
