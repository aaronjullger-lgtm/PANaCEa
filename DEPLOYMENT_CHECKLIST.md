# Deployment Checklist

Last updated: 2026-04-26

Target: Cloudflare Pages with Pages Functions, PostgreSQL/Supabase through Prisma, Clerk auth, Gemini AI, and Cloudflare KV for rate limits/cache. OSCE Durable Object bindings are deferred until OSCE is part of the launch surface and its Worker is deployed separately.

## Required Environment

Set these in Cloudflare Pages for Production and Preview unless noted otherwise.

### Public Build Variables

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for the same Clerk app as `CLERK_SECRET_KEY`.
- `VITE_API_URL`: Production app origin, usually `https://studypanacea.com`.
- `VITE_APP_URL`: Production app origin.
- `VITE_SUPABASE_URL`: Supabase project URL if browser Supabase features remain enabled.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key only. Do not use a service role key with `VITE_`.
- `VITE_SENTRY_DSN`: Optional browser Sentry DSN.

### Server Secrets

- `DATABASE_URL`: Prisma Accelerate URL for Cloudflare Pages Functions, or a serverless-safe pooled Postgres URL.
- `DIRECT_DATABASE_URL`: Direct/session Postgres connection for migrations. Use in CI/operator shells, not browser code.
- `CLERK_SECRET_KEY`: Clerk backend secret key matching the publishable key environment.
- `CLERK_WEBHOOK_SECRET`: Clerk webhook signing secret for `/api/webhooks/clerk`.
- `GEMINI_API_KEY`: Google Gemini key for AI generation/explanation endpoints.
- `SUPABASE_URL`: Supabase project URL for server-side integrations.
- `SUPABASE_ANON_KEY`: Optional server-side anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only service role key, if media/admin/content workflows need it.
- `SENTRY_DSN`: Optional server/runtime Sentry DSN.
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`: Required only when source-map upload is enabled.
- `ADMIN_USER_IDS`, `SUPERADMIN_USER_IDS`: Clerk user IDs for admin gates.
- `CRON_SECRET`: Required before exposing cron endpoints to external schedulers.

### Cloudflare Bindings

- `RATE_LIMIT_KV`: KV namespace for rate limiting.
- `CACHE`: KV namespace for API/cache/idempotency storage.

Deferred:

- `OsceSessionDO`: OSCE session-state Durable Object. Do not bind this for private beta Pages deploys; Pages can consume an existing Durable Object Worker, but cannot deploy that Worker from this project.

### GitHub Actions Secrets

- `CLOUDFLARE_API_TOKEN`: Token allowed to deploy Cloudflare Pages.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `DATABASE_URL`: Migration/runtime connection for `prisma migrate deploy`.
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`: Optional source-map upload.

## Pre-Deploy Commands

Run from the repository root:

```bash
npm ci
npx prisma validate
npx prisma generate
npm run env:check:backend
npm run typecheck:ci
npm run lint
npm run build
npm run build:check-size
npm run test:critical
npm run test -- functions/api/study/session-generate.test.ts functions/api/questions/attempt.test.ts functions/api/drills/submit-review.test.ts functions/api/study/session-summary.test.ts functions/api/questions/explain-rag.test.ts functions/api/conditions/search.test.ts functions/api/drugs/search.test.ts lib/services/dashboardAnalyticsService.test.ts lib/services/studyPlanService.test.ts
npx playwright test --config=playwright.production-smoke.config.ts --list
```

Do not promote to broad public production while `npm run typecheck:all` fails globally. The deploy-focused core gate `npm run typecheck` is currently green, but the full strict check remains a release-hardening backlog for non-core and legacy surfaces.

## Migration Commands

Use the direct/session database URL for migrations:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
```

Before running production migrations:

- Confirm the migration list includes `20260426000002_backend_hardening_indexes`.
- Confirm no local-only `db push` changes are pending.
- Take or verify a database backup.
- Apply migrations before deploying code that depends on new indexes/tables.

## Build And Deploy

Cloudflare Pages build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`
- Project name: `panacea`

Manual deploy:

```bash
npm run build
npm run build:check-size
npx wrangler pages deploy dist --project-name=panacea --branch=main
```

GitHub Actions deploy path:

- `.github/workflows/ci.yml` runs build, lint, bundle-size, and tests.
- `.github/workflows/deploy.yml` deploys to Cloudflare Pages after CI succeeds on `main` or manual dispatch.

## Smoke Tests

Static preview:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
curl -I http://127.0.0.1:4173/
```

Cloudflare Pages Functions:

```bash
npx wrangler pages dev dist --port 8788 --compatibility-date=2025-12-15 --compatibility-flags=nodejs_compat
curl -I http://127.0.0.1:8788/
curl http://127.0.0.1:8788/api/health
```

Production smoke against Wrangler Pages dev:

```bash
BASE_URL=http://127.0.0.1:8788 E2E_REQUIRE_AUTH=1 npm run test:e2e:production-smoke
```

Production smoke against Cloudflare preview or production:

```bash
BASE_URL=https://<preview-or-production-host> E2E_REQUIRE_AUTH=1 npm run test:e2e:production-smoke
```

Required smoke env:

- `E2E_CLERK_TEST_EMAIL`
- `E2E_CLERK_TEST_PASSWORD`

Expected health response:

- HTTP status `200`.
- `status: "healthy"`.
- `checks.database.status: "pass"`.
- `checks.auth.status: "pass"`.
- `checks.cache.status: "pass"`.
- `checks.content.status: "pass"`.

Manual production smoke after deploy:

- Open `/`.
- Sign in with a production Clerk test user.
- Confirm first-login dashboard loads.
- Start a practice/adaptive session.
- Answer one question.
- Refresh and confirm the attempt/progress persists.
- Open review queue and confirm due-count behavior is stable.
- Search a known condition and a known drug.
- Open study plan and complete one task.
- Check Cloudflare Functions logs for 4xx/5xx spikes.

## Rollback Strategy

Application rollback:

- Cloudflare Dashboard > Pages > `panacea` > Deployments.
- Select the last known good deployment.
- Use "Rollback to this deployment".
- Confirm `/api/health` after rollback.

Database rollback:

- Prefer forward fixes for schema changes.
- If rollback is required, restore from backup or use an explicit, reviewed rollback migration.
- Do not use `prisma migrate resolve --rolled-back` unless the failed migration was not applied or a DBA/operator has confirmed the correct state.

Operational rollback:

- Disable or hide risky routes through navigation/feature flags when available.
- Disable external cron callers by rotating or removing `CRON_SECRET`.
- Disable AI-heavy endpoints temporarily by removing provider keys only if the app has fallback behavior for the affected flow.

## Known Deployment Risks

- Full strict `npm run typecheck:all` fails globally with schema/API drift. The deploy-focused `npm run typecheck` passes for the core launch bundle.
- Production-smoke automation exists, but must be run with Clerk smoke credentials against Wrangler and Cloudflare preview before launch.
- Legacy exam endpoints reference Prisma models that are not present in the current schema and are disabled by default unless `ENABLE_LEGACY_EXAM_API=true`.
- OSCE patient encounter endpoints include deterministic mock behavior and are disabled by default unless `ENABLE_OSCE_BETA=true`.
- The production bundle is large. `npm run build:check-size` now protects against regression from the current baseline, but route-level splitting remains a pre-launch performance risk.
- Public `VITE_*` values in `wrangler.toml` should be reviewed by the owner before public production promotion.
