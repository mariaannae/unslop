# Development notes

## Layout

One pnpm package, TypeScript everywhere, no build step for shared code. Tests sit next to the file they test.

| Folder     | Role                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/`     | Vite + React + Tailwind v4 game client. `src/config.ts` picks the scorer and guardrails (and the model `pnpm generate` uses), `src/game.ts` is the engine (check sequence and game state), `src/scorers.ts` holds the scorers and the one function that calls the Worker, `src/App.tsx` only renders state.                                                         |
| `worker/`  | Cloudflare Worker: `POST /api/task`, KV cache, per-IP rate limit, CORS. `index.ts` is the entry and router, `task.ts` the handler. The only code that holds an API key.                                                                                              |
| `shared/`  | The `score-v1` task definition (`scoreV1.ts`: prompt, model, schema, parser), the `/api/task` wire types (`api.ts`), the task runner and cache key (`runTask.ts`), and the Anthropic adapter (`anthropic.ts`). The web app imports only types from here.        |
| `scripts/` | Node scripts run with tsx: eval harness, bank generator (with its `generate-v1` task in `generateV1.ts`), human-corpus builder. They call the provider directly with `ANTHROPIC_API_KEY` from the environment and never go through the Worker. Helpers are in `common.ts`.                                           |
| `data/`    | `passages.json` (the bank the game draws from) and `human_corpus.json` (the harness's human baseline).                                                                                                                                                              |

Hosting: GitHub Pages at unslop.app for the app, Cloudflare for the Worker (spec Appendix B.8).

Design decisions and their reasons are logged in `spec.md`, Appendix B. Add an entry there whenever you settle an open question.

## Run

```bash
pnpm install
pnpm dev:web        # http://localhost:5173, proxies /api to the worker
pnpm dev:worker     # http://localhost:8787, needs worker/.dev.vars
```

The game scores through the Worker by default, so run both commands. To play with no server, set `scorer: scorers.mock` in `web/src/config.ts`. The `meaning-fluency` guardrail can stay: it passes when the scorer reports no judge verdict.

## Verify

```bash
pnpm lint
pnpm typecheck    # shared/ + worker/, then web/, then scripts/
pnpm test         # every folder in one Vitest run
pnpm build        # web app into web/dist
```

## Scripts

`pnpm generate` and `pnpm harness` read `ANTHROPIC_API_KEY` from `worker/.dev.vars`, the same git-ignored file the local Worker uses, so there is nothing to export. A key exported in your shell takes precedence.

```bash
pnpm corpus                                   # rebuild data/human_corpus.json (network only, no model calls)
pnpm generate --out data/passages.new.json    # generate a bank (default 60 passages) into a new file
pnpm harness --bank data/passages.new.json    # separation report for it; add --strict to fail on a miss
mv data/passages.new.json data/passages.json  # when both targets PASS, the game uses it
```

`generate` writes with `generationModel` from `web/src/config.ts` (Haiku 4.5 by default; the options are listed there). Every model gets the same prompt. Each bank entry records its model in `generatedWith.model`.

`generate` writes its output file even when it keeps fewer passages than requested, so write to a new file and replace `data/passages.json` only after the harness passes. The harness makes no model calls for passages the generator already scored.

Model results are cached under `scripts/.cache/results`, except generations, which are cached per model under `scripts/.cache/generations/<model>` so switching models never returns another model's passages. Bump a task's `version` in `shared/scoreV1.ts` or `scripts/generateV1.ts` after changing its prompt; that invalidates both the Worker's KV cache and the scripts' disk cache.

## Deploy

`.github/workflows/deploy.yml` runs on every push to `main`: verify (lint, typecheck, test, build, and a Worker bundle dry-run), then deploy the app to GitHub Pages at unslop.app and the Worker to Cloudflare. One-time setup:

1. GitHub: Settings → Pages → Source "GitHub Actions". Add repository variable `VITE_API_BASE_URL` (the Worker origin, no path; the client appends `/api/task`) and secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
2. Cloudflare: `pnpm exec wrangler kv namespace create TASK_CACHE` and `... RATE_LIMIT`, paste the ids into `worker/wrangler.toml`, then `pnpm exec wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml`. After the first deploy, add the Worker's origin to `ALLOWED_ORIGINS` only if it differs from the defaults.
3. DNS: point `unslop.app` at GitHub Pages and enable HTTPS in the Pages settings.

To deploy the Worker by hand: `pnpm deploy:worker`.

Note: `.gitignore` ignores `*.md`, so a new Markdown file is not tracked until you `git add -f` it. Existing docs are tracked normally.
