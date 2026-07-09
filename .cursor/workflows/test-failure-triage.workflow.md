# Workflow: Test Failure Triage

**Goal:** Diagnose and fix failing checks to root cause; never game the suite.

**Triggers:** red CI/suite, failing build/typecheck/lint, flaky tests.

**Agents:** Orchestrator → Test/Debug (lead) → Implementation → Reviewer.

## Phases
1. **Context scan** *(required)* — capture full failure output; check `.cursor/memory/known-failure-modes.md` + `validation-history.md`.
2. **Plan** — group failures by root cause; separate pre-existing from introduced.
3. **Implementation** — fix source/shared cause (`failure-triage`, `parallel-test-fixing`); ≤2 repair attempts before escalation.
4. **Self-review** — confirm no test deleted/weakened.
5. **Verification** — re-run the exact failing command + full suite.
6. **Specialist review** — Reviewer.
7. **Docs / memory** — record the failure mode + fix.
8. **Final report** — see template.

**Implementation boundaries:** never delete/skip tests, weaken assertions, add `@ts-ignore`/lint-disable, or blind-retry installs/tests.

**Validation commands:** `npm test 2>&1 | tee /tmp/test.log` · `npx vitest run <file>` · `npm run typecheck` · `npm run build`.

**Evidence required:** before/after pass counts; root-cause grouping.

**Stop conditions:** target command passes, or failure confirmed pre-existing/unrelated (documented), or 2 attempts w/o progress → escalate to `self-improvement-loop.workflow.md`.

**Human approval gates:** root cause in auth/RLS/schema.

**Final report template:** Root causes → fixes → before/after → pre-existing failures left (with reason).

**Durable memory updates:** `known-failure-modes.md`, `validation-history.md`.
