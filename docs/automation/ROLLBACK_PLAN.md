# Automation Refactor Rollback Plan

## Immediate containment

Disable these workflows first if the refactor causes bad production behavior or duplicate mutation:

1. `sched-reservoir-supply.yml`
2. `sched-weekly-maintenance.yml`
3. `sched-daily-ops.yml`
4. `sched-daily-learning-models.yml`
5. `sched-content-audit.yml`
6. `sched-runtime-sanity.yml`
7. `sched-weekly-platform-report.yml`
8. `sched-weekly-repo-hygiene.yml`
9. `sched-monthly-deep-audit.yml`

Reason:
- This order shuts off the mutative or state-changing lanes before the read-only/report-only lanes.

## Files to restore first if problems occur

Workflow files from the previous model:

- `.github/workflows/automation-platform-health.yml`
- `.github/workflows/automation-daily-analytics.yml`
- `.github/workflows/automation-daily-personalization.yml`
- `.github/workflows/automation-weekly-maintenance.yml`
- `.github/workflows/automation-monthly-governance.yml` only if the older monthly compatibility path is explicitly needed
- `.github/workflows/automation-reservoir-supply.yml` if the previous filename must be restored during rollback

Entry scripts and compatibility wrappers most likely to matter:

- `scripts/automation/hourlyTasks.ts`
- `scripts/automation/dailyTasks.ts`
- `scripts/automation/weeklyTasks.ts`
- `scripts/automation/dailyLearningModels.ts`
- `scripts/automation/dailyOps.ts`
- `scripts/automation/dailyContentAudit.ts`
- `scripts/automation/weeklyPlatformReport.ts`
- `scripts/automation/weeklyMaintenance.ts`
- `scripts/automation/weeklyRepoHygiene.ts`
- `scripts/automation/monthlyGovernance.ts`
- `scripts/automation/shared/commandRunner.ts`
- `scripts/automation/shared/reporting.ts`

Docs are not operational blockers, but restore these if the repo needs to describe the rolled-back state accurately:

- `docs/automation/README.md`
- `docs/automation/SCHEDULE_MATRIX.md`
- `docs/automation/MIGRATION_MAP.md`
- `docs/automation/WORKFLOW_STANDARDS.md`
- `docs/automation/BEFORE_AFTER_MATRIX.md`
- `docs/automation/CHANGELOG.md`

## How to revert to the previous schedule model

1. Disable the active `sched-*` workflows in GitHub Actions so scheduled runs stop immediately.
2. Restore the previous workflow files from the last known-good commit.
3. Remove or disable the new `sched-*` workflows so there is only one scheduler owner per responsibility.
4. Restore the prior workflow filenames if any external runbooks or operator habits still depend on them.
5. Re-check for duplicate cron ownership before re-enabling schedules.
6. Keep `cloud-agents.yml` unscheduled even during rollback unless there is a very specific reason to revive an old scheduled agent path.

## Data and maintenance jobs that require extra caution on rollback

- `sched-reservoir-supply.yml`
  - live operational mutation
  - avoid any overlap with a restored reservoir workflow
- `sched-daily-ops.yml`
  - calls production cron endpoints that write derived state
  - avoid running both old and new daily owners together
- `sched-weekly-maintenance.yml`
  - touches backups and historical job cleanup
  - confirm backup expectations before re-enabling an older weekly maintenance path
- `sched-daily-learning-models.yml`
  - writes learner-model derived state
  - confirm the old daily owner is not also refreshing similar fields
- any restored legacy workflow that previously bundled queue cleanup or FSRS scheduling
  - avoid reintroducing duplicate queue scheduling silently

## Rollback guardrails

- Do not leave both the refactored and legacy daily or weekly workflows scheduled at the same time.
- Treat reservoir, backup, and production endpoint fanout as the highest-risk overlap zones.
- If rollback is partial, prefer restoring read-only/reporting behavior first and mutative behavior second.
- Re-run the duplicate-schedule checks after rollback before turning schedules back on.
