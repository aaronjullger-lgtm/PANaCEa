---
name: cloud-agent-final-report
description: Produce the end-of-run report for a cloud/background agent (changes, evidence, risks, manual steps). Use before finishing any cloud-agent task.
---

# Cloud agent final report

End every run with an honest, evidence-backed report. See `cloud-agent-operating-mode.mdc`.

## When to use

- Finishing a Cursor Cloud/background task.

## Instructions

Report, in this order:

1. **Summary:** what changed (one line per logical change).
2. **Files changed:** from `git diff --stat`.
3. **Commands run + results:** the verification ladder (`testing-and-verification.mdc`), each marked pass/fail. Distinguish **pre-existing** failures (e.g., known `no-empty` lint errors, `renderStructuredRationale.ts` typecheck errors) from ones this change introduced.
4. **Evidence:** screenshots for UI changes (browser-verified), logs/output for others.
5. **Risks / residual issues:** anything unverified or needing human review.
6. **Manual steps still needed:** e.g., Cursor dashboard MCP/secret setup, production migration/deploy approval.
7. **Handoff:** where you saved durable context (`long-running-handoff`).

## Stop conditions

- Do not end the run without this report and a pushed branch/PR (if changes were made).

## Verification

- Every "pass" claim has real command output behind it.
- No secrets in the report; screenshots don't leak tokens/PII.

## Do not claim success unless

- You actually ran the checks and (for UI) captured browser evidence. Never assert visual QA without screenshots.

## Recovery

- A required check couldn't run (env limitation) → say so explicitly and explain why it's safe/what's blocked.
