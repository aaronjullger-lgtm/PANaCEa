# PANaCEa Codex Guide

PANaCEa is a clinical education platform for PA students with a React 19 + TypeScript + Vite frontend, Cloudflare Pages Functions in production, PostgreSQL via Prisma, and a heavily customized FSRS-based learning engine.

## Working Style

- Aaron is time-constrained. Favor high-ROI fixes, concise reporting, and minimal recap.
- "Do it for me" means execute, not brainstorm.
- Audit every file you plan to change before editing.
- Keep changes small and testable when the task is large.
- Never revert unrelated user changes in the worktree.

## Ask First

- Prisma schema migrations or production-data-affecting DB changes
- New production dependencies
- Auth, RLS, or environment variable changes
- FSRS parameter or rating-logic changes
- Deploys, force-pushes, resets, or file deletions

## Architecture Rules

- Production API lives in `functions/api/`.
- `routes/` and `server.ts` are local-dev Express only, not deployed.
- For Edge handlers, use `context.env.*`, never `process.env`.
- Use shared auth and Prisma helpers from `functions/api/_shared/`.
- Call `safePrismaDisconnect(prisma)` in Edge handler `finally` blocks.
- Do not import Prisma into frontend components.

## PANaCEa Learning Rules

- Student-facing review flow is binary: `Again` / `Good` only.
- Do not add self-rated `Hard` / `Easy` UI.
- Only real `MAIN` and `DRILL` review flows should update FSRS.
- Respect implicit metrics, MVRT filters, par-time logic, and Ghost Grader behavior before changing scheduler code.

## Frontend And Routing

- Reuse existing components, hooks, and service patterns before adding new abstractions.
- Check config-driven view wiring before adding new app surfaces:
  - `config/appViews.ts`
  - `config/lazyComponents.tsx`
- Preserve existing Tailwind token usage and component conventions.

## Commands

- Install: `npm install`
- Dev: `npm run dev`, `npm run dev:all`, `npm run dev:wrangler`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm test`
- E2E: `npm run test:e2e`
- Build: `npm run build`

If typecheck runs out of memory, rerun with:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

## Verification Default

- For narrow changes, run the smallest relevant test first.
- For cross-cutting changes, prefer:
  1. `npm run typecheck`
  2. `npm test`
  3. `npm run build`
- Run Playwright when the change affects routing, auth, sessions, drills, or user-visible flows.

## Read First For Deep Context

- `README.md`
- `CLAUDE.md`
- `prisma/schema.prisma`
- `vitest.config.ts`
