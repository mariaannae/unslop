import type { Guardrail, PassageSource, Referee, Scorer } from "./types";

/**
 * Maps configuration ids to implementations (spec §8).
 *
 * Every entry is a factory so implementations can receive parameters from the
 * config (guardrails) or dependencies such as a task client (later scorers)
 * without the registry knowing about either. Unknown ids throw immediately;
 * there is deliberately no fallback.
 */

export type GuardrailFactory = (params: unknown) => Guardrail;

export type RegistryEntries = {
  scorers: Record<string, () => Scorer>;
  guardrails: Record<string, GuardrailFactory>;
  referees: Record<string, () => Referee>;
  passageSources: Record<string, () => PassageSource>;
};

export interface Registry {
  getScorer(id: string): Scorer;
  getGuardrails(ids: readonly string[], params?: Readonly<Record<string, unknown>>): Guardrail[];
  getReferee(id: string): Referee;
  getPassageSource(id: string): PassageSource;
}

export class UnknownIdError extends Error {
  constructor(kind: string, id: string, known: string[]) {
    super(`Unknown ${kind} "${id}". Known ${kind}s: ${known.join(", ") || "(none)"}`);
    this.name = "UnknownIdError";
  }
}

function lookup<T>(kind: string, table: Record<string, T>, id: string): T {
  const entry = Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;
  if (entry === undefined) throw new UnknownIdError(kind, id, Object.keys(table));
  return entry;
}

export function createRegistry(entries: RegistryEntries): Registry {
  return {
    getScorer: (id) => lookup("scorer", entries.scorers, id)(),
    getGuardrails: (ids, params = {}) =>
      ids.map((id) => lookup("guardrail", entries.guardrails, id)(params[id])),
    getReferee: (id) => lookup("referee", entries.referees, id)(),
    getPassageSource: (id) => lookup("passage source", entries.passageSources, id)(),
  };
}
