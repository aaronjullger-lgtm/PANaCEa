# Runtime Smoke Test Plan

**Date:** 2026-07-09
**Blocker (deep-research 2026-05-22):** "Live browser/smoke tests are missing." — Deployment 68/100,
Testing/QA 86/100.

## 1. Verified current state (smoke *infrastructure* largely EXISTS — "missing" is partly stale)

| Asset | Present? |
|---|---|
| `playwright.production-smoke.config.ts` | ✅ |
| `e2e/production-smoke/` directory | ✅ |
| `e2e/auth.setup.ts` (Clerk auth setup) | ✅ |
| `e2e/all-modes.spec.ts`, `main-session.spec.ts`, `osce.spec.ts`, `patient-encounter-flow.spec.ts`, `critical-flows.spec.ts`, `srs-flashcards.spec.ts`, `condition-library.spec.ts`, `offline-sync.spec.ts` | ✅ |
| `e2e/api-health.spec.ts`, `api-security.spec.ts`, `csp-console.spec.ts` | ✅ |
| Scripts: `test:e2e:production-smoke`, `test:smoke`, `verify:health`, `test:e2e:wrangler`, `test:auth`, `test:auth:check` | ✅ (`package.json`) |
| Workflow: `.github/workflows/sched-runtime-sanity.yml`, `playwright.yml` | ✅ |

So the Playwright specs, configs, and auth-setup scaffolding exist. The real gap is **authenticated
runtime execution against a live/preview deploy**, which needs Clerk credentials.

## 2. The actual gap

- **Authenticated smoke against a live deploy** is not proven, because it requires real Clerk test
  credentials (or a Clerk test environment). `test:auth:check` (`scripts/check-auth-prerequisites.mjs`)
  gates this.
- CI runs component/unit tests (9,850 pass) but not the authenticated end-to-end login→session→review
  path against a deployed URL.

## 3. Clerk auth for E2E — blocked state + safe options

**Blocked:** running authenticated smoke needs credentials this environment must not hold (no secrets).

Safe options to propose (pick one):
1. **Dedicated non-2FA test user** in a Clerk test instance; store creds as CI secrets (repo owner action).
2. **Clerk test environment** with `@clerk/testing` (already a devDependency) using testing tokens.
3. **Mocked auth for local smoke**: a Playwright fixture that injects a signed session for
   `dev_auth=cursor_secret_key_999` (the repo already supports a dev-auth query param per `.cursorrules`).
4. **Staged manual QA checklist** for the login→session→review→results flow until (1)/(2) is set up.

## 4. Safe preparatory work (no approval, no creds)

- **Unauthenticated smoke** can run now: `e2e/api-health.spec.ts` + `csp-console.spec.ts` against a
  local `npm run dev:wrangler` build (no login required). Recommend wiring these into CI as a
  fast pre-deploy gate (they need no secrets).
- **Document the authenticated matrix**: login → start MAIN session → answer → review write →
  results; OSCE encounter happy path; SRS flashcard submit. (Specs already exist for these; they just
  need a credentialed runner.)
- **`test:auth:check`** already reports missing prerequisites cleanly — keep it as the gate.

## 5. Approval gate

Adding Clerk test credentials / a test-user secret to CI is a **credentials + auth** decision →
**Ask First**. Running against production is **Ask First**. Do not add real credentials to the repo.
