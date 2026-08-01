# Contributing to PANaCEa

Thanks for contributing! PANaCEa is an adaptive PANCE/PANRE prep platform for
PA students. This guide keeps contributions consistent with the codebase.

> Maintainers: full architecture rules and decision authority live in
> `CLAUDE.md` / `AGENTS.md`. Skill routing: `docs/skills-usage.md`.

## Development Setup

```bash
# Node 22 required (.nvmrc)
npm ci

# Local env — copy .env.example and fill secrets (maintainers: use 1Password, Code vault)
cp .env.example .env

# Dev servers (choose one):
npm run dev          # Vite only
npm run dev:all      # Vite + local Express (routes/ is dev-only, never deployed)
npm run dev:wrangler # production-like Pages + Functions (recommended)
```

Never commit `.env` or any secret. `gitleaks` runs in pre-commit as a guard.

## Commands

```bash
npm run typecheck        # tsc --noEmit (use NODE_OPTIONS="--max-old-space-size=4096")
npm run lint
npm test                 # Vitest
npm run test:critical    # FSRS + learning-stack gate
npm run build            # production build
```

CI order (`.github/workflows/ci.yml`): prisma validate → prisma generate →
typecheck:ci → lint → build → build:check-size → test:critical → test.
Local hooks mirror this: pre-commit = design-token audit + critical FSRS tests
+ gitleaks; pre-push = the full CI gate set. Install with
`bash scripts/git-hooks/install-hooks.sh`.

## Branch & Commit Conventions

- Branch names: `feat/description`, `fix/description`, `chore/description`
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- One logical change per commit; stage specific files, never `git add .`

## Architecture Rules (non-negotiable)

- **Production API** = `functions/api/**` only. `routes/` is local Express and
  is never deployed.
- Edge handlers: use `context.env.*`, never `process.env`. Auth via
  `authenticatedEndpoint` (`functions/api/_shared/auth.ts`).
- Prisma is server-only — never import `@prisma/client` in frontend code
  (Vite stubs it). Always `await safePrismaDisconnect(prisma)` in `finally`
  for handler-created clients.
- **FSRS ratings are implicit and binary** — Again/Good only, derived from
  behavioral telemetry. Never introduce self-rated difficulty buttons or any
  wider rating scale; the FSRS pipeline and `drillReviewService` own all
  scheduling writes.
- No auth/RLS bypasses "to make tests pass".
- No medical diagnosis claims in AI tutor/OSCE/content output.

## Code Style

- TypeScript strict; no `as any` / `@ts-ignore`.
- File naming: PascalCase components (`DrillShell.tsx`), camelCase services
  (`drillReviewService.ts`), kebab-case API routes (`submit-review.ts`).
- Import order: React → third-party → `@/lib` → `@/hooks` → `@/components` →
  relative.
- API errors: structured `{ error: string }` responses; Sentry capture for
  unexpected errors.
- UI: Tailwind + semantic tokens from `tailwind.config.js` (see
  `.claude/skills/panacea-style-system`); keep components small and composable;
  loading/empty/error states where relevant; keyboard accessibility.

## Tests

- Vitest (jsdom); tests live in `tests/`, also colocated with `lib/`,
  `functions/`, `components/`.
- Never assert on insertion order; use deterministic IDs in fixtures.
- FSRS math assertions must account for floating-point precision.
- New services and bug fixes should carry regression tests
  (`npx vitest run <path>` for a single file).

## Pull Requests

1. Pull latest `main`; keep the PR focused on one change.
2. Run the verification gates above locally before opening.
3. Describe the change, testing performed, and any known limitations.
4. CI must pass (it runs the same gates with a stricter `typecheck:ci` subset).

## Questions

Unclear ownership or routing? See `docs/skills-usage.md` / `panacea-navigator`,
or ask in the issue thread.
