---
name: final-reporting
description: Write the end-of-task report that passes the final-report rubric. Use before finishing any task or run.
---

# Final reporting

Produce an honest, evidence-backed report. Rubric: `.cursor/evals/agent-final-report-rubric.md`; cloud form: `cloud-agent-final-report`.

## When to use
- Finishing any task/run that changed files or produced findings.

## Instructions
Report in order:
1. Summary (one line per logical change).
2. Files changed (`git diff --stat`).
3. Commands run + pass/fail with **real output**; mark **pre-existing vs introduced** failures.
4. Evidence (screenshots for UI; logs/output otherwise).
5. Residual risks / anything unverified.
6. Human-approval items + manual dashboard steps.
7. Durable-memory updates made (where).

## Stop conditions
- Don't finish without this report (and a pushed branch/PR if code changed).

## Verification evidence
- Each "pass" claim is backed by pasted command output; UI claims by screenshots.

## Do not claim success unless
- You actually ran the checks and captured evidence. Never assert visual QA without screenshots; never hide a failure.

## Recovery
- A required check couldn't run (env limit) → say so and explain what's blocked.
