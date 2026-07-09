---
name: self-improvement-loop
description: Recover from a failure safely (max 2 repair attempts) and turn it into a durable lesson. Use after failed tests/build, rejected visual QA, or a repeated mistake.
---

# Self-improvement loop

Bounded recover-and-learn. Full spec: `docs/agent-self-improvement-loop.md`; workflow: `.cursor/workflows/self-improvement-loop.workflow.md`.

## When to use
- A check fails after your edit, visual QA is rejected, or the same mistake recurs.

## Instructions
1. Capture the exact failure output; classify pre-existing vs introduced (`.cursor/memory/validation-history.md`).
2. Attempt a fix (`failure-triage`): one hypothesis → smallest change → re-run the exact command. **Max 2 attempts.**
3. Log each attempt (hypothesis → change → result).
4. If fixed: record the lesson (`repo-learning-loop`). If not fixed after 2 attempts: **stop and escalate** with an unresolved-failure report.
5. Only apply low-risk improvements (docs/memory, a clearly-scoped rule/skill); escalate risky ones (blocking hooks, broad rule changes, safety gates).

## Stop conditions
- Fixed + verified, or 2 attempts exhausted → escalate. Never exceed 2 automatic attempts.

## Verification evidence
- Attempt log + the re-run command output.

## Do not claim success unless
- The exact failing command now passes (output shown).

## Recovery / never
- Never loop on destructive commands; never blind-retry installs/tests; never hide failures; never delete tests or weaken gates.
