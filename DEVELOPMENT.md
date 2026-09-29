# Development notes

## Layout (Milestone 0 summary)

pnpm workspace, TypeScript everywhere, no build step for shared code.

| Package           | Path                 | Role                                                                                                                                       |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@unslop/web`     | `apps/web`           | Vite + React + Tailwind v4 game client. `src/core` is the engine, `src/config` selects implementations by id, `src/ui` only renders state. |
| `@unslop/shared`  | `packages/shared`    | Task definitions (prompt, model, schema, parser) and the `/api/task` wire types. Imported as source by web, worker, and scripts.           |
| `@unslop/worker`  | `server/worker`      | Cloudflare Worker: `POST /api/task`, KV cache, per-IP rate limit, Anthropic adapter. The only code that holds an API key.                  |
| `@unslop/scripts` | `scripts`            | Node scripts (harness, bank generation) arriving in Milestone 3b.                                                                          |
| data              | `data/passages.json` | Passage bank consumed by the static passage source.                                                                                        |

Hosting: GitHub Pages at unslop.app for the app, Cloudflare for the Worker (spec Appendix B.8).

Design decisions and their reasons are logged in `spec.md`, Appendix B. Add an entry there whenever you settle an open question.

## Run

```bash
pnpm install
pnpm dev:web        # http://localhost:5173, proxies /api to the worker
pnpm dev:worker     # http://localhost:8787, needs server/worker/.dev.vars
```

The game scores through the Worker by default, so run both commands. Set `scorer: "mock"` in `apps/web/src/config/game.config.ts` (and drop `meaning-fluency`) to play with no server.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Scripts

```bash
export ANTHROPIC_API_KEY=...          # never commit it
pnpm --filter @unslop/scripts corpus   # rebuild data/human_corpus.json (network only)
pnpm --filter @unslop/scripts harness  # separation report; add --strict to fail on a missed target
pnpm --filter @unslop/scripts generate --count 60   # regenerate the bank
```

Bump a task's `version` in `packages/shared/src/tasks` after changing its prompt; that invalidates both the KV cache and the scripts' disk cache.

## Deploy

`.github/workflows/deploy.yml` runs on every push to `main`: verify (lint, typecheck, test, build), then deploy the app to GitHub Pages at unslop.app and the Worker to Cloudflare. One-time setup:

1. GitHub: Settings → Pages → Source "GitHub Actions". Add repository variable `VITE_API_BASE_URL` (the Worker origin, no path; the client appends `/api/task`) and secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
2. Cloudflare: `wrangler kv namespace create TASK_CACHE` and `... RATE_LIMIT`, paste the ids into `server/worker/wrangler.toml`, then `wrangler secret put ANTHROPIC_API_KEY`. After the first deploy, add the Worker's origin to `ALLOWED_ORIGINS` only if it differs from the defaults.
3. DNS: point `unslop.app` at GitHub Pages and enable HTTPS in the Pages settings.
