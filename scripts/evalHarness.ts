/**
 * Evaluation harness (SPEC §19 Milestone 3b, Appendix A.5). Runs a scoring task
 * over the AI bank and the human corpus and prints histograms, mean, median, and
 * the two separation figures. Talks to the provider directly with
 * ANTHROPIC_API_KEY from the environment; never goes through the Worker.
 *
 *   pnpm harness [--task score-v1] [--limit N] [--concurrency 4] [--no-cache] [--strict]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { callableTasks, runTask, type RunTaskDeps } from "../shared/runTask";
import type { ScoreV1Result } from "../shared/scoreV1";
import type { AnyTask } from "../shared/types";
import {
  cacheDir,
  createDiskCache,
  createScriptProvider,
  dataDir,
  formatSet,
  intArg,
  mapWithConcurrency,
  meetsTarget,
  noCache,
  readArgs,
  type SeparationTarget,
} from "./common";

const args = readArgs({
  task: { type: "string", default: "score-v1" },
  bank: { type: "string" },
  human: { type: "string" },
  limit: { type: "string" },
  concurrency: { type: "string" },
  "no-cache": { type: "boolean", default: false },
  strict: { type: "boolean", default: false },
  "show-misses": { type: "boolean", default: false },
});

function requireTask(id: string): AnyTask {
  const found = callableTasks.get(id);
  if (!found) {
    throw new Error(`Unknown scoring task "${id}". Known: ${[...callableTasks.keys()].join(", ")}`);
  }
  return found;
}
const task = requireTask(args.task!);
const limit = intArg(args.limit, Number.MAX_SAFE_INTEGER);
const concurrency = intArg(args.concurrency, 4);

type Item = { id: string; text: string };
async function loadItems(file: string): Promise<Item[]> {
  const items = JSON.parse(await readFile(file, "utf8")) as Item[];
  return items.slice(0, limit);
}

const deps: RunTaskDeps = {
  provider: createScriptProvider(),
  typesafeApiKey: process.env.TYPESAFE_API_KEY,
  cache: args["no-cache"] ? noCache : createDiskCache(path.join(cacheDir, "results")),
};

type Scored = { id: string; score: number | null; error?: string; cached: boolean };
async function scoreAll(items: Item[]): Promise<Scored[]> {
  return mapWithConcurrency(items, concurrency, async (item) => {
    try {
      const { result, cached } = await runTask(
        task,
        { original: item.text, current: item.text },
        deps,
      );
      return { id: item.id, score: (result as ScoreV1Result).score, cached };
    } catch (error) {
      return {
        id: item.id,
        score: null,
        error: error instanceof Error ? error.message : String(error),
        cached: false,
      };
    }
  });
}

const bank = await loadItems(path.resolve(args.bank ?? path.join(dataDir, "passages.json")));
const human = await loadItems(path.resolve(args.human ?? path.join(dataDir, "human_corpus.json")));

console.log(`scorer task: ${task.id}@${task.version} (${task.model})\n`);
const [bankScored, humanScored] = await Promise.all([scoreAll(bank), scoreAll(human)]);

function report(label: string, scored: Scored[], sep: SeparationTarget, missIsBelow: boolean) {
  const ok = scored.filter((s) => s.score !== null);
  const scores = ok.map((s) => s.score!);
  console.log(formatSet(label, scores, sep));
  const failed = scored.filter((s) => s.score === null);
  if (failed.length)
    console.log(
      `  ${failed.length} failed: ${failed.map((f) => `${f.id} (${f.error})`).join("; ")}`,
    );
  const cachedCount = scored.filter((s) => s.cached).length;
  console.log(`  ${cachedCount}/${scored.length} served from cache`);
  if (args["show-misses"]) {
    const misses = ok.filter((s) =>
      missIsBelow ? s.score! < sep.threshold : s.score! >= sep.threshold,
    );
    if (misses.length)
      console.log(`  misses: ${misses.map((m) => `${m.id}=${m.score}`).join(", ")}`);
  }
  console.log();
  return meetsTarget(scores, sep);
}

// threshold below is for checking the creation of a new bank of ai passages. after scorer is implemented, can update
const bankOk = report("AI bank", bankScored, { threshold: 0, kind: "min", target: 0.95 }, true);
const humanOk = report(
  "Human corpus",
  humanScored,
  { threshold: 6, kind: "max", target: 0.1 },
  false,
);

if (args.strict && !(bankOk && humanOk)) process.exit(1);
