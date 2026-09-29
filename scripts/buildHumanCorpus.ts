/**
 * Builds data/human_corpus.json (SPEC Appendix A.4): ~100 human-written paragraphs
 * of 90–130 words from public-domain Project Gutenberg books and CC BY-SA
 * Wikipedia articles, each with a `source` attribution. Deterministic: the same
 * inputs always select the same paragraphs. Raw downloads are cached under
 * scripts/.cache/raw so reruns are offline.
 *
 *   pnpm --filter @unslop/scripts corpus [--per-book 5] [--out data/human_corpus.json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { intArg, readArgs } from "./lib/args";
import { cacheDir, dataDir } from "./lib/paths";

const USER_AGENT = "unslop-corpus-builder/0.1 (https://unslop.app)";
const MIN_WORDS = 90;
const MAX_WORDS = 130;

type Book = { id: number; title: string; author: string; register: string };

/** Registers roughly mirror the AI bank: narrative, informal, explanatory, persuasive. */
const BOOKS: Book[] = [
  { id: 1342, title: "Pride and Prejudice", author: "Jane Austen", register: "narrative" },
  { id: 84, title: "Frankenstein", author: "Mary Shelley", register: "narrative" },
  { id: 120, title: "Treasure Island", author: "Robert Louis Stevenson", register: "narrative" },
  { id: 76, title: "Adventures of Huckleberry Finn", author: "Mark Twain", register: "informal" },
  {
    id: 11,
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    register: "informal",
  },
  {
    id: 1228,
    title: "On the Origin of Species",
    author: "Charles Darwin",
    register: "explanatory",
  },
  { id: 205, title: "Walden", author: "Henry David Thoreau", register: "explanatory" },
  {
    id: 20203,
    title: "Autobiography of Benjamin Franklin",
    author: "Benjamin Franklin",
    register: "explanatory",
  },
  {
    id: 23,
    title: "Narrative of the Life of Frederick Douglass",
    author: "Frederick Douglass",
    register: "persuasive",
  },
  { id: 408, title: "The Souls of Black Folk", author: "W. E. B. Du Bois", register: "persuasive" },
  { id: 147, title: "Common Sense", author: "Thomas Paine", register: "persuasive" },
  { id: 34901, title: "On Liberty", author: "John Stuart Mill", register: "persuasive" },
];

/** Everyday explanatory topics, comparable to the bank's product/recipe/travel/FAQ registers. */
const WIKIPEDIA_TITLES = [
  "Sourdough",
  "Bicycle",
  "Compost",
  "Knitting",
  "Espresso",
  "Tide pool",
  "Origami",
  "Chess clock",
  "Public library",
  "Lighthouse",
  "Beekeeping",
  "Kite",
  "Hammock",
  "Pencil",
  "Umbrella",
  "Marathon",
  "Sudoku",
  "Houseplant",
  "Bread",
  "Rain gauge",
  "Canoe",
  "Snowshoe",
  "Birdwatching",
  "Windmill",
  "Ferris wheel",
  "Jigsaw puzzle",
  "Porch",
  "Fountain pen",
  "Thermos",
  "Hiking",
  "Tea",
  "Pickling",
  "Skateboard",
  "Lantern",
  "Greenhouse",
  "Trampoline",
  "Piano",
  "Accordion",
  "Harmonica",
  "Sandcastle",
  "Wheelbarrow",
  "Playground",
  "Campfire",
  "Toaster",
  "Doormat",
];

const args = readArgs({
  "per-book": { type: "string" },
  out: { type: "string" },
});
const perBook = intArg(args["per-book"], 5);
const outFile = path.resolve(args.out ?? path.join(dataDir, "human_corpus.json"));

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function fetchCached(name: string, url: string): Promise<string> {
  const file = path.join(cacheDir, "raw", name);
  try {
    return await readFile(file, "utf8");
  } catch {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const text = await response.text();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    return text;
  }
}

function gutenbergBody(raw: string): string {
  const start = raw.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const end = raw.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
  const body = raw.slice(start >= 0 ? raw.indexOf("\n", start) : 0, end >= 0 ? end : undefined);
  return body.replace(/\r\n/g, "\n");
}

function looksLikeProse(paragraph: string): boolean {
  if (/^(chapter|book|part|section|letter|preface|contents|appendix)\b/i.test(paragraph))
    return false;
  if (/[[\]{}|<>_=*#]/.test(paragraph)) return false;
  if (/gutenberg|illustration|footnote|copyright/i.test(paragraph)) return false;
  const letters = paragraph.replace(/[^A-Za-z]/g, "").length;
  const upper = paragraph.replace(/[^A-Z]/g, "").length;
  if (letters === 0 || upper / letters > 0.2) return false;
  if (!/[.!?]["”']?$/.test(paragraph)) return false;
  return true;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

function inRange(paragraph: string): boolean {
  const n = countWords(paragraph);
  return n >= MIN_WORDS && n <= MAX_WORDS;
}

/** Picks `count` items spread evenly through the list. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step + step / 2)]!);
}

type Entry = { id: string; text: string; source: string; register: string };

async function fromGutenberg(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const book of BOOKS) {
    const raw = await fetchCached(
      `gutenberg-${book.id}.txt`,
      `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`,
    );
    const candidates = paragraphs(gutenbergBody(raw)).filter(inRange).filter(looksLikeProse);
    const chosen = spread(candidates, perBook);
    console.error(`${book.title}: ${candidates.length} candidates, kept ${chosen.length}`);
    for (const text of chosen) {
      out.push({
        id: "",
        text,
        source: `Project Gutenberg #${book.id}: ${book.title}, ${book.author} (public domain)`,
        register: book.register,
      });
    }
  }
  return out;
}

async function fromWikipedia(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const title of WIKIPEDIA_TITLES) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=" +
      encodeURIComponent(title);
    const raw = await fetchCached(`wikipedia-${title.replace(/\W+/g, "_")}.json`, url);
    const pages = (JSON.parse(raw) as { query: { pages: Record<string, { extract?: string }> } })
      .query.pages;
    const extract = Object.values(pages)[0]?.extract ?? "";
    const candidate = paragraphs(extract)
      .filter((p) => !p.startsWith("=="))
      .filter(inRange)
      .filter(looksLikeProse)[0];
    if (!candidate) {
      console.error(`Wikipedia "${title}": no paragraph in range, skipped`);
      continue;
    }
    out.push({
      id: "",
      text: candidate,
      source: `Wikipedia, "${title}", CC BY-SA 4.0, https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      register: "explanatory",
    });
  }
  return out;
}

const entries = [...(await fromGutenberg()), ...(await fromWikipedia())].map((e, i) => ({
  ...e,
  id: `h${String(i + 1).padStart(4, "0")}`,
}));

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(entries, null, 2) + "\n");
const byRegister = entries.reduce<Record<string, number>>((acc, e) => {
  acc[e.register] = (acc[e.register] ?? 0) + 1;
  return acc;
}, {});
console.error(`wrote ${entries.length} paragraphs to ${outFile}`, byRegister);
