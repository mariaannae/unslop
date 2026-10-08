/**
 * Helpers shared by the Node scripts: command-line flags, paths, the provider,
 * the disk cache, a concurrency pool, and the harness's score statistics.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsConfig } from "node:util";
import OpenAI from "openai";
import { createAnthropicProvider } from "../shared/anthropic";
import { callableTasks, runTask, type RunTaskDeps, type TaskCache } from "../shared/runTask";
import { ProviderError, type Provider, type ProviderResponse } from "../shared/types";
import { setTaskTransport } from "../web/src/scorers";

// ---------------------------------------------------------------------------
// Flags, paths, and text

export function readArgs<T extends ParseArgsConfig["options"]>(options: T) {
  return parseArgs({ options, allowPositionals: false, strict: true }).values;
}

export function intArg(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.join(scriptsDir, "..", "data");
export const cacheDir = path.join(scriptsDir, ".cache");

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** An entry of data/human_originals.json (spec B.40), written by buildHumanOriginals.ts. */
export type HumanOriginal = {
  id: string;
  /** An AI rewrite of the human text, scored as the passage the player started from. */
  original: string;
  model: string;
  /** sha256 of the human text it was written from, so a changed text is redone. */
  textSha256: string;
};

// ---------------------------------------------------------------------------
// Provider and cache

export type ProviderName = "anthropic" | "openai";

/**
 * Scripts talk to the provider directly. `pnpm generate` and `pnpm harness` load
 * the key from worker/.dev.vars (the Worker's git-ignored secrets file); a key
 * exported in the shell takes precedence.
 */
export function createScriptProvider(name: ProviderName = "anthropic"): Provider {
  const keyName = name === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const apiKey = process.env[keyName];
  if (!apiKey) {
    throw new Error(
      `${keyName} is not set. Put it in worker/.dev.vars (git-ignored) or export it in your shell, and rerun.`,
    );
  }
  return name === "openai" ? createOpenAIProvider(apiKey) : createAnthropicProvider(apiKey);
}

/**
 * OpenAI Chat Completions adapter, the counterpart of shared/anthropic.ts. Only
 * `pnpm generate` uses it (for the GPT models in GENERATE_V1_MODELS), so it
 * lives here rather than in shared/ (spec B.23). `outputSchema` is not sent.
 */
export function createOpenAIProvider(apiKey: string): Provider {
  const client = new OpenAI({ apiKey, maxRetries: 2 });

  return {
    async complete(request): Promise<ProviderResponse> {
      let completion: OpenAI.ChatCompletion;
      try {
        completion = await client.chat.completions.create({
          model: request.model,
          // Includes reasoning tokens on the GPT-5 models, like max_tokens with Claude thinking.
          max_completion_tokens: request.maxTokens,
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          messages: [{ role: "system", content: request.system }, ...request.messages],
        });
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          throw new ProviderError(
            `OpenAI API error ${error.status}: ${error.message}`,
            error.status,
          );
        }
        throw new ProviderError(error instanceof Error ? error.message : String(error));
      }

      const choice = completion.choices[0];
      if (!choice) throw new ProviderError("provider returned no choices");
      if (choice.message.refusal || choice.finish_reason === "content_filter") {
        throw new ProviderError("provider refused the request");
      }
      if (choice.finish_reason === "length") {
        throw new ProviderError("provider output was truncated (max_completion_tokens)");
      }

      return {
        text: choice.message.content ?? "",
        stopReason: choice.finish_reason,
        usage: completion.usage && {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
        },
      };
    },
  };
}

/**
 * Where a cache key lives on disk: `task:score-v1@1:<hash>` is stored at
 * `<root>/score-v1@1/<hash>.json`, the layout used since Milestone 3b.
 */
export function diskCachePath(root: string, key: string): string {
  const [, scope, hash] = key.split(":");
  return path.join(root, scope!, `${hash}.json`);
}

/**
 * Disk cache of parsed task results under scripts/.cache/results, keyed exactly
 * like the Worker's KV cache. Re-running the harness while tuning costs nothing
 * until a task version is bumped.
 */
export function createDiskCache(root: string): TaskCache {
  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(diskCachePath(root, key), "utf8")) as unknown;
      } catch {
        return undefined;
      }
    },
    async put(key, value) {
      const target = diskCachePath(root, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(value));
    },
  };
}

/**
 * Makes the game's scorers (web/src/scorers.ts) run their tasks here with runTask
 * instead of posting to the Worker, so a script scores exactly as the configured
 * scorer does in the game (spec B.29). Returns the set of `task@version` ids the
 * scorers call, filled in as they run, for provenance.
 */
export function runScorersLocally(deps: RunTaskDeps): Set<string> {
  const used = new Set<string>();
  setTaskTransport(async <Result>(taskId: string, payload: unknown) => {
    const task = callableTasks.get(taskId);
    if (!task) throw new Error(`Unknown task "${taskId}"`);
    used.add(`${task.id}@${task.version}`);
    return (await runTask(task, payload, deps)).result as Result;
  });
  return used;
}

export const noCache: TaskCache = {
  async get() {
    return undefined;
  },
  async put() {},
};

/** Maps with at most `limit` in-flight promises, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Score statistics and the Appendix A.5 report format

export type ScoreStats = {
  n: number;
  histogram: number[]; // index = score 0..10
  mean: number;
  median: number;
};

export function computeStats(scores: readonly number[]): ScoreStats {
  const histogram = new Array<number>(11).fill(0);
  for (const s of scores) histogram[Math.min(10, Math.max(0, Math.round(s)))]!++;
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n === 0 ? 0 : sorted.reduce((a, b) => a + b, 0) / n;
  const median =
    n === 0 ? 0 : n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return { n, histogram, mean, median };
}

/**
 * The chance that a random AI passage outscores a random human text, ties
 * counting half (the area under the ROC curve). 1 is perfect separation, 0.5 is
 * chance. Independent of any win threshold, so scorers on different scales compare.
 */
export function auc(ai: readonly number[], human: readonly number[]): number {
  if (ai.length === 0 || human.length === 0) return NaN;
  let wins = 0;
  for (const a of ai) for (const h of human) wins += a > h ? 1 : a === h ? 0.5 : 0;
  return wins / (ai.length * human.length);
}

export type Split = "tune" | "holdout";

/**
 * The evaluation split an entry belongs to: a hash of `key` puts about a third
 * in "holdout" (spec B.24). The harness keys AI passages by topic, so one topic
 * from several generators always lands on the same side.
 */
export function splitOf(key: string): Split {
  return createHash("sha256").update(key).digest()[0]! % 3 === 0 ? "holdout" : "tune";
}

export function fractionAtOrAbove(scores: readonly number[], threshold: number): number {
  if (scores.length === 0) return 0;
  return scores.filter((s) => s >= threshold).length / scores.length;
}

export type SeparationTarget = {
  threshold: number;
  /** "min" means the fraction must be at least `target`; "max" means at most. */
  kind: "min" | "max";
  target: number;
};

export function meetsTarget(scores: readonly number[], sep: SeparationTarget): boolean {
  const frac = fractionAtOrAbove(scores, sep.threshold);
  return sep.kind === "min" ? frac >= sep.target : frac <= sep.target;
}

export function formatSet(label: string, scores: readonly number[], sep: SeparationTarget): string {
  const stats = computeStats(scores);
  const head = `${label} (n=${stats.n})`.padEnd(22);
  const cells = stats.histogram.map((c) => String(c).padStart(3)).join("");
  const header =
    " ".repeat(22) + Array.from({ length: 11 }, (_, i) => String(i).padStart(3)).join("");
  const pct = `${(fractionAtOrAbove(scores, sep.threshold) * 100).toFixed(1)}%`;
  const targetText = `(target ${sep.kind === "min" ? ">=" : "<="} ${(sep.target * 100).toFixed(0)}%)`;
  return [
    header,
    `${head}${cells}`,
    `  mean ${stats.mean.toFixed(1)}  median ${stats.median}   >=${sep.threshold}: ${pct.padEnd(7)} ${targetText}  ${meetsTarget(scores, sep) ? "PASS" : "MISS"}`,
  ].join("\n");
}
