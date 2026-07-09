---
name: repo-learning-loop
description: Capture recurring mistakes and lessons into durable repo memory without bloat. Use after complex tasks, repeated errors, or when a reusable insight emerges.
---

# Repo learning loop

Turn experience into durable, concise memory so future agents don't repeat mistakes. Files: `.cursor/memory/`.

## When to use
- A mistake recurred, a task produced a reusable insight, or checks revealed a pattern.

## Instructions
1. **Recurring mistakes** → add/append to `known-failure-modes.md` (title, date, symptom, fix/avoidance, where it applies). Confirmed patterns only.
2. **Hard don'ts** → add to `do-not-repeat.md` (only after a mistake recurred or a rule is absolute).
3. **Validation** → append the run to `validation-history.md` (date, command, result, pre-existing vs introduced).
4. **Complex tasks** → add a `workflow-retrospectives.md` entry (`workflow-retrospective`).
5. **Only if a pattern repeated** → suggest a new rule/skill/hook (don't create speculative ones).
6. Keep every entry short, dated, evidence-backed. No secrets/PII/huge logs.

## Stop conditions
- Stop when the lesson is captured in exactly one authoritative place (no duplication/bloat).

## Verification evidence
- The memory diff; `git diff | rg -i "sk_live|pk_live|postgres://|prisma://|api[_-]?key"` clean.

## Do not claim success unless
- The memory file is updated and contains no secrets.

## Recovery / never
- Never turn a one-off/flaky failure into a permanent truth unless confirmed; never paste large logs; consolidate duplicates instead of adding new near-identical entries.
