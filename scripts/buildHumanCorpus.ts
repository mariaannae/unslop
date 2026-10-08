/**
 * Builds data/human_corpus.json (SPEC Appendix A.4): human-written paragraphs of
 * 90–130 words from public-domain Project Gutenberg books and, for modern prose,
 * CC BY-SA Wikipedia articles, Stack Exchange answers and Wikivoyage pages as they
 * stood before CUTOFF (spec B.24, B.39). Each has a `source` attribution.
 * Deterministic: the same inputs always select the same paragraphs. Raw downloads
 * are cached under scripts/.cache/raw so reruns are offline.
 *
 *   pnpm corpus [--per-book 5] [--per-site 8] [--out data/human_corpus.json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheDir, countWords, dataDir, intArg, readArgs } from "./common";

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

/**
 * Paragraphs taken from Wikipedia: the 35 the corpus has had since Milestone 3b.
 * Entries after them are numbered from this, so changing it renumbers them.
 */
const WIKIPEDIA_COUNT = 35;

/**
 * ChatGPT's public release. Modern sources are taken only from text written and
 * last edited before this, so no AI-written prose gets into the human corpus.
 */
const CUTOFF = "2022-11-30T00:00:00Z";

/** Stack Exchange sites close to the bank's everyday topics. */
const STACK_EXCHANGE_SITES = [
  "cooking",
  "travel",
  "diy",
  "outdoors",
  "bicycles",
  "gardening",
  "pets",
  "parenting",
];

/** Destinations and travel topics, the human counterpart of the bank's travel descriptions. */
const WIKIVOYAGE_TITLES = [
  "Lisbon",
  "Kyoto",
  "Edinburgh",
  "Prague",
  "Vienna",
  "Copenhagen",
  "Amsterdam",
  "Seville",
  "Bruges",
  "Hanoi",
  "Oaxaca (city)",
  "Quebec City",
  "Savannah",
  "Santa Fe (New Mexico)",
  "Portland (Oregon)",
  "Wellington",
  "Hobart",
  "Valparaíso",
  "Cuzco",
  "Marrakech",
  "Istanbul",
  "Tallinn",
  "Ljubljana",
  "Galway",
  "York",
  "Bath",
  "Kraków",
  "Porto",
  "Lucerne",
  "Chiang Mai",
  "Hiking",
  "Camping",
  "Cycling",
  "Rail travel in Europe",
  "Packing list",
  "Travelling with children",
  "Hitchhiking",
  "Budget travel",
  "Tips for road trips",
  "Winter driving",
  "Food and drink",
  "Beaches",
  "Street food",
];

const args = readArgs({
  "per-book": { type: "string" },
  "per-site": { type: "string" },
  out: { type: "string" },
});
const perBook = intArg(args["per-book"], 5);
const perSite = intArg(args["per-site"], 8);
const outFile = path.resolve(args.out ?? path.join(dataDir, "human_corpus.json"));

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

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : +name.slice(1);
      return String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/**
 * The top-level <p> paragraphs of an HTML page as plain text. Quotes, code,
 * lists and tables are dropped, as are paragraphs with inline code or a
 * Wikivoyage listing (address and phone details).
 */
function htmlParagraphs(html: string): string[] {
  const body = html
    .replace(/<(blockquote|pre|ul|ol|table|style|sup)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  return [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1]!)
    .filter((p) => !/<code\b|class="[^"]*vcard/i.test(p))
    .map((p) =>
      decodeEntities(p.replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 0);
}

function inRange(paragraph: string): boolean {
  const n = countWords(paragraph);
  return n >= MIN_WORDS && n <= MAX_WORDS;
}

/**
 * At least two sentences. Used for the modern sources only, where a single
 * "sentence" in range is usually a list run together (a timetable, say); the
 * older sources were selected without it and keep their paragraphs.
 */
function hasSeveralSentences(paragraph: string): boolean {
  return /[.!?]["”')]*\s+["“(]*[A-Z0-9]/.test(paragraph);
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

/**
 * The first paragraph in range from each article's last revision before CUTOFF
 * (spec B.39). Until then the current article was used, and most of those
 * paragraphs had been added or rewritten since ChatGPT's release. Exactly
 * WIKIPEDIA_COUNT are kept, in title order, so the later sources keep their ids.
 */
async function fromWikipedia(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const title of WIKIPEDIA_TITLES) {
    if (out.length === WIKIPEDIA_COUNT) break;
    const rev = await revisionBefore(CUTOFF, "https://en.wikipedia.org", "wikipedia", title);
    if (!rev) {
      console.error(`Wikipedia "${title}": no revision before ${CUTOFF}, skipped`);
      continue;
    }
    const text = htmlParagraphs(rev.html)
      .filter(inRange)
      .filter(looksLikeProse)
      .filter(hasSeveralSentences)[0];
    if (!text) {
      console.error(`Wikipedia "${title}": no paragraph in range, skipped`);
      continue;
    }
    out.push({
      id: "",
      text,
      // Wikimedia text was licensed CC BY-SA 3.0 until mid-2023.
      source: `Wikipedia, "${title}" (revision of ${rev.timestamp.slice(0, 10)}), CC BY-SA 3.0, https://en.wikipedia.org/w/index.php?oldid=${rev.revid}`,
      register: "explanatory",
    });
  }
  if (out.length < WIKIPEDIA_COUNT) {
    throw new Error(
      `Wikipedia gave ${out.length} paragraphs, not ${WIKIPEDIA_COUNT}; later ids would shift`,
    );
  }
  return out;
}

/** A wiki page's last revision before `cutoff`, with its rendered HTML. */
async function revisionBefore(
  cutoff: string,
  origin: string,
  cachePrefix: string,
  title: string,
): Promise<{ revid: number; timestamp: string; html: string } | undefined> {
  const api = `${origin}/w/api.php?format=json&formatversion=2`;
  const slug = title.replace(/\W+/g, "_");
  const revRaw = await fetchCached(
    `${cachePrefix}-rev-${slug}.json`,
    `${api}&action=query&prop=revisions&rvlimit=1&rvdir=older&rvprop=ids%7Ctimestamp` +
      `&rvstart=${cutoff}&redirects=1&titles=${encodeURIComponent(title)}`,
  );
  const page = (
    JSON.parse(revRaw) as {
      query: { pages: Array<{ revisions?: Array<{ revid: number; timestamp: string }> }> };
    }
  ).query.pages[0];
  const rev = page?.revisions?.[0];
  if (!rev) return undefined;
  const parsed = await fetchCached(
    `${cachePrefix}-${slug}-${rev.revid}.json`,
    `${api}&action=parse&prop=text&disablelimitreport=1&disableeditsection=1&oldid=${rev.revid}`,
  );
  const html = (JSON.parse(parsed) as { parse: { text: string } }).parse.text;
  return { ...rev, html };
}

type StackExchangeAnswer = {
  answer_id: number;
  question_id: number;
  creation_date: number;
  last_edit_date?: number;
  content_license: string;
  owner: { display_name?: string };
  body: string;
};

/**
 * The top-voted answers on each site written and last edited before CUTOFF, one
 * paragraph per question: the answer's first prose paragraph in range.
 */
async function fromStackExchange(): Promise<Entry[]> {
  const cutoff = Date.parse(CUTOFF) / 1000;
  const out: Entry[] = [];
  for (const site of STACK_EXCHANGE_SITES) {
    const url =
      `https://api.stackexchange.com/2.3/answers?order=desc&sort=votes&site=${site}` +
      `&filter=withbody&pagesize=100&todate=${cutoff}`;
    const raw = await fetchCached(`stackexchange-${site}.json`, url);
    const answers = (JSON.parse(raw) as { items: StackExchangeAnswer[] }).items;
    const seen = new Set<number>();
    let kept = 0;
    for (const answer of answers) {
      if (kept >= perSite) break;
      if ((answer.last_edit_date ?? answer.creation_date) >= cutoff) continue;
      if (seen.has(answer.question_id)) continue;
      const text = htmlParagraphs(answer.body)
        .filter(inRange)
        .filter(looksLikeProse)
        .filter(hasSeveralSentences)[0];
      if (!text) continue;
      seen.add(answer.question_id);
      kept++;
      const author = decodeEntities(answer.owner.display_name ?? "an anonymous user");
      out.push({
        id: "",
        text,
        source: `Stack Exchange (${site}), answer by ${author}, ${answer.content_license}, https://${site}.stackexchange.com/a/${answer.answer_id}`,
        register: "informal",
      });
    }
    console.error(`Stack Exchange ${site}: ${answers.length} answers, kept ${kept}`);
  }
  return out;
}

/**
 * One paragraph per page from its last revision before CUTOFF. The middle
 * candidate rather than the first: a destination's first long paragraph is
 * usually its history, which reads like Wikipedia, not like a travel guide.
 */
async function fromWikivoyage(): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const title of WIKIVOYAGE_TITLES) {
    const rev = await revisionBefore(CUTOFF, "https://en.wikivoyage.org", "wikivoyage", title);
    if (!rev) {
      console.error(`Wikivoyage "${title}": no revision before ${CUTOFF}, skipped`);
      continue;
    }
    const candidates = htmlParagraphs(rev.html)
      .filter(inRange)
      .filter(looksLikeProse)
      .filter(hasSeveralSentences);
    const text = spread(candidates, 1)[0];
    if (!text) {
      console.error(`Wikivoyage "${title}": no paragraph in range, skipped`);
      continue;
    }
    out.push({
      id: "",
      text,
      // Wikimedia text was licensed CC BY-SA 3.0 until mid-2023.
      source: `Wikivoyage, "${title}" (revision of ${rev.timestamp.slice(0, 10)}), CC BY-SA 3.0, https://en.wikivoyage.org/w/index.php?oldid=${rev.revid}`,
      register: "informal",
    });
  }
  return out;
}

// New sources go last so the existing entries keep their ids.
const entries = [
  ...(await fromGutenberg()),
  ...(await fromWikipedia()),
  ...(await fromStackExchange()),
  ...(await fromWikivoyage()),
].map((e, i) => ({
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
