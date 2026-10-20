/**
 * Compares the game's judges with Pangram, a commercial AI detector (spec B.50).
 * Scores the harness's texts with each judge from web/src/config.ts and with
 * Pangram, then prints, per detector: how many texts pass as human, the AUC, how
 * often each judge agrees with Pangram's verdict, and the rank correlation of its
 * score with Pangram's. Every judge but the offline one (scorers.mock, which is no
 * detector) is compared unless `--scorers` names others.
 *
 *   pnpm pangram [--scorers jev,haiku] [--model pangram-4.1] [--bank file] [--human file]
 *                [--limit N] [--concurrency 4] [--max-units 500] [--show-disagreements]
 *
 * Pangram charges per call: one unit per started 100 words. Its results are cached
 * under scripts/.cache/pangram/<model>, so each text is paid for once per model.
 * The run stops before calling anything if the uncached texts would cost more than
 * `--max-units`; `--max-units 0` just prints the estimate.
 *
 * Every detector sees only the text, as the judges always do since spec B.51: an
 * AI passage unedited, a human text as its author wrote it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gameConfig } from "../web/src/config";
import type { ScorerOption } from "../web/src/game";
import * as scorers from "../web/src/scorers";
import {
  auc,
  cacheDir,
  createDiskCache,
  createPangramClient,
  createScriptProvider,
  dataDir,
  intArg,
  mapWithConcurrency,
  PangramError,
  pangramScore,
  pangramUnits,
  readArgs,
  runScorersLocally,
  sha256,
  spearman,
  type PangramResult,
} from "./common";

const args = readArgs({
  scorers: { type: "string" },
  model: { type: "string", default: "pangram-4.1" },
  bank: { type: "string" },
  human: { type: "string" },
  limit: { type: "string" },
  concurrency: { type: "string" },
  "max-units": { type: "string" },
  "show-disagreements": { type: "boolean", default: false },
});

const model = args.model;
const limit = intArg(args.limit, Number.MAX_SAFE_INTEGER);
const concurrency = intArg(args.concurrency, 4);
const maxUnits = intArg(args["max-units"], 500);
/** Pangram 4's realtime price per unit (100 words), checked 2026-10-19; assumed for 4.1. */
const DOLLARS_PER_UNIT = 0.05;

function pickJudges(): ScorerOption[] {
  if (args.scorers === undefined)
    return gameConfig.scorers.filter((s) => s.scorer !== scorers.mock);
  return args.scorers.split(",").map((id) => {
    const option = gameConfig.scorers.find((s) => s.id === id.trim());
    if (!option) {
      const known = gameConfig.scorers.map((s) => s.id).join(", ");
      throw new Error(`Unknown scorer "${id}". Known: ${known}`);
    }
    return option;
  });
}
const judges = pickJudges();

type Item = {
  id: string;
  text: string;
  generatedWith?: { model?: string };
  source?: string;
};
async function loadItems(file: string): Promise<Item[]> {
  return (JSON.parse(await readFile(file, "utf8")) as Item[]).slice(0, limit);
}
/** The generator model of an AI passage, or the source site of a human text. */
function groupOf(item: Item): string {
  return item.generatedWith?.model ?? item.source?.match(/^[A-Za-z ]+/)?.[0].trim() ?? "other";
}

const bankFile = path.resolve(args.bank ?? path.join(dataDir, "passages.json"));
const humanFile = path.resolve(args.human ?? path.join(dataDir, "human_corpus.json"));
const bank = await loadItems(bankFile);
const human = await loadItems(humanFile);

// ---------------------------------------------------------------------------
// Pangram: cost check, then one call per uncached text

const pangramCache = createDiskCache(path.join(cacheDir, "pangram"));
const cacheKey = (text: string) => `pangram:${model}:${sha256(text)}`;
const all = [...bank, ...human];
const uncached: Item[] = [];
for (const item of all) {
  if ((await pangramCache.get(cacheKey(item.text))) === undefined) uncached.push(item);
}
const units = uncached.reduce((sum, item) => sum + pangramUnits(item.text), 0);
const estimate = `${uncached.length} new Pangram calls, ${units} units (about $${(units * DOLLARS_PER_UNIT).toFixed(2)})`;
if (units > maxUnits) {
  console.log(
    `${estimate}; ${all.length - uncached.length} texts are cached.\n` +
      `That is over --max-units ${maxUnits}, so nothing was called. Rerun with a higher --max-units to go ahead.`,
  );
  process.exit(1);
}

let pangram: ReturnType<typeof createPangramClient> | undefined;
if (uncached.length) {
  const apiKey = process.env.PANGRAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PANGRAM_API_KEY is not set. Put it in worker/.dev.vars (git-ignored) or export it in your shell, and rerun.",
    );
  }
  pangram = createPangramClient(apiKey);
  // Free, and fails fast on a bad key or a model the key cannot use.
  const available = await pangram.models();
  if (!available.includes(model)) {
    throw new Error(
      `Pangram model "${model}" is not available to this key. It may use: ${available.join(", ")}`,
    );
  }
}

/** A failure that would repeat on every text: bad key, no credits, model not allowed. */
let fatal: PangramError | undefined;
async function detect(item: Item): Promise<PangramResult | string> {
  const key = cacheKey(item.text);
  const hit = (await pangramCache.get(key)) as PangramResult | undefined;
  if (hit) return hit;
  if (fatal) return "skipped";
  try {
    const result = await pangram!.detect(item.text, model);
    await pangramCache.put(key, result);
    return result;
  } catch (error) {
    if (error instanceof PangramError && [401, 402, 403].includes(error.status ?? 0)) fatal = error;
    return error instanceof Error ? error.message : String(error);
  }
}

// ---------------------------------------------------------------------------
// Judges, run here exactly as the game runs them (spec B.29)

runScorersLocally({
  provider: createScriptProvider(),
  typesafeApiKey: process.env.TYPESAFE_API_KEY,
  cache: createDiskCache(path.join(cacheDir, "results")),
});

async function judge(item: Item): Promise<Array<number | string>> {
  const scores: Array<number | string> = [];
  for (const { scorer } of judges) {
    try {
      // The judges read only `current` (spec B.51).
      scores.push((await scorer.score({ original: item.text, current: item.text })).score);
    } catch (error) {
      scores.push(error instanceof Error ? error.message : String(error));
    }
  }
  return scores;
}

if (uncached.length) console.log(`${estimate}...`);
const [pangramResults, judgeScores] = await Promise.all([
  // Pangram allows 5 requests a second, and each task polls once a second.
  mapWithConcurrency(all, Math.min(concurrency, 3), detect),
  mapWithConcurrency(all, concurrency, judge),
]);
if (fatal) {
  console.error(`Stopped: ${fatal.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Report

type Row = {
  item: Item;
  ai: boolean;
  group: string;
  pangram: PangramResult;
  /** One per detector, judges first, then Pangram (0–1). Higher means more AI. */
  scores: number[];
  /** Whether each detector passes the text as human, in the same order. */
  passes: boolean[];
};
const rows: Row[] = [];
const failures: string[] = [];
all.forEach((item, i) => {
  const result = pangramResults[i]!;
  const scores = judgeScores[i]!;
  const errors = [
    ...scores.flatMap((s, j) => (typeof s === "string" ? [`${judges[j]!.label}: ${s}`] : [])),
    ...(typeof result === "string" ? [`Pangram: ${result}`] : []),
  ];
  if (typeof result === "string" || errors.length) {
    failures.push(`${item.id} (${errors.join("; ")})`);
    return;
  }
  const judged = scores as number[];
  rows.push({
    item,
    ai: i < bank.length,
    group: groupOf(item),
    pangram: result,
    scores: [...judged, pangramScore(result)],
    passes: [
      ...judged.map((s, j) => s <= judges[j]!.win.scoreAtOrBelow),
      result.prediction_short === "Human",
    ],
  });
});

const detectors = [...judges.map((j) => j.label), "Pangram"];
const aiRows = rows.filter((r) => r.ai);
const humanRows = rows.filter((r) => !r.ai);
// As in the harness, Gutenberg's 19th-century prose is set apart (spec B.39).
const modernRows = humanRows.filter((r) => r.group !== "Project Gutenberg");
const pangramIndex = judges.length;

const table: string[][] = [["", ...detectors]];
const section = (title: string) => table.push([title]);
const line = (label: string, cell: (d: number) => string) =>
  table.push([`  ${label}`, ...detectors.map((_, d) => cell(d))]);
const fixed = (x: number) => (Number.isNaN(x) ? "–" : x.toFixed(3));

section("Passes as human");
for (const [label, set] of [
  ["AI bank", aiRows],
  ["Human corpus", humanRows],
] as const) {
  line(`${label} (${set.length})`, (d) => String(set.filter((r) => r.passes[d]).length));
  const groups = [...new Set(set.map((r) => r.group))];
  if (groups.length > 1) {
    for (const g of groups) {
      const inGroup = set.filter((r) => r.group === g);
      line(`  ${g} (${inGroup.length})`, (d) => String(inGroup.filter((r) => r.passes[d]).length));
    }
  }
}
section("AUC, AI vs human");
const aucOf = (humans: Row[], d: number) =>
  fixed(
    auc(
      aiRows.map((r) => r.scores[d]!),
      humans.map((r) => r.scores[d]!),
    ),
  );
line(`modern sources (${modernRows.length})`, (d) => aucOf(modernRows, d));
line(`all sources (${humanRows.length})`, (d) => aucOf(humanRows, d));
section("Agrees with Pangram's verdict");
for (const [label, set] of [
  ["AI bank", aiRows],
  ["Human corpus", humanRows],
] as const) {
  line(label, (d) =>
    d === pangramIndex
      ? ""
      : `${set.filter((r) => r.passes[d] === r.passes[pangramIndex]).length}/${set.length}`,
  );
}
section("Rank correlation with Pangram's score (Spearman)");
for (const [label, set] of [
  ["AI bank", aiRows],
  ["Human corpus", humanRows],
  ["All texts", rows],
] as const) {
  line(label, (d) =>
    d === pangramIndex
      ? ""
      : fixed(
          spearman(
            set.map((r) => r.scores[d]!),
            set.map((r) => r.scores[pangramIndex]!),
          ),
        ),
  );
}

const widths = detectors.map((_, d) =>
  Math.max(...table.map((cells) => (cells[d + 1] ?? "").length)),
);
const labelWidth = Math.max(...table.map((cells) => (cells.length > 1 ? cells[0]!.length : 0)));
const formatted = table.map((cells) =>
  cells.length === 1
    ? cells[0]!
    : [
        cells[0]!.padEnd(labelWidth),
        ...widths.map((w, d) => (cells[d + 1] ?? "").padStart(w)),
      ].join("   "),
);

const versions = [...new Set(rows.map((r) => r.pangram.version))].join(", ");
const lines = judges.map((j) => `${j.id} (line ${j.win.scoreAtOrBelow})`).join(", ");
console.log(
  `Pangram ${model} (version ${versions || "?"}) against judges ${lines} from web/src/config.ts`,
);
console.log(
  `AI: ${path.relative(process.cwd(), bankFile)} (${bank.length}); human: ${path.relative(process.cwd(), humanFile)} (${human.length}), each text judged on its own`,
);
console.log(
  `Pangram: ${all.length - uncached.length} cached, ${uncached.length} new calls (${units} units)\n`,
);
console.log(formatted.join("\n"));
console.log(
  `\nA judge passes a text at or below its win line; Pangram passes it when its prediction is "Human".` +
    `\nPangram's score is its ai_assistance_score, 0 (human) to 1 (AI).`,
);
for (const [label, set] of [
  ["AI bank", aiRows],
  ["human corpus", humanRows],
] as const) {
  const counts = ["AI", "Mixed", "Human"].map(
    (p) => `${p} ${set.filter((r) => r.pangram.prediction_short === p).length}`,
  );
  console.log(`Pangram's predictions on the ${label}: ${counts.join(", ")}`);
}
if (failures.length)
  console.log(
    `\nLeft out, ${failures.length} not scored by every detector: ${failures.join("; ")}`,
  );

if (args["show-disagreements"]) {
  const differs = rows.filter((r) =>
    r.passes.slice(0, pangramIndex).some((p) => p !== r.passes[pangramIndex]),
  );
  console.log(
    `\nTexts where a judge and Pangram disagree (${differs.length}); "pass" means passes as human:`,
  );
  for (const r of differs) {
    const cells = detectors.map((name, d) => {
      const score = d === pangramIndex ? r.scores[d]!.toFixed(2) : String(r.scores[d]);
      return `${name} ${score} ${r.passes[d] ? "pass" : "AI"}`;
    });
    console.log(`  ${r.item.id.padEnd(8)} ${r.group.padEnd(18)} ${cells.join(" | ")}`);
  }
}
