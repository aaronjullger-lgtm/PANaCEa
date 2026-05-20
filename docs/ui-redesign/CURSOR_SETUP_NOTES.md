# Cursor Setup Notes

Last updated: 2026-05-20

## Purpose

These notes are for continuing the UI redesign branch from a new Cursor machine without leaking secrets into tracked files.

## Guest-Mode Visual QA

Guest-mode visual QA can run without Clerk test-user credentials. Use it for layout, route consistency, screenshot review, overflow checks, and modal/shell verification.

Final artifacts for this branch are already saved under:

- `docs/ui-redesign/screenshots/final/`
- `docs/ui-redesign/screenshots/final/qa-results.json`

## Local Build And App Runtime

Use local `.env` files only. Do not commit `.env`, `.env.production.local`, auth storage, or provider tokens.

Common local values from `.env.example` and deployment docs:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server/admin integrations may also need:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`
- Cloudflare/Vercel provider tokens when deploying from that machine

## Authenticated Playwright QA

Do not use a personal account for automated auth. Create a dedicated Clerk dev/test learner.

Recommended official Clerk helper path:

- Install `@clerk/testing` as a dev dependency when ready to migrate auth setup.
- Set `CLERK_SECRET_KEY` locally.
- Set `E2E_CLERK_USER_EMAIL` locally.
- Keep `E2E_CLERK_USER_PASSWORD` local-only if any legacy password-based helper remains during the migration.
- Keep existing `E2E_CLERK_TEST_EMAIL` / `E2E_CLERK_TEST_PASSWORD` local-only until the legacy helper is retired.

The current limitation and migration shape are documented in `docs/ui-redesign/AUTH_QA_LIMITATION.md`.

## Safe Next Step On A New PC

After installing dependencies, run:

```bash
npm run typecheck
npm run build
npm run lint
npm run test:critical
```

Then review `docs/ui-redesign/screenshots/final/qa-results.json` and the final screenshots before opening authenticated QA.
