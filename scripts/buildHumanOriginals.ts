/**
 * Builds data/human_originals.json (spec B.40): for each human text, an AI
 * assistant's rewrite of it, with the same facts and length. The harness scores a
 * human text as the edit of this original, as the game would score a player who
 * rewrote an AI passage into genuinely human prose. Scored as its own original, a
 * human text looked unedited to the Haiku judge, which was told the original was
 * AI-written, and it marked the text down for that.
 *
 * Only entries that are missing, or whose human text has changed, are written, so
 * a rerun makes no calls unless the corpus changed.
 *
 *   pnpm originals [--model gpt-4o] [--human data/human_corpus.json]
 *                  [--out data/human_originals.json] [--concurrency 8]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generationModel } from "../web/src/config";
import {
  countWords,
  createScriptProvider,
  dataDir,
  intArg,
  mapWithConcurrency,
  readArgs,
  sha256,
  type HumanOriginal,
} from "./common";
import { GENERATE_V1_MODELS, type GenerationModel } from "./generateV1";

const args = readArgs({
  model: { type: "string" },
  human: { type: "string" },
  out: { type: "string" },
  concurrency: { type: "string" },
});
const model = (args.model ?? generationModel) as GenerationModel;
const settings = GENERATE_V1_MODELS[model];
if (!settings) throw new Error(`Unknown model "${model}"; see GENERATE_V1_MODELS`);
const humanFile = path.resolve(args.human ?? path.join(dataDir, "human_corpus.json"));
const outFile = path.resolve(args.out ?? path.join(dataDir, "human_originals.json"));

const SYSTEM_PROMPT = "You are a helpful AI assistant.";

function userMessage(text: string): string {
  return `Rewrite the passage below in your own words, as you would write it yourself. Keep every fact and the meaning, and keep it to one paragraph of about the same length. Plain prose only: no headings, bullets, bold or emoji. Return only the paragraph.

PASSAGE:
${text}`;
}

const human = JSON.parse(await readFile(humanFile, "utf8")) as { id: string; text: string }[];
let existing: HumanOriginal[] = [];
try {
  existing = JSON.parse(await readFile(outFile, "utf8")) as HumanOriginal[];
} catch {
  // No file yet: write every entry.
}
const byId = new Map(existing.map((e) => [e.id, e]));
const provider = createScriptProvider(settings.provider);

let written = 0;
const originals = await mapWithConcurrency(
  human,
  intArg(args.concurrency, 8),
  async (item): Promise<HumanOriginal> => {
    const textSha256 = sha256(item.text);
    const kept = byId.get(item.id);
    if (kept?.textSha256 === textSha256) return kept;
    const response = await provider.complete({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(item.text) }],
      maxTokens: settings.maxTokens,
      ...("temperature" in settings ? { temperature: settings.temperature } : {}),
    });
    const original = response.text.trim();
    if (original.length === 0) throw new Error(`${item.id}: empty rewrite`);
    const ratio = countWords(original) / countWords(item.text);
    if (ratio < 0.7 || ratio > 1.4) {
      console.error(`${item.id}: rewrite is ${ratio.toFixed(2)}x the length of the text`);
    }
    written++;
    return { id: item.id, original, model, textSha256 };
  },
);

await writeFile(outFile, JSON.stringify(originals, null, 2) + "\n");
console.error(`wrote ${originals.length} originals to ${outFile} (${written} new, with ${model})`);
