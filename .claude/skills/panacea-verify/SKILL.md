---
name: panacea-verify
description: "Choose and run the right PANaCEa verification checks after code changes: targeted Vitest, typecheck, build, Playwright, audits, and clinical safety review."
---

# PANaCEa Verify

Use real repo scripts. The old per-file `transpileModule` check is not enough for this codebase.

## Ladder

1. Targeted test first: `npx vitest run <path>`
2. Contract/type changes: `npm run typecheck`
3. Shared service/API changes: `npm test`
4. Routing/frontend/build-risk changes: `npm run build`
5. User flows/auth/PWA/browser behavior: Playwright

If typecheck memory fails:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```

## Script Map

- Critical learning stack: `npm run test:critical`
- Typecheck: `npm run typecheck`, `npm run typecheck:ci`
- Unit suite: `npm test`
- Build: `npm run build`
- API health smoke: `npm run verify:health`
- E2E: `npm run test:smoke`, `npm run test:e2e`, `npm run test:e2e:wrangler`
- Audits: `npm run audit:prisma`, `npm run audit:zod`, `npm run audit:loading`, `npm run audit:services`, `npm run audit:design-system`

## By Change

- FSRS/session: FSRS/drillReview/API tests, then `npm run test:critical`.
- Edge endpoint: endpoint-local tests plus `_shared` tests if middleware changed.
- Route/lazy view: `tests/routeRegistry.test.ts`, `npm run typecheck`, `npm run build`.
- Dashboard metric: service math tests plus UI test if transforms changed.
- Offline/sync: sync/idempotency tests plus browser reload/offline check when feasible.
- Clinical rendering: test plus safety review for red flags, contraindications, emergency management, and hidden/overflowed text.

Report command, result, and first useful failure. Do not claim broad success if only targeted checks ran.
