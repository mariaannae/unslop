/**
 * Evaluation harness (SPEC §19 Milestone 3b, Appendix A.5). Scores the AI bank and
 * the human corpus and prints histograms, mean, median, the two separation figures
 * and the AUC. By default it scores with the game's default scorer from
 * web/src/config.ts (spec B.29), on that scorer's display scale; `--scorer` picks
 * another configured scorer, and `--task` runs one scoring task on its own scale
 * instead. Talks to the providers directly with the keys from the environment;
 * never goes through the Worker.
 *
 *   pnpm harness [--scorer jev | --task score-jev] [--bank file] [--human file]
 *                [--originals file] [--split tune|holdout] [--limit N]
 *                [--concurrency 4] [--no-cache] [--strict] [--show-misses]
 *
 * `--split` keeps only that part of both sets (spec B.24). Tune scorers on
 * "tune"; "holdout" is for confirming the result once.
 *
 * An AI passage is scored unedited, as the player first sees it. A human text is
 * scored as the edit of its AI rewrite from data/human_originals.json (spec B.40),
 * as if a player had rewritten that passage into this text.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { callableTasks, runTask, type RunTaskDeps } from "../shared/runTask";
import type { ScoreV1Result } from "../shared/scoreV1";
import type { AnyTask } from "../shared/types";
import { gameConfig } from "../web/src/config";
import { checkRules } from "../web/src/game";
import {
  cacheDir,
  createDiskCache,
  sha256,
  type HumanOriginal,
  createScriptProvider,
  dataDir,
  auc,
  formatSet,
  intArg,
  mapWithConcurrency,
  meetsTarget,
  noCache,
  readArgs,
  runScorersLocally,
  splitOf,
  type SeparationTarget,
  type Split,
} from "./common";

const args = readArgs({
  scorer: { type: "string" },
  task: { type: "string" },
  bank: { type: "string" },
  human: { type: "string" },
  originals: { type: "string" },
  split: { type: "string" },
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
const task = args.task === undefined ? undefined : requireTask(args.task);
const scorerId = args.scorer ?? gameConfig.defaultScorer;
const { scorer } = checkRules(gameConfig, scorerId);
const limit = intArg(args.limit, Number.MAX_SAFE_INTEGER);
const concurrency = intArg(args.concurrency, 4);
if (args.split !== undefined && args.split !== "tune" && args.split !== "holdout") {
  throw new Error(`--split must be "tune" or "holdout", not "${args.split}"`);
}
const split = args.split as Split | undefined;

type Item = {
  id: string;
  text: string;
  topic?: string;
  generatedWith?: { model?: string };
  source?: string;
};
async function loadItems(file: string): Promise<Item[]> {
  const items = JSON.parse(await readFile(file, "utf8")) as Item[];
  return items.filter((item) => !split || splitOf(item.topic ?? item.id) === split).slice(0, limit);
}

const deps: RunTaskDeps = {
  provider: createScriptProvider(),
  typesafeApiKey: process.env.TYPESAFE_API_KEY,
  cache: args["no-cache"] ? noCache : createDiskCache(path.join(cacheDir, "results")),
};
const scorerTasks = runScorersLocally(deps);

/**
 * `group` is the generator model of an AI passage, or the source site of a human
 * text. `cached` is known only when a single task runs.
 */
type Scored = {
  id: string;
  group?: string;
  score: number | null;
  error?: string;
  cached?: boolean;
};
async function scoreAll(items: Item[], originalOf: (item: Item) => string): Promise<Scored[]> {
  return mapWithConcurrency(items, concurrency, async (item) => {
    const ctx = { original: originalOf(item), current: item.text };
    try {
      if (!task) {
        const { score } = await scorer.score(ctx);
        return { id: item.id, group: groupOf(item), score };
      }
      const { result, cached } = await runTask(task, ctx, deps);
      return { id: item.id, group: groupOf(item), score: (result as ScoreV1Result).score, cached };
    } catch (error) {
      return {
        id: item.id,
        group: groupOf(item),
        score: null,
        error: error instanceof Error ? error.message : String(error),
        cached: false,
      };
    }
  });
}

function groupOf(item: Item): string | undefined {
  return item.generatedWith?.model ?? item.source?.match(/^[A-Za-z ]+/)?.[0].trim();
}

const bank = await loadItems(path.resolve(args.bank ?? path.join(dataDir, "passages.json")));
const human = await loadItems(path.resolve(args.human ?? path.join(dataDir, "human_corpus.json")));
const originalsFile = path.resolve(args.originals ?? path.join(dataDir, "human_originals.json"));
const originals = new Map(
  (JSON.parse(await readFile(originalsFile, "utf8")) as HumanOriginal[]).map((o) => [o.id, o]),
);
for (const item of human) {
  if (originals.get(item.id)?.textSha256 !== sha256(item.text)) {
    throw new Error(
      `${originalsFile} has no AI original for ${item.id}'s current text. Run pnpm originals.`,
    );
  }
}

const [bankScored, humanScored] = await Promise.all([
  scoreAll(bank, (item) => item.text),
  scoreAll(human, (item) => originals.get(item.id)!.original),
]);
const scorerLabel = task
  ? `scorer task: ${task.id}@${task.version} (${task.model})`
  : `scorer "${scorerId}" (web/src/config.ts): ${[...scorerTasks].join(" + ") || "offline"}`;
console.log(`${scorerLabel}${split ? `, ${split} split` : ""}\n`);

function report(label: string, scored: Scored[], sep: SeparationTarget, missIsBelow: boolean) {
  const ok = scored.filter((s) => s.score !== null);
  const scores = ok.map((s) => s.score!);
  console.log(formatSet(label, scores, sep));
  const failed = scored.filter((s) => s.score === null);
  if (failed.length)
    console.log(
      `  ${failed.length} failed: ${failed.map((f) => `${f.id} (${f.error})`).join("; ")}`,
    );
  if (task) {
    const cachedCount = scored.filter((s) => s.cached).length;
    console.log(`  ${cachedCount}/${scored.length} served from cache`);
  }
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

const scoresOf = (scored: Scored[]) => scored.flatMap((s) => (s.score === null ? [] : [s.score]));
const groups = (scored: Scored[]) => [...new Set(scored.map((s) => s.group ?? "other"))];
const inGroup = (scored: Scored[], group: string) =>
  scored.filter((s) => (s.group ?? "other") === group);
// Gutenberg's 19th-century prose is far from anything a player writes, and every
// scorer separates it from AI text almost perfectly, so the modern sources come
// first (spec B.39).
const modern = humanScored.filter((s) => s.group !== "Project Gutenberg");
console.log(
  `AUC (AI vs modern human, n=${scoresOf(modern).length}): ${auc(scoresOf(bankScored), scoresOf(modern)).toFixed(3)}`,
);
console.log(
  `AUC (AI vs all human, n=${scoresOf(humanScored).length}): ${auc(scoresOf(bankScored), scoresOf(humanScored)).toFixed(3)}`,
);
if (groups(bankScored).length > 1) {
  const cells = groups(bankScored).map(
    (g) => `${g} ${auc(scoresOf(inGroup(bankScored, g)), scoresOf(humanScored)).toFixed(3)}`,
  );
  console.log(`  by generator: ${cells.join(", ")}`);
}
if (groups(humanScored).length > 1) {
  const cells = groups(humanScored).map(
    (g) => `${g} ${auc(scoresOf(bankScored), scoresOf(inGroup(humanScored, g))).toFixed(3)}`,
  );
  console.log(`  by human source: ${cells.join(", ")}`);
}

if (args.strict && !(bankOk && humanOk)) process.exit(1);
