# Automation Refactor PR Summary

## What changed

- Replaced cadence-based scheduled workflows with purpose-based workflows under `.github/workflows/sched-*.yml`.
- Centralized shared scheduled-lane setup in [\_automation-lane.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/_automation-lane.yml).
- Split daily automation into:
  - `sched-daily-learning-models.yml`
  - `sched-daily-ops.yml`
  - `sched-content-audit.yml`
- Split weekly automation into:
  - `sched-weekly-platform-report.yml`
  - `sched-weekly-maintenance.yml`
- Added repo-only and long-horizon audit lanes:
  - `sched-weekly-repo-hygiene.yml`
  - `sched-monthly-deep-audit.yml`
- Kept `sched-runtime-sanity.yml` as the hourly platform-health lane.
- Kept `sched-reservoir-supply.yml` as a documented transitional exception until runtime queue ownership exists.
- Removed scheduled cloud-agent behavior and kept [cloud-agents.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/cloud-agents.yml) event-driven or manual-only.
- Updated the automation docs so the live architecture, migration map, standards, and before/after matrix all match the current workflow tree.

## Why the old system was insufficient

- The old hourly/daily/weekly model mixed unrelated responsibilities in the same runs.
- Reporting, derived-data refresh, cleanup, backup, and mutation-heavy tasks were bundled together, which made reruns unsafe and failures hard to interpret.
- Scheduler ownership was split across GitHub Actions, retired local-cron paths, and legacy comments that no longer matched behavior.
- Several workflows lacked the final hardening standards now enforced across the live scheduled set:
  - consistent naming
  - explicit operator rerun path
  - clear summaries and artifact expectations
  - minimal secret exposure
  - documented transitional exceptions

## New workflow portfolio

- `sched-runtime-sanity.yml`
- `sched-reservoir-supply.yml`
- `sched-daily-learning-models.yml`
- `sched-daily-ops.yml`
- `sched-content-audit.yml`
- `sched-weekly-platform-report.yml`
- `sched-weekly-maintenance.yml`
- `sched-weekly-repo-hygiene.yml`
- `sched-monthly-deep-audit.yml`
- `_automation-lane.yml` as the reusable lane helper
- `cloud-agents.yml` as event-driven/manual-only, not scheduled

## Most important reliability and safety improvements

- Every scheduled workflow now exposes `workflow_dispatch`.
- Permissions are explicit and minimal across the live scheduled set.
- Every scheduled workflow has scoped concurrency and explicit timeout coverage.
- All scheduled cron minutes are staggered away from `:00` and are unique across the live portfolio.
- Step summaries now point operators to artifacts and next actions instead of leaving failures buried in raw logs.
- Artifact retention is explicit by lane class:
  - runtime/daily/reservoir/weekly-maintenance: 14 days
  - weekly report/repo hygiene: 21 days
  - monthly deep audit: 30 days
- Shared reusable-lane secret exposure was reduced to `DATABASE_URL`, `PRODUCTION_URL`, and `CRON_SECRET`.
- Scheduled cloud-agent behavior was removed so recurring AI work does not silently drift back in.

## Major migrations

- Hourly platform health -> `sched-runtime-sanity.yml`
- Daily catch-all automation -> `sched-daily-learning-models.yml`, `sched-daily-ops.yml`, `sched-content-audit.yml`
- Weekly catch-all automation -> `sched-weekly-platform-report.yml`, `sched-weekly-maintenance.yml`
- Monthly governance bundle -> `sched-weekly-repo-hygiene.yml` plus `sched-monthly-deep-audit.yml`
- Reservoir supply workflow -> renamed and hardened as `sched-reservoir-supply.yml`
- Cloud-agent security-sentinel -> manual-only / advisory-driven path
- Local-cron scheduler model -> retired in favor of GitHub Actions as the sole scheduler authority

## Removed workflows

- `automation-platform-health.yml`
- `automation-daily-analytics.yml`
- `automation-daily-personalization.yml`
- `automation-weekly-maintenance.yml`
- `automation-monthly-governance.yml`
- historical `hourly-automation.yml`
- historical `daily-automation.yml`
- historical `weekly-automation.yml`

## Added workflows

- `sched-runtime-sanity.yml`
- `sched-reservoir-supply.yml`
- `sched-daily-learning-models.yml`
- `sched-daily-ops.yml`
- `sched-content-audit.yml`
- `sched-weekly-platform-report.yml`
- `sched-weekly-maintenance.yml`
- `sched-weekly-repo-hygiene.yml`
- `sched-monthly-deep-audit.yml`
- `_automation-lane.yml`

## Risks and follow-ups

- `sched-reservoir-supply.yml` is still mutating live operational state from GitHub cron and should move to runtime queue ownership.
- `push-reminders` and FSRS optimization no longer belong in GitHub cron; their runtime-owned replacement must remain explicit.
- `calibrate-items` and `analyze-exam-outcomes` are still deferred because they are not yet scheduler-ready in the new architecture.
- Weekly backup is still artifact-based and needs true restore verification.
- A dead-man switch or missed-run alert is still recommended so failures do not wait for manual discovery.
