---
name: task-decomposition
description: Break a task into small, individually-verifiable steps before editing. Use for anything with 3+ steps or cross-file impact.
---

# Task decomposition

Turn a goal into verifiable steps. Complements `agent-task-planning` and `agent-planning-and-handoff.mdc`.

## When to use
- Multi-step/ambiguous/cross-file work.

## Instructions
1. State the goal + definition of done.
2. List the files you expect to change; confirm each exists (`route-and-import-verification`).
3. Split into steps, each ending in a concrete check from `testing-and-verification.mdc`.
4. Order steps: exploration/research first (subagent), then edits.
5. Create a TODO list; one item in progress at a time. Note "will not touch" (shared primitives, auth/RLS, FSRS) and approval gates.

## Stop conditions
- Stop when each step has a verification and the implementer can proceed.

## Verification evidence
- The step list with a check per step and confirmed file targets.

## Do not claim success unless
- Steps were executed and each check passed (or deviations documented).

## Recovery
- If a target file/module is missing, stop and re-scope (don't invent it).
