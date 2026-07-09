---
name: recording-browser-flow-as-test
description: Turn a verified browser flow into a durable Playwright E2E test. Use after manually verifying a user flow, to lock it in against regressions.
---

# Recording a browser flow as a test

Capture a working flow as a Playwright spec so it can't silently regress.

## When to use

- You just verified a user flow in the browser and want a regression test.
- A bug is fixed and needs a reproduction/guard test.

## Instructions

1. Confirm the flow works manually first (see `verifying-in-browser`).
2. Use Playwright's codegen against the running dev server to scaffold selectors:
   ```bash
   npm run dev              # Vite on localhost:3000
   npx playwright codegen localhost:3000   # add http:// scheme if your shell needs it
   ```
3. Move the generated steps into a spec under `e2e/` following existing patterns (check `e2e/all-modes` and the Playwright configs). Match the project's config (base URL, auth setup in `e2e/auth.setup.ts`).
4. Prefer role/label/text selectors over brittle CSS/nth-child. Assert on visible outcomes, not implementation details.
5. Handle auth via the existing E2E setup (Clerk testing token / dev-auth) — never hardcode real credentials; read them from env if required.
6. Keep it deterministic: wait on state, not timeouts; avoid random data.

## Verification

```bash
npx playwright install      # once
npx playwright test e2e/<your-spec>.spec.ts
```
- The test passes locally and fails if the feature is broken (sanity-check by temporarily breaking it).

## Failure recovery

- Flaky selectors → switch to `getByRole`/`getByText`; wait on assertions.
- Auth failures → use `e2e/auth.setup.ts` patterns; confirm a Clerk test user exists; never use prod creds.
- Backend-dependent flow unavailable locally → gate the spec behind the appropriate config/env and document it.
