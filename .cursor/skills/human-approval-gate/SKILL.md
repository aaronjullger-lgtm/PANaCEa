---
name: human-approval-gate
description: Pause and require explicit human approval before high-risk/irreversible actions. Use whenever an action touches prod, secrets, auth/RLS, DB writes, deploys, billing, deps, or shared primitives.
---

# Human approval gate

Stop and ask before crossing a one-way door.

## When to use (any of)
- Database writes/migrations, auth/RLS/middleware changes, production deploys, billing, secret handling.
- New production dependency; shared UI primitive or FSRS rating change; deleting files; history rewrite; anything ambiguous/irreversible.

## Instructions
1. Stop before executing the gated action.
2. Present a concise decision request: **what** you want to do, **why**, **risk/blast radius**, **reversible?**, and your **recommendation**.
3. Wait for explicit approval. Do the safe, reversible prep (draft the migration, write the code behind a flag) but do not execute the gated step.
4. Record the pending-approval item in the final report and `.cursor/memory/` if durable.

## Stop conditions
- Hard stop until a human approves; do not proceed on assumption.

## Verification evidence
- The decision request and the recorded approval (or that you're waiting).

## Do not claim success unless
- The gated action was explicitly approved before execution.

## Recovery
- No approval available → leave the change drafted/unapplied and hand off cleanly (`long-running-handoff`).
