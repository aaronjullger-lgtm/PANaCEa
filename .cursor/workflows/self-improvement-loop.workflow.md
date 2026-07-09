# Workflow: Self-Improvement Loop

**Goal:** Recover from a failure (failed tests/build, bad visual QA, repeated mistake) safely and turn it into a durable lesson — **bounded, never uncontrolled**.

**Triggers:** failing checks after an edit, rejected visual QA, or the same mistake recurring.

**Agents:** Orchestrator → Test/Debug (lead) → (Implementation) → Documentation. Full spec: `docs/agent-self-improvement-loop.md`.

## Phases (max 2 automatic repair attempts)
1. **Context scan** *(required)* — capture the exact failure; check `.cursor/memory/known-failure-modes.md` + `do-not-repeat.md`.
2. **Plan** — one hypothesis + the smallest fix + the proving check.
3. **Implementation** — apply the fix (`failure-triage`).
4. **Self-review** — diff matches the fix; no tests/gates weakened.
5. **Verification** — re-run the exact failing command.
6. **Specialist review** — if still failing after attempt #2 → **stop and escalate**.
7. **Docs / memory** — record the lesson (`repo-learning-loop`): update `known-failure-modes.md`, `do-not-repeat.md`, `validation-history.md`; add a retrospective for complex tasks.
8. **Final report** — outcome + attempts used + unresolved items.

**Improvement step (low-risk only):** propose a new rule/skill/hook ONLY if the pattern repeated; apply low-risk doc/memory improvements; **escalate risky changes** (hooks that block, rule changes affecting many files, anything touching safety gates).

**Implementation boundaries / never:** never loop on destructive commands; never blind-retry installs/tests without diagnosis; never hide failures; never delete tests or weaken validation to pass; never exceed 2 automatic attempts.

**Validation commands:** the exact failing command + the relevant ladder.

**Evidence required:** attempt log (hypothesis → change → result) for each attempt.

**Stop conditions:** fixed and verified, OR 2 attempts exhausted → escalate with a clear unresolved-failure report.

**Human approval gates:** any risky rule/hook change; any restricted-area root cause.

**Final report template:** Failure → attempts (≤2) → outcome → lesson recorded (where) → unresolved items + escalation.

**Durable memory updates:** `known-failure-modes.md`, `do-not-repeat.md`, `validation-history.md`, `workflow-retrospectives.md`.
