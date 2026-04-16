# PANaCEa Scheduled Workflow Before/After Matrix

This matrix captures the scheduled-workflow cleanup after the purpose-based automation refactor.

Use [README.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/README.md) for the live workflow inventory and [SCHEDULE_MATRIX.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/SCHEDULE_MATRIX.md) for the target cadence/role design.

| Old workflow | Old cadence | Old role | New workflow | New cadence | New role | Action taken | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.github/workflows/automation-platform-health.yml` | `17 * * * *` | mixed hourly runtime sanity and health reporting | `.github/workflows/sched-runtime-sanity.yml` | `17 * * * *` | canonical hourly runtime sanity lane | deleted | The new workflow owns the same safe hourly checks with clearer artifacts, explicit metadata, and no duplicate scheduler. |
| `.github/workflows/automation-daily-analytics.yml` | `40 3 * * *` | mixed daily report generation, content checks, cleanup, and analytics rollups | `.github/workflows/sched-daily-ops.yml`; `.github/workflows/sched-content-audit.yml` | `27 4 * * *`; `41 5 * * *` | daily safe ops refresh; daily read-only content audit | deleted | The old lane mixed report-only work with cleanup logic and had poor rerun safety. |
| `.github/workflows/automation-daily-personalization.yml` | `10 3 * * *` | daily prescriptions, insights, and reminders | `.github/workflows/sched-daily-learning-models.yml`; `.github/workflows/sched-daily-ops.yml` | `13 3 * * *`; `27 4 * * *` | learner-model refresh; daily ops refresh | deleted | Derived-data refresh was split from model prep, and reminder delivery was intentionally removed from GitHub cron. |
| `.github/workflows/automation-weekly-maintenance.yml` | `22 7 * * 0` | mixed weekly reporting, backup, cleanup, psychometrics, and content-quality mutation | `.github/workflows/sched-weekly-platform-report.yml`; `.github/workflows/sched-weekly-maintenance.yml` | `18 6 * * 0`; `47 7 * * 0` | weekly read-only reporting; bounded weekly housekeeping | deleted | Reporting and mutation-heavy maintenance needed separate failure semantics, artifacts, and rerun safety. |
| `.github/workflows/automation-monthly-governance.yml` | `35 8 1 * *` | mixed monthly drift review and repo-hygiene checks | `.github/workflows/sched-weekly-repo-hygiene.yml`; `.github/workflows/sched-monthly-deep-audit.yml` | `23 8 * * 6`; `29 9 1 * *` | recurring repo-only hygiene; monthly long-horizon audit packet | deleted | The old monthly wrapper no longer had unique behavior once the weekly repo-hygiene lane and monthly deep-audit lane both exposed `workflow_dispatch`. |
| `.github/workflows/hourly-automation.yml` | historical predecessor | broad cadence-based hourly bundle | `.github/workflows/sched-runtime-sanity.yml` | `17 * * * *` | purpose-based hourly runtime sanity | already retired before this cleanup | The named runtime-sanity lane superseded the old cadence-first hourly file. |
| `.github/workflows/daily-automation.yml` | historical predecessor | broad cadence-based daily bundle | `.github/workflows/sched-daily-learning-models.yml`; `.github/workflows/sched-daily-ops.yml`; `.github/workflows/sched-content-audit.yml` | `13 3 * * *`; `27 4 * * *`; `41 5 * * *` | split daily model refresh, ops refresh, and audit | already retired before this cleanup | Daily work now has purpose-based ownership instead of a single catch-all workflow. |
| `.github/workflows/weekly-automation.yml` | historical predecessor | broad cadence-based weekly bundle | `.github/workflows/sched-weekly-platform-report.yml`; `.github/workflows/sched-weekly-maintenance.yml` | `18 6 * * 0`; `47 7 * * 0` | split weekly report lane and maintenance lane | already retired before this cleanup | Weekly reporting and housekeeping were split to improve observability and rerun safety. |
| `.github/workflows/automation-reservoir-supply.yml` | `25 */2 * * *` | reservoir refill and supply maintenance | `.github/workflows/sched-reservoir-supply.yml` | `25 */2 * * *` | reservoir supply lane retained as a transitional scheduled exception pending runtime re-home | renamed + kept | No app-native/runtime replacement has been implemented yet, so removing this workflow would drop live reservoir maintenance; the final hardening pass only standardized naming and controls. |

## Validation checklist

- [x] Every scheduled workflow exposes `workflow_dispatch`.
- [x] Permissions are explicit and minimal across the scheduled portfolio.
- [x] Every scheduled workflow defines a stable concurrency group with non-overlapping behavior.
- [x] Every scheduled workflow has an explicit timeout, either directly or through the reusable lane input.
- [x] Node `22` remains the standard for every scheduled workflow that runs PANaCEa Node commands.
- [x] All live cron expressions avoid top-of-hour minute `0`.
- [x] The live cron set uses unique minute offsets: `13`, `17`, `18`, `23`, `25`, `27`, `29`, `41`, and `47`.
- [x] Scheduled workflows now write understandable step summaries with artifact context and next-action guidance.
- [x] Artifact retention is explicit and tiered across runtime/daily, weekly, and monthly lanes.
- [x] No scheduled primary workflow step currently uses `continue-on-error`.
- [x] Header comments match the actual behavior, secrets, cadence, and operator expectation of each scheduled workflow.
- [x] Shared secret exposure was reduced to the minimum current reusable-lane set: `DATABASE_URL`, `PRODUCTION_URL`, and `CRON_SECRET`.
- [x] Scheduled workflow naming is now consistent under the `sched-` prefix, including the reservoir lane.
- [x] The only dangerous scheduled exception still left on GitHub cron is explicitly documented: `sched-reservoir-supply.yml` remains transitional until runtime queue ownership exists.
