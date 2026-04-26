# Automation Runbook

Use this document for manual reruns and operator checks against the live PANaCEa automation portfolio.

## Standard manual inputs

| Input | Meaning | Expected use |
| --- | --- | --- |
| `target_scope` | Narrow the manual run to the smallest meaningful slice. | Prefer the narrowest scope first. |
| `report_only` | Keep the run read-only or preview-only when the lane supports it. | Default to `true` on risky lanes. |
| `skip_expensive_steps` | Skip long or noisy segments that are not required for a first-pass manual check. | Use for report lanes and audits. |
| `dry_run` | Preview cleanup or retention work without applying deletes. | Use on maintenance lanes before any live rerun. |
| `environment_guard` | Explicit opt-in string for live mutation. | Do not bypass this; it is the manual safety catch. |

## Safe to run manually anytime

| Workflow | Recommended first manual mode | Why it is safe |
| --- | --- | --- |
| `sched-runtime-sanity.yml` | no inputs; run as-is | Read-only runtime checks only. |
| `sched-content-audit.yml` | `target_scope=fast-audit` | Read-only content and DB audit packet. |
| `sched-weekly-repo-hygiene.yml` | `target_scope=policy-only` | Repo-only checks; no production secrets or mutation. |
| `sched-monthly-deep-audit.yml` | `target_scope=fast-review`, `skip_expensive_steps=true` | Read-only long-horizon audit packet. |

## Usually run report-only first

| Workflow | First manual mode | Why |
| --- | --- | --- |
| `sched-daily-learning-models.yml` | `target_scope=sample`, `report_only=true` | Preview the active-user scope before any learner-model writes. |
| `sched-daily-ops.yml` | `target_scope=repo-rollups-only`, `report_only=true` | Confirms repo-hosted reporting without touching production endpoint fanout. |
| `sched-weekly-platform-report.yml` | `target_scope=report-only`, `report_only=true` | Keeps the rerun read-heavy before enabling the psychometric snapshot endpoint. |
| `sched-weekly-maintenance.yml` | `target_scope=retention-cleanup`, `report_only=true`, `dry_run=true` | Lets operators inspect cleanup scope before backup or deletion behavior. |
| `sched-reservoir-supply.yml` | `target_scope=report-only`, `report_only=true` | Keeps the transitional reservoir lane inert unless live pressure truly warrants action. |

## Workflows that require caution

| Workflow | Why it needs caution | Manual guard |
| --- | --- | --- |
| `sched-daily-learning-models.yml` | Writes derived learner-model state. | `environment_guard=allow-learning-model-writes` before any non-report-only run. |
| `sched-daily-ops.yml` | Calls production analytics, prescription, and insight endpoints. | `environment_guard=allow-production-endpoints` before any endpoint fanout. |
| `sched-weekly-maintenance.yml` | Produces backups and can delete historical background-job rows. | `environment_guard=allow-weekly-maintenance-write` before non-report-only runs. |
| `sched-reservoir-supply.yml` | Mutates live reservoir state. | `environment_guard=allow-live-reservoir-mutation` before any live endpoint call. |
| `cloud-agents.yml` | Can launch AI code changes or PR creation. | Use only for a concrete job and keep `security-sentinel` tied to a specific advisory. |

## Manual rerun order after a failure

1. Start with the smallest safe mode:
   - fast audit
   - policy-only
   - report-only
   - dry-run
2. Inspect:
   - `GITHUB_STEP_SUMMARY`
   - uploaded artifacts
   - `logs/automation-http/*.log` when endpoint fanout is involved
3. Escalate to a live or broader rerun only if:
   - the first run proves the failure is understood
   - the target lane has a clear operator need
   - the required `environment_guard` is deliberate, not habitual

## Workflow-specific notes

- `sched-runtime-sanity.yml`: best first rerun for general automation-health suspicion.
- `sched-daily-ops.yml`: do not jump straight to `full-lane` unless the issue clearly spans both analytics and personalization endpoints.
- `sched-weekly-platform-report.yml`: `report_only=true` should be the norm; enabling the psychometric snapshot is the exception.
- `sched-weekly-maintenance.yml`: do not run live cleanup just to "see if it works." Use report-only or dry-run first.
- `sched-reservoir-supply.yml`: manual live reruns should be rare and tied to an actual low-supply condition, not general curiosity.
- `cloud-agents.yml`: keep the workflow event-driven or manual only; do not treat it as a generic maintenance sweep.
