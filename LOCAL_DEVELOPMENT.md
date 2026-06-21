# PANaCEa Local Development Runbook

> Single source of truth for running PANaCEa on your local machine.

## Prerequisites

- **Node.js**: `>=22.0.0` (the repo pins `22` in `.node-version` and `.nvmrc`).
- **npm**: bundled with Node.js.
- **Git**.
- External accounts/services you will need to configure:
  - **Clerk** — for authentication (`VITE_CLERK_*` and `CLERK_*` variables).
  - **Supabase** — for database and storage (`SUPABASE_*` and `VITE_SUPABASE_*` variables).
  - **Google Gemini** — for content generation (`GEMINI_API_KEY`).
  - **Sentry** — for error tracking (`SENTRY_*` variables).
  - **SMTP provider** — for transactional email (`SMTP_*` variables).
- (Optional) **Docker** if you prefer a local Postgres instance instead of Supabase.

## Environment setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in real values in `.env`. Do **not** commit `.env`.

Required variables include:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `VITE_CLERK_DEBUG`
- `VITE_APP_URL`
- `APP_URL`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `GEMINI_API_KEY`
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENABLE_DEV`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `ADMIN_EMAIL`
- `PORT`
- `NODE_ENV`
- `APP_VERSION`
- `BACKGROUND_WORKER_ENABLED`
- `CRON_SECRET`
- `HEALTH_CHECK_SCHEDULE`
- `JOB_QUEUE_POLL_INTERVAL`
- `MAX_JOB_ATTEMPTS`
- `SYNC_DEBOUNCE_DELAY`

> Use separate test/dev projects for Clerk and Supabase; never use production credentials locally.

## Install dependencies

```bash
npm install
```

`postinstall` automatically runs `prisma generate`.

## Database setup

Generate the Prisma client (already done by `npm install`, but you can re-run it):

```bash
npm run db:generate
```

Apply migrations for local development:

```bash
npm run db:migrate:dev
```

For rapid local iteration against a throwaway database you can also use:

```bash
npm run db:push
```

> Use `db:push` only in local/throwaway databases; prefer migrations for shared or production-like environments.

Open Prisma Studio to inspect data:

```bash
npm run db:studio
```

## Run the app

Start the Vite dev server and Express backend together:

```bash
npm run dev:all
```

Or run just the frontend:

```bash
npm run dev
```

Run just the API server:

```bash
npm run dev:server
```

## Run tests

Unit / integration tests:

```bash
npm run test
```

Critical subset:

```bash
npm run test:critical
```

End-to-end tests (requires Playwright browsers):

```bash
npx playwright install
npm run test:e2e
```

## Lint and typecheck

```bash
npm run lint
npm run typecheck
npm run typecheck:ci
```

Auto-fix lint issues:

```bash
npm run lint:fix
```

## Content-generation and automation scripts

The `scripts/` directory contains many utility scripts for generating content, migrating data, and running automation. Most require external API keys. Read each script's usage before running it, and never run destructive scripts against production data.

Examples (run only after understanding what they do):

```bash
npm run generate:lab
npm run generate:clinical
npm run system-health
```

## Common issues

- **Auth redirects fail**: ensure Clerk URLs in `.env` match the URLs configured in the Clerk dashboard.
- **Database connection errors**: verify `DATABASE_URL` points to a local or dev database and that the schema is migrated.
- **Prisma pooling errors**: use `pgbouncer=true` in `DATABASE_URL` for serverless/edge environments.
- **WSL path issues**: if running under WSL, ensure Windows paths are translated correctly for any file-watching tools.
- **Missing Prisma client**: run `npm run db:generate` if you see Prisma client import errors.
