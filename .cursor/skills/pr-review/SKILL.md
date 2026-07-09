---
name: pr-review
description: Review a PR/diff for correctness, scope, tests, security, and evidence. Use when asked to review changes or before opening your own PR.
---

# PR review

Structured, evidence-based review. See `pr-review-quality-gate.mdc`; delegate the security portion to `auditing-security`.

## When to use

- Reviewing a diff/PR, or self-reviewing before opening one.

## Instructions

1. Understand intent, then read the diff: `git diff <base>...HEAD` and `git diff --stat`.
2. Check scope: only intended files; no unrelated churn/drive-by refactors.
3. Check correctness: logic, edge cases, error/empty/loading states, regressions.
4. Check hallucinations: imports/paths/exports/routes resolve (see `route-and-import-verification`).
5. Check tests: new behavior covered; none deleted/skipped/weakened.
6. Check security: run `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"`; auth/RLS not weakened; inputs validated.
7. Check architecture/UI: Edge rules (`architecture-boundaries.mdc`); design + browser evidence for UI (`visual-design-quality-gate.mdc`).
8. Run the verification ladder (`testing-and-verification.mdc`) for the change type.

## Stop conditions

- Stop when every gate item is assessed with evidence.

## Verification

- Commands run with results; findings mapped to file/line.

## Do not claim success unless

- You actually ran/inspected the checks (no evidence-free "LGTM").

## Recovery

- Can't compute the diff → confirm the base branch; fetch it.
- A control looks weakened → flag it; never suggest weakening it to pass CI.
- Review-only task → do not edit code unless asked.
