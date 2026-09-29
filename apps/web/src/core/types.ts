/**
 * Domain model for the game core (spec §6).
 * Nothing in here may reference a provider, a task, or React.
 */

export type EvalContext = {
  puzzleId: string;
  original: string;
  current: string;
  checksUsed: number;
};

export type Tell = {
  label: string;
  quote: string;
};

export type ScoreResult = {
  /** Integer 0–10. 10 = strongly AI-like, 0 = strongly human-like, per the active scorer. */
  score: number;
  tells?: Tell[];
  /** Scorer-specific payload. Only remote guardrails and referees may read it. */
  raw?: unknown;
};

export type GuardrailResult = {
  pass: boolean;
  reason?: string;
};

export type RefereeResult = {
  approved: boolean;
  reasons: string[];
};

export type Passage = {
  id: string;
  text: string;
  topic?: string;
};

export interface Scorer {
  id: string;
  score(ctx: EvalContext): Promise<ScoreResult>;
}

export interface Guardrail {
  id: string;
  /** True when the check needs no network. Local guardrails run before the scorer. */
  local: boolean;
  check(ctx: EvalContext, score?: ScoreResult): Promise<GuardrailResult>;
}

export interface Referee {
  id: string;
  verify(ctx: EvalContext, score: ScoreResult): Promise<RefereeResult>;
}

export interface PassageSource {
  id: string;
  getRandom(excludeId?: string): Promise<Passage>;
}

export type CheckOutcome = {
  guardrails: Array<{ id: string; result: GuardrailResult }>;
  score?: ScoreResult;
  referee?: RefereeResult;
  win: boolean;
  /** True when the scorer ran, which is the only thing that spends a Check (spec §13). */
  checkConsumed: boolean;
};
