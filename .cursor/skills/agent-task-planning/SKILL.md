---
name: agent-task-planning
description: Turn a non-trivial request into a small, verifiable plan before editing. Use for multi-step/ambiguous/cross-file tasks, or when you're unsure where to start.
---

# Agent task planning

Produce a tight plan so execution is verifiable and low-risk. See `agent-planning-and-handoff.mdc`.

## When to use

- Task has 3+ steps, ambiguity, or touches multiple files/subsystems.

## Instructions

1. Restate the goal in one sentence and the definition of done.
2. Identify the affected subsystem and the exact files you expect to change (confirm they exist — see `route-and-import-verification`).
3. Decompose into small steps, each ending in a concrete check from `testing-and-verification.mdc`.
4. Separate read/exploration steps from edit steps; do exploration first (use a subagent for heavy exploration to keep context clean).
5. Create a TODO list; keep exactly one item in progress.
6. Note risks and what you will NOT touch (shared primitives, auth/RLS, FSRS logic) unless approved.

## Stop conditions

- Stop planning and start executing once each step has a clear verification.
- Stop and ask only for scope changes or destructive/irreversible actions.

## Verification

- Every step maps to a runnable check.
- The plan names the files and the commands you'll run.

## Do not claim success unless

- The plan was actually executed and each step's check passed (or deviations are documented).

## Recovery

- If reality diverges from the plan, update the plan; don't force a wrong approach.
- If a target file/module doesn't exist, stop and re-scope (do not invent it).
