import { createAnthropicProvider } from "../shared/anthropic";
import {
  createKvRateLimiter,
  createKvTaskCache,
  errorResponse,
  handleTask,
  HttpError,
  jsonResponse,
} from "./task";

export interface Env {
  /** Secret. Local: `worker/.dev.vars`. Production: `wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY?: string;
  /** Secret for the score-jev task. Local: `worker/.dev.vars`. Production: `wrangler secret put TYPESAFE_API_KEY`. */
  TYPESAFE_API_KEY?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  CACHE_TTL_SECONDS?: string;
  /** Comma-separated browser origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  TASK_CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get("origin"), env.ALLOWED_ORIGINS);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    return withCors(await route(request, env), cors);
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/task") {
    if (!env.ANTHROPIC_API_KEY) {
      return errorResponse(
        new HttpError(
          "server_misconfigured",
          "ANTHROPIC_API_KEY is not set (local: worker/.dev.vars; production: wrangler secret put)",
        ),
      );
    }
    return handleTask(request, {
      provider: createAnthropicProvider(env.ANTHROPIC_API_KEY),
      typesafeApiKey: env.TYPESAFE_API_KEY,
      cache: createKvTaskCache(env.TASK_CACHE, intVar(env.CACHE_TTL_SECONDS, 30 * 24 * 3600)),
      rateLimiter: createKvRateLimiter(env.RATE_LIMIT, {
        limit: intVar(env.RATE_LIMIT_PER_MINUTE, 30),
        windowSeconds: 60,
      }),
      log: (message, detail) => console.warn(message, detail ?? ""),
    });
  }

  if (url.pathname === "/api/health") {
    return jsonResponse({ ok: true });
  }

  return jsonResponse(
    { ok: false, error: { code: "not_found", message: `no route for ${url.pathname}` } },
    404,
  );
}

function intVar(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * CORS for the split hosting model (spec Appendix B.8): the app is served from
 * unslop.app while this Worker lives on Cloudflare. Only origins listed in
 * ALLOWED_ORIGINS may call the API from a browser; everything else gets no CORS
 * headers and the browser blocks the response.
 */
function corsHeaders(
  origin: string | null,
  allowedOrigins: string | undefined,
): Record<string, string> {
  const allowed = (allowedOrigins ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function withCors(response: Response, headers: Record<string, string>): Response {
  if (Object.keys(headers).length === 0) return response;
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
  return out;
}
