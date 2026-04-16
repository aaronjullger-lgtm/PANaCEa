# PANaCEa Automation Label Recommendation

Use these labels for the refactored automation system. The goal is fast triage, not label sprawl.

## Core labels

| Label | Applies to | Use when | Notes |
| --- | --- | --- | --- |
| `automation` | issues, PRs | Any change or incident touching `.github/workflows/**`, `docs/automation/**`, or `scripts/automation/**`. | Base label for all automation work. |
| `automation-drift` | issues, PRs | Docs, cron comments, workflow headers, package aliases, or runbook guidance are stale or inconsistent. | Pair with `automation` and the affected lane label. |
| `cloud-agents` | issues, PRs | Changes or failures affect `.github/workflows/cloud-agents.yml` or `scripts/cloud-agents/**`. | Keep separate from the scheduled portfolio. |

## Lane labels

| Label | Applies to | Use when |
| --- | --- | --- |
| `sched-runtime` | issues, PRs | Affects `sched-runtime-sanity.yml` or hourly runtime signals. |
| `sched-content` | issues, PRs | Affects `sched-content-audit.yml` or content/data audit reporting. |
| `sched-maintenance` | issues, PRs | Affects `sched-weekly-maintenance.yml` or any mutative upkeep lane. |
| `sched-reporting` | issues, PRs | Affects `sched-weekly-platform-report.yml`, `sched-weekly-repo-hygiene.yml`, or `sched-monthly-deep-audit.yml`. |
| `sched-learning-models` | issues, PRs | Affects `sched-daily-learning-models.yml` or learner-model refresh logic. |
| `sched-daily-ops` | issues, PRs | Affects `sched-daily-ops.yml` or daily production endpoint fanout. |
| `sched-reservoir` | issues, PRs | Affects `sched-reservoir-supply.yml` or reservoir supply ownership. |

## Risk and operator-action labels

| Label | Applies to | Use when |
| --- | --- | --- |
| `cron-risk` | issues, PRs | A schedule, cron expression, endpoint fanout, or unattended mutation path could cause unsafe or duplicate execution. |
| `manual-run-needed` | issues | A human should rerun a workflow, inspect artifacts, or intervene before the next scheduled window. |
| `rollback-watch` | issues, PRs | A change or incident may require disabling a lane, reverting a workflow, or guarding against data churn. |
| `report-only-first` | issues, PRs | A manual rerun should stay in `report_only` or fast-review mode before any live mutation is allowed. |

## Recommended combinations

- Scheduled failure in a report lane:
  - `automation`
  - `sched-reporting`
  - `manual-run-needed`

- Daily ops endpoint incident:
  - `automation`
  - `sched-daily-ops`
  - `cron-risk`
  - `rollback-watch`

- Reservoir or maintenance change PR:
  - `automation`
  - `sched-reservoir` or `sched-maintenance`
  - `cron-risk`
  - `report-only-first`

- Stale docs or comment mismatch:
  - `automation`
  - `automation-drift`
  - lane label if known

- Cloud-agent workflow change:
  - `automation`
  - `cloud-agents`

## Provisioning note

This file is a recommendation only. Create the labels in GitHub before relying on them in issue forms, project views, or automation dashboards.
