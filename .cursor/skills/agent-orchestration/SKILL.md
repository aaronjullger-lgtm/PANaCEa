---
name: agent-orchestration
description: Coordinate a multi-phase task across specialist agent roles and enforce gates. Use for non-trivial tasks that span planning, implementation, review, and verification.
---

# Agent orchestration

Run a task like a coordinated team. Full map: `docs/agent-workflow-orchestration.md`; roles: `.cursor/agents/`.

## When to use
- Any task spanning multiple phases/roles (feature, cross-cutting change, release, multi-agent review).

## Instructions
1. Select the workflow (`workflow-selection`) from the task→workflow matrix.
2. Run the 8-phase pattern: context scan → plan → implement → self-review → verify → specialist review → docs/memory → final report.
3. Delegate each phase to the right agent role; keep exploration in subagents to protect context.
4. Enforce gates: run `human-approval-gate` before any gated action; require specialist review for risky changes.
5. Assemble the final report (`final-reporting`) and record lessons (`repo-learning-loop`).

## Stop conditions
- Stop at any human-approval gate or unresolved specialist blocker; stop when the workflow's stop condition is met.

## Verification evidence
- Phase log (agent → outcome → evidence) + consolidated verification results.

## Do not claim success unless
- Every applicable phase ran with evidence and the final report passes `agent-final-report-rubric.md`.

## Recovery
- On failure, enter `self-improvement-loop` (≤2 attempts) then escalate. Never merge/deploy or skip the review phase for risky changes.
