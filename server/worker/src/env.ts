export interface Env {
  /** Secret. Local: `.dev.vars`. Production: `wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  CACHE_TTL_SECONDS?: string;
  /** Comma-separated browser origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  TASK_CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
}

export function intVar(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
