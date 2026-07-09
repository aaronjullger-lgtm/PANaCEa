---
name: workflow-selection
description: Pick the correct workflow and lead/supporting agents for a task. Use at the start of any task to route it correctly.
---

# Workflow selection

Route a task to the right recipe. Source of truth: the matrix in `docs/agent-workflow-orchestration.md`.

## When to use
- Start of any task, when unsure which workflow/agents apply.

## Instructions
1. Classify the task type (feature, bug, UI, visual QA, a11y, security, DB, Cloudflare Functions, deps, tests, release, docs, memory, imports).
2. Look it up in the matrix → open the matching `.cursor/workflows/*.workflow.md`.
3. Note the lead agent, supporting agents, required checks, and whether human approval is required.
4. If the task spans types, choose the closest workflow and add the extra specialists; if truly novel, use `feature-build` or `bug-fix` as the base and document the deviation.

## Stop conditions
- Stop once a workflow + agent lineup + required checks are identified.

## Verification evidence
- State the chosen workflow and why, plus the approval gates it carries.

## Do not claim success unless
- The selected workflow's required checks are actually run later (selection alone isn't completion).

## Recovery
- Wrong fit discovered mid-task → switch workflows and note it in the final report.
