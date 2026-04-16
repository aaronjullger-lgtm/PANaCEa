# Automation Refactor Rollout Notes

## Recommended rollout order

1. Merge the docs and workflow tree together so the review package matches the shipped schedule model.
2. Manually trigger the safest read-only lanes first:
   - `sched-weekly-repo-hygiene.yml`
   - `sched-runtime-sanity.yml`
   - `sched-content-audit.yml`
3. Manually trigger the derived-data lanes next:
   - `sched-daily-learning-models.yml`
   - `sched-daily-ops.yml`
4. Manually trigger the weekly report lane:
   - `sched-weekly-platform-report.yml`
5. Manually trigger the weekly maintenance lane with a conservative operator read of its artifacts before waiting for the next scheduled run.
6. Leave `sched-reservoir-supply.yml` alone unless reservoir pressure justifies an operator rerun; it is the one live mutative transitional lane.
7. Let `sched-monthly-deep-audit.yml` wait for either a manual smoke invocation with segments trimmed or its natural monthly window.

## What to watch after merge

- Any unexpected double-firing of scheduled work.
- Reservoir churn, refill noise, or queue pressure after the renamed reservoir lane goes live.
- Failures in daily ops endpoint fanout:
  - `aggregate-analytics`
  - `aggregate-distributions`
  - `daily-prescription`
  - `generate-daily-insights`
- Weekly maintenance backup failures or empty backup artifacts.
- Repo-hygiene failures that reflect real debt versus workflow-policy false positives.
- Any operator confusion caused by stale references to retired workflow names.

## What to manually trigger first

- First trigger:
  - `sched-weekly-repo-hygiene.yml`
  - confirms the workflow-policy checks and docs wiring match the live tree
- Second trigger:
  - `sched-runtime-sanity.yml`
  - confirms the hourly lane still produces readable artifacts and summaries
- Third trigger:
  - `sched-daily-ops.yml`
  - confirms the endpoint fanout path still works after the refactor
- Fourth trigger:
  - `sched-weekly-platform-report.yml`
  - confirms the reporting packet remains readable and complete
- Trigger `sched-weekly-maintenance.yml` only when an operator is ready to inspect backup and retention-cleanup output immediately after the run.
- Do not manually trigger `sched-reservoir-supply.yml` as a smoke test unless live reservoir health actually warrants it.

## What metrics or logs to inspect

- GitHub Actions run summaries for all `sched-*` workflows.
- Uploaded artifacts under:
  - `logs/hourly/`
  - `logs/daily-learning-models/`
  - `logs/daily-ops/`
  - `logs/content-audit/`
  - `logs/weekly-platform-report/`
  - `logs/weekly-maintenance/`
  - `logs/repo-hygiene/`
  - `logs/monthly-deep-audit/`
  - `logs/automation-http/`
- Reservoir-related HTTP logs for:
  - `/api/cron/reservoir-maintenance`
  - `/api/cron/replenish-pool`
- Daily ops HTTP logs for:
  - `/api/cron/aggregate-analytics`
  - `/api/cron/aggregate-distributions`
  - `/api/cron/daily-prescription`
  - `/api/cron/generate-daily-insights`
- Weekly maintenance artifacts under `backups/**`.
- Queue-health and failed-background-job output from the runtime sanity lane.

## Using automation issue templates

- Use `.github/ISSUE_TEMPLATE/automation-failure.yml` for any failed `sched-*` run, failed manual rerun, or automation lane that behaved incorrectly at runtime.
- Use `.github/ISSUE_TEMPLATE/automation-drift.yml` when workflow headers, cron comments, package aliases, or automation docs disagree with the live behavior defined in [SCHEDULE_MATRIX.md](./SCHEDULE_MATRIX.md).
- Use `.github/ISSUE_TEMPLATE/automation-change-request.yml` for missing jobs, unsafe scheduled behavior, cadence changes, manual-only requests, dead-man-switch alerting, backup restore verification, or work that should move out of GitHub cron.
- Always include the workflow name, run URL when one exists, artifact/log paths checked, whether any production mutation occurred, and whether rollback or manual intervention is needed.
- Treat the `sched-*` workflow file as the runtime owner; package aliases such as `automation:daily` and `automation:weekly` are operator entrypoints, not scheduler authority.

## Manual run defaults

- Prefer `report_only=true` or `dry_run=true` on the first manual rerun whenever the lane supports it.
- Prefer the narrowest `target_scope` first:
  - `sample`
  - `repo-rollups-only`
  - `policy-only`
  - `fast-audit`
  - `fast-review`
- Treat `environment_guard` as the explicit approval switch for live mutation. If a lane asks for it, do not bypass it.
- Use [RUNBOOK.md](./RUNBOOK.md) for lane-by-lane manual guidance and [OPERATOR_DASHBOARD.md](./OPERATOR_DASHBOARD.md) for weekly and monthly health review.

## Governance references

- Role ownership: [JOB_OWNERSHIP.md](./JOB_OWNERSHIP.md)
- Operator runbook: [RUNBOOK.md](./RUNBOOK.md)
- Health overview: [OPERATOR_DASHBOARD.md](./OPERATOR_DASHBOARD.md)
- Future backlog: [FUTURE_BACKLOG.md](./FUTURE_BACKLOG.md)
- Label taxonomy recommendation: [../../.github/labels-automation-recommendation.md](/Users/aaronullger/GitHub/StudyPANaCEa/.github/labels-automation-recommendation.md)

## How to confirm no duplicate schedules remain

- Confirm only the intended scheduled workflows remain:

```bash
ls -1 .github/workflows | sort
```

- Confirm only the intended files contain cron entries:

```bash
rg -n 'cron:' .github/workflows/*.yml
```

- Confirm no active scheduled workflow still uses `continue-on-error`:

```bash
rg -n 'continue-on-error:' .github/workflows/sched-*.yml .github/workflows/_automation-lane.yml
```

- Confirm the live scheduled set still uses unique, non-top-of-hour minutes:
  - `13`, `17`, `18`, `23`, `25`, `27`, `29`, `41`, `47`

- Confirm `cloud-agents.yml` has no `schedule:` trigger and remains event-driven or manual-only.
