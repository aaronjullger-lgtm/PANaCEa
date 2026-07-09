# Rubric: Workflow Completion

Grades whether a workflow was executed properly end-to-end (used by Orchestrator + `release-readiness-gate`).

## Pass criteria (all required)
- The correct workflow was selected for the task type (see matrix in `docs/agent-workflow-orchestration.md`).
- All 8 phases ran, including the mandatory **context scan** and a **specialist review** for risky changes.
- Validation commands for the change type were run with evidence.
- Human-approval gates were respected (nothing gated was auto-executed).
- Durable memory updated where warranted; final report passes `agent-final-report-rubric.md`.
- Loop discipline honored (≤2 repair attempts; escalation on unresolved failure).

## Scoring (0–5)
- 5: right workflow, all phases, gated correctly, evidence + memory. 3: minor phase skipped but safe. 1: phases skipped / weak evidence. 0: any automatic failure.

## Evidence required
- Phase log (agent → outcome → evidence); consolidated verification results.

## Automatic failure conditions
- Skipped context scan or specialist review on a risky change.
- Executed a human-approval-gated action (deploy, migration, auth/RLS, secrets, prod data) without approval.
- Unresolved failure hidden; uncontrolled loop (>2 attempts / destructive retry).
- Final report fails its rubric.

## Examples of unacceptable claims
- "Ran the whole feature workflow" but no review phase and no evidence.
- "Shipped it" (deploy performed without approval).

## Must be reported
- Workflow used, phase log, verification results, approvals, memory updates, next steps.
