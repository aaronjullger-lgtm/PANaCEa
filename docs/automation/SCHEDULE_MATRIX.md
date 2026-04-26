# PANaCEa Future-State Schedule Matrix

Source of truth used for this design:
- `docs/automation/scheduled-jobs-audit.md`

Design intent:
- Separate repo maintenance from app/data maintenance.
- Separate reporting from mutation-heavy maintenance.
- Separate content audit from learning-model refresh.
- Replace broad hourly/daily/weekly catch-alls with purpose-based workflows.
- Keep GitHub cron only for safe, observable, idempotent, non-real-time work.
- Move user-critical real-time behavior toward app-native scheduling, queue ownership, or event-driven execution.

## 1. Proposed workflow portfolio

### `sched-runtime-sanity.yml`

Purpose:
- Hourly read-only runtime sanity checks against the PANaCEa platform and its external dependencies.

Exact cron recommendation:
- `17 * * * *`

Why that cadence is correct for this repo:
- The current `scripts/automation/hourlyTasks.ts` already covers the right class of work: DB connectivity, Gemini reachability, failed background-job counts, and content availability.
- These are operational signals, not end-user features, so hourly GitHub cron is acceptable.
- `:17` keeps the job off the top of the hour and preserves the current non-`:00` pattern that is already better than the old `0 * * * *`.

What tasks belong inside:
- The trimmed, read-only successor to `scripts/automation/hourlyTasks.ts`
- Safe dependency checks already present there:
  - database reachability
  - Gemini API reachability
  - failed background job count
  - content availability
- Optional remote smoke ping if added as a bounded check

What tasks explicitly do not belong inside:
- `functions/api/cron/push-reminders.ts`
- `functions/api/cron/reservoir-maintenance.ts`
- `functions/api/cron/replenish-pool.ts`
- any analytics rollup or daily report generation
- any repo hygiene task such as `npm audit`
- any mutation-heavy repair or content generation

Dependencies / secrets:
- `DATABASE_URL`
- `GEMINI_API_KEY`
- optional `PRODUCTION_URL` only if a bounded remote smoke check is added

Expected runtime class:
- `short`

Failure handling expectations:
- Fail hard on any failed check.
- Always upload JSON artifacts and write a step summary.
- Treat repeated failures as platform health incidents, not as informational noise.

### `sched-reservoir-supply.yml` (transitional exception)

Purpose:
- Keep live reservoir supply above minimum levels until this responsibility moves into app-native queue ownership.

Exact cron recommendation:
- `25 */2 * * *`

Why that cadence is correct for this repo:
- PANaCEa still depends on `reservoir-maintenance` and `replenish-pool` running often enough to keep queued question supply healthy.
- The current codebase still lacks the intended runtime-owned replacement in `lib/services/queue/jobQueue.ts` plus `scripts/backgroundWorker.ts`.
- `:25` keeps the lane off the top of the hour and away from the other live scheduled minutes.

What tasks belong inside:
- `functions/api/cron/reservoir-maintenance.ts`
- `functions/api/cron/replenish-pool.ts`

What tasks explicitly do not belong inside:
- `functions/api/cron/push-reminders.ts`
- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- analytics rollups, report generation, or repo hygiene checks

Dependencies / secrets:
- `PRODUCTION_URL`
- `CRON_SECRET`

Expected runtime class:
- `short`

Failure handling expectations:
- Fail on any non-2xx endpoint response.
- Preserve HTTP logs as artifacts and point operators to them in the step summary.
- Treat this as a documented transitional lane, not as the desired long-term scheduler home for reservoir ownership.

### `sched-daily-ops.yml`

Purpose:
- Daily operational data refresh for safe user-facing derived data and analytics ingestion.

Exact cron recommendation:
- `27 4 * * *`

Why that cadence is correct for this repo:
- PANaCEa already has daily batch-style work that is not real-time but does benefit from being fresh before the next usage window:
  - `functions/api/cron/aggregate-analytics.ts`
  - `functions/api/cron/aggregate-distributions.ts`
  - `functions/api/cron/daily-prescription.ts`
  - `functions/api/cron/generate-daily-insights.ts`
- Running after the overnight data window is appropriate.
- This lane should happen after any future daily learning-model refresh lane so prescriptions and insights can use fresh derived profile state.
- `:27` avoids the top-of-hour and leaves room before later audit/report lanes.

What tasks belong inside:
- `functions/api/cron/aggregate-analytics.ts`
- `functions/api/cron/aggregate-distributions.ts`
- `functions/api/cron/daily-prescription.ts`
- `functions/api/cron/generate-daily-insights.ts`
- a future extracted daily operational rollup script if `scripts/automation/dailyTasks.ts` is split into dedicated safe entrypoints

What tasks explicitly do not belong inside:
- `functions/api/cron/push-reminders.ts`
- `functions/api/cron/reservoir-maintenance.ts`
- `functions/api/cron/replenish-pool.ts`
- `functions/api/cron/content-quality-loop.ts`
- `scripts/weekly-maintenance.ts`
- `npm audit`
- queue cleanup, backup, restore, or repo-only checks

Dependencies / secrets:
- `PRODUCTION_URL`
- `CRON_SECRET`
- `DATABASE_URL` if any repo-hosted daily rollup script remains in scope

Expected runtime class:
- `medium`

Failure handling expectations:
- Core endpoint calls must fail the workflow.
- No `continue-on-error` on primary steps.
- Persist HTTP logs and any daily rollup artifacts.
- Manual rerun via `workflow_dispatch` should be the primary remediation path.

### `sched-daily-learning-models.yml`

Purpose:
- Daily refresh of low-risk learning-model inputs and derived learner-model state.

Exact cron recommendation:
- `13 3 * * *`

Why that cadence is correct for this repo:
- PANaCEa has several model-refresh surfaces that are not real-time but should stay fresher than weekly:
  - `scripts/automation/jobs/userProfileEnrichment.ts`
  - `functions/api/cron/calibrate-items.ts`
  - `functions/api/cron/generate-daily-plans.ts` after refactor
- The key repo-specific nuance is that these jobs should consume the previous day’s data and finish before daily prescriptions/insights are generated.
- `:13` puts the lane ahead of `sched-daily-ops.yml` without using a crowded `:00` start.

What tasks belong inside:
- A dedicated CLI wrapper around `scripts/automation/jobs/userProfileEnrichment.ts`
- a refactored incremental version of `functions/api/cron/calibrate-items.ts`
- a refactored, properly exported version of `functions/api/cron/generate-daily-plans.ts` only if it remains batch-oriented and non-real-time
- Longer-term only after incremental refactor:
  - `functions/api/cron/compute-item-metrics.ts` if it stops behaving like a weekly psychometric snapshot and becomes a true daily model-refresh input

What tasks explicitly do not belong inside:
- `functions/api/cron/push-reminders.ts`
- `functions/api/cron/content-quality-loop.ts`
- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- `scripts/weekly-maintenance.ts`
- repo maintenance audits

Dependencies / secrets:
- `DATABASE_URL`
- `PRODUCTION_URL`
- `CRON_SECRET`
- optional `CACHE` / KV-backed endpoint runtime where calibration writes summaries

Expected runtime class:
- `medium`

Failure handling expectations:
- This workflow should only contain idempotent or bounded-refresh tasks.
- If an incremental model-refresh step cannot yet be made safe and repeatable, it should stay out of this lane and remain manual-only until refactored.
- Failures should not silently fall through to stale prescriptions; the lane must be independently rerunnable.

### `sched-content-audit.yml`

Purpose:
- Daily read-only content health, completeness, and anomaly auditing.

Exact cron recommendation:
- `41 5 * * *`

Why that cadence is correct for this repo:
- The audit found multiple overlapping content-health surfaces:
  - `functions/api/cron/compute-content-health.ts`
  - `functions/api/cron/nightly-health-check.ts`
  - `scripts/db/data-integrity-monitor.ts`
  - `scripts/db/content-completeness-dashboard.ts`
  - `scripts/contentHealthChecker.ts` (retired)
- PANaCEa needs one canonical content-audit lane that produces artifacts and alerts without mutating content.
- Running after daily ops allows audits to observe settled daily rollups, but before weekly reporting so issues are visible throughout the week.

What tasks belong inside:
- the merged, read-only successor to `functions/api/cron/compute-content-health.ts`
- the merged, read-only successor to `functions/api/cron/nightly-health-check.ts`
- `scripts/db/data-integrity-monitor.ts`
- `scripts/db/content-completeness-dashboard.ts`
- optionally `scripts/db/audit-user-progress.ts` if the team wants learning-data audit artifacts alongside content audit

What tasks explicitly do not belong inside:
- `functions/api/cron/content-quality-loop.ts`
- `scripts/db/auto-deprecate-flagged-questions.ts`
- `scripts/db/enrich-critical-conditions.ts`
- image deletion or cleanup scripts
- any auto-demotion or AI regeneration step

Dependencies / secrets:
- `DATABASE_URL`
- `PRODUCTION_URL`
- `CRON_SECRET` if endpoint-based audit paths remain

Expected runtime class:
- `medium`

Failure handling expectations:
- Read-only audit steps should fail loudly and produce artifacts.
- The workflow should never hide failures with `continue-on-error`.
- Output should be artifact-first: JSON, CSV, and step-summary friendly.

### `sched-weekly-maintenance.yml`

Purpose:
- Narrow weekly maintenance for bounded, non-user-facing data hygiene only.

Exact cron recommendation:
- `47 7 * * 0`

Why that cadence is correct for this repo:
- PANaCEa does need periodic maintenance, but the audit shows the current weekly lane is dangerously broad.
- The future weekly maintenance lane should stay intentionally small:
  - backup
  - retention cleanup
  - non-destructive housekeeping
- Sunday morning UTC remains a reasonable low-traffic slot, but the lane should run after weekly report generation or at least far enough away that failures are easy to attribute.

What tasks belong inside:
- `scripts/emergency_backup.ts`
- a dedicated cleanup path for historical `BackgroundJob` rows
- other explicitly safe, idempotent housekeeping extracted from the current weekly super-lane

What tasks explicitly do not belong inside:
- `scripts/weekly-maintenance.ts`
- `scripts/orchestrate.ts`
- `scripts/maintenance/orchestrator.ts`
- `functions/api/cron/content-quality-loop.ts`
- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- `scripts/emergency_restore.ts`
- any repo hygiene task

Dependencies / secrets:
- `DATABASE_URL`
- optional `DIRECT_DATABASE_URL` only if backup or cleanup tooling eventually requires it
- `SyncQueue` cleanup remains deferred until the table has an explicit retention contract

Expected runtime class:
- `short` to `medium`

Failure handling expectations:
- Backup failure should fail the workflow and page an operator.
- Cleanup failures should also fail the workflow unless they are clearly non-critical and split into a secondary job with explicit labeling.
- No broad `continue-on-error` allowed.

### `sched-weekly-platform-report.yml`

Purpose:
- Weekly read-only operator reporting for platform usage, learner health, and model-quality summaries.

Exact cron recommendation:
- `18 6 * * 0`

Why that cadence is correct for this repo:
- Weekly is the right cadence for "operator summary" views that do not need to mutate production state:
  - exam-outcome predictiveness
  - progress/report artifacts
  - user-progress audit summaries
  - rollup of daily analytics tables into weekly operator-facing snapshots
- The audit found that weekly reporting was previously buried inside a giant maintenance workflow. It should become a standalone reporting lane.

What tasks belong inside:
- a refactored report-only weekly summary script extracted from `scripts/automation/weeklyTasks.ts`
- `functions/api/cron/compute-item-metrics.ts` while it remains a read-heavy psychometric snapshot
- `functions/api/cron/analyze-exam-outcomes.ts` after it is fixed to use proper Pages exports
- `scripts/db/audit-user-progress.ts`
- optional report assembly from daily rollup tables populated by `sched-daily-ops.yml`

What tasks explicitly do not belong inside:
- `db:backup`
- `db:restore`
- `db:orchestrate`
- `functions/api/cron/content-quality-loop.ts`
- any question generation, image processing, or queue cleanup

Dependencies / secrets:
- `DATABASE_URL`
- `PRODUCTION_URL`
- `CRON_SECRET` if any report endpoint remains endpoint-backed

Expected runtime class:
- `medium`

Failure handling expectations:
- This workflow is report-only and should be fully observable.
- Failures should block green status because stale weekly reporting undermines operator trust.
- Artifacts should be preserved longer than daily lanes.

### `sched-weekly-repo-hygiene.yml`

Purpose:
- Weekly repository-maintenance audit that does not depend on production runtime behavior.

Exact cron recommendation:
- `23 8 * * 6`

Why that cadence is correct for this repo:
- Repo hygiene is not part of runtime operations and should not compete with app/data lanes.
- Saturday UTC is a good separation point from Sunday app maintenance/reporting.
- Weekly is frequent enough for dependency and structural drift without paying unnecessary CI cost daily.

What tasks belong inside:
- `npm audit --omit=dev`
- workflow policy audit for `.github/workflows/*.yml`
  - explicit permissions
  - `workflow_dispatch` on scheduled lanes
  - concurrency
  - timeout presence
  - Node `22`
  - non-top-of-hour cron minutes
- `npm run audit:prisma`
- `npm run audit:zod`
- `npm run audit:services`
- `npm run audit:components`
- `prettier --check` for `.github/workflows/*.yml` and `docs/automation/*.md`

What tasks explicitly do not belong inside:
- any call to `functions/api/cron/**`
- any production data mutation
- any DB backup or restore
- any queue-processing or notification logic

Dependencies / secrets:
- ideally none beyond default repo checkout
- `GITHUB_TOKEN` with minimal `contents: read`

Expected runtime class:
- `medium`

Failure handling expectations:
- Repo hygiene failures should be noisy because they are usually action items for maintainers, not operational incidents.
- This workflow should upload machine-readable artifacts when helpful, but it should not require production secrets.

### `sched-monthly-deep-audit.yml`

Purpose:
- Monthly long-horizon audit for AI/content drift, schema/search drift, and automation safety drift.

Exact cron recommendation:
- `29 9 1 * *`

Why that cadence is correct for this repo:
- PANaCEa has several expensive, long-horizon audit surfaces that do not need weekly frequency:
  - `scripts/cron/drift-detector.ts`
  - `scripts/db/sample-ai-content.ts`
  - `scripts/db/audit-search-vector.ts`
  - broader automation-governance review that currently lives in `scripts/automation/monthlyGovernance.ts`
- Monthly is the right cadence for "deep audit" because these checks are higher signal when grouped and reviewed as an operator packet rather than as noisy daily jobs.

What tasks belong inside:
- `scripts/automation/monthlyGovernance.ts`
- `scripts/cron/drift-detector.ts`
- `scripts/db/sample-ai-content.ts`
- `scripts/db/audit-search-vector.ts`
- `scripts/db/link-questions-to-conditions.ts --audit-only`
- `scripts/media/audit-media-needs.ts`

What tasks explicitly do not belong inside:
- `scripts/db/enrich-critical-conditions.ts`
- `scripts/db/auto-deprecate-flagged-questions.ts`
- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- any real-time user-facing functionality

Dependencies / secrets:
- `DATABASE_URL`
- optional `DIRECT_DATABASE_URL`

Expected runtime class:
- `medium` to `long`

Failure handling expectations:
- This workflow should produce a review packet, not attempt auto-remediation.
- Failures should surface clearly, but individual sub-audits can be split into separate jobs if they need independent timeout budgets.

## 2. Schedule matrix table

| Workflow | Domain | Exact cron (UTC) | Runtime class | Primary tasks | Primary secrets | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `sched-runtime-sanity.yml` | app/runtime, read-only | `17 * * * *` | short | runtime sanity checks, dependency reachability, queue-health visibility | `DATABASE_URL`, `GEMINI_API_KEY` | Successor to current platform-health lane |
| `sched-reservoir-supply.yml` | app/runtime, transitional maintenance | `25 */2 * * *` | short | reservoir maintenance, pool replenishment | `PRODUCTION_URL`, `CRON_SECRET` | Transitional exception pending runtime queue ownership |
| `sched-daily-learning-models.yml` | app/data, model refresh | `13 3 * * *` | medium | user profile enrichment, incremental item metrics, incremental calibration, future daily-plan refresh | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` | Must stay incremental and idempotent |
| `sched-daily-ops.yml` | app/data, safe ops refresh | `27 4 * * *` | medium | analytics aggregation, answer distributions, daily prescriptions, daily insights | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` | Explicitly excludes reminders and reservoir supply |
| `sched-content-audit.yml` | app/data, read-only audit | `41 5 * * *` | medium | content health, nightly audit snapshot, integrity/completeness reports | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` | Audit only; no auto-repair |
| `sched-weekly-platform-report.yml` | app/data, reporting | `18 6 * * 0` | medium | weekly operator report, user-progress audit packet, psychometric snapshot via `compute-item-metrics` | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` | Reporting only; `analyze-exam-outcomes` stays deferred until handler wiring is fixed |
| `sched-weekly-maintenance.yml` | app/data, bounded maintenance | `47 7 * * 0` | short/medium | backup snapshot, background-job retention cleanup | `DATABASE_URL` | Keep intentionally small; `SyncQueue` cleanup is intentionally deferred |
| `sched-weekly-repo-hygiene.yml` | repo maintenance | `23 8 * * 6` | medium | `npm audit`, repo audits, workflow/docs drift checks | none or minimal repo token | No production secrets |
| `sched-monthly-deep-audit.yml` | app + repo audit | `29 9 1 * *` | medium/long | drift detector, AI content sample review, search-vector audit, linkage audit, media backlog packet | `DATABASE_URL`, optional `DIRECT_DATABASE_URL` | Review packet, not remediation |

## Implementation status

| Workflow | Scaffold status | Task migration | Validation |
| --- | --- | --- | --- |
| `sched-runtime-sanity.yml` | `active` | `hourly runtime sanity migrated` | `static validation complete; local script execution exercised` |
| `sched-reservoir-supply.yml` | `active` | `transitional reservoir endpoint fanout retained while runtime replacement is still pending` | `static validation complete; live run pending` |
| `sched-daily-learning-models.yml` | `active` | `user profile enrichment migrated; broader model tasks still pending` | `static validation complete; live run pending` |
| `sched-daily-ops.yml` | `active` | `repo-hosted daily rollups and safe endpoint fanout migrated` | `static validation complete; live run pending` |
| `sched-content-audit.yml` | `active` | `content validation plus db audit scripts migrated` | `static validation complete; live run pending` |
| `sched-weekly-platform-report.yml` | `active` | `weekly report, progress audit packet, and compute-item-metrics snapshot migrated` | `static validation complete; live run pending` |
| `sched-weekly-maintenance.yml` | `active` | `backup snapshot and background-job retention cleanup migrated` | `static validation complete; live run pending` |
| `sched-weekly-repo-hygiene.yml` | `active` | `dependency audit, workflow policy audit, repo audit scripts, and automation-doc formatting checks migrated` | `static validation complete; live run pending` |
| `sched-monthly-deep-audit.yml` | `active` | `drift detector, search-vector audit, AI sample review, linkage audit, and media backlog snapshot migrated` | `static validation complete; live run pending` |

Implementation note:
- `sched-runtime-sanity.yml` now owns the hourly schedule; the prior `automation-platform-health.yml` workflow was removed to eliminate duplicate scheduled execution.
- `sched-reservoir-supply.yml` now owns the live two-hour reservoir lane after renaming the old `automation-reservoir-supply.yml` workflow during the final hardening pass.
- `sched-weekly-platform-report.yml` and `sched-weekly-maintenance.yml` now own the weekly split; the prior `automation-weekly-maintenance.yml` workflow was removed to eliminate the mixed weekly catch-all.
- `sched-weekly-repo-hygiene.yml` now owns the recurring repo-only hygiene lane, and the old monthly-governance wrapper has been retired.
- `sched-monthly-deep-audit.yml` now owns the monthly deep-audit packet without any duplicate legacy wrapper in the workflow tree.

## 3. Jobs to remove

- Remove the retired local scheduler surface entirely:
  - `scripts/scheduleJobs.ts`
  - `scripts/contentHealthChecker.ts`
  - `scripts/cleanupJobs.ts`
  - `functions/cache-warmer.ts`
- Remove any remaining references in docs or workflow comments to:
  - local machine cron as an active scheduler path
  - Cloudflare Pages native scheduled handlers where `wrangler.toml` already states they are not supported
- Remove the concept of a broad scheduled "catch-all" workflow:
  - historical `.github/workflows/hourly-automation.yml`
  - historical `.github/workflows/daily-automation.yml`
  - historical `.github/workflows/weekly-automation.yml`

## 4. Jobs to split

- Split `scripts/automation/dailyTasks.ts` into:
  - daily ops rollup entrypoint
  - optional safe cleanup entrypoint
  - anything content-audit related moved to `sched-content-audit.yml`
- Split `scripts/automation/weeklyTasks.ts` into:
  - `scripts/automation/weeklyPlatformReport.ts` for scheduled report ownership
  - `scripts/automation/weeklyMaintenance.ts` for bounded scheduled housekeeping
  - a manual compatibility wrapper so `npm run automation:weekly` no longer implies scheduled ownership
- Split `scripts/weekly-maintenance.ts` into explicit operator-grade subcommands before any part of it is ever reconsidered for unattended schedule.
- The historical responsibility bundle in `.github/workflows/automation-weekly-maintenance.yml` has been split into:
  - `sched-weekly-platform-report.yml`
  - `sched-weekly-maintenance.yml`
  - manual-only maintenance workflows for high-risk mutation paths
- Split the current daily ownership bundle across:
  - `sched-daily-learning-models.yml`
  - `sched-daily-ops.yml`
  - `sched-content-audit.yml`

## 5. Jobs to merge

- Merge content health ownership into one audit lane:
  - `functions/api/cron/compute-content-health.ts`
  - `functions/api/cron/nightly-health-check.ts`
  - `scripts/db/data-integrity-monitor.ts`
  - `scripts/db/content-completeness-dashboard.ts`
- Merge daily derived-data refresh ownership into one ops lane:
  - `functions/api/cron/aggregate-analytics.ts`
  - `functions/api/cron/aggregate-distributions.ts`
  - `functions/api/cron/daily-prescription.ts`
  - `functions/api/cron/generate-daily-insights.ts`
- Merge learning-model refresh ownership into one model lane:
  - `scripts/automation/jobs/userProfileEnrichment.ts`
  - `functions/api/cron/calibrate-items.ts`
  - the safe, batch-oriented part of `functions/api/cron/generate-daily-plans.ts` if retained
- Merge weekly operator reporting ownership into one report lane:
  - weekly summary logic currently inside `scripts/automation/weeklyTasks.ts`
  - `functions/api/cron/compute-item-metrics.ts`
  - `functions/api/cron/analyze-exam-outcomes.ts`
  - `scripts/db/audit-user-progress.ts`

## 6. Jobs that should become manual-only

- `scripts/weekly-maintenance.ts`
- `scripts/orchestrate.ts`
- `scripts/maintenance/orchestrator.ts`
- `scripts/emergency_restore.ts`
- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- `functions/api/cron/populate-prerequisites.ts`
- `functions/api/cron/xapi-export.ts`
- `scripts/db/enrich-critical-conditions.ts`
- `scripts/db/auto-deprecate-flagged-questions.ts`
- all image fetch/process/audit/delete families under `scripts/images/**`
- manual cloud-agent jobs that are investigative or repair-oriented rather than event-driven
- `security-sentinel` in `.github/workflows/cloud-agents.yml`

Rationale:
- These paths are mutation-heavy, expensive, hard to make idempotent, or dangerous if they silently run unattended.
- Cloud-agent work is justified when it is tied to code changes or an explicit operator request. It is not justified as a vague recurring AI sweep with no concrete advisory or diff context.

## 7. Jobs that should move toward app-native scheduling / queue execution

- `functions/api/cron/reservoir-maintenance.ts`
- `functions/api/cron/replenish-pool.ts`
- `functions/api/cron/push-reminders.ts`
- queue-driven FSRS optimization currently coordinated through:
  - `scripts/automation/dailyTasks.ts`
  - `lib/services/queue/jobQueue.ts`
  - `scripts/backgroundWorker.ts`
- future question-supply automation:
  - `functions/api/cron/batch-generate-questions.ts`
  - `functions/api/cron/generate-variants.ts`

Why these should move:
- Reservoir health and question supply are closer to runtime capacity management than to offline reporting.
- Push reminders are user-facing and timezone-sensitive; GitHub cron is a poor fit for user-local delivery semantics.
- FSRS optimization already has a queue/worker model in the repo; GitHub cron should orchestrate less of that, not more.
- Question generation belongs behind queue budgets, retries, and concurrency control, not inside blind recurring GitHub runners.

Preferred destination:
- `lib/services/queue/jobQueue.ts`
- `scripts/backgroundWorker.ts`
- dedicated runtime triggers inside the app or a platform-native scheduler that owns queue enqueueing rather than direct GitHub execution

## 8. Required workflow standards

Every important scheduled workflow in the future-state portfolio should meet all of the following:

- Use `workflow_dispatch`.
- Use a shared reusable workflow for common setup, logging, timeout, and artifact handling.
- Declare explicit least-privilege permissions.
- Use Node `22` only.
- Use a non-`:00` cron minute.
- Set `concurrency` with a stable non-overlap group and `cancel-in-progress: false` for scheduled lanes.
- Set explicit `timeout-minutes`.
- Do not use `continue-on-error` on primary scheduled work.
- Scope secrets to the smallest possible job or step; do not place production secrets at workflow scope unless every job requires them.
- Emit artifacts and `GITHUB_STEP_SUMMARY` output on every run, including failure paths.
- Keep each workflow single-purpose. If a task list starts to mix repo maintenance, app/data maintenance, and user-facing runtime behavior, split it.
- Prefer idempotent endpoints or scripts. If a task cannot be made idempotent, it should default toward manual-only or queue-owned execution.
- Avoid direct inline `tsx -e "..."` maintenance logic inside workflow YAML. PANaCEa should use dedicated entrypoint scripts so behavior is reviewable and testable.
- Comments and headers must match the actual cron expression and current scheduler authority.

## 9. Rollout sequence

### Phase 1: Stabilize safe scheduled lanes first

1. Keep the current platform sanity lane as the baseline and rename/reshape it into `sched-runtime-sanity.yml`.
2. Introduce `sched-weekly-repo-hygiene.yml` because it is repo-only and does not depend on production runtime refactors.
3. Introduce `sched-monthly-deep-audit.yml` by repurposing the existing monthly governance work.

### Phase 2: Split daily responsibility by purpose

4. Refactor daily ownership so that:
   - learning-model refresh is isolated into `sched-daily-learning-models.yml`
   - safe user-facing daily refresh and analytics ingestion move into `sched-daily-ops.yml`
   - content health/reporting moves into `sched-content-audit.yml`
5. Fix endpoint export/auth mismatches before admitting those endpoints into scheduled lanes:
   - `analyze-exam-outcomes.ts`
   - `compute-content-health.ts`
   - `generate-daily-plans.ts`
   - `nightly-health-check.ts`
   - `populate-prerequisites.ts`

### Phase 3: Shrink weekly mutation surface

6. Replace the current broad weekly lane with two separate workflows:
   - `sched-weekly-platform-report.yml`
   - `sched-weekly-maintenance.yml`
7. Extract safe housekeeping scripts for queue retention and backup so weekly maintenance no longer depends on `scripts/weekly-maintenance.ts` or `db:orchestrate`.

### Phase 4: Move runtime-critical behavior off GitHub cron

8. Remove GitHub-cron ownership for:
   - reservoir supply maintenance
   - push reminders
   - queue-owned FSRS optimization orchestration
9. Shift those concerns toward app-native or queue-driven execution using the existing `BackgroundJob` + `scripts/backgroundWorker.ts` model.

### Phase 5: Decommission the retired and transitional surfaces

10. Delete the retired local scheduler scripts and any documentation that still makes them look active.
11. Keep high-risk generation and DB-repair paths manual-only until they have dedicated safety rails, budgets, and explicit operator runbooks.
