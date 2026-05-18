---
name: debug-reproduce-isolate
description: Use for debugging tasks: reproduce reported bugs, inspect logs and recent diffs, isolate root causes, implement minimal fixes, add regression tests, and summarize the fix. Trigger when the user reports a bug, error, crash, failing test, or unexpected behavior.
---

1. Clarify the observed behavior, expected behavior, reproduction steps, affected environment, error messages, logs, screenshots, and recent changes. If details are missing, make the safest reasonable assumption and state it.
2. Reproduce the issue locally before editing whenever possible. Use the repo's documented commands and the smallest failing case. If reproduction fails, record what was attempted and what extra evidence is needed.
3. Inspect the affected module, relevant dependencies, recent diffs, tests, logs, and configuration. Prefer `rg`, focused file reads, and targeted test runs.
4. Form hypotheses that map to concrete code paths. Narrow the failure by adding temporary logs, running focused tests, or isolating inputs; remove temporary diagnostics before finishing.
5. Implement the smallest safe fix that addresses the root cause. Follow existing patterns and avoid speculative rewrites, unrelated refactors, dependency churn, or broad formatting changes.
6. Add or update a regression test that fails without the fix and passes with it. If a test is not practical, explain why and provide the closest verification performed.
7. Protect safety boundaries. Do not expose secrets in logs, weaken authentication, remove validation, bypass database authorization, delete user data, or silence errors without handling them.
8. Run targeted verification first, then broader verification as risk warrants: affected tests, lint, typecheck, full test suite, and build using existing scripts.
9. Acceptance criteria: the issue is reproduced or clearly characterized, the root cause is identified, the fix is minimal, regression coverage exists where practical, and verification results are reported.
10. Finish with the root cause, changed files, tests added, commands run, remaining risks, and any follow-up work.
