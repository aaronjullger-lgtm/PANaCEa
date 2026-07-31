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

The `1password` MCP server wraps the `op` CLI (`scripts/mcp-1password.js` in the repo root). It uses your **desktop app auth** — no service account needed. Secrets are read from the **`Code` vault** on demand via `op://` references.

- **Always use the 1Password MCP** for reading secrets — do not paste or hardcode credentials, and do not fall back to inventing values if a secret is missing; ask instead.
- **Vault:** use the **`Code` vault** (id `2rtellcmb44g5uku2ozj3hlcei`) for this repo's secrets (DB URLs, Clerk/Gemini/Supabase keys, Cloudflare tokens, `OPENROUTER_API_KEY`, etc.).
- **Tools available:** `vault_list`, `item_lookup`, `item_list`, `item_get`, `read_secret` (for `op://` refs), `op_run` (run commands with resolved secrets).
- **Prefer `op_run` over `read_secret`** — use `op://Code/Item Name/field` in env vars to pass secrets to commands without revealing them to the model.
- **Desktop app auth:** the `op` CLI authenticates via your desktop app. If prompted, approve the connection in 1Password.
- **Variable discovery only:** listing item names is fine; never request raw secret values unless explicitly needed. Use `op://` references instead.

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

Use React Three Fiber for:

- hero anatomy/scanner scene
- meaningful 3D medical objects
- subtle organ-system visualization

Always:

- respect prefers-reduced-motion
- avoid animation during hydration that causes layout shift
- lazy-load heavy 3D sections
- keep mobile fallbacks lighter

## Implementation rules

Before editing:

- inspect existing files
- identify routing conventions
- identify component conventions
- identify package manager
- preserve working behavior

When editing:

- make focused changes
- avoid broad rewrites unless requested
- keep components small and composable
- use TypeScript types
- avoid `any` unless justified
- avoid hard-coded magic data inside presentation components
- place mock data in a dedicated file
- add loading, empty, and error states where relevant
- maintain keyboard accessibility and visible focus states

Verification:

- run lint if available
- run typecheck if available
- run build if available
- if a command fails, explain the failure and whether it is related to the change

Completion summary:

- list changed files
- explain major decisions
- list verification commands run
- list known limitations

## Recovery workflow

This repository has a working recovery plan in `APP_FUNCTIONALITY_PLAN.md`.

When continuing functional recovery work:

- read `APP_FUNCTIONALITY_PLAN.md` before choosing the next task
- update it after setup, build, runtime, auth, API, test, or workflow changes
- keep known blockers, verification history, current task, and next best step current
- do not restart broad inspection when the plan already contains current evidence
- preserve unrelated dirty-worktree changes

## Codex skill routing

Repo-local skills live in `.agents/skills` and should be considered available to Codex whenever working inside this repository.

Use `skill-routing-and-usage` when a request could match multiple skills, asks to improve skill usage, or changes `.agents/skills`.

Default routing:

- Use `panacea-navigator` first for unclear StudyPANaCEa repo work.
- Prefer narrow `panacea-*` skills over generic reusable skills for product internals.
- Use `panacea-verify` to choose validation commands for code changes.
- Use `aidesigner-frontend` for AIDesigner-driven frontend generation or redesign.
- Use `supabase` as a secondary skill for Supabase-specific behavior, but use `panacea-prisma-data-integrity` as primary for PANaCEa Prisma/schema/data-integrity work.
- Use `security-and-privacy-audit` for auth, authorization, secrets, privacy, payment, or sensitive logging risk.
- Use `release-readiness` only when the task is preparing for production release or launch.

Do not load every plausible skill. Pick one primary skill, then add only the secondary skills that materially constrain the work.

## Prompt engineering defaults

When prompts are broad, restate the working route before editing:

- primary skill
- secondary skills, if any
- affected subsystem
- verification plan

Favor precise, outcome-oriented task framing:

- Good: "Use `panacea-session-pipeline` to trace duplicate drill submissions and add a regression test."
- Good: "Use `panacea-fsrs-guardrails` and `panacea-verify` for a safe FSRS scheduler change."
- Good: "Use the `langfuse` skill when adding to or auditing Langfuse tracing in `lib/ai/aiGateway.ts` or `lib/observability/langfuse.ts`."
- Good: "Use `ecosystem-primer` first when starting any LangChain/LangGraph/Deep Agents work in `~/GitHub/langchain-agent/`, then load the layer-specific skill."
- Weak: "Fix the study mode."

For safety-critical work, preserve these constraints:

- no Hard/Easy FSRS ratings
- no production migrations without approval
- no secrets in logs or docs
- no Prisma imports in frontend code
- no auth, RLS, or middleware bypasses to make tests pass
- no medical diagnosis claims in AI tutor, OSCE, or content-generation output

Skill library maintenance:

- Update `docs/skills-overview.md` when skills are added, renamed, removed, or repurposed.
- Update `docs/skills-usage.md` when routing rules change.
- Run `.agents/skills/skill-routing-and-usage/scripts/audit-skills.sh /Users/aaronullger/GitHub/StudyPANaCEa` after skill edits.

- Preserve unrelated dirty-worktree changes.
- Prefer focused diffs; park broad refactors (e.g. QuizView) unless requested.
- Design system / UI direction lives in `CLAUDE.md` and product docs — do not expand this file with style essays.
