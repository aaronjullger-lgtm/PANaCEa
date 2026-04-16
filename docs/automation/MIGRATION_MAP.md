# PANaCEa Automation Migration Map

Source documents:
- `docs/automation/scheduled-jobs-audit.md`
- `docs/automation/SCHEDULE_MATRIX.md`

Decision intent:
- move from broad cadence-based bundles to purpose-based workflows
- keep GitHub cron for safe, observable, rerunnable work
- move runtime-critical or user-visible side effects toward queue/runtime ownership
- keep high-risk mutation and AI-heavy remediation manual by default

## Implementation notes

### 2026-04-16: Hourly runtime sanity migration

- `sched-runtime-sanity.yml` now owns the live hourly schedule at `17 * * * *`.
- `.github/workflows/automation-platform-health.yml` was removed to prevent duplicate scheduled execution.
- `scripts/automation/hourlyTasks.ts` kept the checks that are meaningful from GitHub Actions:
  - database connectivity
  - Gemini reachability
  - failed background job count
  - queue health visibility
  - published content availability
- The old local process memory check was removed because it only measured the GitHub runner process, not PANaCEa production runtime health.
- The hourly script now emits both JSON and markdown artifacts under `logs/hourly/`, and the workflow appends the latest markdown report to `GITHUB_STEP_SUMMARY`.
- No cadence reduction was applied in this pass because the current target architecture still calls for an hourly runtime sanity lane.

### 2026-04-16: Daily lane split migration

- `.github/workflows/sched-daily-learning-models.yml` now owns the scheduled learner-model refresh lane at `13 3 * * *`.
- `.github/workflows/sched-daily-ops.yml` now owns the scheduled daily ops lane at `27 4 * * *`.
- `.github/workflows/sched-content-audit.yml` now owns the scheduled read-only content audit lane at `41 5 * * *`.
- `.github/workflows/automation-daily-analytics.yml` and `.github/workflows/automation-daily-personalization.yml` were removed so there is no duplicate scheduled daily owner.
- `scripts/automation/dailyTasks.ts` is now a manual compatibility wrapper that delegates to the three split daily entrypoints rather than remaining a scheduled catch-all.
- `scripts/automation/dailyOps.ts` now owns repo-hosted daily rollups, emits JSON plus markdown artifacts under `logs/daily-ops/`, and keeps safe production endpoint fanout in the workflow instead of mixing it into the script.
- `scripts/automation/dailyLearningModels.ts` now owns bounded user-profile enrichment reporting under `logs/daily-learning-models/`.
- `scripts/automation/dailyContentAudit.ts` now owns the read-only content validation path plus `db:health` and `db:completeness`, with artifacts under `logs/content-audit/`.
- `push-reminders` was intentionally removed from GitHub cron in this pass because it is user-visible and not safe for blind reruns.
- Queue cleanup and FSRS optimization enqueueing were intentionally removed from the repo-side daily scheduled path to stop daily cron from owning queue/runtime responsibilities.

### 2026-04-16: Repo hygiene and deep audit migration

- `.github/workflows/sched-weekly-repo-hygiene.yml` now owns the recurring repo-only hygiene lane at `23 8 * * 6`.
- `scripts/automation/weeklyRepoHygiene.ts` now emits the weekly repo hygiene packet under `logs/repo-hygiene/`:
  - `npm audit --omit=dev`
  - workflow policy audit for `.github/workflows/*.yml`
  - `audit:prisma`
  - `audit:zod`
  - `audit:services`
  - `audit:components`
  - `prettier --check` for workflows and automation docs
- `.github/workflows/sched-monthly-deep-audit.yml` now owns the recurring monthly deep-audit lane at `29 9 1 * *`.
- `scripts/automation/monthlyGovernance.ts` was narrowed into the monthly deep-audit packet and now runs:
  - `scripts/cron/drift-detector.ts`
  - `scripts/db/audit-search-vector.ts`
  - `scripts/db/sample-ai-content.ts`
  - `scripts/db/link-questions-to-conditions.ts --audit-only`
  - `scripts/media/audit-media-needs.ts`
- `.github/workflows/automation-monthly-governance.yml` has now been retired entirely because the new weekly repo-hygiene lane and monthly deep-audit lane both expose `workflow_dispatch`.

### 2026-04-16: Final scheduled-workflow hardening

- `.github/workflows/sched-reservoir-supply.yml` now owns the live two-hour reservoir lane after renaming the old `automation-reservoir-supply.yml` file to match the `sched-` portfolio.
- The reservoir lane remains a documented transitional exception while queue/runtime ownership is still pending; the hardening pass kept the live behavior but standardized naming, concurrency, summary output, and artifact retention.
- Scheduled workflow summaries now explicitly point operators at artifact directories and next actions on failure.

## Current scheduled GitHub workflows

| Current item | Current location | Current cadence | Future home | Action | Rationale | Risk notes |
| --- | --- | --- | --- | --- | --- | --- |
| Automation - Platform Health | `.github/workflows/automation-platform-health.yml` | `17 * * * *` | `.github/workflows/sched-runtime-sanity.yml` | moves into a new workflow | Implemented: the old scheduled workflow was removed after `sched-runtime-sanity.yml` became the sole hourly owner. | Migration complete for the hourly lane; the remaining risk is keeping future runtime sanity scope read-only and non-duplicative. |
| Sched - Reservoir Supply | `.github/workflows/sched-reservoir-supply.yml` | `25 */2 * * *` | `lib/services/queue/jobQueue.ts` + `scripts/backgroundWorker.ts` + reservoir services | moved out of GitHub cron and into app-native/runtime queue responsibility | The lane remains scheduled only as a transitional exception. Reservoir refill and reservation cleanup are runtime-capacity concerns that ultimately need tighter coupling to pool state, retries, and queue backpressure than GitHub cron provides. | High-risk migration because it currently mutates live operational state. Avoid duplicate firing during cutover or creating a second scheduler authority. |
| Automation - Daily Personalization | `.github/workflows/automation-daily-personalization.yml` | `10 3 * * *` | `.github/workflows/sched-daily-ops.yml` for `daily-prescription` and `generate-daily-insights`; app-native reminder queue for `push-reminders` | split across multiple new workflows | The current lane mixes safe daily derived-data refresh with user-visible push delivery. Those have different failure semantics and rerun safety. | `push-reminders` is non-idempotent and user-visible. A blind rerun can duplicate notifications. |
| Automation - Daily Analytics | `.github/workflows/automation-daily-analytics.yml` | `40 3 * * *` | `.github/workflows/sched-daily-ops.yml` for rollups; `.github/workflows/sched-content-audit.yml` for read-only validation; queue/runtime ownership for FSRS enqueueing | split across multiple new workflows | The current lane mixes report generation, content checks, old-job cleanup, and queue scheduling. That is too mixed for clear ownership or rerun safety. | `scripts/automation/dailyTasks.ts` currently bundles report-only steps with DB cleanup and queue mutation. Split before changing cadence. |
| Automation - Weekly Maintenance | `.github/workflows/automation-weekly-maintenance.yml` | `22 7 * * 0` | `.github/workflows/sched-weekly-platform-report.yml` + `.github/workflows/sched-weekly-maintenance.yml` + manual-only operator workflows | split across multiple new workflows | Implemented: the old mixed weekly owner has been removed and replaced with separate report and maintenance lanes. | Migration complete for the weekly split itself. Remaining risk is the deferred re-homing of higher-write psychometric work that no longer belongs in the weekly catch-all. |
| Automation - Monthly Governance | `.github/workflows/automation-monthly-governance.yml` | formerly `35 8 1 * *`, then temporary manual-only compatibility | `.github/workflows/sched-weekly-repo-hygiene.yml` for recurring repo audits; `.github/workflows/sched-monthly-deep-audit.yml` for drift/governance packet | removed | Implemented: the old wrapper had no unique behavior once both new workflows exposed `workflow_dispatch`, so keeping the legacy filename only added confusion. | Retirement removes the final duplicate ownership path for monthly governance work. |
| Cloud Agents | `.github/workflows/cloud-agents.yml` | none scheduled; `push` / `pull_request` / `workflow_dispatch` only | `.github/workflows/cloud-agents.yml` | stays where it is | Implemented: path-scoped review agents stay automatic on code-change events, while `security-sentinel` is now an explicitly validated manual dispatch path with advisory metadata inputs. | Do not reintroduce a scheduled security-sentinel lane. Agent work is investigative and hard to make idempotent, and generic recurring sweeps have unclear operator value. |

## App/runtime cron endpoints

| Current item | Current location | Current cadence | Future home | Action | Rationale | Risk notes |
| --- | --- | --- | --- | --- | --- | --- |
| Daily Analytics Aggregation Cron Endpoint | `functions/api/cron/aggregate-analytics.ts` | `40 3 * * *` via daily analytics workflow | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | This is safe daily derived-data refresh and belongs in the daily ops lane. | Writes aggregated state, so backfill windows and rerun semantics should stay explicit. |
| Answer Distribution Aggregation | `functions/api/cron/aggregate-distributions.ts` | `40 3 * * *` via daily analytics workflow | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | Same domain as daily analytics rollups; it should live with the other report-style daily aggregates. | Low risk if kept read-mostly and incremental. |
| Analyze Exam Outcomes | `functions/api/cron/analyze-exam-outcomes.ts` | none live; file comment says weekly | `.github/workflows/sched-weekly-platform-report.yml` | moves into a new workflow | This is weekly operator reporting, not maintenance. It belongs in a report-only lane after export/auth fixes. | Current export shape is not scheduler-ready. Fix handler wiring before scheduling. |
| Batch Question Generation | `functions/api/cron/batch-generate-questions.ts` | none live; file comment says nightly | manual operator workflow / runbook | converted to manual-only | AI-heavy question generation is expensive, mutative, and hard to make safely unattended. | Long-term it may become queue-owned, but not until budgets, approvals, and quality gates exist. |
| Batch Psychometric Calibration | `functions/api/cron/calibrate-items.ts` | `22 7 * * 0` via historical weekly maintenance workflow | `.github/workflows/sched-daily-learning-models.yml` | moves into a new workflow | Calibration is learning-model refresh, not weekly maintenance or reporting. It should return later in a bounded model lane with incremental batching. | Intentionally left out of the weekly split implementation so the new weekly lanes stay purpose-specific. This endpoint is temporarily unscheduled until its new home is ready. |
| Compute Content Health | `functions/api/cron/compute-content-health.ts` | none live; file comment says nightly/daily | `.github/workflows/sched-content-audit.yml` | moves into a new workflow | Content health should be part of a read-only audit lane, separate from any auto-repair or demotion logic. | Current implementation may persist health scores; keep audit lane report-first and strip mutation where needed. |
| Compute Item Metrics | `functions/api/cron/compute-item-metrics.ts` | `22 7 * * 0` via historical weekly maintenance workflow | `.github/workflows/sched-weekly-platform-report.yml` | moves into a new workflow | The current implementation is read-heavy and returns a useful weekly psychometric snapshot without folding it into maintenance cleanup. | Implemented in the weekly report lane for now; revisit daily placement only after the learning-model lane grows beyond user-profile enrichment. |
| Content Quality Loop | `functions/api/cron/content-quality-loop.ts` | `22 7 * * 0` via weekly maintenance workflow | manual operator workflow / runbook | converted to manual-only | It crosses the line from reporting into AI-driven content mutation. That is the wrong class of work for unattended cron. | High risk: regeneration and flagging side effects make reruns unsafe without operator review. |
| Daily Study Prescription Generator | `functions/api/cron/daily-prescription.ts` | `10 3 * * *` via daily personalization workflow | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | This is safe daily derived-data generation for active users and belongs in the daily ops lane. | Writes user-facing prescription state; keep ordering behind learning-model refresh if that lane is introduced first. |
| Daily Dashboard Insight Generation | `functions/api/cron/generate-daily-insights.ts` | `10 3 * * *` via daily personalization workflow | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | Insight generation is a daily user-facing report path, not a reminder system. | Gemini dependency makes failures noisier; keep separate logs/artifacts from prescriptions. |
| Generate Personalized Daily Study Plans | `functions/api/cron/generate-daily-plans.ts` | none live; file comment says nightly/evening | `.github/workflows/sched-daily-learning-models.yml` | moves into a new workflow | If retained, it belongs with learner-model refresh, not with daily ops or reminders. | Current export is not scheduler-ready. Also overlaps with `daily-prescription` and `userProfileEnrichment`. |
| Batch Variant Generation | `functions/api/cron/generate-variants.ts` | none live; file comment says daily at 4 AM UTC | manual operator workflow / runbook | converted to manual-only | Variant generation is supply mutation and AI-cost heavy. It should not be scheduled blindly. | Longer-term queue ownership is possible, but not before safety budgets and review gates. |
| Nightly Content Health Report | `functions/api/cron/nightly-health-check.ts` | none live; file comment says nightly | `.github/workflows/sched-content-audit.yml` | moves into a new workflow | This is report-only content oversight and should merge into the canonical content audit lane. | Current export is not scheduler-ready, and it overlaps heavily with `compute-content-health`. |
| Populate Prerequisites | `functions/api/cron/populate-prerequisites.ts` | none live; file comment says weekly | manual operator workflow / runbook | converted to manual-only | It is implemented as `authenticatedEndpoint(...)`, so it is not fit for shared-secret cron today. Keep it operator-invoked until auth and blast radius are redesigned. | Graph rebuilds can touch large portions of the knowledge graph. Unsafe to automate casually. |
| Push Reminder Cron Job | `functions/api/cron/push-reminders.ts` | `10 3 * * *` via daily personalization workflow; comment says every 2 hours | app-native reminder scheduler + queue ownership | moved out of GitHub cron and into app-native/runtime queue responsibility | Reminder delivery is user-visible, timezone-sensitive, and not safe as a once-daily GitHub cron call. | This is one of the most dangerous migrations. Avoid duplicate notifications during switchover. |
| Question Pool Replenishment Check | `functions/api/cron/replenish-pool.ts` | `25 */2 * * *` via reservoir supply workflow | queue/runtime reservoir ownership | moved out of GitHub cron and into app-native/runtime queue responsibility | Pool replenishment is part of runtime capacity management and should move closer to reservoir/queue state. | Today it overlaps with `reservoir-maintenance`, generation endpoints, and refill orchestration. |
| Reservoir Maintenance | `functions/api/cron/reservoir-maintenance.ts` | `25 */2 * * *` via reservoir supply workflow | queue/runtime reservoir ownership | moved out of GitHub cron and into app-native/runtime queue responsibility | Reservation expiry, cleanup, refill, and view refresh are operational mutations tied to live supply health. | High-risk cutover because the current endpoint mutates live availability and triggers refill flows. |
| xAPI Export | `functions/api/cron/xapi-export.ts` | none live | manual operator workflow / export runbook | converted to manual-only | Export is a bounded operator/reporting action, not a standing recurring runtime obligation in the repo today. | Safe to rerun technically, but export volume and downstream consumers argue for explicit operator control. |

## Automation scripts and helpers

| Current item | Current location | Current cadence | Future home | Action | Rationale | Risk notes |
| --- | --- | --- | --- | --- | --- | --- |
| Hourly Automation Tasks | `scripts/automation/hourlyTasks.ts` | workflow runs `17 * * * *`; script now documents `sched-runtime-sanity.yml` as the scheduler owner | `.github/workflows/sched-runtime-sanity.yml` | moves into a new workflow | Implemented: the script now powers `sched-runtime-sanity.yml`, emits JSON plus markdown artifacts, and only includes GitHub-cron-appropriate runtime checks. | Completed for this pass; future work should keep the lane free of queue mutation, reminders, reservoir maintenance, and repo-only checks. |
| Daily Automation Tasks | `scripts/automation/dailyTasks.ts` | workflow runs `40 3 * * *`; file comment still says `0 3 * * *` | `.github/workflows/sched-daily-ops.yml` for rollups; `.github/workflows/sched-content-audit.yml` for read-only validation; queue/runtime ownership for FSRS optimization | split across multiple new workflows | It currently mixes content validation, media checks, performance aggregation, old-job deletion, and FSRS enqueueing. That is too broad for safe reruns. | This file duplicates cleanup responsibility with `scripts/cleanupJobs.ts` and overlaps with queue cleanup helpers. Separate report-only and mutative steps first. |
| Weekly Automation Tasks | `scripts/automation/weeklyTasks.ts` | historical workflow ran `22 7 * * 0`; file comment used to say `0 2 * * 0` | `.github/workflows/sched-weekly-platform-report.yml` for reporting; `.github/workflows/sched-weekly-maintenance.yml` for bounded housekeeping; manual operator workflows for mutative maintenance | split across multiple new workflows | Implemented: the script is now a manual compatibility wrapper that runs the report and bounded maintenance entrypoints in sequence. | Scheduled ownership has been removed from this file, which reduces rerun ambiguity but means the old catch-all path is intentionally gone. |
| Monthly Deep Audit Packet | `scripts/automation/monthlyGovernance.ts` | monthly via `29 9 1 * *` | `.github/workflows/sched-monthly-deep-audit.yml` | moves into a new workflow | Implemented: the script now owns only the report-first monthly deep-audit packet after repo-hygiene checks moved into the weekly repo lane. | Keep it report-only; do not re-add dependency audit or mutative remediation to this script. |
| Platform Statistics Job | `scripts/automation/jobs/platformStatistics.ts` | not live; comment says daily at 2 AM UTC | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | Platform rollups belong with daily operational analytics, not as an orphan helper with its own implied schedule. | Overlaps with `aggregate-analytics`; avoid double-computing the same metrics. |
| Content Statistics Job | `scripts/automation/jobs/contentStatistics.ts` | not live; comment says daily at 3 AM UTC | `.github/workflows/sched-daily-ops.yml` | moves into a new workflow | Content usage/accuracy rollups belong beside the other daily aggregate/report work. | Overlaps with `aggregate-analytics` and `dailyTasks.ts`; choose one canonical rollup path. |
| User Profile Enrichment Job | `scripts/automation/jobs/userProfileEnrichment.ts` | not live; comment says daily at 3 AM UTC | `.github/workflows/sched-daily-learning-models.yml` | moves into a new workflow | This is the clearest candidate for the learning-model refresh lane. | It writes learner-profile state; keep the batch bounded and ordered ahead of daily prescriptions. |
| Health Checks and User Statistics Helper Family | `scripts/automation/jobs/healthChecks.ts`; `scripts/automation/jobs/userStatistics.ts`; `scripts/automation/jobs/index.ts` | helper-only; implied hourly/daily/weekly | `.github/workflows/sched-runtime-sanity.yml` for health helpers; `.github/workflows/sched-daily-learning-models.yml` and `.github/workflows/sched-weekly-platform-report.yml` for user-stat/report helpers | split across multiple new workflows | The helper family spans runtime sanity, streak/due-card logic, and weekly report helpers. It should not be treated as one schedule target. | Some helpers are report-only while others feed operational or user-facing derived state. Split by side effect before wiring schedules. |
| FSRS Parameter Optimization | `scripts/automation/jobs/fsrsOptimization.ts` | queue-driven after `dailyTasks.ts` schedules next `3 AM` job | `lib/services/queue/jobQueue.ts` + `scripts/backgroundWorker.ts` | moved out of GitHub cron and into app-native/runtime queue responsibility | FSRS optimization is already a worker job in practice. GitHub Actions should stop being the hidden orchestrator for when it runs. | Current ownership is split between `dailyTasks.ts` and queue helpers. Remove duplicate schedule authority carefully. |

## Queue, runtime, and always-on ownership

| Current item | Current location | Current cadence | Future home | Action | Rationale | Risk notes |
| --- | --- | --- | --- | --- | --- | --- |
| Background Worker Process | `scripts/backgroundWorker.ts` | poll loop every `5000ms` | `scripts/backgroundWorker.ts` | stays where it is | This is already the right runtime home for queue-owned automation. More jobs should move toward it, not away from it. | Needs better heartbeat, lag monitoring, and job-type observability before more responsibility is added. |
| Background Job Queue Service | `lib/services/queue/jobQueue.ts` | embeds next-`3 AM` and random `2-5 AM` scheduling helpers | `lib/services/queue/jobQueue.ts` | stays where it is | The queue library should become the canonical scheduler for runtime-critical asynchronous work. | Hidden schedule logic inside the library can conflict with GitHub cron ownership. Make one system authoritative per job type. |
| PANaCEa Background Job Worker service | `deployment/systemd/panacea-worker.service` | always-on | `deployment/systemd/panacea-worker.service` | stays where it is | Runtime queue work still needs an always-on worker supervisor. | Add watchdog/heartbeat coverage before shifting more recurring responsibility onto it. |
| Offline Background Sync Surface | `public/sw.js`; `public/service-worker.js`; `lib/services/sync/syncManager.ts`; `services/pwaEnhancer.ts`; `lib/utils/serviceWorkerRegistration.ts` | event-driven on reconnect / sync | service-worker and sync runtime ownership | stays where it is | This is already app-native background behavior and should remain outside GitHub cron. | There is duplicate SW logic in two files; keep this out of the scheduled-workflow migration and address separately. |

## Legacy, manual, and operator-driven surfaces

| Current item | Current location | Current cadence | Future home | Action | Rationale | Risk notes |
| --- | --- | --- | --- | --- | --- | --- |
| Weekly Maintenance Suite | `scripts/weekly-maintenance.ts` | historically invoked transitively by `weeklyTasks.ts` | manual operator workflow / runbook | converted to manual-only | It is broad, AI-heavy, and mutative. It should not be part of unattended cron. | Implemented as manual-only in code comments. Keep it supervised until it is broken into explicit operator-grade subcommands. |
| System Health & Monitoring Check | `scripts/system-health.ts` | none; manual | manual operator workflow or CI verification | converted to manual-only | Useful as a diagnostic script, but it is not the canonical recurring runtime lane. | Overlaps with CI and hourly runtime sanity; do not create a second scheduled health authority. |
| Automated Content Pipeline | `scripts/runAutomatedPipeline.ts` | none; manual | manual operator workflow / runbook | converted to manual-only | Content ingestion/generation/orchestration remains too broad and too mutative for unattended use. | Cost and content-quality side effects are too high for default automation. |
| Database Automation Orchestrator | `scripts/orchestrate.ts` | none; manual | manual operator workflow / runbook | converted to manual-only | This is an operator orchestrator, not a safe recurring scheduler target. | It overlaps heavily with `scripts/maintenance/orchestrator.ts` and the weekly suite. |
| Master Database Orchestrator | `scripts/maintenance/orchestrator.ts` | indirectly weekly through current weekly workflow | manual operator workflow / runbook | converted to manual-only | Registry sync, validation, optional repair, and DB-to-local write-back are not suitable inside unattended GitHub cron. | Dangerous because repair and write-back can make large state changes. |
| Emergency Backup | `scripts/emergency_backup.ts` | historically weekly through the mixed weekly workflow | `.github/workflows/sched-weekly-maintenance.yml` | moves into a new workflow | Backup is one of the few bounded maintenance tasks that should stay scheduled. | Implemented in the weekly maintenance lane. Durable storage is still an interim compromise because the workflow currently preserves the runner-produced snapshot via Actions artifacts rather than an external backup target. |
| Emergency Restore | `scripts/emergency_restore.ts` | manual only | manual operator workflow / recovery runbook | converted to manual-only | Restore is an emergency path, not routine automation. | Destructive if pointed at the wrong dataset or backup set. |
| Job Scheduler (retired local cron path) | `scripts/scheduleJobs.ts` | retired local cron; file still documents `0 0 * * *` | none | removed | It belongs to the old local-cron architecture and conflicts with current ownership. | Leaving it around as if active invites duplicate scheduling. |
| Content Health Checker (deprecated) | `scripts/contentHealthChecker.ts` | historical nightly | none | removed | It has been superseded by the content audit path and should not remain as a second implied owner. | Its existence reinforces health-check sprawl and comment drift. |
| Cleanup Old Jobs (deprecated) | `scripts/cleanupJobs.ts` | historical weekly `0 4 * * 0` | none; replacement logic now lives in `scripts/automation/weeklyMaintenance.ts` | removed | The standalone scheduler path is dead, and its cleanup responsibility duplicates modern queue/maintenance ownership. | The file remains deprecated, but the bounded background-job retention logic has already been rehomed into the new weekly maintenance lane. |
| AI Content Drift Detector | `scripts/cron/drift-detector.ts` | currently monthly through `monthlyGovernance.ts`; file comment implies weekly | `.github/workflows/sched-monthly-deep-audit.yml` | moves into a new workflow | Drift detection is a deep audit concern and should stay report-only inside the monthly audit packet. | Keep it report-only; do not turn it into auto-regeneration. |
| Search Vector Coverage Audit | `scripts/db/audit-search-vector.ts` | none live | `.github/workflows/sched-monthly-deep-audit.yml` | moves into a new workflow | Search-vector null coverage is a long-horizon audit signal, not a daily operator task. | Keep it report-only; backfill remains manual when nulls are found. |
| AI Content Sample Review | `scripts/db/sample-ai-content.ts` | none live | `.github/workflows/sched-monthly-deep-audit.yml` | moves into a new workflow | Random AI-content sampling is valuable as a monthly governance packet, but not as a daily job. | Output is qualitative; use it for review packets, not for automatic pass/fail gating. |
| Cache Warmer (deprecated) | `functions/cache-warmer.ts` | none in current architecture | none | removed | This belongs to the retired Pages-cron path and should not survive as a pseudo-live scheduler target. | Comments around it can mislead operators into thinking Pages cron is active. |
| DB Monitoring and Audit Family | `scripts/db/data-integrity-monitor.ts`; `scripts/db/content-completeness-dashboard.ts`; `scripts/db/audit-user-progress.ts` | none live | `.github/workflows/sched-content-audit.yml` for content/data audits; `.github/workflows/sched-weekly-platform-report.yml` for progress audit | split across multiple new workflows | These scripts are exactly the kind of report-only work the future architecture wants, but they belong in different lanes by purpose. | `audit-user-progress.ts` is now wired into the weekly report lane with optional CSV exports. Keep the rest read-only and do not let audit scripts silently mutate or repair data. |
| Question-to-Condition Linkage Audit | `scripts/db/link-questions-to-conditions.ts --audit-only` | none live | `.github/workflows/sched-monthly-deep-audit.yml` | split across multiple new workflows | The audit-only mode is read-only and valuable in the monthly governance packet, while apply mode remains a manual repair path. | Keep `--apply`, `--link-questions`, and `--link-pregen` manual-only to avoid unattended content mutation. |
| DB Mutative Quality Family | `scripts/db/auto-deprecate-flagged-questions.ts`; `scripts/db/enrich-critical-conditions.ts`; `scripts/db/unify-condition-medicalcontent.ts`; `scripts/db/link-questions-to-conditions.ts --apply` | none live | manual operator workflow / runbook | converted to manual-only | These are DB/content mutation tools, not scheduled reporting. | Several members can directly alter clinical content or availability state. |
| DB Normalization and Repair Family | `scripts/db/normalize-formatting-unified.ts`; `scripts/db/normalize-formatting.ts`; `scripts/db/normalize-systems.ts`; `scripts/db/fix-optional-nulls.ts`; `scripts/db/revert-none-to-null.ts`; `scripts/db/apply-fulltext-search.ts`; `scripts/db/backfill-search-vector.ts`; `scripts/db/consolidate-condition-hierarchy.ts` | none live | manual operator workflow / runbook | converted to manual-only | These are migration/repair tools and should stay explicit, scoped, and reviewed. | Some members need `DIRECT_DATABASE_URL` and can make broad irreversible changes. |
| Image Acquisition Planning Family | `scripts/images/image-acquisition-workflow.ts`; docs under `scripts/images/` | none live | manual operator workflow / planning runbook | converted to manual-only | Planning is operator work, not recurring cron. | Safe enough to run, but not valuable as unattended automation. |
| Image Fetch Family | `scripts/images/clinical-image-fetcher.ts`; `scripts/images/bulk-image-fetcher.ts`; `scripts/images/fetch-*.ts` | none live | manual operator workflow / runbook | converted to manual-only | External media acquisition has cost, licensing, and quality-control implications. | Dangerous unattended because it can ingest large volumes of low-quality or mismatched media. |
| Image Processing Family | `scripts/images/process-curated-images.ts`; `scripts/images/process-curated-strict.ts`; `scripts/images/process-images-pipeline.ts`; `scripts/images/process-local-images.ts`; helper modules | none live | manual operator workflow / runbook | converted to manual-only | Image analysis and upload are high-volume mutative operations with AI gates and storage side effects. | Unsafe to schedule by default because reruns can create duplicates or churn storage. |
| Media Coverage Backlog Audit | `scripts/media/audit-media-needs.ts` | none live | `.github/workflows/sched-monthly-deep-audit.yml` | moves into a new workflow | Media backlog trends are useful monthly and pair well with the rest of the deep content-governance packet. | Keep it read-only and avoid turning it into unattended acquisition or cleanup. |
| Image Audit and Cleanup Family | `scripts/images/audit-and-clean-images.ts`; `scripts/images/audit-db-images.ts`; `scripts/images/delete-unreviewed-images.ts` | none live | manual operator workflow / runbook | converted to manual-only | Cleanup/deletion against production media should stay manual and reviewed. | Potentially destructive. Do not automate by default. |
| Cloud Agent Entry Family | `scripts/cloud-agents/trigger.ts`; `scripts/cloud-agents/bulk-repos.ts`; `scripts/cloud-agents/run-from-ci.ts` | none scheduled; manual CLI or CI-triggered | `.github/workflows/cloud-agents.yml` + manual CLI entrypoints | stays where it is | This family should remain event-driven and manual. It is automation-adjacent, but not part of the recurring schedule portfolio. | Implemented: helper comments now make the manual-only expectation explicit, and `run-from-ci.ts` validates security-sentinel context instead of allowing vague generic runs. |

## Quick wins

- Remove the retired local-cron files after extracting any still-needed helper logic:
  - `scripts/scheduleJobs.ts`
  - `scripts/contentHealthChecker.ts`
  - `scripts/cleanupJobs.ts`
  - `functions/cache-warmer.ts`
- Keep `.github/workflows/cloud-agents.yml` explicitly unscheduled and document that no recurring cloud-agent lane should be restored.
- Keep `security-sentinel` manual-only with explicit advisory inputs instead of allowing it to drift back into a nightly or weekly dependency sweep.
- Finish retiring the remaining local-cron docs and compatibility references now that the repo-hygiene and deep-audit lanes exist.
- Add a dead-man switch / missed-run alert so the new scheduled lanes do not fail silently between operator reviews.

## Dangerous migrations

- `functions/api/cron/push-reminders.ts`: user-visible, non-idempotent, and currently on the wrong cadence relative to its file comments.
- `functions/api/cron/reservoir-maintenance.ts` and `functions/api/cron/replenish-pool.ts`: live operational mutations that must not double-fire during cutover.
- `scripts/automation/dailyTasks.ts`: currently the hidden bridge between GitHub cron and queue-owned FSRS optimization; removing that bridge without a replacement will silently stop optimization.
- `scripts/automation/weeklyTasks.ts` and `scripts/weekly-maintenance.ts`: broad bundles that mix reporting with DB/content mutation, making safe reruns difficult.
- `scripts/maintenance/orchestrator.ts` and `scripts/orchestrate.ts`: repair-oriented operator tools that should not accidentally stay reachable from scheduled workflows.
- `scripts/emergency_backup.ts` / `scripts/emergency_restore.ts`: backup scheduling is reasonable, but restore must remain isolated and explicitly operator-controlled.

## Do not automate by default

- `functions/api/cron/batch-generate-questions.ts`
- `functions/api/cron/generate-variants.ts`
- `functions/api/cron/content-quality-loop.ts`
- `functions/api/cron/populate-prerequisites.ts`
- `functions/api/cron/xapi-export.ts`
- `scripts/weekly-maintenance.ts`
- `scripts/runAutomatedPipeline.ts`
- `scripts/orchestrate.ts`
- `scripts/maintenance/orchestrator.ts`
- `scripts/emergency_restore.ts`
- `scripts/db/auto-deprecate-flagged-questions.ts`
- `scripts/db/enrich-critical-conditions.ts`
- the fetch/process/audit/delete families under `scripts/images/**`

Reason:
- These are mutation-heavy, expensive, hard to make idempotent, or destructive enough that operator review should remain mandatory.

## Missing but recommended new jobs

- Dead-man switch / missed-run alert for scheduled lanes
  - Called out by the audit as a current gap.
  - Should verify that scheduled workflows actually ran and emitted artifacts.
- Queue watchdog / worker heartbeat report
  - Needed before moving reminder/reservoir/FSRS responsibility deeper into runtime ownership.
- Backup restore verification job
  - Weekly backup without restore verification is incomplete operationally.

## Safe ordering for implementation

1. Keep the current reusable workflow foundation and introduce the least-risk target lanes first:
   - `sched-runtime-sanity.yml`
   - `sched-weekly-repo-hygiene.yml`
   - `sched-monthly-deep-audit.yml`
2. Split `automation-daily-analytics.yml` by responsibility before changing endpoint cadence:
   - report-style rollups to `sched-daily-ops.yml`
   - read-only validation to `sched-content-audit.yml`
   - FSRS enqueueing out of GitHub cron
3. Split `automation-daily-personalization.yml` next:
   - keep `daily-prescription` and `generate-daily-insights` in scheduled daily ops
   - move `push-reminders` to queue/runtime ownership
4. Replace `automation-weekly-maintenance.yml` last among the current scheduled workflows:
   - extract report-only weekly output first
   - isolate bounded housekeeping second
   - leave mutative AI/content maintenance manual-only
5. Migrate reservoir supply off GitHub cron only after queue heartbeat, lag visibility, and a clear single scheduler authority exist.
6. Remove the retired local-cron and deprecated scheduler files only after replacement ownership is live and documented.
7. Keep cloud-agent behavior event-driven or manual-only during the migration. The no-schedule rule should be explicit in docs, workflow comments, and manual-dispatch validation.
