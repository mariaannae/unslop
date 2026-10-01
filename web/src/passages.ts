import bank from "../../data/passages.json";
import type { DrawPassage, Passage } from "./game";

/**
 * Passage source backed by the bundled JSON bank (spec §11).
 *
 * The returned function is uniform over the bank, excluding `excludeId` when
 * more than one passage exists. This is the only place in the game that uses
 * randomness; `random` is injectable so tests stay deterministic.
 */
export function createStaticBank(
  passages: readonly Passage[] = validateBank(bank),
  random: () => number = Math.random,
): DrawPassage {
  if (passages.length === 0) throw new Error("static-bank: passage bank is empty");
  return async (excludeId) => {
    const candidates = passages.length > 1 ? passages.filter((p) => p.id !== excludeId) : passages;
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    return candidates[index]!;
  };
}

export function validateBank(input: unknown): Passage[] {
  if (!Array.isArray(input)) throw new Error("static-bank: bank must be an array");
  const seen = new Set<string>();
  return input.map((entry, i) => {
    const { id, text, topic } = (entry ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`static-bank: passage ${i} has no id`);
    }
    if (seen.has(id)) throw new Error(`static-bank: duplicate passage id "${id}"`);
    seen.add(id);
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error(`static-bank: passage "${id}" has no text`);
    }
    return topic === undefined ? { id, text } : { id, text, topic: String(topic) };
  });
}
