/**
 * Bank generator (SPEC §19 Milestone 3b, Appendix A.3). Generates candidate
 * passages with `generate-v1`, scores each with the active scoring task, and
 * keeps those at or above --min-score that the judge also marks fluent and
 * meaning-preserving. Writes data/passages.json with provenance.
 *
 *   pnpm --filter @unslop/scripts generate [--count 60] [--min-score 8] [--out data/passages.json] [--append] [--concurrency 3]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GENERATE_V1_REGISTERS,
  generateV1Task,
  scoreV1Task,
  type GenerateV1Result,
  type ScoreV1Result,
} from "@unslop/shared";
import { intArg, readArgs } from "./lib/args";
import { cacheDir, dataDir } from "./lib/paths";
import { mapWithConcurrency } from "./lib/pool";
import { createScriptProvider } from "./lib/provider";
import { createDiskCache } from "./lib/resultCache";
import { createTaskRunner } from "./lib/runTask";

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
  "min-score": { type: "string" },
  out: { type: "string" },
  append: { type: "boolean", default: false },
  concurrency: { type: "string" },
  "max-attempts": { type: "string" },
});
const count = intArg(args.count, 60);
const minScore = intArg(args["min-score"], 8);
const concurrency = intArg(args.concurrency, 3);
const maxAttempts = intArg(args["max-attempts"], count * 2);
const outFile = path.resolve(args.out ?? path.join(dataDir, "passages.json"));

type BankEntry = {
  id: string;
  topic: string;
  register: string;
  text: string;
  generatedWith: { task: string; scoredWith: string; score: number };
};

const runner = createTaskRunner(
  createScriptProvider(),
  createDiskCache(path.join(cacheDir, "results")),
);

const existing: BankEntry[] = args.append
  ? (JSON.parse(await readFile(outFile, "utf8")) as BankEntry[])
  : [];
const usedTexts = new Set(existing.map((e) => e.text));

/** Deterministic topic/register pairing: attempt i uses topic i and a rotating register. */
function combo(i: number) {
  return {
    topic: TOPICS[i % TOPICS.length]!,
    register:
      GENERATE_V1_REGISTERS[(i + Math.floor(i / TOPICS.length)) % GENERATE_V1_REGISTERS.length]!,
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
    const gen = (await runner.run(generateV1Task, { topic, register })).result as GenerateV1Result;
    if (gen.wordCount < 80 || gen.wordCount > 140) {
      return { topic, register, text: gen.text, keep: false, why: `length ${gen.wordCount} words` };
    }
    if (usedTexts.has(gen.text))
      return { topic, register, text: gen.text, keep: false, why: "duplicate" };
    const scored = (await runner.run(scoreV1Task, { original: gen.text, current: gen.text }))
      .result as ScoreV1Result;
    if (scored.score < minScore) {
      return {
        topic,
        register,
        text: gen.text,
        score: scored.score,
        keep: false,
        why: `score ${scored.score} < ${minScore}`,
      };
    }
    if (!scored.fluent || !scored.meaning_preserved) {
      return {
        topic,
        register,
        text: gen.text,
        score: scored.score,
        keep: false,
        why: "judge flagged fluency/meaning",
      };
    }
    return { topic, register, text: gen.text, score: scored.score, keep: true, why: "kept" };
  } catch (error) {
    return {
      topic,
      register,
      keep: false,
      why: error instanceof Error ? error.message : String(error),
    };
  }
}

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
          scoredWith: `${scoreV1Task.id}@${scoreV1Task.version}`,
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
