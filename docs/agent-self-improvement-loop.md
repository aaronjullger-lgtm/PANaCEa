# Agent Self-Improvement Loop

A **bounded, safe** recovery-and-learning loop for when a task fails (failed tests/build, bad visual QA, or a repeated mistake). It is deliberately small: diagnose, attempt a fix, verify, and either succeed or **escalate** — then record the lesson. It never becomes an uncontrolled autonomous loop. Workflow form: `.cursor/workflows/self-improvement-loop.workflow.md`.

## The loop

1. **Run task** — execute the intended change/workflow.
2. **Record plan** — one-line hypothesis of what should happen and the check that proves it.
3. **Run checks** — the exact command(s) for the change (see `testing-and-verification.mdc`).
4. **Capture failures** — save the real output; classify as **pre-existing** (baseline in `.cursor/memory/validation-history.md`) or **introduced**.
5. **Fix or document** — fix the root cause (`failure-triage` / `parallel-test-fixing`); if it's pre-existing/out-of-scope, document it and move on.
6. **Review diff** — `git diff --stat` matches scope; no tests/gates weakened; no secrets.
7. **Update repo memory** — record the failure mode/lesson (`repo-learning-loop`): `known-failure-modes.md`, `do-not-repeat.md`, `validation-history.md`; add a retrospective for complex tasks.
8. **Suggest improvement** — if a pattern **repeated**, propose a new rule/skill/hook (don't create speculative ones).
9. **Apply low-risk improvements only** — doc/memory updates, a clearly-scoped skill/rule addition.
10. **Escalate risky changes** — anything touching safety gates, hooks that block, rules affecting many files, or restricted areas → human approval.

## Hard limits (non-negotiable)

- **Maximum 2 automatic repair attempts** per failure. After attempt #2 without success → **stop and escalate** with an unresolved-failure report.
- **Never loop on destructive commands** (no auto-retry of `rm`, resets, migrations, deploys).
- **Never blind-retry** failing installs/tests without a diagnosis of *why* they failed.
- **Never hide failures** — unresolved failures must appear in the final report.
- **Never delete tests** or weaken validation/type/lint gates to pass.
- **Never** turn a one-off/flaky failure into a permanent "truth" in memory unless confirmed.

## Attempt log (required)

Track each attempt so the loop is auditable:

```
Attempt N/2
- Hypothesis:
- Change:
- Command re-run:
- Result: pass | fail (output ref)
```

## When to enter the loop

- A verification command fails after your edit.
- Visual QA is rejected (screenshots don't meet `ui-quality-rubric.md`).
- The same mistake recurs across tasks (then bias toward step 8 — suggest a rule).

## Escalation report format

When escalating, report: the failure + full output, the ≤2 attempts and why they failed, whether it's pre-existing vs introduced, the suspected root cause, what you need from a human (approval/decision/access), and any partial progress that's safe to keep.

## What this loop is NOT

- Not model fine-tuning. "Improvement" = better repo-local playbooks/rules/memory for future agents.
- Not a license to keep running unattended — it is capped, diagnosis-first, and escalation-biased.
