# AGENTS.md

StudyPANaCEa (PANaCEa) — PANCE/PANRE prep. React + Vite + TypeScript, Clerk auth, Prisma/Postgres (Supabase), Cloudflare Pages Functions (`functions/api/`).

Local clone: `GitHub/StudyPANaCEa`. Remote: `github.com/aaronjullger-lgtm/PANaCEa`. Package manager: **npm** + `package-lock.json`. **Node 22** (`.nvmrc`). Path alias: `@/*` → repo root.

Longer context: `CLAUDE.md`. Session recovery / blockers: `APP_FUNCTIONALITY_PLAN.md`.

## Commands

```bash
npm ci
npm run dev                 # Vite only
npm run dev:all             # Vite + local Express (routes/ is dev-only)
npm run dev:wrangler        # production-like Pages + Functions

npm run typecheck           # production tsconfig
npm run typecheck:ci        # CI gate (critical paths only — not full tree)
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck   # if OOM

npm run lint
npm test
npx vitest run <path>       # single file / focused
npm run test:critical       # FSRS + learning-stack gate

npm run build               # inject-wrangler-env + vite production
npm run build:check-size
```

CI order (see `.github/workflows/ci.yml`): `prisma validate` → `prisma generate` → `typecheck:ci` → `lint` → `build` → `build:check-size` → `test:critical` → `test`.

Do not invent scripts. Prefer `panacea-verify` skill when choosing validation.

## Architecture (easy to get wrong)

- **Production API** = `functions/api/**` only. `routes/` is local Express and is **never** deployed.
- Edge handlers: use `context.env.*`, not `process.env`. Auth via `authenticatedEndpoint` (`functions/api/_shared/auth.ts`).
- Prisma Edge singleton: `functions/api/_shared/prisma-edge.ts`. Always `await safePrismaDisconnect(prisma)` in `finally` for handler-created clients.
- **No Prisma / `@prisma/client` in frontend** (Vite stubs it). Server-only.
- Main study submit: `QuizView` → sync queue → `POST /api/questions/attempt`.
- Drill submit: drill UI → `useDrillFSRS` → `POST /api/drills/submit-review` → `lib/services/drillReviewService.ts`.
- SRS review writes are owned by `drillReviewService`; legacy `/api/srs/*` are compatibility adapters.

## FSRS / learning (non-negotiable)

- Fully **implicit** ratings from behavior — no student Hard/Easy self-rate UI.
- Binary only: **Again / Good**. Do not reintroduce Hard/Easy.
- Only real sessions update FSRS (`review_type: 'real'`; MAIN/DRILL). Cram / rapid_recall excluded.
- Key files: `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `lib/confidence/**`.
- Confidence pipeline source of truth = `// Step` / `// Wave` comments in `drillReviewService.ts` (code wins over docs).

## Ask first / never

**Ask first:** Prisma migrations / production data changes, new production deps, deploy (`deploy:local` / wrangler), auth middleware or RLS, FSRS algorithm parameters, deleting hot-path services/endpoints.

**Never:** commit secrets/`.env`; log secrets; Prisma in browser code; skip `safePrismaDisconnect`; auth/RLS bypasses “to make tests pass”; medical diagnosis claims in AI tutor/OSCE/content output.

## 1Password (secrets)

The `1password` MCP server is installed (`/usr/local/bin/1password-mcp`, bridge to the desktop app). It manages **1Password Environments** — secrets never return to the agent; they're injected into authorized processes at runtime, with a desktop-app approval prompt on each access.

- **Always use the 1Password MCP** for create/read/manage of secrets — do not paste or hardcode credentials, and do not fall back to inventing values if a secret is missing; ask instead.
- **Project Environment:** use the Environment named **`PANaCEa`** (id `yyhys7vw4jpovijz7oxjiwuxqe`, account `LSYKNVM7BJAENHJE2DYZHVY23Q`) for this repo's secrets (DB URLs, Clerk/Gemini/Supabase keys, Cloudflare tokens, `OPENROUTER_API_KEY`, etc.). It already exists and is populated — do not recreate it.
- **Variable discovery only:** listing variable *names* is fine; never request raw secret values. Reference secrets by name and let 1Password inject them.
- **Runtime injection:** secrets are mounted as a local FIFO at `.env.1password` (1Password injects on read; no plaintext on disk). Launch opencode via `opencode-1p` (wrapper at `~/.local/bin/opencode-1p`) so MCP servers and the scout agent receive their keys (`OPENROUTER_API_KEY`, `FIRECRAWL_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CONTEXT7_API_KEY`, `COMPOSIO_API_KEY`). If a key is missing from the Environment, add it there — do not hardcode.
- If the desktop app prompts, that's expected — approval is per-access.

## Skills

Repo skills: `.agents/skills/`. Overview: `docs/skills-overview.md`.

- Unclear ownership → `panacea-navigator`
- Verification / which tests → `panacea-verify`
- FSRS / scheduling / telemetry → `panacea-fsrs-guardrails`
- Session/QuizView/drill submit → `panacea-session-pipeline`
- Edge endpoints → `panacea-edge-endpoints`
- Schema/migrations/data integrity → `panacea-prisma-data-integrity` (Supabase skill secondary only)

One primary skill; add secondary only when it constrains the work. After skill add/rename/remove: update `docs/skills-overview.md` / `docs/skills-usage.md`.

## Working notes

- Preserve unrelated dirty-worktree changes.
- Prefer focused diffs; park broad refactors (e.g. QuizView) unless requested.
- Design system / UI direction lives in `CLAUDE.md` and product docs — do not expand this file with style essays.
