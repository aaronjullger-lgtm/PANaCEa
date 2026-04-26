# Automation Changelog

## 2026-04-16

### Governance layer and manual-run hardening

- Added a role-based automation governance package:
  - [JOB_OWNERSHIP.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/JOB_OWNERSHIP.md)
  - [RUNBOOK.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/RUNBOOK.md)
  - [OPERATOR_DASHBOARD.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/OPERATOR_DASHBOARD.md)
  - [FUTURE_BACKLOG.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/FUTURE_BACKLOG.md)
  - [labels-automation-recommendation.md](/Users/aaronullger/GitHub/StudyPANaCEa/.github/labels-automation-recommendation.md)
  - [CODEOWNERS](/Users/aaronullger/GitHub/StudyPANaCEa/CODEOWNERS) as a recommendation template pending real GitHub handles
- Hardened manual workflow dispatch behavior across the live lanes:
  - report-only or dry-run defaults on risky manual paths
  - `target_scope` choices for narrower reruns
  - `skip_expensive_steps` on report-heavy lanes
  - explicit `environment_guard` inputs before live mutation or production endpoint fanout
- Added real preview/report-only behavior to the supporting scripts where the workflows needed it:
  - [dailyLearningModels.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyLearningModels.ts)
  - [dailyOps.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyOps.ts)
  - [weeklyMaintenance.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyMaintenance.ts)
  - [weeklyRepoHygiene.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyRepoHygiene.ts)
  - [userProfileEnrichment.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/jobs/userProfileEnrichment.ts)
- Reworked [sched-reservoir-supply.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-reservoir-supply.yml) into a custom guarded lane so manual runs default to report-only and require an explicit live-mutation opt-in.

Why this pass:
- The refactor was structurally complete, but operator safety and governance still depended too much on shared memory.
- This pass makes manual reruns safer, clarifies role ownership, and gives the repo a credible follow-up governance model without changing the core schedule architecture.

### Follow-up governance and issue intake

- Standardized the remaining non-scheduled workflow metadata headers in:
  - [ci.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/ci.yml)
  - [deploy.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/deploy.yml)
  - [playwright.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/playwright.yml)
  - [neon_workflow.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/neon_workflow.yml)
  - [cloud-agents.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/cloud-agents.yml)
- Added GitHub issue forms for the new automation system:
  - [automation-failure.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/ISSUE_TEMPLATE/automation-failure.yml)
  - [automation-drift.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/ISSUE_TEMPLATE/automation-drift.yml)
  - [automation-change-request.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/ISSUE_TEMPLATE/automation-change-request.yml)
- Updated [ROLLOUT_NOTES.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/ROLLOUT_NOTES.md) and [WORKFLOW_STANDARDS.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/WORKFLOW_STANDARDS.md) so operators have a clear path for reporting workflow failures, automation drift, and post-refactor change requests.

Why this pass:
- The final audit showed the remaining gaps were mostly governance and metadata consistency, not architecture breakage.
- The new issue forms make it easier to track failed runs, stale docs, cron drift, unsafe requests, and deferred safeguards without reopening the workflow architecture itself.

### Hourly runtime sanity migration

- Migrated the live hourly scheduled behavior into [sched-runtime-sanity.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-runtime-sanity.yml).
- Removed [automation-platform-health.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-platform-health.yml) so there is no duplicate scheduled hourly owner.
- Kept the hourly cadence at `17 * * * *` because the future-state schedule matrix still defines runtime sanity as an hourly lane.
- Updated [hourlyTasks.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/hourlyTasks.ts) to keep only GitHub-cron-appropriate checks:
  - database connectivity
  - Gemini API reachability
  - failed background job monitoring
  - queue health visibility
  - published content availability
- Removed the old local process memory check because it measured the GitHub runner process rather than PANaCEa production health.
- Added markdown summary output next to the JSON hourly report so the workflow can append a useful `GITHUB_STEP_SUMMARY` and upload readable artifacts even on failure.
- Kept permissions minimal, concurrency non-overlapping, Node pinned to `22`, and artifact retention explicit to match PANaCEa workflow standards.

Why this pass:
- The runtime sanity lane is the cleanest current scheduled surface and the safest first migration target.
- It demonstrates the future-state workflow shape without moving risky runtime ownership like reminders or reservoir maintenance into GitHub cron.

### Daily automation split migration

- Replaced the old scheduled daily owners [automation-daily-analytics.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-daily-analytics.yml) and [automation-daily-personalization.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-daily-personalization.yml) with the target purpose-based workflows:
  - [sched-daily-learning-models.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-daily-learning-models.yml)
  - [sched-daily-ops.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-daily-ops.yml)
  - [sched-content-audit.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-content-audit.yml)
- Added repo-hosted daily entrypoints with JSON plus markdown artifact output:
  - [dailyLearningModels.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyLearningModels.ts)
  - [dailyOps.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyOps.ts)
  - [dailyContentAudit.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyContentAudit.ts)
- Converted [dailyTasks.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/dailyTasks.ts) into a manual compatibility wrapper so `npm run automation:daily` no longer hides a scheduled catch-all owner.
- Kept these daily production cron endpoints inside GitHub cron because they are bounded, rerun-safe derived-data refresh:
  - `/api/cron/aggregate-analytics`
  - `/api/cron/aggregate-distributions`
  - `/api/cron/daily-prescription`
  - `/api/cron/generate-daily-insights`
- Removed `push-reminders` from GitHub cron because it is user-visible and not safe for blind reruns.
- Removed queue cleanup and FSRS optimization enqueueing from the repo-side daily script so the daily scheduled path no longer owns queue/runtime responsibilities.

Why this pass:
- The old daily automation mixed operational rollups, content audit, queue cleanup, FSRS job scheduling, and user-facing personalization in the same schedule window.
- The split lanes make reruns safer, failure modes more legible, and the intended owner of each daily concern explicit.

### Weekly maintenance and reporting split

- Replaced the mixed weekly owner [automation-weekly-maintenance.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-weekly-maintenance.yml) with the target purpose-based workflows:
  - [sched-weekly-platform-report.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-weekly-platform-report.yml)
  - [sched-weekly-maintenance.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-weekly-maintenance.yml)
- Added repo-hosted weekly entrypoints with JSON plus markdown artifact output:
  - [weeklyPlatformReport.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyPlatformReport.ts)
  - [weeklyMaintenance.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyMaintenance.ts)
- Converted [weeklyTasks.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyTasks.ts) into a manual compatibility wrapper so `npm run automation:weekly` no longer hides scheduled ownership.
- Kept [weekly-maintenance.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/weekly-maintenance.ts) as manual-only operator tooling and made that status explicit in the file header.
- Kept the weekly report lane read-heavy:
  - local weekly platform report generation
  - `scripts/db/audit-user-progress.ts` with optional CSV packet export
  - `/api/cron/compute-item-metrics` as a psychometric snapshot endpoint
- Kept the weekly maintenance lane narrow:
  - backup snapshot generation
  - historical `BackgroundJob` retention cleanup
- Removed `db:orchestrate`, `content-quality-loop`, and `calibrate-items` from weekly GitHub cron so the new weekly lanes do not inherit broad mutation by accident.

Why this pass:
- The previous weekly lane mixed reporting, cleanup, backup, psychometrics, and operator-grade AI content mutation in one rerun-unsafe schedule.
- Weekly reporting and weekly maintenance have different failure semantics, different artifact needs, and different reasons to rerun.

Risky assumptions and unresolved items:
- `functions/api/cron/analyze-exam-outcomes.ts` is still not scheduler-ready, so it remains deferred rather than being silently folded into the new weekly report lane.
- `functions/api/cron/calibrate-items.ts` no longer runs in weekly cron and has not yet been re-homed into `sched-daily-learning-models.yml`; that gap is intentional until the model-refresh lane is ready for incremental writes.
- `SyncQueue` cleanup remains deferred because the repo does not define a stable completed/failed retention contract for that table.
- Weekly backup durability is still an interim compromise: the new lane preserves runner-generated backup output through Actions artifacts rather than an external backup target or restore-verification flow.

### Cloud-agent scheduling hardening

- Kept [cloud-agents.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/cloud-agents.yml) unscheduled and made the no-cron rule explicit in the workflow header, manual-dispatch summary, and supporting docs.
- Preserved the existing PR/push path-scoped agent jobs:
  - `edge-guard`
  - `living-docs`
  - `asset-perf`
  - `schema-sync`
  - `e2e-gap`
  - `pr-review`
- Improved manual dispatch ergonomics:
  - `agent_job` is now a typed choice input
  - operators can set `target_branch`
  - operators can provide `changed_files_override`
  - `security-sentinel` now accepts explicit `package_name`, `package_version`, and `advisory_url` inputs
- Added validation so `security-sentinel` only runs with concrete advisory context and only against `main`.
- Updated [run-from-ci.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/cloud-agents/run-from-ci.ts), [trigger.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/cloud-agents/trigger.ts), and [bulk-repos.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/cloud-agents/bulk-repos.ts) to document the manual-only expectation for generic or advisory-driven agent runs.

Why this pass:
- The historical nightly `security-sentinel` job was too blunt. It created recurring AI work with unclear incremental value unless a concrete advisory was already in hand.
- PANaCEa gets better value from event-driven agent work tied to changed files and from operator-triggered security remediation tied to a specific package advisory.

Final rationale:
- Keep cloud agents where they are strongest: PR/push review automation and explicit operator intervention.
- Do not let cloud-agent scheduling drift back into recurring open-ended review or repair work with no bounded scope.

### Repo hygiene and deep audit implementation

- Activated [sched-weekly-repo-hygiene.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-weekly-repo-hygiene.yml) as the new recurring repo-only maintenance lane.
- Added [weeklyRepoHygiene.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/weeklyRepoHygiene.ts) to produce JSON, markdown, and log artifacts for:
  - `npm audit --omit=dev`
  - workflow policy checks against `.github/workflows/*.yml`
  - `audit:prisma`
  - `audit:zod`
  - `audit:services`
  - `audit:components`
  - `prettier --check` for workflows and automation docs
- Activated [sched-monthly-deep-audit.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-monthly-deep-audit.yml) as the new recurring long-horizon audit lane.
- Refactored [monthlyGovernance.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/monthlyGovernance.ts) into a report-first deep-audit packet with optional manual-dispatch skips for:
  - AI/content drift detection
  - search-vector coverage audit
  - AI content sample review
  - question-to-condition linkage audit in `--audit-only` mode
  - media backlog coverage audit
- Converted [automation-monthly-governance.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-monthly-governance.yml) into a manual-only compatibility workflow so the repo does not keep two monthly schedulers alive.
- Added [commandRunner.ts](/Users/aaronullger/GitHub/StudyPANaCEa/scripts/automation/shared/commandRunner.ts) so the new audit lanes can capture per-task logs without duplicating subprocess boilerplate.

Why this pass:
- `sched-weekly-repo-hygiene.yml` and `sched-monthly-deep-audit.yml` were the remaining high-value lanes in the target architecture that had real backing scripts and clear operator value.
- Weekly repo hygiene is justified because PANaCEa already has repo audit scripts and workflow-standard debt worth checking outside production runtime.
- Monthly deep audit is justified because PANaCEa already had a monthly governance script plus concrete read-only audit scripts for drift, search coverage, linkage quality, and media backlog.

Risky assumptions and unresolved items:
- The workflow policy audit is intentionally text-based instead of YAML-AST-based so it can run from repo code without adding another parsing dependency; if workflow syntax patterns diversify, the checker may need to become more structured.
- `scripts/db/sample-ai-content.ts` and `scripts/media/audit-media-needs.ts` remain report-producing utilities rather than strict pass/fail gates; that is intentional because their value is operator review, not automated remediation.

### Superseded workflow retirement cleanup

- Deleted [automation-monthly-governance.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/automation-monthly-governance.yml).
- Did not retire the live reservoir supply lane because it still owns production reservoir maintenance and does not yet have an implemented runtime-owned replacement.
- Added [BEFORE_AFTER_MATRIX.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/BEFORE_AFTER_MATRIX.md) to make the retirement mapping explicit.
- Updated the canonical automation docs so the live architecture points only at:
  - `sched-runtime-sanity.yml`
  - `sched-reservoir-supply.yml`
  - `sched-daily-learning-models.yml`
  - `sched-daily-ops.yml`
  - `sched-content-audit.yml`
  - `sched-weekly-platform-report.yml`
  - `sched-weekly-maintenance.yml`
  - `sched-weekly-repo-hygiene.yml`
  - `sched-monthly-deep-audit.yml`
- Added a historical banner to [scheduled-jobs-audit.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/scheduled-jobs-audit.md) so it is not mistaken for the current workflow inventory.

Why this pass:
- The monthly compatibility wrapper no longer provided any unique operator function because the new weekly repo-hygiene and monthly deep-audit lanes already expose manual dispatch.
- Removing it eliminates the last legacy workflow filename that could be mistaken for a still-supported scheduler authority.

### Final scheduled-workflow hardening

- Renamed the live reservoir lane from `automation-reservoir-supply.yml` to [sched-reservoir-supply.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/sched-reservoir-supply.yml) so the active scheduled portfolio now uses a consistent `sched-` naming convention.
- Kept the reservoir lane scheduled only as a documented transitional exception while runtime queue ownership is still pending.
- Tightened [._automation-lane.yml](/Users/aaronullger/GitHub/StudyPANaCEa/.github/workflows/_automation-lane.yml) so shared shell execution only exposes the minimum current secrets (`DATABASE_URL`, `PRODUCTION_URL`, `CRON_SECRET`) and reusable-lane summaries now include timeout, retention, and next-step guidance.
- Added clearer operator summaries to the direct scheduled workflows so daily, monthly, repo-hygiene, and runtime lanes now point directly at artifact directories and rerun guidance.
- Made artifact retention explicit across the remaining reusable-lane callers:
  - `sched-reservoir-supply.yml`: `14` days
  - `sched-weekly-maintenance.yml`: `14` days
  - `sched-weekly-platform-report.yml`: `21` days
- Revalidated the live scheduled set after the rename/hardening pass:
  - every scheduled workflow exposes `workflow_dispatch`
  - permissions are explicit and minimal
  - concurrency groups are present and non-overlapping
  - timeouts are explicit
  - Node `22` remains the repo standard
  - all cron expressions avoid top-of-hour and use unique minute offsets
  - no scheduled primary step uses `continue-on-error`

Why this pass:
- The structural refactor was already in place; the remaining work was to remove the last naming drift, make operator guidance more explicit, and ensure the final live cron tree meets the workflow standards it now documents.

### Review package handoff

- Added [PR_SUMMARY.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/PR_SUMMARY.md) to give reviewers a concise explanation of what changed, why the old model was insufficient, what workflows were removed or added, and which follow-ups remain open.
- Added [ROLLOUT_NOTES.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/ROLLOUT_NOTES.md) to document rollout order, first manual triggers, post-merge monitoring points, and duplicate-schedule checks.
- Added [ROLLBACK_PLAN.md](/Users/aaronullger/GitHub/StudyPANaCEa/docs/automation/ROLLBACK_PLAN.md) to document immediate containment order, files to restore, rollback cautions, and how to return to the previous schedule model if necessary.

Why this pass:
- The workflow refactor is large enough that review quality depends on a clear operator handoff.
- These docs are intentionally operational and concise so the reviewer, merger, and on-call operator can use the same source material.
