# PANaCEa Workflow Engineering Standards

Applies to:
- `.github/workflows/**/*.yml`
- reusable workflow helpers used by PANaCEa automation
- any new workflow introduced during the automation refactor

PANaCEa-specific baseline:
- `package.json` requires Node `>=22.0.0`.
- `.node-version`, `.nvmrc`, and `wrangler.toml` all pin Node `22`.
- Cloudflare Pages native cron is not the scheduler contract for this repo. `wrangler.toml` explicitly says scheduled cache warming via Pages cron is not supported here.
- Local machine cron is retired. `deployment/cron/README.md` remains only as historical documentation.
- Runtime queue ownership already exists via `lib/services/queue/jobQueue.ts`, `scripts/backgroundWorker.ts`, and `deployment/systemd/panacea-worker.service`.
- The repo already has automation debt:
  - stale cron comments in scripts and endpoint files
  - broad catch-all daily and weekly automation scripts
  - duplicate cleanup logic
  - user-visible work mixed with report-only work

Use this document as a refactor checklist.

## 1. Naming conventions

Checklist:
- New recurring scheduled workflows MUST use the file prefix `sched-`.
- Transitional scheduled exceptions MUST still use the file prefix `sched-` so the active schedule tree stays visually consistent.
- New manual-only operator workflows SHOULD use the file prefix `manual-`.
- Reusable internal workflow helpers MUST use the file prefix `_`.
- Event-driven agent workflows SHOULD use a descriptive non-scheduled name such as `cloud-agents.yml` or `agents-<purpose>.yml`.
- Deploy and CI workflows MAY keep stable canonical names such as `ci.yml`, `deploy.yml`, `playwright.yml`, and `neon_workflow.yml`.
- Workflow `name:` values MUST be purpose-based, not cadence-only.
- Prefer names such as `Runtime Sanity`, `Daily Ops`, `Content Audit`, or `Weekly Platform Report`.
- Avoid names like `Hourly Automation`, `Daily Automation`, or `Weekly Automation` unless the workflow truly has one narrow purpose.
- Job names MUST be explicit about function:
  - `Build & Test`
  - `Secret Scan`
  - `Call production cron endpoints`
  - `Upload lane artifacts`
- Artifact slugs, log directories, and lane identifiers SHOULD reuse the same stable slug used in the workflow filename.

## 2. When to use `schedule` vs `workflow_dispatch` vs `push` / `pull_request`

Checklist:
- Use `schedule` only for work that is:
  - safe to rerun
  - reasonably idempotent
  - observable
  - not user-critical in real time
  - not dependent on user-local time zones
- Every important scheduled workflow MUST also expose `workflow_dispatch`.
- Use `workflow_dispatch` only for:
  - operator jobs
  - repair jobs
  - exports
  - DB normalization or backfills
  - content generation
  - media acquisition/cleanup
  - any task with meaningful blast radius
- Use `push` / `pull_request` for:
  - CI validation
  - code-quality gates
  - preview infrastructure
  - path-triggered cloud-agent jobs
- Cloud-agent workflows in PANaCEa MUST be either:
  - path-triggered on `push` / `pull_request`, or
  - explicit `workflow_dispatch` operator runs
- Do not add recurring `schedule` triggers to cloud-agent workflows unless the exact agent job proves bounded scope, durable operator value, and non-vague success criteria.
- Use `workflow_run` only when one workflow should promote or continue after another succeeds.
- In this repo, `deploy.yml` is the canonical example of `workflow_run`.
- Do not mix `schedule` with `push` / `pull_request` in the same workflow unless the exact same behavior is correct for both trigger classes.
- PANaCEa scheduled workflows SHOULD stay separate from code-change workflows.

## 3. Required workflow-level settings

Checklist:
- Every workflow file MUST start with the metadata header comment block:
  - `purpose`
  - `owner`
  - `trigger strategy`
  - `secrets required`
  - `expected runtime`
  - `failure behavior`
- Every workflow MUST define an explicit `name:`.
- Every workflow MUST define explicit `on:` triggers.
- Every workflow MUST define explicit top-level `permissions:`.
- Every scheduled workflow MUST define top-level `concurrency:`.
- Any workflow that runs Node commands directly SHOULD define `env.NODE_VERSION: "22"`.
- Scheduled/manual automation workflows SHOULD use `.github/workflows/_automation-lane.yml` unless a multi-job layout is clearly justified.
- A scheduled workflow MUST remain single-purpose.
- If a workflow contains both report-only and mutation-heavy work, it must be split.
- Workflow comments and human-readable descriptions MUST match the actual triggers and cron strings.

## 4. Required job-level settings

Checklist:
- Every job MUST declare `runs-on: ubuntu-latest` unless there is a specific platform need.
- Every job MUST declare `timeout-minutes`.
- Every job MUST inherit or declare explicit permissions.
- Any job that runs repo Node commands MUST:
  - check out the repository
  - install Node `22`
  - use `npm` cache when using `actions/setup-node`
  - run `npm ci`
- Any job that depends on Prisma-generated client code MUST run `npx prisma generate`.
- Any job that validates schema or deploys DB work SHOULD run `npx prisma validate` first.
- Scheduled jobs MUST upload artifacts or logs when they claim to produce reports.
- Jobs calling production cron endpoints MUST fail on non-2xx responses.
- Jobs that do not need Node setup MUST explicitly disable it when using the reusable lane.

## 5. Node version policy

Checklist:
- PANaCEa workflows MUST use Node `22`.
- Do not introduce Node `18` or Node `20` for repo-run commands.
- This requirement is grounded in:
  - `package.json` engines `>=22.0.0`
  - `.node-version`
  - `.nvmrc`
  - `wrangler.toml`
- CI, deploy, Playwright, cloud-agent, and scheduled automation workflows MUST stay aligned on Node `22`.
- If a document or workflow note still says `Node.js 18+`, treat it as documentation debt and update it when touching that area.
- Third-party actions may run on their own internal runtime, but any PANaCEa shell commands MUST run under Node `22`.

## 6. Permissions policy

Checklist:
- Default workflow permission is `contents: read`.
- Elevate permissions only at the job that needs them.
- Scheduled automation jobs MUST NOT request repo write permissions by default.
- Repo-maintenance workflows SHOULD stay read-only unless they must write deployment or PR state.
- `deploy.yml` is allowed to request `deployments: write`.
- A PR-comment or schema-diff job may request `pull-requests: write` only if it actually posts back to the PR.
- Do not grant `actions: write`, `contents: write`, `issues: write`, or `packages: write` to scheduled automation lanes unless there is a documented reason in the workflow header and comments.
- The reusable lane MUST keep its own permissions minimal.

## 7. Concurrency policy

Checklist:
- Every scheduled workflow MUST define a stable, lane-specific concurrency group.
- Scheduled workflows MUST use `cancel-in-progress: false`.
- CI and Playwright workflows triggered by `push` / `pull_request` SHOULD use per-ref concurrency and `cancel-in-progress: true`.
- Deploy workflows SHOULD use environment-specific concurrency and `cancel-in-progress: true`.
- Manual destructive jobs SHOULD use `cancel-in-progress: false`.
- Manual destructive jobs SHOULD include target environment or target scope in the concurrency group.
- Cloud-agent workflows SHOULD use event/ref keyed concurrency to prevent unrelated runs from trampling each other.
- Concurrency belongs in the caller workflow for reusable automation lanes, not in the reusable helper itself.

## 8. Timeout policy

Checklist:
- Every job MUST set `timeout-minutes`.
- Default PANaCEa timeout ranges:
  - runtime sanity: `10-15`
  - daily ops / daily learning models / content audit: `20-30`
  - weekly report: `20-30`
  - weekly maintenance: `30-60`
  - monthly deep audit: `30-60`
  - cloud-agent jobs: `20`
  - CI build/test: `20`
  - deploy: `15`
  - preview DB jobs: `5-10`
- If a scheduled job needs more than `60` minutes, split it or move it out of GitHub Actions.
- If a task has unpredictable runtime because of queue depth, API latency, or AI workload size, it is a poor fit for scheduled GitHub cron.

## 9. Artifact/reporting policy

Checklist:
- Scheduled workflows MUST upload artifacts on success and failure using `if: always()`.
- PANaCEa scheduled jobs SHOULD emit machine-readable artifacts under stable paths such as:
  - `logs/hourly/*.json`
  - `logs/daily/*.json`
  - `logs/weekly/*.json`
  - `logs/monthly/*.json`
  - `logs/automation-http/*.log`
- Report-only workflows SHOULD also emit a human-readable report artifact when useful.
- Artifact retention defaults:
  - runtime, daily, weekly maintenance, and transitional reservoir lanes: `14` days
  - weekly report and weekly repo-hygiene artifacts: `21` days
  - monthly deep-audit artifacts: `30` days
  - CI build artifacts: `7` days
  - Playwright reports: `30` days
- If a workflow claims to produce a required report, missing artifacts SHOULD be treated as a failure, not silently ignored.
- Use `if-no-files-found: ignore` only for optional secondary artifacts and explain why in a comment.
- Endpoint-calling automation workflows MUST preserve HTTP request/response logs as artifacts.

## 10. Failure-handling policy

Checklist:
- Primary scheduled work MUST fail hard.
- Do not mask failed cron endpoint calls, failed reports, or failed maintenance steps as success.
- If a workflow contains multiple tasks with different failure domains, split them into separate workflows or jobs.
- Every failure path SHOULD still upload whatever logs or partial artifacts were produced.
- Every failure path SHOULD append actionable data to `GITHUB_STEP_SUMMARY`.
- The workflow header `failure behavior` line MUST tell an operator what to inspect and whether rerun is safe.
- Deploy workflows MUST stop promotion on any failed validation gate.
- Report-only workflows MUST still fail if they cannot produce trustworthy output.

## 11. `continue-on-error` policy

Checklist:
- `continue-on-error` is forbidden on primary scheduled automation steps.
- `continue-on-error` is forbidden on any mutation-heavy or user-visible task.
- `continue-on-error` is forbidden at workflow scope.
- `continue-on-error` is allowed only for clearly non-blocking diagnostic or debt-managed CI steps.
- Current allowed-style examples in PANaCEa:
  - CI coverage run
  - CI E2E smoke while the bundling limitation remains unresolved
- Any use of `continue-on-error` MUST include an inline comment explaining:
  - why it is safe
  - what signal is still preserved
  - what condition should remove it later

## 12. Logging and step summary policy

Checklist:
- Multi-line shell steps SHOULD use `set -euo pipefail`.
- Scheduled jobs MUST not rely on console output alone.
- All timestamps in generated logs SHOULD use UTC.
- Every scheduled workflow MUST write a `GITHUB_STEP_SUMMARY` section including:
  - workflow or lane name
  - commands or endpoints attempted
  - failure count
  - artifact paths
  - artifact retention when it matters operationally
  - next operator action
- Endpoint-calling workflows MUST log:
  - HTTP method
  - endpoint path
  - status code
  - response body snapshot
- Manual-only jobs that mutate DB, content, or media SHOULD emit before/after counts or a dry-run summary.

## 13. Secret usage policy

Checklist:
- Do not place secrets at workflow scope unless every job in that workflow needs them.
- Prefer job-level or step-level `env`.
- Secret usage must be minimal and purpose-specific:
  - `DATABASE_URL`: only for Prisma/DB scripts or DB-backed cron endpoints
  - `PRODUCTION_URL`: only for calling deployed PANaCEa endpoints
  - `CRON_SECRET`: only for `/api/cron/**` endpoint callers
  - `GEMINI_API_KEY`: only for AI-dependent scripts or Gemini reachability checks
  - `CURSOR_AGENTS_API_KEY`: only for cloud-agent workflows and scripts
  - `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`: only for deploy work
  - Sentry secrets: only for deploy/build steps that upload source maps
- Do not pass production secrets into repo-only workflows such as repo hygiene, Playwright, or secret scanning.
- `secrets: inherit` is acceptable only for the internal reusable automation lane when:
  - the caller workflow is single-purpose
  - the job is just the reusable lane call
  - the workflow header clearly documents which secrets are actually required
- The reusable automation lane SHOULD only expose the minimum shared shell/endpoint secrets needed by current callers:
  - `DATABASE_URL`
  - `PRODUCTION_URL`
  - `CRON_SECRET`
- Extra secrets such as `GEMINI_API_KEY` or deploy credentials MUST stay in the direct workflow or step that actually uses them.
- Never echo secret values to logs or step summaries.

## 14. Safe cron design rules

Checklist:
- Cron expressions MUST use UTC.
- Scheduled workflows MUST avoid `:00` minute values.
- Prefer staggered, uneven minutes such as `13`, `17`, `23`, `27`, `41`, and `47`.
- The current live scheduled portfolio uses `13`, `17`, `18`, `23`, `25`, `27`, `29`, `41`, and `47`.
- Do not place two scheduled workflows on the same minute unless there is an explicit reason.
- Preserve logical ordering across dependent lanes:
  - learning-model refresh before daily ops
  - daily ops before content audit
  - weekly platform report before weekly maintenance
- Cadence must be justified by freshness needs and rerun safety, not by habit.
- Comments in workflow files, scripts, and endpoint files MUST match the actual cron expression.
- If the work is sensitive to user-local time zones or should happen many times per day based on active usage, it does not belong in GitHub cron.

## 15. Rules for when a task must not live in GitHub cron

Checklist:
- Do not place user-critical real-time behavior in GitHub cron.
- PANaCEa examples that should not live in GitHub cron by default:
  - `functions/api/cron/push-reminders.ts`
  - `functions/api/cron/reservoir-maintenance.ts`
  - `functions/api/cron/replenish-pool.ts`
  - queue-owned FSRS optimization triggers
- Do not place non-idempotent AI/content mutation in GitHub cron.
- PANaCEa examples:
  - `functions/api/cron/batch-generate-questions.ts`
  - `functions/api/cron/generate-variants.ts`
  - `functions/api/cron/content-quality-loop.ts`
  - `scripts/weekly-maintenance.ts`
- Do not place DB repair, restore, or normalization sweeps in GitHub cron.
- Do not place media acquisition, image processing, or media cleanup in GitHub cron.
- Do not place generic cloud-agent review or repair sweeps in GitHub cron.
- PANaCEa example:
  - `security-sentinel` in `.github/workflows/cloud-agents.yml` should stay manual-only unless it is tied to a specific advisory and still shows ongoing operator value.
- Do not place tasks requiring authenticated user context in GitHub cron.
- PANaCEa example:
  - `functions/api/cron/populate-prerequisites.ts` as currently implemented
- Do not place long-running daemon logic or queue consumers in GitHub cron.
- Do not place work in GitHub cron if it needs:
  - queue backpressure
  - retries with stateful ownership
  - per-user scheduling
  - constant supervision
- If a dangerous task remains scheduled temporarily, the workflow header and automation docs MUST state why it is still scheduled and what replacement is pending.

## 16. Rules for manual-only jobs

Checklist:
- Manual-only workflows MUST use `workflow_dispatch` and no `schedule`.
- Manual-only jobs SHOULD live in their own workflow file or remain CLI/runbook-only.
- Manual-only jobs MUST describe:
  - blast radius
  - required secrets
  - expected runtime
  - rollback or recovery path
- Manual-only DB/content/media jobs SHOULD support dry-run mode when technically possible.
- Manual-only jobs MUST NOT be called transitively from a scheduled lane.
- High-risk PANaCEa job classes that default to manual-only:
  - database orchestrators
  - restore paths
  - AI content generation
  - advisory-driven cloud-agent repair jobs such as `security-sentinel`
  - variant generation
  - prerequisite rebuilds
  - media fetch/process/delete workflows
  - destructive cleanup
- If a manual-only job is later promoted to scheduled status, it must first prove:
  - idempotency
  - bounded runtime
  - artifact visibility
  - safe rerun behavior

## 17. Documentation requirements for every workflow

Checklist:
- Every workflow file MUST contain the header metadata comment block.
- The header MUST name exact secret names, not vague descriptions.
- The `trigger strategy` header line MUST match the actual trigger configuration.
- The `expected runtime` header line MUST reflect reality, not aspiration.
- The `failure behavior` header line MUST tell an operator what to do next.
- If a workflow changes scheduled ownership, update the automation docs in the same change:
  - `docs/automation/README.md`
  - `docs/automation/SCHEDULE_MATRIX.md`
  - `docs/automation/MIGRATION_MAP.md`
  - `docs/automation/BEFORE_AFTER_MATRIX.md`
  - `docs/automation/CHANGELOG.md`
  - `docs/automation/scheduled-jobs-audit.md` when current-state inventory changes
- If a workflow calls PANaCEa cron endpoints, the exact endpoints SHOULD be visible in the workflow file.
- If a workflow contains a non-blocking step, the file MUST explain why.
- Any stale references to local cron or Cloudflare Pages scheduled handlers MUST be removed when touching the affected workflow or endpoint.

## 18. Issue intake and follow-up policy

Checklist:
- Automation incidents and follow-up requests SHOULD use the repo issue forms under `.github/ISSUE_TEMPLATE/`.
- Use `automation-failure.yml` for:
  - failed `sched-*` runs
  - failed manual reruns of scheduled lanes
  - misleading success states where the workflow completed but the automation outcome was wrong
- Use `automation-drift.yml` for:
  - stale docs
  - mismatched cron comments
  - header metadata drift
  - package alias confusion
  - schedule matrix mismatches
  - policy drift between a workflow file and this standards document
- Use `automation-change-request.yml` for:
  - new recurring jobs
  - cadence changes
  - split or merge requests
  - manual-only requests
  - requests to move work out of GitHub cron and into queue/runtime ownership
  - deferred safeguards such as dead-man-switch alerting or backup restore verification
- Every automation failure issue SHOULD include:
  - workflow name
  - run URL
  - expected behavior
  - actual behavior
  - severity
  - whether data mutation occurred
  - whether rollback or manual intervention is needed
- Every drift issue SHOULD cite exact file paths and quote the mismatched text or behavior.
- Every change request for a scheduled job MUST explain why GitHub cron is the correct home and why event-driven, queue-owned, or manual-only execution is not better.
- Compatibility aliases in `package.json` such as `automation:daily`, `automation:weekly`, and `automation:monthly` MUST be treated as operator entrypoints only.
- If a compatibility alias remains in the repo, nearby docs SHOULD point to the canonical `sched-*` workflow owner so operators do not mistake the alias for scheduler authority.

## 19. Manual dispatch input policy

Checklist:
- Scheduled workflows with meaningful manual rerun paths SHOULD use the standard input names where they fit:
  - `target_scope`
  - `report_only`
  - `skip_expensive_steps`
  - `dry_run`
  - `environment_guard`
- `target_scope` SHOULD default to the smallest useful rerun surface, not the broadest one.
- `report_only` SHOULD default to `true` on risky or mutative lanes.
- `dry_run` SHOULD default to `true` on maintenance or cleanup lanes when preview mode is technically possible.
- `skip_expensive_steps` SHOULD default to `false` unless the lane is primarily an operator audit packet where a lighter smoke mode is more useful.
- `environment_guard` SHOULD be a choice input, not free text, when a manual run can mutate live state.
- Mutative manual lanes MUST NOT default directly into live writes.
- If a workflow cannot meaningfully narrow or preview its behavior, it MAY expose bare `workflow_dispatch` with no extra inputs.
- PANaCEa example:
  - `sched-runtime-sanity.yml` is safe enough to rerun without extra knobs
- Cloud-agent manual runs are the main exception to the shared naming pattern:
  - job-specific inputs such as `agent_job`, `package_name`, or `advisory_url` are more useful than forced generic fields
- Input descriptions MUST explain the actual operational effect, not just restate the name.

## 20. Ownership and governance policy

Checklist:
- Automation workflow ownership MUST be documented in `docs/automation/JOB_OWNERSHIP.md`.
- Shared or mutative workflow changes SHOULD have dual-owner review even before real `CODEOWNERS` handles are activated.
- The repo SHOULD use the recommended automation labels from `.github/labels-automation-recommendation.md` for:
  - failed runs
  - drift
  - risky cron changes
  - rollback-sensitive changes
- `CODEOWNERS` SHOULD stay aligned with the role map once real GitHub usernames or teams are known.
- Any proposal to reintroduce scheduled cloud-agent behavior requires explicit governance review because the current policy is event-driven or manual-only.

## Refactor acceptance checklist

Use this list before considering a workflow refactor done:
- File name follows the correct convention.
- Workflow `name:` is purpose-based.
- Metadata header exists and is accurate.
- Trigger choice matches the task class.
- Node version is `22`.
- Permissions are explicit and minimal.
- Concurrency is explicit and appropriate.
- Every job has a timeout.
- Scheduled workflows also have `workflow_dispatch`.
- No unsafe task is still hiding inside GitHub cron.
- No primary scheduled step uses `continue-on-error`.
- Artifact and step summary output are present.
- Secret scope is minimal.
- Cron timing is staggered and not top-of-hour.
- Scheduled work is single-purpose.
- Related docs were updated.
