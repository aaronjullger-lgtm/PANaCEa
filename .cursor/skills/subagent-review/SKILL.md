---
name: subagent-review
description: Get a fresh-eyes/adversarial review from a separate agent context that grades work it did not write. Use before merge and for risky changes.
---

# Subagent review

A second, independent pass so the agent that wrote the code isn't the one grading it (a core safety principle).

## When to use
- Before merge; after implementation of anything risky (auth/DB/UI/perf).

## Instructions
1. Spawn a review in a fresh context (or hand off to the Reviewer/Security/UI-QA agent) with only: the diff, the intent, and the relevant rubric in `.cursor/evals/`.
2. The reviewer runs the change's verification ladder and checks against the rubric — it must not rely on the implementer's claims.
3. Return findings mapped to file/line with a pass/block verdict; the reviewer does not silently fix (unless asked).
4. Feed blocking findings back for a fix, then re-review.

## Stop conditions
- Stop when the rubric is fully assessed with a clear verdict.

## Verification evidence
- Independent command output + findings list; verdict.

## Do not claim success unless
- The reviewer independently ran the checks (no rubber-stamp).

## Recovery
- Reviewer can't reproduce → get exact repro steps; never approve on trust alone.
