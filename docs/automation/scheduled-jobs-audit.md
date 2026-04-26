# Scheduled Jobs Audit

Historical audit snapshot date: `2026-04-16`

> Historical note
>
> This document captures the pre-retirement audit snapshot gathered during the automation refactor. It is not the live workflow inventory.
>
> For the current scheduled architecture, use:
> - [docs/automation/README.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/README.md)
> - [docs/automation/SCHEDULE_MATRIX.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/SCHEDULE_MATRIX.md)
> - [docs/automation/BEFORE_AFTER_MATRIX.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/BEFORE_AFTER_MATRIX.md)

Scope reviewed:
- `.github/workflows/**/*.yml`
- `package.json` scripts
- `scripts/automation/**`
- `scripts/db/**`
- `scripts/images/**`
- `scripts/cloud-agents/**`
- queue/background worker code under `lib/services/queue/**`, `scripts/backgroundWorker.ts`, `deployment/systemd/**`
- runtime/background sync code under `public/sw.js`, `public/service-worker.js`, `lib/services/sync/**`, `services/pwaEnhancer.ts`, `lib/utils/serviceWorkerRegistration.ts`
- platform config and retirement docs under `wrangler.toml`, `deployment/README.md`, `deployment/cron/README.md`

Working definition used in this audit:
- A "scheduled job" is either:
  - actively scheduled by GitHub Actions, or
  - a production/runtime endpoint or script that is clearly intended to be scheduler-owned, or
  - an operator-facing script that is schedule-capable and overlaps with recurring maintenance, auditing, cleanup, generation, reporting, or health checks.
- `package.json` aliases are listed separately as operator entrypoints, not counted again as independent automation surfaces when they only wrap an already-inventoried file.

Snapshot:
- `6` GitHub Actions workflows currently use `on.schedule`; all `6` also expose `workflow_dispatch`.
- `1` reusable workflow powers the scheduled lanes: `.github/workflows/_automation-lane.yml`.
- `5` additional GitHub workflows are automation/maintenance-adjacent without `on.schedule`.
- `18` Pages cron endpoints exist under `functions/api/cron/`; `10` are referenced by current scheduled GitHub workflows and `8` are not.
- `4` primary script entrypoints exist under `scripts/automation/`.
- `6` helper modules under `scripts/automation/jobs/` declare or imply recurring intent but are not directly scheduler-wired.
- The repo still contains a retired local scheduler path: `scripts/scheduleJobs.ts`, `scripts/contentHealthChecker.ts`, `scripts/cleanupJobs.ts`, `functions/cache-warmer.ts`, `deployment/cron/README.md`.
- Background runtime automation exists outside cron via `scripts/backgroundWorker.ts`, `lib/services/queue/jobQueue.ts`, `deployment/systemd/panacea-worker.service`, `public/sw.js`, and `lib/services/sync/syncManager.ts`.

## Existing GitHub Scheduled Workflows

### Automation - Platform Health
- Name: `Automation - Platform Health`
- Location: `.github/workflows/automation-platform-health.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `17 * * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `GEMINI_API_KEY`; reusable runner `.github/workflows/_automation-lane.yml`; `npm run automation:hourly`
- What it actually does: Runs `scripts/automation/hourlyTasks.ts` to check DB connectivity, Gemini access, failed background jobs, content availability, and system resources, then uploads hourly JSON logs.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `scripts/automation/jobs/healthChecks.ts`, `scripts/system-health.ts`, `scripts/contentHealthChecker.ts`, `functions/api/cron/compute-content-health.ts`, `functions/api/cron/nightly-health-check.ts`
- Recommendation bucket: `refactor`

### Automation - Reservoir Supply
- Name: `Automation - Reservoir Supply`
- Location: `.github/workflows/automation-reservoir-supply.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `25 */2 * * *`
- Inputs / secrets / environment dependencies: `PRODUCTION_URL`, `CRON_SECRET`; reusable runner `.github/workflows/_automation-lane.yml`; `/api/cron/reservoir-maintenance`; `/api/cron/replenish-pool`
- What it actually does: Calls two production endpoints every two hours to expire/release reservoir rows, trigger low-water refills, refresh materialized views, and report question-pool shortages.
- Operational category: `production/runtime-facing`; `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/reservoir-maintenance.ts`, `functions/api/cron/replenish-pool.ts`, `functions/api/cron/batch-generate-questions.ts`, `functions/api/cron/generate-variants.ts`, `lib/services/reservoir/refillOrchestrator.ts`
- Recommendation bucket: `keep`

### Automation - Daily Personalization
- Name: `Automation - Daily Personalization`
- Location: `.github/workflows/automation-daily-personalization.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `10 3 * * *`
- Inputs / secrets / environment dependencies: `PRODUCTION_URL`, `CRON_SECRET`; reusable runner `.github/workflows/_automation-lane.yml`; `/api/cron/daily-prescription`; `/api/cron/generate-daily-insights`; `/api/cron/push-reminders`
- What it actually does: Calls production personalization endpoints that compute daily prescriptions, generate cached dashboard insights, and send push reminders.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/daily-prescription.ts`, `functions/api/cron/generate-daily-insights.ts`, `functions/api/cron/generate-daily-plans.ts`, `scripts/automation/jobs/userProfileEnrichment.ts`, `scripts/automation/jobs/userStatistics.ts`
- Recommendation bucket: `refactor`

### Automation - Daily Analytics
- Name: `Automation - Daily Analytics`
- Location: `.github/workflows/automation-daily-analytics.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `40 3 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET`; reusable runner `.github/workflows/_automation-lane.yml`; `npm run automation:daily`; `/api/cron/aggregate-analytics`; `/api/cron/aggregate-distributions`
- What it actually does: Runs repo-hosted daily report generation and cleanup via `scripts/automation/dailyTasks.ts`, then calls production analytics/distribution rollups.
- Operational category: `analytics/reporting`; `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `scripts/automation/dailyTasks.ts`, `functions/api/cron/aggregate-analytics.ts`, `functions/api/cron/aggregate-distributions.ts`, `scripts/automation/jobs/platformStatistics.ts`, `scripts/automation/jobs/contentStatistics.ts`
- Recommendation bucket: `refactor`

### Automation - Weekly Maintenance
- Name: `Automation - Weekly Maintenance`
- Location: `.github/workflows/automation-weekly-maintenance.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `22 7 * * 0`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `GEMINI_API_KEY`, `PRODUCTION_URL`, `CRON_SECRET`; reusable runner `.github/workflows/_automation-lane.yml`; `npm run automation:weekly`; `npm run db:backup`; `npm run db:orchestrate`; `/api/cron/compute-item-metrics`; `/api/cron/calibrate-items`; `/api/cron/content-quality-loop`
- What it actually does: Bundles the weekly script suite, a full JSON backup, DB orchestration, psychometric analysis, item calibration, and AI-driven content quality work into one lane.
- Operational category: `content/data maintenance`; `analytics/reporting`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/automation/weeklyTasks.ts`, `scripts/weekly-maintenance.ts`, `scripts/maintenance/orchestrator.ts`, `functions/api/cron/compute-item-metrics.ts`, `functions/api/cron/calibrate-items.ts`, `functions/api/cron/content-quality-loop.ts`
- Recommendation bucket: `refactor`

### Automation - Monthly Governance
- Name: `Automation - Monthly Governance`
- Location: `.github/workflows/automation-monthly-governance.yml`
- Trigger type: `schedule` + `workflow_dispatch`
- Current cadence if any: `35 8 1 * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`; reusable runner `.github/workflows/_automation-lane.yml`; `npm run automation:monthly`
- What it actually does: Runs `scripts/automation/monthlyGovernance.ts`, which executes the drift detector and `npm audit --omit=dev`, then writes monthly JSON logs.
- Operational category: `repo maintenance only`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `scripts/automation/monthlyGovernance.ts`, `scripts/cron/drift-detector.ts`, `audit:*` package scripts
- Recommendation bucket: `refactor`

### Reusable Automation Lane
- Name: `Reusable Automation Lane`
- Location: `.github/workflows/_automation-lane.yml`
- Trigger type: `workflow_call`
- Current cadence if any: none; called by the six scheduled/manual automation lanes
- Inputs / secrets / environment dependencies: caller-provided lane name/slug/commands/endpoints; optional `DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `SUPABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET`
- What it actually does: Centralizes checkout, Node setup, `npm ci`, optional `prisma generate`, shell-command execution, production cron endpoint invocation, and artifact upload for the automation lanes.
- Operational category: `repo maintenance only`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: none; this is the workflow abstraction all current scheduled jobs depend on
- Recommendation bucket: `keep`

### CI
- Name: `CI`
- Location: `.github/workflows/ci.yml`
- Trigger type: `push` + `pull_request` + `workflow_dispatch`
- Current cadence if any: event-driven only
- Inputs / secrets / environment dependencies: `GITHUB_TOKEN`; Node `22`; `npm ci`; Prisma; lint; build; tests; gitleaks
- What it actually does: Runs build/test/lint/secret-scan workflows and a non-blocking E2E smoke path on pushes, PRs, and manual runs.
- Operational category: `repo maintenance only`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `.github/workflows/playwright.yml`, local `audit:*` package scripts, `verify:health`
- Recommendation bucket: `keep`

### Deploy to Cloudflare Pages
- Name: `Deploy to Cloudflare Pages`
- Location: `.github/workflows/deploy.yml`
- Trigger type: `workflow_run` + `workflow_dispatch`
- Current cadence if any: event-driven only; deploys after CI success on `main`
- Inputs / secrets / environment dependencies: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, optional Sentry secrets; Node `22`; Prisma migrate deploy
- What it actually does: Validates/builds/deploys the app to Cloudflare Pages when CI passes or when manually invoked.
- Operational category: `repo maintenance only`; `production/runtime-facing`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: none directly; adjacent to deployment shell scripts under `deployment/scripts/**`
- Recommendation bucket: `keep`

### Cloud Agents
- Name: `Cloud Agents`
- Location: `.github/workflows/cloud-agents.yml`
- Trigger type: `push` + `pull_request` + `workflow_dispatch`
- Current cadence if any: event-driven only
- Inputs / secrets / environment dependencies: `CURSOR_AGENTS_API_KEY`; Node `22`; `scripts/cloud-agents/run-from-ci.ts`
- What it actually does: Uses path filters plus manual operator input to launch external Cursor Cloud Agent jobs such as edge guard, living docs, schema sync, E2E gap filling, PR review, and security sentinel work.
- Operational category: `cloud-agent related`; `repo maintenance only`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/cloud-agents/trigger.ts`, `scripts/cloud-agents/bulk-repos.ts`, `scripts/cloud-agents/run-from-ci.ts`, CodeRabbit/GitHub review flows
- Recommendation bucket: `refactor`

### Neon Preview Branches
- Name: `Neon Preview Branches`
- Location: `.github/workflows/neon_workflow.yml`
- Trigger type: `pull_request`
- Current cadence if any: event-driven only
- Inputs / secrets / environment dependencies: `NEON_API_KEY`; `vars.NEON_PROJECT_ID`
- What it actually does: Creates or deletes ephemeral Neon preview DB branches when PRs open, synchronize, reopen, or close.
- Operational category: `repo maintenance only`; `production/runtime-facing`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: none directly; adjacent to DB deployment lifecycle
- Recommendation bucket: `keep`

### Playwright End-to-End Tests
- Name: `Playwright End-to-End Tests`
- Location: `.github/workflows/playwright.yml`
- Trigger type: `push` + `pull_request`
- Current cadence if any: event-driven only
- Inputs / secrets / environment dependencies: Node `22`; Playwright browsers; `npm ci`; Prisma generate
- What it actually does: Runs the full Playwright suite and uploads the HTML report artifact outside the lighter CI smoke lane.
- Operational category: `repo maintenance only`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `.github/workflows/ci.yml` `e2e-smoke`; `verify:health`
- Recommendation bucket: `keep`

## Existing App-Level / Script-Level Schedulable Jobs

### `/api/cron/aggregate-analytics`
- Name: `Daily Analytics Aggregation Cron Endpoint`
- Location: `functions/api/cron/aggregate-analytics.ts`
- Trigger type: HTTP cron endpoint called by GitHub Actions; comment still says Cloudflare scheduled handler
- Current cadence if any: live via `.github/workflows/automation-daily-analytics.yml` at `40 3 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`
- What it actually does: Aggregates yesterday's `QuestionAttempt` data into `dailyUserAnalytics`, updates `userConditionAccuracy`, and writes an `auditLog` row.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `scripts/automation/dailyTasks.ts`, `scripts/automation/jobs/platformStatistics.ts`, `scripts/automation/jobs/contentStatistics.ts`
- Recommendation bucket: `refactor`

### `/api/cron/aggregate-distributions`
- Name: `Answer Distribution Aggregation`
- Location: `functions/api/cron/aggregate-distributions.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-daily-analytics.yml` at `40 3 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`
- What it actually does: Aggregates `QuestionAttempt.selectedAnswer` data into `questionAnswerDistribution` for questions with at least ten attempts.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: analytics rollup logic in `scripts/automation/dailyTasks.ts`
- Recommendation bucket: `keep`

### `/api/cron/analyze-exam-outcomes`
- Name: `Analyze Exam Outcomes`
- Location: `functions/api/cron/analyze-exam-outcomes.ts`
- Trigger type: intended HTTP cron endpoint; current file exports `default` instead of Pages `onRequest*`
- Current cadence if any: comment says weekly; no current scheduler reference found
- Inputs / secrets / environment dependencies: `CRON_SECRET`; exam-outcome data; `systemPredictiveness`
- What it actually does: Computes exam-outcome predictiveness metrics and alert summaries by exam type.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `functions/api/cron/compute-item-metrics.ts`, `functions/api/cron/calibrate-items.ts`, weekly reporting
- Recommendation bucket: `unclear`

### `/api/cron/batch-generate-questions`
- Name: `Batch Question Generation`
- Location: `functions/api/cron/batch-generate-questions.ts`
- Trigger type: intended HTTP cron endpoint
- Current cadence if any: comment says nightly externally triggered; no current scheduler reference found
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, Gemini API access, staging question pipeline
- What it actually does: Finds blueprint coverage gaps, generates batches of questions plus hints/explanations, validates them, and promotes passing content to staging.
- Operational category: `production/runtime-facing`; `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `no`
- Likely overlap with: `functions/api/cron/replenish-pool.ts`, `functions/api/cron/generate-variants.ts`, `scripts/weekly-maintenance.ts`, `scripts/backgroundWorker.ts`
- Recommendation bucket: `manual-only`

### `/api/cron/calibrate-items`
- Name: `Batch Psychometric Calibration`
- Location: `functions/api/cron/calibrate-items.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-weekly-maintenance.yml` at `22 7 * * 0`; file comment still says daily
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, optional `CACHE` KV binding
- What it actually does: Reads recent attempts, computes Elo/CTT calibration metrics per question, stores per-question summaries in KV, and returns flagged items.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/compute-item-metrics.ts`, `functions/api/cron/content-quality-loop.ts`
- Recommendation bucket: `refactor`

### `/api/cron/compute-content-health`
- Name: `Compute Content Health`
- Location: `functions/api/cron/compute-content-health.ts`
- Trigger type: intended HTTP cron endpoint; current file exports `default`
- Current cadence if any: comment says nightly/daily; no current scheduler reference found
- Inputs / secrets / environment dependencies: `CRON_SECRET`, content health services, `contentHealthReport`
- What it actually does: Computes question/content health scores, persists them, may auto-demote unhealthy questions, and writes a health snapshot row.
- Operational category: `content/data maintenance`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/nightly-health-check.ts`, `scripts/contentHealthChecker.ts`, `scripts/automation/hourlyTasks.ts`, `scripts/system-health.ts`
- Recommendation bucket: `merge`

### `/api/cron/compute-item-metrics`
- Name: `Compute Item Metrics`
- Location: `functions/api/cron/compute-item-metrics.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-weekly-maintenance.yml` at `22 7 * * 0`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`
- What it actually does: Computes discrimination, point-biserial, and distractor quality metrics for active questions with enough attempts, then returns flagged items.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `functions/api/cron/calibrate-items.ts`, `functions/api/cron/content-quality-loop.ts`
- Recommendation bucket: `keep`

### `/api/cron/content-quality-loop`
- Name: `Content Quality Loop`
- Location: `functions/api/cron/content-quality-loop.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-weekly-maintenance.yml` at `22 7 * * 0`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, Gemini-backed self-refine pipeline
- What it actually does: Finds poorly performing questions, flags them, and may regenerate content through the AI self-refine path.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/weekly-maintenance.ts`, `functions/api/cron/compute-item-metrics.ts`, `functions/api/cron/calibrate-items.ts`, `scripts/db/auto-deprecate-flagged-questions.ts`
- Recommendation bucket: `refactor`

### `/api/cron/daily-prescription`
- Name: `Daily Study Prescription Generator`
- Location: `functions/api/cron/daily-prescription.ts`
- Trigger type: HTTP cron endpoint; comment still says Cloudflare scheduled handler
- Current cadence if any: live via `.github/workflows/automation-daily-personalization.yml` at `10 3 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`
- What it actually does: Generates daily prescription/audit records for recently active users based on weak systems, due cards, and low-stability items.
- Operational category: `production/runtime-facing`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/generate-daily-plans.ts`, `scripts/automation/jobs/userProfileEnrichment.ts`, `scripts/automation/jobs/userStatistics.ts`
- Recommendation bucket: `refactor`

### `/api/cron/generate-daily-insights`
- Name: `Daily Dashboard Insight Generation`
- Location: `functions/api/cron/generate-daily-insights.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-daily-personalization.yml` at `10 3 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY`
- What it actually does: Computes study metrics per active user, generates natural-language insight summaries with Gemini, and caches them for the dashboard.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/daily-prescription.ts`, `functions/api/cron/generate-daily-plans.ts`
- Recommendation bucket: `refactor`

### `/api/cron/generate-daily-plans`
- Name: `Generate Personalized Daily Study Plans`
- Location: `functions/api/cron/generate-daily-plans.ts`
- Trigger type: intended HTTP cron endpoint; current file exports `default`
- Current cadence if any: comment says nightly/evening; no current scheduler reference found
- Inputs / secrets / environment dependencies: `CRON_SECRET`, phenotype service, daily-plan generation services
- What it actually does: Computes phenotypes and tomorrow's daily plans for active users in batches.
- Operational category: `production/runtime-facing`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `functions/api/cron/daily-prescription.ts`, `functions/api/cron/generate-daily-insights.ts`, `scripts/automation/jobs/userProfileEnrichment.ts`
- Recommendation bucket: `merge`

### `/api/cron/generate-variants`
- Name: `Batch Variant Generation`
- Location: `functions/api/cron/generate-variants.ts`
- Trigger type: intended HTTP cron endpoint
- Current cadence if any: comment says daily at 4 AM UTC; no current scheduler reference found
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY`
- What it actually does: Generates question variants for thinly covered conditions to increase spaced-repetition rotation depth.
- Operational category: `production/runtime-facing`; `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `no`
- Likely overlap with: `functions/api/cron/batch-generate-questions.ts`, `functions/api/cron/replenish-pool.ts`
- Recommendation bucket: `manual-only`

### `/api/cron/nightly-health-check`
- Name: `Nightly Content Health Report`
- Location: `functions/api/cron/nightly-health-check.ts`
- Trigger type: intended HTTP cron endpoint; current file exports `default`
- Current cadence if any: comment says nightly; no current scheduler reference found
- Inputs / secrets / environment dependencies: `CRON_SECRET`, content health services, blueprint coverage analysis
- What it actually does: Builds a comprehensive health snapshot covering system health, unhealthy questions, blueprint gaps, QA distribution, and update velocity.
- Operational category: `analytics/reporting`; `content/data maintenance`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/compute-content-health.ts`, `scripts/contentHealthChecker.ts`, `scripts/automation/hourlyTasks.ts`
- Recommendation bucket: `merge`

### `/api/cron/populate-prerequisites`
- Name: `Populate Prerequisites`
- Location: `functions/api/cron/populate-prerequisites.ts`
- Trigger type: intended HTTP cron endpoint, but implemented as `authenticatedEndpoint(...)`
- Current cadence if any: comment says weekly; no current scheduler reference found
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CLERK_SECRET_KEY`, authenticated user context; optional rebuild flag
- What it actually does: Rebuilds or upserts semantic prerequisite graph edges from clinical relationships, hierarchy, anatomy, drug, and complication links.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `yes`
- Likely overlap with: graph maintenance and prerequisite remediation services
- Recommendation bucket: `refactor`

### `/api/cron/push-reminders`
- Name: `Push Reminder Cron Job`
- Location: `functions/api/cron/push-reminders.ts`
- Trigger type: HTTP cron endpoint; comment says every two hours via Cloudflare Cron Trigger
- Current cadence if any: live via `.github/workflows/automation-daily-personalization.yml` at `10 3 * * *` only once daily
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, push subscription data, habit formation service
- What it actually does: Builds personalized notification candidates, throttles them, and sends live push notifications.
- Operational category: `production/runtime-facing`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `no`
- Likely overlap with: reminder preference logic and daily personalization lane; file comment implies a different live cadence than the workflow
- Recommendation bucket: `refactor`

### `/api/cron/replenish-pool`
- Name: `Question Pool Replenishment Check`
- Location: `functions/api/cron/replenish-pool.ts`
- Trigger type: HTTP cron endpoint; comment still says Cloudflare scheduled handler
- Current cadence if any: live via `.github/workflows/automation-reservoir-supply.yml` every two hours at `25 */2 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`
- What it actually does: Checks per-system question counts, flags shortages, counts problematic questions, and writes an audit log.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `functions/api/cron/reservoir-maintenance.ts`, `functions/api/cron/batch-generate-questions.ts`, `functions/api/cron/generate-variants.ts`
- Recommendation bucket: `merge`

### `/api/cron/reservoir-maintenance`
- Name: `Reservoir Maintenance`
- Location: `functions/api/cron/reservoir-maintenance.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: live via `.github/workflows/automation-reservoir-supply.yml` every two hours at `25 */2 * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`, reservoir services, blueprint gap analyzer
- What it actually does: Expires stale rows, releases abandoned reservations, deletes old rows, triggers refills, runs blueprint-gap generation analysis, refreshes materialized views, and writes an audit log.
- Operational category: `production/runtime-facing`; `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/replenish-pool.ts`, reservoir refill job creation, batch generation endpoints
- Recommendation bucket: `keep`

### `/api/cron/xapi-export`
- Name: `xAPI Export`
- Location: `functions/api/cron/xapi-export.ts`
- Trigger type: HTTP cron endpoint
- Current cadence if any: none found; endpoint is export-capable only
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `CRON_SECRET`; query params `hours` and `format`
- What it actually does: Exports recent `QuestionAttempt` and `ReviewLog` activity as xAPI 1.0.3 statements.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `yes`
- Likely overlap with: external analytics export/reporting pipelines
- Recommendation bucket: `manual-only`

### Hourly Automation Tasks
- Name: `Hourly Automation Tasks`
- Location: `scripts/automation/hourlyTasks.ts`
- Trigger type: script entrypoint invoked by GitHub Actions
- Current cadence if any: file comment says `0 * * * *`; actual workflow cadence is `17 * * * *`
- Inputs / secrets / environment dependencies: `DATABASE_URL`, `GEMINI_API_KEY`; Prisma DB access; writes `logs/hourly/*.json`
- What it actually does: Runs five core health checks and persists a JSON report.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `scripts/automation/jobs/healthChecks.ts`, `scripts/system-health.ts`, `scripts/contentHealthChecker.ts`
- Recommendation bucket: `refactor`

### Daily Automation Tasks
- Name: `Daily Automation Tasks`
- Location: `scripts/automation/dailyTasks.ts`
- Trigger type: script entrypoint invoked by GitHub Actions
- Current cadence if any: file comment says `0 3 * * *`; actual workflow cadence is `40 3 * * *`
- Inputs / secrets / environment dependencies: Prisma DB access; queue access via `createJob`; writes `logs/daily/*.json`
- What it actually does: Validates content, identifies content gaps, checks media quality, aggregates yesterday's performance metrics, deletes old background jobs, and enqueues FSRS optimization.
- Operational category: `content/data maintenance`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/aggregate-analytics.ts`, `functions/api/cron/aggregate-distributions.ts`, `scripts/automation/jobs/platformStatistics.ts`, `scripts/automation/jobs/contentStatistics.ts`, `lib/services/queue/jobQueue.ts`
- Recommendation bucket: `refactor`

### Weekly Automation Tasks
- Name: `Weekly Automation Tasks`
- Location: `scripts/automation/weeklyTasks.ts`
- Trigger type: script entrypoint invoked by GitHub Actions
- Current cadence if any: file comment says `0 2 * * 0`; actual workflow cadence is `22 7 * * 0`
- Inputs / secrets / environment dependencies: Prisma DB access; `npm run maintenance:weekly`; writes `logs/weekly/*.json` and `weekly-report-latest.txt`
- What it actually does: Launches the broad weekly maintenance suite, runs database/content audits, identifies outdated content, aggregates weekly metrics, and writes a human-readable report.
- Operational category: `content/data maintenance`; `analytics/reporting`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/weekly-maintenance.ts`, `scripts/maintenance/orchestrator.ts`, weekly cron endpoints
- Recommendation bucket: `refactor`

### Monthly Automation Governance
- Name: `Monthly Automation Governance`
- Location: `scripts/automation/monthlyGovernance.ts`
- Trigger type: script entrypoint invoked by GitHub Actions
- Current cadence if any: monthly via `.github/workflows/automation-monthly-governance.yml`
- Inputs / secrets / environment dependencies: Node shell access; `npm audit`; `scripts/cron/drift-detector.ts`; writes `logs/monthly/*.json`
- What it actually does: Runs drift detection plus a production-dependency vulnerability snapshot and saves a governance report.
- Operational category: `repo maintenance only`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `scripts/cron/drift-detector.ts`, `audit:*` package scripts
- Recommendation bucket: `refactor`

### Platform Statistics Job
- Name: `Platform Statistics Job`
- Location: `scripts/automation/jobs/platformStatistics.ts`
- Trigger type: helper script; not wired directly by a live scheduler
- Current cadence if any: file comment says daily at `2 AM UTC`
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Computes DAU/WAU/MAU, retention, session, and FSRS metrics into `PlatformStatistics`.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/aggregate-analytics.ts`, `scripts/automation/dailyTasks.ts`
- Recommendation bucket: `merge`

### Content Statistics Job
- Name: `Content Statistics Job`
- Location: `scripts/automation/jobs/contentStatistics.ts`
- Trigger type: helper script; not wired directly by a live scheduler
- Current cadence if any: file comment says daily at `3 AM UTC`
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Computes condition-level usage and accuracy metrics into `ContentStatistics`.
- Operational category: `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/aggregate-analytics.ts`, `scripts/automation/dailyTasks.ts`
- Recommendation bucket: `merge`

### User Profile Enrichment Job
- Name: `User Profile Enrichment Job`
- Location: `scripts/automation/jobs/userProfileEnrichment.ts`
- Trigger type: helper script; not wired directly by a live scheduler
- Current cadence if any: file comment says daily at `3 AM UTC`
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Backfills chronotype, peak hour, session-length, learning-velocity, and metacognition style fields in `UserLearningProfile`.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `functions/api/cron/daily-prescription.ts`, `functions/api/cron/generate-daily-plans.ts`, `functions/api/cron/generate-daily-insights.ts`
- Recommendation bucket: `merge`

### Health / User Stats Helper Family
- Name: `Health Checks and User Statistics Helper Family`
- Location: `scripts/automation/jobs/healthChecks.ts`; `scripts/automation/jobs/userStatistics.ts`; `scripts/automation/jobs/index.ts`
- Trigger type: helper modules only
- Current cadence if any: implied hourly/daily/weekly from file comments and exports; not directly scheduler-wired
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Exposes reusable health checks, streak updates, due-card calculations, recommendations, weekly reports, and smoke-test helpers that the higher-level scripts can call.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `scripts/automation/hourlyTasks.ts`, `scripts/automation/dailyTasks.ts`, `scripts/system-health.ts`, daily personalization endpoints
- Recommendation bucket: `merge`

### FSRS Optimization Helper Job
- Name: `FSRS Parameter Optimization`
- Location: `scripts/automation/jobs/fsrsOptimization.ts`
- Trigger type: helper module used by the background worker
- Current cadence if any: file comment says weekly batch optimization; actual execution is queue-driven after `scripts/automation/dailyTasks.ts` schedules a job for next `3 AM`
- Inputs / secrets / environment dependencies: Prisma DB access; FSRS optimizer
- What it actually does: Finds eligible users and runs personalized FSRS v6 parameter optimization.
- Operational category: `production/runtime-facing`; `analytics/reporting`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: `lib/services/queue/jobQueue.ts` `scheduleFSRSOptimization()`, `scripts/backgroundWorker.ts`
- Recommendation bucket: `merge`

### Weekly Maintenance Suite
- Name: `Weekly Maintenance Suite`
- Location: `scripts/weekly-maintenance.ts`
- Trigger type: shell script entrypoint called by `scripts/automation/weeklyTasks.ts`
- Current cadence if any: weekly, but only because the weekly workflow calls it transitively
- Inputs / secrets / environment dependencies: `GEMINI_API_KEY`, Prisma DB access, `content-doctor:*`, `standardize:formatting*`, `assess:adequacy*`
- What it actually does: Runs gap analysis, AI content generation, formatting standardization, field enhancement, structure validation, and a health check in one mutative pass.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `functions/api/cron/content-quality-loop.ts`, `scripts/db/enrich-critical-conditions.ts`, `scripts/db/auto-deprecate-flagged-questions.ts`
- Recommendation bucket: `manual-only`

### System Health Check Script
- Name: `System Health & Monitoring Check`
- Location: `scripts/system-health.ts`
- Trigger type: operator script
- Current cadence if any: none; local/manual only
- Inputs / secrets / environment dependencies: local `.env`; optional remote health endpoint; `npm audit`; `tsc`; Prisma validation
- What it actually does: Verifies environment, TypeScript build, Prisma client, dependencies, and optionally remote health.
- Operational category: `repo maintenance only`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `scripts/automation/hourlyTasks.ts`, `scripts/automation/jobs/healthChecks.ts`, CI
- Recommendation bucket: `manual-only`

### Automated Content Pipeline
- Name: `Automated Content Pipeline`
- Location: `scripts/runAutomatedPipeline.ts`
- Trigger type: operator script
- Current cadence if any: none; manual only
- Inputs / secrets / environment dependencies: underlying `services/automatedContentPipeline`
- What it actually does: Orchestrates content ingestion, gap identification, sourcing, validation, generation, and DB optimization.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/weekly-maintenance.ts`, `scripts/orchestrate.ts`, `scripts/maintenance/orchestrator.ts`
- Recommendation bucket: `manual-only`

### Database Automation Orchestrator
- Name: `Database Automation Orchestrator`
- Location: `scripts/orchestrate.ts`
- Trigger type: operator script
- Current cadence if any: none; manual only
- Inputs / secrets / environment dependencies: registry sync, DB validation, content generation scripts
- What it actually does: Runs registry sync, validation, quality checks, relationship validation, dedupe, and content generation in sequence.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/maintenance/orchestrator.ts`, `scripts/weekly-maintenance.ts`, `db:*` package scripts
- Recommendation bucket: `manual-only`

### Master Database Orchestrator
- Name: `Master Database Orchestrator`
- Location: `scripts/maintenance/orchestrator.ts`
- Trigger type: operator script; also called by the weekly GitHub lane via `npm run db:orchestrate`
- Current cadence if any: indirectly weekly via `.github/workflows/automation-weekly-maintenance.yml`
- Inputs / secrets / environment dependencies: registry sync, DB validation, optional repair, DB-to-local write-back
- What it actually does: Executes the "Health & Sync" cycle: local registry sync, validation, optional repair, and DB-to-local write-back.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/orchestrate.ts`, `scripts/weekly-maintenance.ts`, `sync:all-registries`, `db:sync-to-registry`
- Recommendation bucket: `manual-only`

### Emergency Backup
- Name: `Emergency Backup`
- Location: `scripts/emergency_backup.ts`
- Trigger type: script entrypoint invoked by the weekly GitHub lane
- Current cadence if any: indirectly weekly via `.github/workflows/automation-weekly-maintenance.yml`
- Inputs / secrets / environment dependencies: Prisma DB access; local filesystem write access to `backups/**`
- What it actually does: Iterates over many tables and writes JSON snapshots into a timestamped local backup directory.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `no`
- Likely overlap with: deployment backup expectations; no automated restore verification path is present
- Recommendation bucket: `keep`

### Emergency Restore
- Name: `Emergency Restore`
- Location: `scripts/emergency_restore.ts`
- Trigger type: manual operator script
- Current cadence if any: none; manual only
- Inputs / secrets / environment dependencies: Prisma DB access; `BACKUP_FOLDER` environment variable or hard-coded folder selection
- What it actually does: Replays JSON backup files into many tables using Prisma upserts.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/emergency_backup.ts`
- Recommendation bucket: `manual-only`

### Legacy Local Scheduler
- Name: `Job Scheduler (retired local cron path)`
- Location: `scripts/scheduleJobs.ts`
- Trigger type: local cron or manual CLI
- Current cadence if any: file still documents `0 0 * * *`; repository docs say local cron is retired
- Inputs / secrets / environment dependencies: Prisma DB access; queue scheduling helpers
- What it actually does: Schedules nightly health-check and question-generation queue jobs and deletes old jobs, but only for the old local cron architecture.
- Operational category: `repo maintenance only`
- Safe for unattended schedule?: `no`
- Idempotent?: `conditionally`
- Likely overlap with: scheduled GitHub workflows, `lib/services/queue/jobQueue.ts`, `scripts/contentHealthChecker.ts`, `scripts/cleanupJobs.ts`
- Recommendation bucket: `remove`

### Legacy Content Health Checker
- Name: `Content Health Checker`
- Location: `scripts/contentHealthChecker.ts`
- Trigger type: local cron or manual CLI
- Current cadence if any: historical nightly; file is explicitly marked deprecated
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Audits published content for placeholders, missing sections, broken media references, and missing basic science links.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `functions/api/cron/compute-content-health.ts`, `functions/api/cron/nightly-health-check.ts`, `scripts/automation/hourlyTasks.ts`
- Recommendation bucket: `remove`

### Legacy Job Cleanup
- Name: `Cleanup Old Jobs`
- Location: `scripts/cleanupJobs.ts`
- Trigger type: local cron or manual CLI
- Current cadence if any: historical weekly `0 4 * * 0`; file is explicitly marked deprecated
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Deletes completed and failed `BackgroundJob` rows older than a retention threshold.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `scripts/automation/dailyTasks.ts` cleanup block; `lib/services/queue/jobQueue.ts` cleanup
- Recommendation bucket: `remove`

### Drift Detector
- Name: `AI Content Drift Detector`
- Location: `scripts/cron/drift-detector.ts`
- Trigger type: operator script; also called by monthly governance
- Current cadence if any: file comment says weekly via GitHub Actions or cron; currently only invoked monthly through `scripts/automation/monthlyGovernance.ts`
- Inputs / secrets / environment dependencies: `DIRECT_DATABASE_URL` or `DATABASE_URL`; Prisma PG adapter
- What it actually does: Flags stale content, high-error questions, and high-velocity topics that may need regeneration.
- Operational category: `analytics/reporting`; `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `yes`
- Likely overlap with: monthly governance, `functions/api/cron/compute-content-health.ts`, `functions/api/cron/nightly-health-check.ts`
- Recommendation bucket: `refactor`

### Deprecated Cache Warmer
- Name: `Cache Warmer`
- Location: `functions/cache-warmer.ts`
- Trigger type: Cloudflare Worker `scheduled()` handler; deprecated
- Current cadence if any: none in current architecture
- Inputs / secrets / environment dependencies: `DATABASE_URL`, optional `CACHE` KV, `REQUIRE_APPROVED_QUESTIONS`
- What it actually does: Warms condition and question-pool cache keys, but the file is explicitly retained only as a historical/manual reference because Pages cron is not used here.
- Operational category: `production/runtime-facing`
- Safe for unattended schedule?: `no`
- Idempotent?: `conditionally`
- Likely overlap with: `wrangler.toml` cache-warming note; retired scheduler path
- Recommendation bucket: `remove`

### Background Worker Process
- Name: `Background Worker Process`
- Location: `scripts/backgroundWorker.ts`
- Trigger type: long-running daemon / system service
- Current cadence if any: poll loop every `5000ms`
- Inputs / secrets / environment dependencies: Prisma DB access; `BackgroundJob` queue; `JOB_QUEUE_POLL_INTERVAL`; worker host
- What it actually does: Polls the database queue and processes `generate_questions`, `health_check`, `media_processing`, `sync_operation`, `ai_quality_check`, `duplicate_detection`, and `fsrs_optimization` jobs.
- Operational category: `production/runtime-facing`; `queue/background worker code`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `lib/services/queue/jobQueue.ts`, `scripts/scheduleJobs.ts`, `scripts/automation/dailyTasks.ts`, `deployment/systemd/panacea-worker.service`
- Recommendation bucket: `keep`

### Background Job Queue Service
- Name: `Background Job Queue Service`
- Location: `lib/services/queue/jobQueue.ts`
- Trigger type: library; queue scheduler/helpers
- Current cadence if any: embeds `getNext3AM()` and random `2-5 AM` low-traffic scheduling logic
- Inputs / secrets / environment dependencies: Prisma-compatible DB client
- What it actually does: Creates, fetches, retries, and cleans up `BackgroundJob` rows and includes helper methods for scheduling question generation, nightly health checks, and FSRS optimization.
- Operational category: `production/runtime-facing`; `queue/background worker code`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: GitHub Actions scheduler, `scripts/scheduleJobs.ts`, `scripts/backgroundWorker.ts`
- Recommendation bucket: `refactor`

### Background Worker Systemd Service
- Name: `PANaCEa Background Job Worker`
- Location: `deployment/systemd/panacea-worker.service`
- Trigger type: system service
- Current cadence if any: always-on process with `Restart=always`
- Inputs / secrets / environment dependencies: `/opt/PANaCEa/.env`; `BACKGROUND_WORKER_ENABLED=true`; `JOB_QUEUE_POLL_INTERVAL=5000`
- What it actually does: Runs `npx tsx scripts/backgroundWorker.ts` as a supervised Linux service.
- Operational category: `production/runtime-facing`; `queue/background worker code`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/backgroundWorker.ts`, PM2 guidance in `deployment/README.md`
- Recommendation bucket: `keep`

### Offline Background Sync Surface
- Name: `Offline Background Sync Surface`
- Location: `public/sw.js`; `public/service-worker.js`; `lib/services/sync/syncManager.ts`; `services/pwaEnhancer.ts`; `lib/utils/serviceWorkerRegistration.ts`
- Trigger type: browser `Background Sync`, push events, service-worker registration
- Current cadence if any: event-driven only; retries when connectivity returns
- Inputs / secrets / environment dependencies: service worker support; IndexedDB; browser Push/Background Sync APIs
- What it actually does: Queues question attempts and review submissions offline, then retries them via service worker when connectivity resumes.
- Operational category: `production/runtime-facing`; `queue/background worker code`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `conditionally`
- Likely overlap with: duplicate service-worker implementations in `public/sw.js` and `public/service-worker.js`
- Recommendation bucket: `refactor`

### DB Monitoring / Audit Family
- Name: `DB Monitoring and Audit Family`
- Location: `scripts/db/data-integrity-monitor.ts`; `scripts/db/content-completeness-dashboard.ts`; `scripts/db/audit-user-progress.ts`
- Trigger type: operator scripts
- Current cadence if any: none live; report-style scripts suitable for daily/weekly manual or scheduler use
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Produces health/completeness/orphan/staleness reports for content, question linkage, media coverage, and FSRS/user progress.
- Operational category: `content/data maintenance`; `analytics/reporting`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: `scripts/automation/dailyTasks.ts`, `scripts/automation/weeklyTasks.ts`, `functions/api/cron/compute-content-health.ts`, `functions/api/cron/nightly-health-check.ts`
- Recommendation bucket: `manual-only`

### DB Mutative Quality Family
- Name: `DB Mutative Quality Family`
- Location: `scripts/db/auto-deprecate-flagged-questions.ts`; `scripts/db/enrich-critical-conditions.ts`; `scripts/db/unify-condition-medicalcontent.ts`; `scripts/db/link-questions-to-conditions.ts`
- Trigger type: operator scripts
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: Prisma DB access; some members require `GEMINI_API_KEY`
- What it actually does: Deprecates heavily flagged questions, AI-enriches stub content, creates/fixes content rows, and backfills question-to-condition links.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/weekly-maintenance.ts`, `functions/api/cron/content-quality-loop.ts`, `scripts/orchestrate.ts`
- Recommendation bucket: `manual-only`

### DB Normalization / Repair Family
- Name: `DB Normalization and Repair Family`
- Location: `scripts/db/normalize-formatting-unified.ts`; `scripts/db/normalize-formatting.ts`; `scripts/db/normalize-systems.ts`; `scripts/db/fix-optional-nulls.ts`; `scripts/db/revert-none-to-null.ts`; `scripts/db/apply-fulltext-search.ts`; `scripts/db/backfill-search-vector.ts`; `scripts/db/consolidate-condition-hierarchy.ts`
- Trigger type: operator scripts
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: Prisma DB access; some members need `DIRECT_DATABASE_URL`
- What it actually does: Normalizes DB field formats, repairs enum/system naming mismatches, applies search migrations, backfills search vectors, and repairs content hierarchy.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `scripts/maintenance/orchestrator.ts`, `scripts/orchestrate.ts`, deployment migration flow
- Recommendation bucket: `manual-only`

### Image Acquisition Planning Family
- Name: `Image Acquisition Planning Family`
- Location: `scripts/images/image-acquisition-workflow.ts`; `scripts/images/CLINE_IMAGE_TASK.md`; `scripts/images/IMAGE_SOURCE_STRATEGY.md`
- Trigger type: operator scripts/docs
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: Prisma DB access
- What it actually does: Plans condition/system image-acquisition work, shows status/list outputs, and documents source strategy.
- Operational category: `content/data maintenance`
- Safe for unattended schedule?: `yes`
- Idempotent?: `yes`
- Likely overlap with: all fetch/process image families
- Recommendation bucket: `manual-only`

### Image Fetch Family
- Name: `Image Fetch Family`
- Location: `scripts/images/clinical-image-fetcher.ts`; `scripts/images/bulk-image-fetcher.ts`; `scripts/images/fetch-curated-images.ts`; `scripts/images/fetch-medical-images.ts`; `scripts/images/fetch-online-images.ts`; `scripts/images/fetch-ecg-images.ts`; `scripts/images/fetch-xray-images.ts`; `scripts/images/fetch-ct-images.ts`; `scripts/images/fetch-mri-images.ts`; `scripts/images/fetch-derm-images.ts`; `scripts/images/fetch-other-images.ts`
- Trigger type: operator scripts
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: combinations of `IMAGESORCERY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `GEMINI_API_KEY`
- What it actually does: Pulls external medical imagery from ImageSorcery, Wikimedia, OpenI, curated sources, and other open datasets for quiz/reference use.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: image processing and audit families; `images:*` package scripts
- Recommendation bucket: `manual-only`

### Image Processing Family
- Name: `Image Processing Family`
- Location: `scripts/images/process-curated-images.ts`; `scripts/images/process-curated-strict.ts`; `scripts/images/process-images-pipeline.ts`; `scripts/images/process-local-images.ts`; `scripts/images/image-analyzer.ts`; `scripts/images/image-cropper.ts`; `scripts/images/upload-helper.ts`
- Trigger type: operator scripts and helper modules
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, local filesystem image corpus, optional `sharp`
- What it actually does: Analyzes, crops, validates, deduplicates, and uploads clinical images for quiz use, sometimes with AI gating.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: image fetch family, image audit/cleanup family
- Recommendation bucket: `manual-only`

### Image Audit / Cleanup Family
- Name: `Image Audit and Cleanup Family`
- Location: `scripts/images/audit-and-clean-images.ts`; `scripts/images/audit-db-images.ts`; `scripts/images/delete-unreviewed-images.ts`
- Trigger type: operator scripts
- Current cadence if any: none live
- Inputs / secrets / environment dependencies: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `GEMINI_API_KEY`, Prisma DB access
- What it actually does: Reviews or deletes existing media assets based on AI analysis, missing metadata, or condition mismatch.
- Operational category: `content/data maintenance`; `dangerous to run unattended`
- Safe for unattended schedule?: `no`
- Idempotent?: `unclear`
- Likely overlap with: image processing family; content quality workflows
- Recommendation bucket: `manual-only`

### Cloud Agent Entry Family
- Name: `Cloud Agent Entry Family`
- Location: `scripts/cloud-agents/trigger.ts`; `scripts/cloud-agents/bulk-repos.ts`; `scripts/cloud-agents/run-from-ci.ts`
- Trigger type: manual CLI or CI-triggered entrypoints
- Current cadence if any: none scheduled
- Inputs / secrets / environment dependencies: `CURSOR_AGENTS_API_KEY`; optional repo/branch/changed-file context
- What it actually does: Launches Cursor Cloud Agents for manual tasks, multi-repo batches, or GitHub Actions path-triggered jobs.
- Operational category: `cloud-agent related`
- Safe for unattended schedule?: `conditionally`
- Idempotent?: `unclear`
- Likely overlap with: `.github/workflows/cloud-agents.yml`, CodeRabbit/GitHub review automation
- Recommendation bucket: `manual-only`

## High-Risk Unattended Jobs

- `functions/api/cron/push-reminders.ts`: sends real push notifications; incorrect cadence or duplicate firing directly impacts users.
- `functions/api/cron/batch-generate-questions.ts`: AI-heavy content creation with staging side effects and cost implications.
- `functions/api/cron/generate-variants.ts`: mutates question supply and can generate large volumes of AI content.
- `functions/api/cron/content-quality-loop.ts`: can flag/regenerate content automatically based on psychometric thresholds.
- `scripts/weekly-maintenance.ts`: broad AI-driven mutation pass across content quality, formatting, and regeneration.
- `scripts/db/enrich-critical-conditions.ts`: writes AI-generated medical content directly to the database.
- `scripts/db/auto-deprecate-flagged-questions.ts`: changes question validation/availability based on traffic-derived flags.
- `scripts/emergency_restore.ts`: destructive recovery path; absolutely not safe for unattended use.
- `scripts/images/audit-and-clean-images.ts`, `scripts/images/delete-unreviewed-images.ts`: can delete or reassign production media.
- `scripts/backgroundWorker.ts`: always-on runtime automation that executes mixed job types with side effects; safe only with monitoring and queue hygiene.

## Redundant or Overlapping Responsibilities

| Responsibility | Overlapping surfaces | Notes |
| --- | --- | --- |
| Platform/content health checks | `scripts/automation/hourlyTasks.ts`; `scripts/automation/jobs/healthChecks.ts`; `scripts/system-health.ts`; `scripts/contentHealthChecker.ts`; `functions/api/cron/compute-content-health.ts`; `functions/api/cron/nightly-health-check.ts` | Too many places can claim ownership of "health" without a single canonical metric path. |
| Daily analytics and rollups | `scripts/automation/dailyTasks.ts`; `functions/api/cron/aggregate-analytics.ts`; `functions/api/cron/aggregate-distributions.ts`; `scripts/automation/jobs/platformStatistics.ts`; `scripts/automation/jobs/contentStatistics.ts` | Current daily lane already mixes repo-side reports with production-side rollups. |
| Personalization / daily plan generation | `functions/api/cron/daily-prescription.ts`; `functions/api/cron/generate-daily-insights.ts`; `functions/api/cron/generate-daily-plans.ts`; `scripts/automation/jobs/userProfileEnrichment.ts`; `scripts/automation/jobs/userStatistics.ts` | Similar user-level enrichment and recommendation work is split across multiple endpoints and helpers. |
| Reservoir/question-supply maintenance | `functions/api/cron/reservoir-maintenance.ts`; `functions/api/cron/replenish-pool.ts`; `functions/api/cron/batch-generate-questions.ts`; `functions/api/cron/generate-variants.ts`; `scripts/backgroundWorker.ts` | Supply health, refill, generation, and reporting are spread across separate surfaces with partial overlap. |
| FSRS optimization scheduling | `scripts/automation/dailyTasks.ts`; `lib/services/queue/jobQueue.ts`; `scripts/backgroundWorker.ts`; `scripts/automation/jobs/fsrsOptimization.ts` | GitHub Actions enqueues a worker job, while the queue library itself also encodes its own next-`3 AM` schedule logic. |
| Weekly DB/content maintenance | `.github/workflows/automation-weekly-maintenance.yml`; `scripts/automation/weeklyTasks.ts`; `scripts/weekly-maintenance.ts`; `scripts/orchestrate.ts`; `scripts/maintenance/orchestrator.ts`; several `scripts/db/**` families | Multiple orchestrators exist with overlapping validation/repair/generation scope. |
| Service-worker sync | `public/sw.js`; `public/service-worker.js`; `lib/services/sync/syncManager.ts` | Only `/sw.js` is registered by current client code, but a second service worker still contains overlapping sync logic. |
| Cloud agent automation | `.github/workflows/cloud-agents.yml`; `scripts/cloud-agents/run-from-ci.ts`; `scripts/cloud-agents/trigger.ts`; `scripts/cloud-agents/bulk-repos.ts` | Automation-adjacent review/fix tasks exist in both workflow and manual CLI form. |

## Gaps in Automation Coverage

- `functions/api/cron/analyze-exam-outcomes.ts`, `functions/api/cron/compute-content-health.ts`, `functions/api/cron/generate-daily-plans.ts`, `functions/api/cron/nightly-health-check.ts`, `functions/api/cron/generate-variants.ts`, `functions/api/cron/populate-prerequisites.ts`, `functions/api/cron/xapi-export.ts`, and `functions/api/cron/batch-generate-questions.ts` exist but have no current scheduler reference from the active GitHub Actions lanes.
- `scripts/automation/jobs/platformStatistics.ts`, `scripts/automation/jobs/contentStatistics.ts`, and `scripts/automation/jobs/userProfileEnrichment.ts` advertise daily cadences in comments but are not directly wired to the live scheduler.
- There is no visible dead-man switch or missed-run alerting for the GitHub Actions lanes.
- There is no explicit restore-verification automation even though `scripts/emergency_backup.ts` is scheduled indirectly each week.
- Background worker health is runtime-critical, but the repo does not expose a canonical heartbeat or watchdog job for `scripts/backgroundWorker.ts`.
- Service-worker background sync is important for offline correctness, but there is no dedicated recurring audit/verification job that validates the active SW path and queue integrity.
- Before this file, the repo had no single canonical inventory of current automation ownership and live schedule mappings.

## Observability / Safety Gaps

- Most script-based automation writes local JSON or text reports to `logs/**`, but there is no central alert routing in the repo.
- `scripts/backgroundWorker.ts` has no in-repo heartbeat, queue-depth alert, or lag monitor beyond raw DB/job counts.
- `functions/api/cron/push-reminders.ts` is user-visible and non-idempotent, but the scheduled workflow only preserves an HTTP log artifact; there is no explicit notification delivery/audit dashboard surfaced here.
- Several mutative AI/content scripts lack strong approval gates or dry-run requirements before they are safe to schedule.
- Multiple endpoints still describe Cloudflare scheduled handlers even though `wrangler.toml` explicitly says Pages cron triggers are not supported in this repo.
- Deprecated local-cron docs remain in `deployment/cron/README.md`, including runnable examples, which increases operator confusion.
- Export/auth mismatches in some unwired cron files mean they can look "done" while still being operationally nonfunctional.

## Time/Comment Mismatches or Suspicious Cron Definitions

- `scripts/automation/hourlyTasks.ts` says `Schedule: 0 * * * *`, but `.github/workflows/automation-platform-health.yml` runs it at `17 * * * *`.
- `scripts/automation/dailyTasks.ts` says `Schedule: 0 3 * * *`, but `.github/workflows/automation-daily-analytics.yml` runs it at `40 3 * * *`.
- `scripts/automation/weeklyTasks.ts` says `Schedule: 0 2 * * 0`, but `.github/workflows/automation-weekly-maintenance.yml` runs it at `22 7 * * 0`.
- `functions/api/cron/aggregate-analytics.ts` says "Called by: Cloudflare Scheduled Handler at 2 AM UTC", but it is currently called by `.github/workflows/automation-daily-analytics.yml` at `40 3 * * *`.
- `functions/api/cron/daily-prescription.ts` says "Called by: Cloudflare Scheduled Handler at 6 AM UTC", but it is currently called at `10 3 * * *`.
- `functions/api/cron/replenish-pool.ts` says "Called by: Cloudflare Scheduled Handler at 3 AM UTC", but it is currently called every two hours at `25 */2 * * *`.
- `functions/api/cron/push-reminders.ts` says "Designed to run every 2 hours", but the live daily personalization lane currently calls it only once daily.
- `functions/api/cron/calibrate-items.ts` says "Designed to run daily", but the live weekly lane runs it weekly.
- `functions/api/cron/generate-variants.ts` says "Called by: Cloudflare Scheduled Handler at 4 AM UTC", but there is no current scheduler reference.
- `functions/api/cron/populate-prerequisites.ts` says it is "Designed to run weekly via Cloudflare Cron Triggers", but it is implemented as `authenticatedEndpoint(...)`, not a shared-secret cron endpoint.
- `wrangler.toml` explicitly says Pages cron triggers are not supported and that external schedulers should call endpoints, which conflicts with several cron-file comments.
- `deployment/cron/README.md` calls the local cron surface retired, but still contains runnable cron snippets and systemd timer advice.
- Positive finding: all current GitHub scheduled workflows avoid top-of-hour scheduling, which reduces collision risk.

## Node/Runtime Inconsistencies Across Workflows

- Current alignment is good:
  - `package.json` engines: `>=22.0.0`
  - `.node-version`: `22`
  - `.nvmrc`: `22`
  - current GitHub workflows: Node `22`
  - `wrangler.toml` `[vars] NODE_VERSION = "22"`
- Documentation drift still exists:
  - `deployment/systemd/README.md` still says "Node.js 18+ installed", which is now behind the repo standard.
- Runtime model split:
  - script/workflow automation expects full Node.js + Prisma access,
  - production cron endpoints run on Cloudflare Pages Functions and depend on `DATABASE_URL` plus `CRON_SECRET`,
  - some manual DB scripts use `DIRECT_DATABASE_URL` and the Prisma PG adapter (`scripts/db/normalize-systems.ts`, `scripts/db/verify-guidelines.ts`, `scripts/cron/drift-detector.ts`), which is a different runtime assumption than both the workflow lanes and the Pages cron endpoints.

## Relevant `package.json` Scripts

These are aliases/operator entrypoints that appear relevant to recurring operations, maintenance, auditing, generation, validation, cleanup, or reporting. When a script only wraps an already-inventoried file, it is listed here for completeness but not counted again as a distinct automation surface.

| Alias | Command target | Maps to / notes |
| --- | --- | --- |
| `worker` | `tsx ./scripts/backgroundWorker.ts` | Runtime background worker daemon. |
| `system-health` | `tsx ./scripts/system-health.ts` | Manual health verification. |
| `orchestrate:full` | `tsx ./scripts/runAutomatedPipeline.ts` | Broad automated content pipeline. |
| `orchestrate:context-aware` | `tsx ./scripts/runContextAwareOrchestration.ts` | Automation-adjacent operator flow; not inventoried separately here. |
| `db:automate` | `tsx ./scripts/orchestrate.ts` | Database automation orchestrator. |
| `db:automate:quick` | `tsx ./scripts/orchestrate.ts --quick` | Variant of same orchestrator. |
| `db:automate:skip-gen` | `tsx ./scripts/orchestrate.ts --skip-generation` | Variant of same orchestrator. |
| `db:orchestrate` | `tsx ./scripts/maintenance/orchestrator.ts` | Master DB orchestrator. |
| `db:sync-to-registry` | `tsx ./scripts/sync_db_to_registry.ts` | Write-back phase used by DB orchestration. |
| `db:validate` | `tsx ./scripts/validate_database.ts` | Validation step used by orchestration. |
| `db:quality` | `tsx ./scripts/check_content_quality.ts` | Content quality operator script. |
| `db:relationships` | `tsx ./scripts/validate_relationships.ts` | Relationship validation operator script. |
| `db:deduplicate` | `tsx ./scripts/deduplicate.ts` | Duplicate cleanup operator script. |
| `db:generate-content` | `tsx ./scripts/generate_content.ts` | AI content-generation operator script. |
| `db:backup` | `tsx ./scripts/emergency_backup.ts` | Weekly workflow calls this directly. |
| `db:restore` | `tsx ./scripts/emergency_restore.ts` | High-risk manual restore path. |
| `db:unify` | `tsx ./scripts/db/unify-condition-medicalcontent.ts` | DB mutative quality family. |
| `db:link-questions` | `tsx ./scripts/db/link-questions-to-conditions.ts` | DB mutative quality family. |
| `db:health` | `tsx ./scripts/db/data-integrity-monitor.ts` | DB monitoring/audit family. |
| `db:fulltext-search` | `tsx ./scripts/db/apply-fulltext-search.ts` | DB normalization/repair family. |
| `db:completeness` | `tsx ./scripts/db/content-completeness-dashboard.ts` | DB monitoring/audit family. |
| `db:enrich` | `tsx ./scripts/db/enrich-critical-conditions.ts` | High-risk AI DB enrichment. |
| `db:enrich-template` | `tsx ./scripts/db/generate-enrichment-template.ts` | Manual enrichment prep. |
| `db:apply-enrichment` | `tsx ./scripts/db/apply-enrichment.ts` | Manual enrichment apply. |
| `db:deprecate-flagged` | `tsx ./scripts/db/auto-deprecate-flagged-questions.ts` | High-risk mutative quality script. |
| `db:audit-progress` | `tsx ./scripts/db/audit-user-progress.ts` | DB monitoring/audit family. |
| `sync:all-registries` | `tsx ./scripts/syncAllRegistries.ts` | DB orchestration dependency. |
| `automation:hourly` | `tsx ./scripts/automation/hourlyTasks.ts` | Live scheduled via GitHub Actions. |
| `automation:daily` | `tsx ./scripts/automation/dailyTasks.ts` | Live scheduled via GitHub Actions. |
| `automation:weekly` | `tsx ./scripts/automation/weeklyTasks.ts` | Live scheduled via GitHub Actions. |
| `automation:monthly` | `tsx ./scripts/automation/monthlyGovernance.ts` | Live scheduled via GitHub Actions. |
| `stats:platform` | `tsx ./scripts/automation/jobs/platformStatistics.ts` | Explicit daily-intent helper job; not wired live. |
| `stats:content` | `tsx ./scripts/automation/jobs/contentStatistics.ts` | Explicit daily-intent helper job; not wired live. |
| `maintenance:weekly` | `tsx ./scripts/weekly-maintenance.ts` | High-risk weekly content mutation suite. |
| `maintenance:weekly:dry-run` | `tsx ./scripts/weekly-maintenance.ts --dry-run` | Safer operator variant. |
| `content-doctor:phase1` | `tsx ./scripts/content-doctor.ts --phase1` | Used by weekly maintenance/operator flows. |
| `content-doctor:phase2` | `tsx ./scripts/content-doctor.ts --phase2` | Used by weekly maintenance/operator flows. |
| `content-doctor:buzzwords` | `tsx ./scripts/content-doctor.ts --buzzwords` | Manual field-enhancement flow. |
| `content-doctor:mnemonics` | `tsx ./scripts/content-doctor.ts --mnemonics` | Manual field-enhancement flow. |
| `content-doctor:guidelines` | `tsx ./scripts/content-doctor.ts --guidelines` | Manual field-enhancement flow. |
| `content-doctor:triads` | `tsx ./scripts/content-doctor.ts --triads` | Manual field-enhancement flow. |
| `content-doctor:pearls` | `tsx ./scripts/content-doctor.ts --pearls` | Manual field-enhancement flow. |
| `standardize:formatting` | `tsx ./scripts/standardize-formatting.ts` | Weekly maintenance/operator dependency. |
| `standardize:formatting:dry-run` | `tsx ./scripts/standardize-formatting.ts --dry-run` | Safer operator variant. |
| `standardize:formatting:regenerate` | `tsx ./scripts/standardize-formatting.ts --regenerate` | Mutative content formatting run. |
| `assess:adequacy` | `tsx ./scripts/assess-content-adequacy.ts` | Weekly maintenance/operator dependency. |
| `assess:adequacy:regenerate` | `tsx ./scripts/assess-content-adequacy.ts --regenerate` | Mutative content adequacy run. |
| `images:fetch` | `tsx ./scripts/images/clinical-image-fetcher.ts` | Image fetch family. |
| `images:fetch:dry-run` | `tsx ./scripts/images/clinical-image-fetcher.ts --dry-run` | Safer operator variant. |
| `images:upload` | `tsx ./scripts/images/upload-helper.ts upload` | Image processing family helper. |
| `images:batch` | `tsx ./scripts/images/upload-helper.ts batch` | Image processing family helper. |
| `images:test` | `tsx ./scripts/images/upload-helper.ts test` | Image helper test path. |
| `images:status` | `tsx ./scripts/images/image-acquisition-workflow.ts status` | Image acquisition planning family. |
| `images:list` | `tsx ./scripts/images/image-acquisition-workflow.ts list` | Image acquisition planning family. |
| `images:plan` | `tsx ./scripts/images/image-acquisition-workflow.ts plan` | Image acquisition planning family. |
| `images:plan-system` | `tsx ./scripts/images/image-acquisition-workflow.ts plan-system` | Image acquisition planning family. |
| `images:bulk` | `tsx ./scripts/images/bulk-image-fetcher.ts fetch` | Image fetch family. |
| `images:bulk-one` | `tsx ./scripts/images/bulk-image-fetcher.ts fetch-one` | Image fetch family. |
| `images:preview` | `tsx ./scripts/images/bulk-image-fetcher.ts preview` | Image fetch family preview mode. |
| `images:curated` | `tsx ./scripts/images/fetch-curated-images.ts` | Image fetch family. |
| `images:local` | `tsx ./scripts/images/process-local-images.ts` | Image processing family. |
| `verify:health` | `playwright test e2e/api-health.spec.ts` | Repo health validation; overlaps CI smoke. |
| `audit:prisma` | `tsx scripts/audit-prisma-disconnect.ts` | Repo-maintenance audit. |
| `audit:zod` | `tsx scripts/audit-zod-validation.ts` | Repo-maintenance audit. |
| `audit:loading` | `tsx scripts/audit-loading-states.ts` | Repo-maintenance audit. |
| `audit:services` | `tsx scripts/audit-service-consolidation.ts` | Repo-maintenance audit. |
| `audit:components` | `tsx scripts/audit-component-organization.ts` | Repo-maintenance audit. |
| `audit:design-system` | `tsx scripts/audit-design-system.ts` | Repo-maintenance audit. |
| `audit:design-system:strict` | `tsx scripts/audit-design-system.ts --strict` | Stricter audit variant. |
| `audit:all` | chained audit aliases | Aggregates several repo audits. |
| `agents:trigger` | `tsx scripts/cloud-agents/trigger.ts` | Cloud agent entry family. |
| `agents:bulk` | `tsx scripts/cloud-agents/bulk-repos.ts` | Cloud agent entry family. |

## Deep critique of current scheduled workflows

Note on scope:
- As of `2026-04-16`, `.github/workflows/hourly-automation.yml`, `.github/workflows/daily-automation.yml`, and `.github/workflows/weekly-automation.yml` are not present in the current tree.
- The critique below uses their last committed contents from git history because those are the workflow names explicitly requested and they explain why the current `automation-*` split-lane structure exists.
- `.github/workflows/cloud-agents.yml` is current, but it is no longer scheduled. It is included because it was explicitly requested and because it is automation-adjacent.

### `.github/workflows/hourly-automation.yml`

Retired predecessor of: `.github/workflows/automation-platform-health.yml`

1. GitHub schedule was a reasonable execution environment for the narrow task it actually performed. This workflow only ran `npm run automation:hourly`, so it behaved like a coarse external health-check runner rather than a latency-sensitive runtime scheduler.
2. An hourly cadence was broadly appropriate for DB/API/content availability checks. It was frequent enough to catch regressions without being so frequent that GitHub Actions overhead dominated the job.
3. The task mix was fairly coherent. Unlike the old daily and weekly workflows, this file was not trying to do unrelated production operations in one lane.
4. The cron timing was poor. `0 * * * *` is the worst minute to pick for a GitHub cron because it clusters with the rest of the planet's hourly jobs and increases jitter/collision risk.
5. Top-of-hour scheduling should have been avoided. A non-`:00` minute, exactly like the current `17 * * * *` platform-health lane, is materially better.
6. Permissions were not explicit. The file relied on default `GITHUB_TOKEN` permissions instead of declaring a minimal `contents: read`.
7. Concurrency controls were missing. An hourly job should not be allowed to overlap with a delayed manual rerun or a slow prior execution.
8. `timeout-minutes` was missing. For a health-check workflow this is unnecessary risk; a stuck `npm ci` or network call could leave the job hanging until GitHub kills it.
9. `continue-on-error` was not present, which was good. Health checks should fail loudly when they fail.
10. The workflow used Node `20`, which was already behind the repo standard (`package.json` engines `>=22.0.0`, `.node-version` `22`, CI `22`).
11. It did not need to be made manual-only or merged into a broader lane. It mainly needed operational hardening: explicit permissions, concurrency, timeout, and a better minute offset.
12. The only part that arguably belongs outside GitHub cron is "failed background job monitoring" as a primary alert source. A once-per-hour GitHub report is useful, but the queue/worker system should own real runtime alerting.

Verdict:
- `Keep as scheduled`
- Current-tree note: the successor `.github/workflows/automation-platform-health.yml` fixes most of the structural issues by using Node `22`, explicit permissions, concurrency, timeout, and a non-top-of-hour minute.

### `.github/workflows/daily-automation.yml`

Retired predecessors of its responsibilities:
- `.github/workflows/automation-daily-analytics.yml`
- `.github/workflows/automation-daily-personalization.yml`
- `.github/workflows/automation-reservoir-supply.yml`

1. GitHub schedule was only partly the right execution environment. It was fine for daily repo-hosted aggregation and for externally triggering bounded production endpoints, but it was the wrong place to hide multiple unrelated runtime concerns behind one daily wrapper.
2. The frequency was not appropriate for all included tasks. Daily analytics and daily prescriptions make sense once per day; `replenish-pool` does not. Question-supply maintenance is a higher-cadence operational concern, not a once-per-day batch concern.
3. The workflow mixed too many responsibilities together. One file combined repo-side daily audit/cleanup work with production analytics, personalization, and reservoir supply maintenance.
4. The `0 3 * * *` timing was superficially reasonable for batch work, but it was still blunt. It forced very different concerns into the same UTC window and gave user-facing tasks like reminders a global batch time instead of a user-local delivery strategy.
5. Top-of-hour scheduling should have been avoided here too. `0 3 * * *` is a collision-prone minute and created a sharp batch edge right when other cron systems also fire.
6. Permissions were not explicit. The workflow should have declared minimal permissions instead of inheriting defaults.
7. Concurrency controls were missing. A daily workflow that calls production cron endpoints should never risk overlapping manual reruns or delayed retries.
8. `timeout-minutes` was missing. That matters more here than in the hourly lane because the workflow was doing both `npm ci`/script work and remote HTTP calls.
9. `continue-on-error` was masking real failures. The cron API loop used both `curl ... || true` and `continue-on-error: true`, which meant endpoint failures could easily appear as "green" runs while daily data went stale.
10. The workflow used Node `20`, which did not match the repo runtime standard.
11. The correct direction was to split it, not merely harden it. Analytics, personalization, and reservoir supply are distinct automation domains with different cadences, blast radii, and ownership.
12. `replenish-pool` was the clearest task that did not belong in this daily GitHub cron bundle. It belongs in a separate higher-cadence external trigger or in queue/native supply orchestration. Daily prescriptions and analytics can remain scheduler-owned; supply health should not.

Verdict:
- `Split into smaller workflows`
- Current-tree note: the current split into `automation-daily-analytics.yml`, `automation-daily-personalization.yml`, and `automation-reservoir-supply.yml` is the right structural correction.

### `.github/workflows/weekly-automation.yml`

Retired predecessor of:
- `.github/workflows/automation-weekly-maintenance.yml`
- some governance/reporting responsibility now separated from the live weekly lane

1. GitHub schedule was a reasonable orchestrator for bounded weekly reporting, backups, and psychometric tasks, but it was the wrong home for one giant mutative maintenance suite with loosely related cleanup and operator-style orchestration mixed in.
2. Weekly cadence was appropriate for some tasks and questionable for others. Weekly psychometric analysis, summary reports, and backups are sensible; "health checks" are too important to live only in a weekly lane, and some AI-heavy maintenance steps may be too risky to run automatically every week.
3. The task mix was far too broad. This file combined health checks, user statistics, weekly reporting, the weekly script suite, database backup, DB orchestration, DB cleanup, and a summary-notification job.
4. The cron timing was suspiciously documented. The file said "2 AM EST" and used `0 7 * * 0`, which is only `2 AM` in Eastern Standard Time, not Eastern Daylight Time. It was a DST-fragile comment and a classic source of operator confusion.
5. Top-of-hour scheduling should have been avoided. `0 7 * * 0` is still a crowded minute and gave no collision buffer.
6. Permissions were not explicit, and secrets were exposed too broadly. The workflow placed `DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `SUPABASE_URL`, and `PRODUCTION_URL` at workflow scope, making them available to every job and step whether needed or not.
7. Concurrency controls were missing. A heavy weekly workflow especially needs a non-overlap guard because manual reruns and long-running prior executions are common.
8. `timeout-minutes` existed on the two heavy jobs, which was better than the old hourly/daily files, but the absence of a timeout on the final notification job and the excessive `continue-on-error` use meant timeout discipline did not translate into execution safety.
9. `continue-on-error` was masking real failures at multiple layers. The health-check step, weekly user-stats step, weekly script step, backup step, and DB orchestration step could all fail without turning the workflow red. The final grep-based "Check for failures" step then explicitly exited `0` even when it found failures.
10. The workflow used Node `20`, which was behind the repo standard.
11. It should not have remained one scheduled superworkflow. At minimum it needed to be split into separate maintenance, reporting, and backup lanes, with the most dangerous content-mutation tasks either downgraded to manual runs or isolated behind stronger safeguards.
12. Several tasks belonged outside this GitHub cron bundle. Background-job cleanup is queue/DB hygiene, not weekly reporting. Long-running content mutation and DB write-back are closer to operator-run orchestration or worker-native processing than to a blanket weekly cron. One step was also suspicious on its face: `npx tsx scripts/automation/jobs/healthChecks.ts --daily` targets a helper module with exports, not a clear CLI entrypoint.

Verdict:
- `Move some tasks out of GitHub cron`
- Current-tree note: the live weekly lane is directionally better, but it is still the scheduled workflow most likely to remain too broad and too mutative unless narrowed further.

### `.github/workflows/cloud-agents.yml`

Current file. Not scheduled in the current tree.

1. GitHub Actions is the right execution environment for this workflow, but only as event-driven and operator-triggered automation. It is not the right home for blind recurring cron execution because these jobs are primarily code-change, PR, or operator-context driven.
2. Frequency is appropriately "no schedule" right now. If a schedule were reintroduced for jobs like `security-sentinel`, it would likely be too blunt compared with event-driven triggers or explicit operator dispatch.
3. The workflow is conceptually mixed. One file currently covers edge/runtime review, living docs, asset/perf review, schema sync, E2E gap detection, PR review, and manual job dispatch. That is workable because setup is shared, but it is still multiple automation families in one file.
4. Cron timing is not applicable because the file has no `on.schedule`. That is a strength, not a gap.
5. Top-of-hour avoidance is also not applicable because the workflow should stay off cron.
6. Permissions are explicit and minimal. `contents: read` is a good default for a workflow that launches external agent jobs rather than directly mutating repo state in GitHub Actions.
7. Concurrency controls are present and broadly sensible, but there is a tradeoff. `cancel-in-progress: false` means superseded PR or push runs can stack up and launch stale agent work. That may be intentional for auditability, but it is still a throughput/cost consideration.
8. `timeout-minutes` is present and reasonable: `5` minutes for setup/helper jobs and `20` minutes for agent-launch jobs.
9. `continue-on-error` is absent, which is good. If an agent-launch path fails, the workflow should surface it rather than silently degrade.
10. The workflow uses Node `22`, which matches the repo standard.
11. The right long-term shape is partially manual, not scheduled. PR review and path-scoped guard jobs can stay automatic on `pull_request`/`push`; security-sentinel- or lint-fix-style jobs are stronger candidates for operator-only dispatch.
12. None of these tasks belong in app-native scheduling or queue processing. They are repository automation concerns, so GitHub events and manual Actions dispatch are the correct control plane.

Verdict:
- `Convert partially or fully to manual`
- Current-tree note: the absence of `on.schedule` is correct and should remain that way.

### Synthesis Against The Current Tree

- The current `automation-*` split-lane architecture materially improves on the retired hourly/daily/weekly files:
  - Node `22` is now aligned with repo standards.
  - permissions are explicit.
  - concurrency groups exist.
  - `timeout-minutes` is defined through the reusable lane.
  - top-of-hour scheduling is avoided.
  - daily responsibilities are no longer all forced into one file.
- The remaining architectural concern in the live tree is not "basic workflow hygiene" anymore; it is responsibility placement:
  - `.github/workflows/automation-weekly-maintenance.yml` is still the broadest and riskiest scheduled lane.
  - runtime-facing supply and personalization endpoints are still externally triggered from GitHub cron rather than from an app-native scheduler/queue boundary.
  - queue-backed background work exists (`scripts/backgroundWorker.ts`, `lib/services/queue/jobQueue.ts`), but GitHub cron is still acting as the outer scheduler for several runtime concerns.
