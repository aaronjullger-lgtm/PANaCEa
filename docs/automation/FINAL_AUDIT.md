# Final Automation Audit

Audit date: `2026-04-16`

Plain verdict:
- The live scheduled automation architecture looks good overall.
- I did not find any live duplicate cron schedules.
- I did not find any canonical current-state automation doc that still claims the old workflow architecture is current.
- A small number of non-blocking inconsistencies remain, and one operationally significant deferred item is still intentionally scheduled: `sched-reservoir-supply.yml`.

## Implemented workflow inventory

| Workflow | Cadence (UTC) | Purpose | Current state |
| --- | --- | --- | --- |
| `sched-runtime-sanity.yml` | `17 * * * *` | hourly runtime sanity checks | implemented |
| `sched-reservoir-supply.yml` | `25 */2 * * *` | transitional reservoir maintenance and replenishment | implemented, intentionally deferred from final destination |
| `sched-daily-learning-models.yml` | `13 3 * * *` | learner-model refresh | implemented |
| `sched-daily-ops.yml` | `27 4 * * *` | daily rollups plus safe endpoint fanout | implemented |
| `sched-content-audit.yml` | `41 5 * * *` | read-only content and integrity audit | implemented |
| `sched-weekly-platform-report.yml` | `18 6 * * 0` | weekly operator reporting | implemented |
| `sched-weekly-maintenance.yml` | `47 7 * * 0` | bounded weekly backup and cleanup | implemented |
| `sched-weekly-repo-hygiene.yml` | `23 8 * * 6` | repo-only workflow and dependency hygiene | implemented |
| `sched-monthly-deep-audit.yml` | `29 9 1 * *` | monthly deep audit packet | implemented |

Static checks confirmed:
- all 9 scheduled workflows expose `workflow_dispatch`
- all 9 use explicit `permissions`
- all 9 define `concurrency`
- all 9 have timeout coverage
- all 9 use non-top-of-hour cron minutes
- all 9 avoid `continue-on-error` on scheduled primary work

## Remaining concerns

1. Workflow header metadata is still inconsistent outside the scheduled portfolio.
   - Scheduled workflows now use `trigger strategy` and `failure behavior`.
   - Non-scheduled workflows such as `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/playwright.yml`, `.github/workflows/neon_workflow.yml`, and `.github/workflows/cloud-agents.yml` still use the older `triggers` / `failure action` wording.
   - This is a documentation/consistency issue, not a scheduler bug.
2. `package.json` still exposes compatibility aliases that can look like scheduler owners at a glance.
   - `automation:daily`
   - `automation:weekly`
   - `automation:monthly`
   - `maintenance:weekly`
   - `automation:monthly` and `automation:monthly:deep-audit` point to the same script.
3. `docs/automation/scheduled-jobs-audit.md` still surfaces removed workflows and old counts in grep results.
   - This is acceptable because the document has an explicit historical banner.
   - It is still noisy for search-based audits.

## Intentional deferred items

- `sched-reservoir-supply.yml` remains scheduled on GitHub Actions as a transitional exception until reservoir ownership moves into runtime queue processing.
- Dead-man switch / missed-run alerting is still not implemented.
- Backup restore verification is still not implemented.
- `functions/api/cron/calibrate-items.ts` is still not re-homed into the daily learning-model lane.
- `functions/api/cron/analyze-exam-outcomes.ts` is still not scheduler-ready.
- Compatibility wrapper scripts remain intentionally present:
  - `scripts/automation/dailyTasks.ts`
  - `scripts/automation/weeklyTasks.ts`

## Verified removals

Confirmed absent from the current tree:
- `.github/workflows/automation-platform-health.yml`
- `.github/workflows/automation-daily-analytics.yml`
- `.github/workflows/automation-daily-personalization.yml`
- `.github/workflows/automation-weekly-maintenance.yml`
- `.github/workflows/automation-monthly-governance.yml`
- `.github/workflows/hourly-automation.yml`
- `.github/workflows/daily-automation.yml`
- `.github/workflows/weekly-automation.yml`
- `deployment/cron/panacea.cron`

Also verified:
- `cloud-agents.yml` has no `schedule:` trigger.

## Verified new additions

Confirmed present in the current tree:
- `.github/workflows/_automation-lane.yml`
- `.github/workflows/sched-runtime-sanity.yml`
- `.github/workflows/sched-reservoir-supply.yml`
- `.github/workflows/sched-daily-learning-models.yml`
- `.github/workflows/sched-daily-ops.yml`
- `.github/workflows/sched-content-audit.yml`
- `.github/workflows/sched-weekly-platform-report.yml`
- `.github/workflows/sched-weekly-maintenance.yml`
- `.github/workflows/sched-weekly-repo-hygiene.yml`
- `.github/workflows/sched-monthly-deep-audit.yml`

Relevant package scripts now present:
- `automation:hourly`
- `automation:daily:learning-models`
- `automation:daily:ops`
- `automation:daily:content-audit`
- `automation:weekly:report`
- `automation:weekly:maintenance`
- `automation:weekly:repo-hygiene`
- `automation:monthly:deep-audit`

Review and operator handoff docs now present:
- `docs/automation/PR_SUMMARY.md`
- `docs/automation/ROLLOUT_NOTES.md`
- `docs/automation/ROLLBACK_PLAN.md`

## Confidence assessment

- High confidence in the static repo state.
  - Workflow tree, package scripts, and automation docs now mostly align.
  - No live duplicate cron windows were found.
  - Canonical docs reflect the current `sched-*` portfolio.
- Medium confidence in runtime behavior.
  - This audit re-scanned the repo and workflow definitions.
  - It did not execute every workflow, every endpoint fanout, or every maintenance path end-to-end.

Plain assessment:
- The refactor is in good shape for review.
- The remaining questions are specific and known, not broad uncertainty.

## Recommended next manual checks

1. Manually dispatch `sched-weekly-repo-hygiene.yml` and confirm the workflow-policy checks agree with the live workflow tree.
2. Manually dispatch `sched-runtime-sanity.yml` and inspect `logs/hourly/` artifacts plus the step summary.
3. Manually dispatch `sched-daily-ops.yml` and inspect `logs/automation-http/` for endpoint fanout clarity.
4. Manually dispatch `sched-weekly-platform-report.yml` and verify the weekly report artifact set is readable and complete.
5. Inspect the first natural or manual run of `sched-weekly-maintenance.yml` carefully, especially:
   - `backups/**`
   - weekly maintenance JSON/markdown artifacts
6. Inspect the next run of `sched-reservoir-supply.yml` specifically for:
   - unexpected refill churn
   - duplicate operational side effects
   - clean HTTP logs for `/api/cron/reservoir-maintenance` and `/api/cron/replenish-pool`
7. Decide whether to normalize the non-scheduled workflow header keys to match `WORKFLOW_STANDARDS.md`.
8. Decide whether to keep or retire the compatibility aliases in `package.json`:
   - `automation:daily`
   - `automation:weekly`
   - `automation:monthly`
