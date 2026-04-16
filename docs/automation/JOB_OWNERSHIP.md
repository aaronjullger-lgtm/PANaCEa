# Automation Job Ownership

This is the role-based owner map for the live PANaCEa automation portfolio. It avoids inventing named reviewers where the repo does not define them.

## Scheduled and manual workflow ownership

| Workflow | Owner role | Backup owner role | Blast radius | Approval expectations for changes |
| --- | --- | --- | --- | --- |
| `.github/workflows/sched-runtime-sanity.yml` | Platform / DevOps | Platform / DevEx | Low. Read-only runtime observability. | One owner-role review is usually enough unless secrets, cadence, or artifact guarantees change. |
| `.github/workflows/sched-reservoir-supply.yml` | Learning Platform / Reservoir | Platform / DevOps | High. Calls live reservoir-maintenance and refill endpoints. | Dual review required. Any non-report-only behavior, cadence change, or endpoint-set change should have both owner and backup-owner approval. |
| `.github/workflows/sched-daily-learning-models.yml` | Learning / Personalization | Platform / DevOps | Medium. Writes derived learner-model state. | Dual review for write-path, cadence, or scope changes. One owner-role review is enough for report-only/manual-default UX or artifact wording changes. |
| `.github/workflows/sched-daily-ops.yml` | Analytics / Personalization | Platform / DevOps | Medium to high. Calls production rollup, prescription, and insight endpoints. | Dual review required for endpoint fanout, guard logic, cadence, or concurrency changes. |
| `.github/workflows/sched-content-audit.yml` | Content Platform / Quality | Platform / DevEx | Low. Read-only audit and reporting. | One owner-role review is usually enough unless a change introduces mutation or new secrets. |
| `.github/workflows/sched-weekly-platform-report.yml` | Analytics / Learning Platform | Platform / DevEx | Low to medium. Read-heavy reporting plus optional psychometric snapshot endpoint. | One owner-role review for report-only behavior. Dual review if endpoint fanout, guard rules, or data-writing behavior changes. |
| `.github/workflows/sched-weekly-maintenance.yml` | Platform / Data Maintenance | Platform / DevOps | High. Backup generation and historical job cleanup. | Dual review required. Any change affecting backup scope, retention deletion, or manual safeguards needs explicit approval from both roles. |
| `.github/workflows/sched-weekly-repo-hygiene.yml` | Platform / DevEx | Platform / DevOps | Low. Repo-only audits and policy checks. | One owner-role review is usually enough. Dual review if the lane becomes gating or starts touching non-repo surfaces. |
| `.github/workflows/sched-monthly-deep-audit.yml` | Platform / Content Quality | Content Platform / Quality | Low. Read-only long-horizon audit packet. | One owner-role review is usually enough unless a change adds mutation, external side effects, or long-running new audit surfaces. |
| `.github/workflows/cloud-agents.yml` | Platform / DevEx | Platform / DevOps | Medium to high. AI-generated code review and optional PR creation. | Dual review required for any new agent job, any scope expansion, or any proposal to add schedule back into the workflow. |
| `.github/workflows/_automation-lane.yml` | Platform / DevOps | Platform / DevEx | High. Shared runner used by multiple lanes. | Dual review required plus at least one approval from an affected lane owner when behavior changes could alter scheduled execution semantics. |

## Ownership notes

- The `sched-*` workflow file is the scheduler authority, even when a `package.json` alias or compatibility wrapper script exists.
- `scripts/automation/**` ownership follows the workflow that actually schedules or dispatches the script.
- `scripts/cloud-agents/**` should stay under the `cloud-agents.yml` ownership model even when invoked from the CLI.
- If GitHub team handles are defined later, wire them into `CODEOWNERS` using this document as the role map.
