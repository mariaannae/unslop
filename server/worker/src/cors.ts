/**
 * CORS for the split hosting model (spec Appendix B.8): the app is served from
 * unslop.app while this Worker lives on Cloudflare. Only listed origins may
 * call the API from a browser; everything else gets no CORS headers and the
 * browser blocks the response.
 */
export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function withCors(response: Response, headers: Record<string, string>): Response {
  if (Object.keys(headers).length === 0) return response;
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
  return out;
}
