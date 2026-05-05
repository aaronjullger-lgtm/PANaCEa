---
name: "panacea-verify"
description: "Use this skill when verifying PANaCEa changes, adding tests, fixing tests, choosing validation before shipping, or summarizing check results. It maps change types to the current package scripts, targeted Vitest files, typecheck configs, Playwright smoke tests, and repo audits."
---

# PANaCEa Verify

Start narrow, then widen based on blast radius. Prefer real repo scripts over ad hoc transpile checks.

## Default Ladder

1. Run the most relevant targeted test file:
   - `npx vitest run <path>`
   - `npx vitest run --runInBand <path>` if a file is stateful or resource-heavy
2. Run `npm run typecheck` for TypeScript contract changes.
3. Run `npm test` for shared service, API contract, or cross-cutting changes.
4. Run `npm run build` for frontend, routing, bundle, env injection, or Edge import-risk changes.
5. Run Playwright only for real user flows, auth/routing, PWA/offline, or browser layout behavior.

If typecheck memory fails, rerun with:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```

## Useful Script Map

- Critical learning stack: `npm run test:critical`
- Production typecheck: `npm run typecheck`
- CI-style typecheck: `npm run typecheck:ci`
- Full unit suite: `npm test`
- Production build: `npm run build`
- Health smoke: `npm run verify:health`
- E2E smoke/modes: `npm run test:smoke`, `npm run test:e2e`
- Wrangler E2E parity: `npm run test:e2e:wrangler`
- Audits: `npm run audit:prisma`, `npm run audit:zod`, `npm run audit:loading`, `npm run audit:services`, `npm run audit:design-system`

## By Change Type

- FSRS/session submission: targeted FSRS/drillReview/API tests, then `npm run test:critical`.
- Edge endpoint: endpoint test, `_shared` middleware test if wrappers changed, then `npm run typecheck`.
- View routing/lazy imports: `tests/routeRegistry.test.ts`, `npm run typecheck`, `npm run build`.
- Dashboard metrics: service math tests plus the UI/component test if transform or state changed.
- Offline/sync: `tests/syncManager.test.ts`, `tests/syncResponseShape.test.ts`, idempotency tests, then a browser/reload check when feasible.
- Clinical content rendering: targeted tests plus manual safety review for red flags, contraindications, emergency management, and hidden/overflowed content.

## Vitest Habits

- Import Vitest symbols explicitly: `import { describe, expect, it, vi } from 'vitest';`
- Prefer pure helpers for algorithm math, then one integration test at the writer/endpoint boundary.
- Make rolling-window fixtures interleaved instead of front-loading all correct or incorrect outcomes.
- Mock Prisma at the boundary; do not turn unit tests into database integration tests unless the repo already has that pattern for the file.

## Reporting

Report command, pass/fail count, and the first useful failure. If a broad command fails because of unrelated dirty-worktree errors, say that and include the targeted checks that did pass.
