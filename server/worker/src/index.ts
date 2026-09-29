import { getCallableTask } from "@unslop/shared";
import { createAnthropicProvider } from "@unslop/shared/anthropic";
import { createKvTaskCache } from "./cache";
import { corsHeaders, parseAllowedOrigins, withCors } from "./cors";
import { intVar, type Env } from "./env";
import { HttpError, errorResponse, jsonResponse } from "./errors";
import { handleTask } from "./handlers/task";
import { createKvRateLimiter } from "./rateLimit";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(
      request.headers.get("origin"),
      parseAllowedOrigins(env.ALLOWED_ORIGINS),
    );
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
          "ANTHROPIC_API_KEY is not set (local: .dev.vars; production: wrangler secret put)",
        ),
      );
    }
    return handleTask(request, {
      getTask: getCallableTask,
      provider: createAnthropicProvider(env.ANTHROPIC_API_KEY),
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
