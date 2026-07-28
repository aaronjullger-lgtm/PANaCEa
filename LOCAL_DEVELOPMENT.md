# PANaCEa Local Development Runbook

> Single source of truth for running PANaCEa on your local machine.
> For cross-machine setup, see [`MACHINE_TRANSFER.md`](./MACHINE_TRANSFER.md).

## Overview

PANaCEa is an AI-powered PANCE/PANRE exam preparation platform. This runbook covers how to set up the project locally, configure the required services, run the dev servers, execute tests, and troubleshoot common issues.

## Prerequisites

- **Node.js**: `>=22.0.0` (the repo pins `22` in `.node-version` and `.nvmrc`).
- **npm**: bundled with Node.js.
- **Git**.
- **1Password desktop app + CLI (`op`)** — used to mount `.env` as an inject pipe (see below). Not strictly required if you manage `.env` manually.
- **uv** — for the sibling `langchain-agent/` Python project (optional, only if you work on dev agents).
- External accounts/services you will need to configure:
  - **Clerk** — for authentication (`VITE_CLERK_*` and `CLERK_*` variables).
  - **Supabase** — for database and storage (`SUPABASE_*` and `VITE_SUPABASE_*` variables).
  - **Google Gemini** — for content generation (`GEMINI_API_KEY`).
  - **Sentry** — for error tracking (`SENTRY_*` variables).
  - **SMTP provider** — for transactional email (`SMTP_*` variables).
  - **Langfuse** (optional) — LLM observability for the app's Gemini calls (`LANGFUSE_*` variables). Code no-ops cleanly without these.
  - **LangSmith** (optional) — observability for the sibling `langchain-agent` Python project (`LANGSMITH_*` variables).
- (Optional) **Docker** if you prefer a local Postgres instance instead of Supabase.

## Environment setup

PANaCEa uses **1Password-managed `.env`** as the primary flow. Manual `.env` still works as a fallback.

### Option A: 1Password (preferred — auto-rotating secrets)

The `PANaCEa` Environment in your 1Password account holds every secret. The CLI mounts it as a local `.env.1password` inject pipe:

```bash
# One-time setup (per machine) — register the mount via 1Password desktop app
# or the 1Password MCP server. The .env.1password file appears as a named pipe
# that re-reads fresh values from 1Password on every access.
```

The repo's Vite/dev tooling reads `.env.1password` automatically (alongside `.env`). See [`MACHINE_TRANSFER.md`](./MACHINE_TRANSFER.md) for full per-machine setup.

### Option B: Manual `.env` (fallback)

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

## Sibling: `langchain-agent/` Python project

A separate Python agent scaffold lives at `~/GitHub/langchain-agent/` (sibling directory). It's the seed for future autonomous dev agents that operate on PANaCEa. Traced to LangSmith project `panacea-dev-agents`.

```bash
cd ~/GitHub/langchain-agent
uv sync
uv run main.py
```

Its `.env` is also a 1Password inject pipe (same PANaCEa Environment). See [`~/GitHub/langchain-agent/README.md`](https://github.com/aaronjullger-lgtm/langchain-agent) for details.

## LLM observability

Two separate tracing systems are wired:

| System | Scope | Variables | Status |
|---|---|---|---|
| **Langfuse** | PANaCEa app's Gemini calls (via `lib/ai/aiGateway.ts`) | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` | Wired, no-op without keys |
| **LangSmith** | Sibling `langchain-agent/` Python dev agents | `LANGSMITH_API_KEY`, `LANGSMITH_TRACING=true`, `LANGSMITH_PROJECT=panacea-dev-agents` | Wired in langchain-agent |

Both sets of variables live in the 1Password PANaCEa Environment.

## Common issues

- **Auth redirects fail**: ensure Clerk URLs in `.env` match the URLs configured in the Clerk dashboard.
- **Database connection errors**: verify `DATABASE_URL` points to a local or dev database and that the schema is migrated.
- **Prisma pooling errors**: use `pgbouncer=true` in `DATABASE_URL` for serverless/edge environments.
- **WSL path issues**: if running under WSL, ensure Windows paths are translated correctly for any file-watching tools.
- **Missing Prisma client**: run `npm run db:generate` if you see Prisma client import errors.
- **`.env.1password` not present**: 1Password desktop app must be running and signed in. Re-register the mount if it disappears (see `MACHINE_TRANSFER.md`).
- **Langfuse traces not landing**: confirm `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` are in the 1Password Environment. Code silently no-ops otherwise.
- **LangSmith 403 Forbidden on trace POST**: use `LANGSMITH_PERSONAL_ACCESS_TOKEN` instead of bare `LANGSMITH_API_KEY`. The langchain-agent `main.py` does this automatically.
