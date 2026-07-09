# Cursor Automation Audit

> Snapshot of the repository's stack and the Cursor AI-automation setup added under `.cursor/`.
> Generated as part of the "Cursor automation system" setup. Update when the stack or the automation config changes.

## Repository summary

| Area | Detail |
|------|--------|
| Product | **PANaCEa / StudyPanacea** — AI-powered PANCE/PANRE exam-prep platform for PA students (spaced repetition, clinical drills, OSCE, analytics). |
| Language | TypeScript (strict) + React 19 |
| Framework | React 19 SPA built with **Vite 6** and **React Router 7** (not Next.js) |
| Package manager | **npm** (`package-lock.json`; Node `>=22`, pinned in `.node-version` / `.nvmrc`) |
| UI | TailwindCSS 3.4, Radix UI primitives, Framer Motion / `motion`, Lucide icons, Recharts / Nivo, `three` |
| State / data | Zustand 5, TanStack Query 5, Zod 4 |
| Backend | **Cloudflare Pages Functions** (Edge) under `functions/api/` (production). A legacy Express `server.ts` exists for local dev only. |
| Database | **PostgreSQL (Supabase)** via **Prisma 7**. Edge functions use Prisma Accelerate (`prisma://`); CLI/scripts use a direct `postgres://` URL. |
| Auth | **Clerk** (`@clerk/clerk-react` + `@clerk/backend`) |
| AI | Google Gemini (`@google/genai`), plus AI SDK / LangChain |
| Tests | **Vitest 4** (unit/integration, `jsdom`) + **Playwright** (E2E) |
| Deployment | Cloudflare Pages + Functions (CI in `.github/workflows/`) |

## Key commands (from `package.json`)

| Purpose | Command |
|---------|---------|
| Install | `npm install` (runs `postinstall` → `prisma generate`) |
| Frontend dev | `npm run dev` (Vite, port 3000) |
| Full local dev | `npm run dev:all` (Express + Vite) — see caveat below |
| Prod-parity dev | `npm run dev:wrangler` (build + `wrangler pages dev`, port 8788) — see caveat below |
| Typecheck | `npm run typecheck` (`tsc --noEmit -p tsconfig.production.json`) / `npm run typecheck:ci` |
| Lint | `npm run lint` (`eslint . --max-warnings 2000`) / `npm run lint:fix` |
| Format | `npm run format:check` / `npm run format` (Prettier) |
| Unit tests | `npm test` (`vitest run`) / `npm run test:critical` |
| E2E | `npm run test:e2e` (Playwright; needs `npx playwright install`) |
| Build | `npm run build` (`vite build --mode production`) |
| Prisma | `npm run db:generate`, `db:studio`, `db:migrate:dev` |

## Existing Cursor / agent configuration (preserved, not overwritten)

- `.cursor/rules/` already contains: `autonomous-behavior.mdc`, `project-conventions.mdc`, `project-roles.mdc`, **`ui-design-system.mdc`** (comprehensive "Stormy Slate" design system), and `panacea-rules.md`. These are `alwaysApply: true` and were left untouched.
- `.cursor/commands/` contains `audit-*.md` slash commands.
- `.cursorrules` (deprecated format) exists and is preserved as a compatibility file. New guidance lives in `.cursor/rules/*.mdc`.
- `.agents/skills/` (~40 skills) and `.claude/skills/` already exist. The new skills added here live in `.cursor/skills/` and are complementary (browser/QA/verification/onboarding), not duplicates of the domain skills.
- `AGENTS.md`, `CLAUDE.md`, and the local dev runbook markdown at the repo root document product/domain conventions and are the source of truth referenced by the new rules.

> Because `ui-design-system.mdc` already exists and is authoritative, this setup **did not** create a second one. The new `accessibility.mdc` and skills reference it.

## What this setup adds

- **Rules** (`.cursor/rules/`): `project-context`, `architecture-boundaries`, `typescript-quality`, `react-quality`, `supabase-security`, `accessibility`, `testing-and-verification`, `security-review`, `agent-operating-procedure`.
- **Skills** (`.cursor/skills/`): 15 browser/QA/verification/onboarding skills (see `.cursor/README.md`).
- **Hooks** (`.cursor/hooks.json` + `.cursor/hooks/`): a `beforeShellExecution` safety guard and a non-destructive `afterFileEdit` Prettier check.
- **MCP templates** (`.cursor/mcp.example.json`) + `docs/cursor-mcp-cloud-setup.md`.
- **Automation prompts** (`docs/cursor-cloud-automations.md`) and a **safety checklist** (`docs/agent-safety-checklist.md`).

## Known repo caveats relevant to automations

- **`npm run dev:all` / `dev:server` are broken on `main`**: `server.ts` imports `./routes`, which does not exist (moved to `_trash/`). Use `npm run dev` for the frontend.
- **`npm run dev:wrangler` is broken on `main`**: `functions/api/_shared/semantic-cache.ts` imports `@/lib/services/tokenMatchCache`, which does not exist, so the Functions bundle fails.
- **`npm run lint` currently exits non-zero** from 3 pre-existing `no-empty` errors (plus warnings under the 2000-warning gate). Pre-existing, not caused by this setup.
- **`npm run typecheck` currently exits non-zero** from 2 pre-existing errors in `lib/study/renderStructuredRationale.ts` (a tracked app file). Pre-existing, not caused by this setup (this change adds only docs/config/JS hooks, which are outside the TS `include`).

### Validation results for this change

| Command | Result |
|---------|--------|
| `npm install` | ✅ pass |
| `npm run typecheck` | ❌ 2 pre-existing errors (unrelated to this change) |
| `npm run lint` | ❌ 3 pre-existing `no-empty` errors (unrelated) |
| `npm test` | ✅ 527 files, 9849 passed (1 skipped) |
| `npm run build` | ✅ pass |
| Hook self-tests (`guard-shell.mjs`, `format-edited-file.mjs`) | ✅ deny/ask/allow + format-check behave correctly |
- Secrets are provided via environment variables / Cursor dashboard, never committed. See `docs/cursor-mcp-cloud-setup.md`.
