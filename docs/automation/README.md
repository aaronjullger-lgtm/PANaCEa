# Automation

This document is the canonical automation reference for the repository. It supersedes the older ad hoc automation docs that still mention the retired local-cron path.

Workflow retirement mapping:

- [docs/automation/BEFORE_AFTER_MATRIX.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/BEFORE_AFTER_MATRIX.md)

## Architecture

- GitHub Actions is the only scheduler authority for recurring automation.
- Scheduled lanes use `.github/workflows/_automation-lane.yml` where it reduces maintenance burden, and use direct workflow jobs when a lane needs segment-specific gating, summaries, or artifacts.
- Production cron endpoints are invoked from GitHub Actions with `PRODUCTION_URL` and `CRON_SECRET` when the work must happen against the live Pages deployment.
- Repo-hosted maintenance scripts run directly in GitHub Actions only when the work is safe to run against repository code plus configured secrets.

## Schedule Matrix

| Lane                   | Workflow                                             | Schedule (UTC) | Primary work                                                                      | Secrets                                         |
| ---------------------- | ---------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| Runtime Sanity         | `.github/workflows/sched-runtime-sanity.yml`         | `17 * * * *`   | `npm run automation:hourly`                                                       | `DATABASE_URL`, `GEMINI_API_KEY`                |
| Reservoir Supply       | `.github/workflows/sched-reservoir-supply.yml`       | `25 */2 * * *` | `reservoir-maintenance`, `replenish-pool`                                         | `PRODUCTION_URL`, `CRON_SECRET`                 |
| Daily Learning Models  | `.github/workflows/sched-daily-learning-models.yml`  | `13 3 * * *`   | `npm run automation:daily:learning-models`                                        | `DATABASE_URL`                                  |
| Daily Ops              | `.github/workflows/sched-daily-ops.yml`              | `27 4 * * *`   | `npm run automation:daily:ops`, analytics fanout, prescription + insight refresh  | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` |
| Content Audit          | `.github/workflows/sched-content-audit.yml`          | `41 5 * * *`   | `npm run automation:daily:content-audit`, `db:health`, `db:completeness`          | `DATABASE_URL`                                  |
| Weekly Platform Report | `.github/workflows/sched-weekly-platform-report.yml` | `18 6 * * 0`   | `npm run automation:weekly:report`, weekly progress audit, psychometric snapshot  | `DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET` |
| Weekly Maintenance     | `.github/workflows/sched-weekly-maintenance.yml`     | `47 7 * * 0`   | `npm run automation:weekly:maintenance`, backup, background-job retention cleanup | `DATABASE_URL`                                  |
| Weekly Repo Hygiene    | `.github/workflows/sched-weekly-repo-hygiene.yml`    | `23 8 * * 6`   | `npm run automation:weekly:repo-hygiene`                                          | none                                            |
| Monthly Deep Audit     | `.github/workflows/sched-monthly-deep-audit.yml`     | `29 9 1 * *`   | `npm run automation:monthly:deep-audit`                                           | `DATABASE_URL`, optional `DIRECT_DATABASE_URL`  |

All scheduled lanes also expose `workflow_dispatch` for operator reruns.

## Lane Registry & Validation

- `config/automation-lanes.ts` is the machine-readable mirror of the Schedule Matrix (9 lanes: slug, workflow, cron, npmScript, endpoints, purpose).
- `npm run automation:lanes:check` (`scripts/automation/check-lane-registry.ts`) validates registry ↔ workflow files ↔ package.json scripts and flags orphans (umbrella scripts warn by design).
- `npm run scripts:list [filter]` (`scripts/help-scripts.mjs`) groups the 160+ npm scripts for navigation.

When adding a lane: add the `sched-*.yml` workflow, then update both the Schedule Matrix above and `config/automation-lanes.ts`; run `npm run automation:lanes:check` to confirm consistency.

## Reusable Workflow Contract

`_automation-lane.yml` accepts:

- optional repo shell commands
- optional production cron endpoint manifest in `METHOD|PATH|JSON_BODY` format
- explicit timeout control
- optional artifact upload paths

This is the only reusable workflow used by the scheduled lanes. It exists to keep maintenance burden low and keep schedules, permissions, and failure semantics consistent.

## Manual-Only Surfaces

- `cloud-agents.yml` is no longer scheduled. `security-sentinel` and the other agent jobs run on PR/push or manual dispatch only.
- Legacy local cron scripts remain in the repo only as historical/manual utilities and are not scheduler authority.

## Retired Surfaces

- `deployment/cron/panacea.cron` has been removed.
- The previous scheduled workflow files `daily-automation.yml`, `hourly-automation.yml`, `weekly-automation.yml`, and `automation-weekly-maintenance.yml` have been replaced by the named automation lanes above.
- `automation-monthly-governance.yml` has been retired. Its remaining operator value was fully absorbed by `sched-weekly-repo-hygiene.yml` and `sched-monthly-deep-audit.yml`, both of which already expose `workflow_dispatch`.
- Local-cron installation instructions under `deployment/cron/` are retired. GitHub Actions owns recurring execution.

## Operational Notes

- Avoid top-of-hour schedules so automation does not stack with common shared-infrastructure peaks.
- Use `contents: read` unless a workflow truly needs broader scope.
- Scheduled lanes use concurrency groups so a slow run does not overlap the next one.
- Lane failures should be treated as data freshness or platform health incidents, not ignored noise.
- `sched-reservoir-supply.yml` is the only intentional transitional exception in the scheduled portfolio; it remains on GitHub cron only until runtime-owned reservoir maintenance is implemented.
