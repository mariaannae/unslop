import { vi } from "vitest";
import type {
  EvalContext,
  Guardrail,
  GuardrailResult,
  Passage,
  PassageSource,
  Referee,
  RefereeResult,
  ScoreResult,
  Scorer,
} from "../core/types";

/** Test doubles shared by the core suites. Every function is a spy so ordering can be asserted. */

export const ctx = (overrides: Partial<EvalContext> = {}): EvalContext => ({
  puzzleId: "p-test",
  original: "one two three four five six seven eight nine ten",
  current: "one two three four five six seven eight nine ten",
  checksUsed: 0,
  ...overrides,
});

export function fakeScorer(result: ScoreResult | Error = { score: 5 }) {
  const score = vi.fn(async (_ctx: EvalContext): Promise<ScoreResult> => {
    if (result instanceof Error) throw result;
    return result;
  });
  const scorer: Scorer & { score: typeof score } = { id: "fake", score };
  return scorer;
}

export function fakeGuardrail(
  id: string,
  local: boolean,
  result: GuardrailResult = { pass: true },
) {
  const check = vi.fn(async (_ctx: EvalContext, _score?: ScoreResult) => result);
  const guardrail: Guardrail & { check: typeof check } = { id, local, check };
  return guardrail;
}

export function fakeReferee(result: RefereeResult = { approved: true, reasons: [] }) {
  const verify = vi.fn(async (_ctx: EvalContext, _score: ScoreResult) => result);
  const referee: Referee & { verify: typeof verify } = { id: "fake-ref", verify };
  return referee;
}

export const passages: Passage[] = [
  { id: "a", text: "alpha alpha alpha alpha" },
  { id: "b", text: "bravo bravo bravo bravo" },
  { id: "c", text: "charlie charlie charlie charlie" },
];

/** Cycles through the bank in order, honouring excludeId, so tests are deterministic. */
export function sequentialSource(bank: Passage[] = passages) {
  let index = 0;
  const getRandom = vi.fn(async (excludeId?: string) => {
    for (let tries = 0; tries < bank.length; tries++) {
      const candidate = bank[index++ % bank.length]!;
      if (candidate.id !== excludeId) return candidate;
    }
    return bank[0]!;
  });
  const source: PassageSource & { getRandom: typeof getRandom } = { id: "seq", getRandom };
  return source;
}
