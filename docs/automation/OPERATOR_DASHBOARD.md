# Automation Operator Dashboard

This document is the operator-facing health overview for the current PANaCEa automation system.

## Workflow portfolio overview

| Workflow | Purpose | Normal cadence | Manual posture |
| --- | --- | --- | --- |
| `sched-runtime-sanity.yml` | Hourly runtime health checks | hourly at `:17` | safe anytime |
| `sched-reservoir-supply.yml` | Transitional live reservoir maintenance | every 2 hours at `:25` | caution; report-only first |
| `sched-daily-learning-models.yml` | Learner-model refresh | daily at `03:13 UTC` | caution; sample + report-only first |
| `sched-daily-ops.yml` | Daily rollups and production endpoint fanout | daily at `04:27 UTC` | caution; repo-rollups-only + report-only first |
| `sched-content-audit.yml` | Content and DB-backed audit packet | daily at `05:41 UTC` | safe anytime |
| `sched-weekly-platform-report.yml` | Weekly operator reporting | Sundays at `06:18 UTC` | report-only first |
| `sched-weekly-maintenance.yml` | Backups and historical job cleanup | Sundays at `07:47 UTC` | caution; report-only + dry-run first |
| `sched-weekly-repo-hygiene.yml` | Workflow and repo policy checks | Saturdays at `08:23 UTC` | safe anytime |
| `sched-monthly-deep-audit.yml` | Long-horizon audit packet | day 1 monthly at `09:29 UTC` | safe anytime; fast-review first |

## What “healthy” looks like

- All `sched-*` workflows have recent successful runs consistent with their cadence.
- No two scheduled workflows share the same cron minute.
- `sched-runtime-sanity.yml` artifacts show passing DB, Gemini, queue, and content checks.
- `sched-daily-ops.yml` has clean HTTP logs for:
  - `/api/cron/aggregate-analytics`
  - `/api/cron/aggregate-distributions`
  - `/api/cron/daily-prescription`
  - `/api/cron/generate-daily-insights`
- `sched-weekly-maintenance.yml` shows a backup artifact plus the expected retention-cleanup summary.
- `sched-weekly-repo-hygiene.yml` does not report workflow-policy regressions or unexpected new cron drift.
- `sched-reservoir-supply.yml` runs quietly and does not create repeated churn without a real supply reason.

## Warning signs

- Repeated runtime-sanity DB or Gemini failures.
- Daily ops endpoint logs showing non-2xx responses or empty HTTP artifacts.
- Reservoir lane being manually rerun often, or failing repeatedly on both endpoints.
- Weekly maintenance missing backups or deleting far more historical jobs than expected.
- Weekly repo hygiene suddenly reporting:
  - missing workflow permissions
  - top-of-hour cron
  - missing `workflow_dispatch`
  - header metadata drift
- Monthly deep audit or content audit showing growing content staleness without follow-up tickets.
- Operators using full/manual-live modes routinely instead of report-only first.

## Failure severity tiers

| Tier | Meaning | Typical examples |
| --- | --- | --- |
| `sev-1` | Active production data risk or immediate rollback concern | reservoir mutation gone wrong; unsafe weekly maintenance behavior |
| `sev-2` | Scheduled lane failing or producing incorrect live output | daily ops endpoint fanout failures; learner-model refresh write-path failure |
| `sev-3` | Report degradation or partial automation failure | missing CSV export; incomplete audit packet; repo hygiene debt report issues |
| `sev-4` | Low-risk noise or documentation drift | stale workflow comment; outdated runbook wording |

## Weekly review checklist

- Check the last `sched-weekly-repo-hygiene.yml` run for policy drift.
- Read the latest `sched-weekly-platform-report.yml` markdown artifact.
- Confirm `sched-weekly-maintenance.yml` produced:
  - backup output
  - a plausible retention-cleanup summary
- Scan runtime-sanity failures from the last 7 days for repeat patterns.
- Confirm no new `automation-failure` issues are missing lane labels or manual follow-up.
- Confirm `cloud-agents.yml` still has no schedule trigger.

## Monthly review checklist

- Read the latest `sched-monthly-deep-audit.yml` packet.
- Review any unresolved warnings from:
  - content freshness
  - search-vector coverage
  - linkage audit
  - media backlog coverage
- Confirm `sched-reservoir-supply.yml` is still treated as a transitional exception and not growing in scope.
- Reconfirm the recommended ownership map in [JOB_OWNERSHIP.md](./JOB_OWNERSHIP.md).
- Decide whether deferred safeguards need promotion:
  - dead-man-switch alerting
  - backup restore verification

## Duplicate schedule detection checklist

- Run:

```bash
rg -n 'cron:' .github/workflows/*.yml
```

- Confirm the live scheduled set still uses these unique non-top-of-hour minutes:
  - `13`
  - `17`
  - `18`
  - `23`
  - `25`
  - `27`
  - `29`
  - `41`
  - `47`

- Confirm no retired scheduled workflow files have reappeared.

## Stale doc / stale workflow detection checklist

- Compare workflow headers to [WORKFLOW_STANDARDS.md](./WORKFLOW_STANDARDS.md).
- Compare the live tree to [SCHEDULE_MATRIX.md](./SCHEDULE_MATRIX.md).
- Confirm the operator guidance in [RUNBOOK.md](./RUNBOOK.md) still matches the actual manual inputs.
- Confirm compatibility aliases in `package.json` still point to the intended lane scripts and are not being mistaken for scheduler owners.

## When to use manual reruns

- Use a manual rerun when:
  - a scheduled lane failed and the cause is understood
  - you need a fresh report artifact
  - a safe report-only or dry-run preview will help decide next action
- Prefer the first rerun mode to be:
  - `report_only=true`
  - `dry_run=true`
  - `target_scope=fast-*`, `policy-only`, `repo-rollups-only`, or `sample`

## When to stop and rollback

- Stop and consider rollback when:
  - a manual live run changes more state than expected
  - a mutative lane fails after partial completion and the blast radius is unclear
  - reservoir or maintenance behavior looks repetitive or unstable
  - operators need repeated non-report-only reruns just to keep the system limping along
- In those cases:
  - disable the affected lane first if needed
  - open or update an automation issue with `rollback-watch`
  - follow [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
