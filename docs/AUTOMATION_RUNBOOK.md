# PANaCEa Automation Runbook

Reference for workflows, schedules, and manual commands for database and maintenance automation.

## Workflows

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `daily-automation.yml` | Daily 3 AM UTC | Grand Rounds, OSCE cleanup, content validation, metrics aggregation, cron API calls |
| `weekly-automation.yml` | Sunday 2 AM EST (7 AM UTC) | Health checks, user stats, weekly tasks, database orchestration, cleanup |
| `hourly-automation.yml` | Hourly | Health checks, streak updates, leaderboard cache |
| `ci-cd.yml` (deploy-production) | On push to main | Deploy + post-deploy `sync:all-registries` |

## Manual Commands

| Command | Purpose |
|---------|---------|
| `npm run automation:daily` | Run daily tasks (Grand Rounds, cleanup, validation, etc.) |
| `npm run automation:weekly` | Run weekly tasks |
| `npm run automation:hourly` | Run hourly tasks |
| `npm run db:orchestrate` | Full orchestration: sync registries, validate, repair, write-back |
| `npm run sync:all-registries` | Sync local registries (config/conditionRegistry, src/registries/drugRegistry) to database |
| `npm run db:backup` | Backup all tables to backups/{timestamp}/ |
| `npm run db:validate` | Validate database integrity |
| `npm run db:automate` | Content automation (validation, quality, relationships, dedup, generate) |

## Required Secrets (GitHub)

- `DATABASE_URL` – PostgreSQL connection string
- `GEMINI_API_KEY` – For AI content generation
- `CLERK_SECRET_KEY` – For auth
- `SUPABASE_URL` – Supabase
- `PRODUCTION_URL` – Production site URL (e.g. https://studypanacea.com)
- `CRON_SECRET` – Auth for cron API endpoints (must match Cloudflare env var)

## Cron API Endpoints

These endpoints are called by `daily-automation.yml` when `PRODUCTION_URL` and `CRON_SECRET` are set:

- `POST /api/cron/aggregate-analytics` – Daily user analytics
- `POST /api/cron/daily-prescription` – Personalized study plans
- `POST /api/cron/replenish-pool` – Question pool replenishment

## Registry Sync on Deploy

`sync:all-registries` runs in the `deploy-production` job of `ci-cd.yml` after Cloudflare Pages deploy. It keeps the database in sync with local registries. Manual run: `npm run sync:all-registries`.

## Database Orchestration (Weekly)

`db:orchestrate` runs in `weekly-automation.yml` as part of the database-optimization job. Order:

1. `db:backup` (optional, continue-on-error)
2. `db:orchestrate` (Handshake, Diagnostic, Auto-Mechanic, Write-Back)
3. Database cleanup (BackgroundJob, SyncQueue)
