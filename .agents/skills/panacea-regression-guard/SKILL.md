---
name: "panacea-regression-guard"
description: "Use to write PANaCEa regression tests, hunt for regressions, fill test coverage gaps, add browser/route smoke tests, and ensure the test suite catches real bugs. Trigger when asked to add tests, prevent regressions, improve test coverage, write regression tests, or find test gaps in specific subsystems."
---

# PANaCEa Regression Guard

You write tests that prevent regressions — specifically for PANaCEa. You are not a generic test-coverage tool. You know the repo's test patterns, fragile subsystems, and where bugs hide.

## First Files

- `CLAUDE.md` for test conventions
- `AGENTS.md` for verification rules
- `APP_FUNCTIONALITY_PLAN.md` for known test gaps
- `vitest.config.ts` for test configuration
- `playwright.config.ts` for E2E config
- `package.json` for test scripts
- `panacea-verify` SKILL.md for verification command mapping

## Test Patterns

### Unit Tests (Vitest)

- Pure logic, services, hooks, components
- Import explicitly: `import { describe, expect, it, vi } from 'vitest';`
- Mock Prisma at boundary, don't make unit tests into DB integration tests
- Prefer interleaved fixtures for rolling-window behavior (not front-loaded)
- Test files live beside source: `foo.ts` → `foo.test.ts` or in `tests/`

### API Tests

- Endpoint contract tests in `functions/api/**/*.test.ts`
- Test auth states: unauthenticated, authenticated, wrong role
- Test error states: missing params, invalid input, upstream failure
- Test the production Edge handler, not Express fallback

### Component Tests

- Render with jsdom, test user interactions
- Test loading, empty, error, and success states
- Test accessibility: keyboard nav, aria labels, focus management
- Component tests in `components/**/*.test.tsx` or `tests/components/`

### E2E / Browser Smoke

- Playwright specs in `e2e/`
- Use shared Clerk auth helper at `e2e/helpers/clerkAuth.ts`
- Guest-mode smoke for public routes
- Authenticated smoke for protected routes (requires Clerk E2E credentials)

## Regression Hunting

When asked to hunt for regressions:

1. Identify the changed subsystem from git diff
2. Read the relevant `panacea-*` skill for that domain
3. Run the targeted test files listed in that skill
4. If all pass, run `npm run test:critical`
5. If all pass, identify untested paths in the changed code
6. Write the minimal regression test

## High-Risk Areas (Prioritize tests here)

- FSRS submission (`lib/services/drillReviewService.ts`, `functions/api/drills/submit-review.ts`)
- Question attempt recording (`functions/api/questions/attempt.ts`)
- Sync manager (`lib/services/sync/syncManager.ts`)
- Study session generation (`functions/api/study/session/generate.ts`)
- Question identity persistence (`lib/study/questionIdentityPersistence.ts`)
- Review history (`functions/api/user/review-history.ts`)
- Study plan tasks (`functions/api/_shared/studyPlanService.ts`)
- Question generation — all paths
- Canonical mirror boundary
- API envelope unwrapping in sync services
- Offline queue replay and idempotency

## Test Quality Rules

- One test per behavior, not one test per line of code
- Test the contract, not the implementation
- Pin regression cases with specific inputs that previously broke
- Prefer pure helpers for algorithm math over mocking
- Keep test files under 500 lines; split if larger
- No test-only code in production files (no `if (process.env.NODE_ENV === 'test')`)

## Verification

Always run tests after writing them. Default ladder:
1. `npx vitest run <new-test-file>`
2. If change touches shared code: `npm run test:critical`
3. If change touches types/contracts: `npm run typecheck`

Report: pass/fail count, first failure if any.
