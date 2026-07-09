# Workflow: Bug Fix

**Goal:** Fix a defect at root cause with a regression test, no collateral damage.

**Triggers:** "fix <bug>", failing behavior, error report, reproducible issue.

**Agents:** Orchestrator → Test/Debug (lead) → Implementation → Reviewer → Documentation.

## Phases
1. **Context scan** *(required)* — reproduce; read the failing code path + tests; check `.cursor/memory/known-failure-modes.md`.
2. **Plan** — hypothesis + smallest fix + the check that proves it.
3. **Implementation** — apply fix; for non-trivial bugs use the debug workflow (instrument → reproduce → analyze) before editing (`failure-triage`).
4. **Self-review** — confirm the fix addresses root cause, not a symptom.
5. **Verification** — reproduce before/after; run the ladder.
6. **Specialist review** — Reviewer; Security if the bug touches auth/data.
7. **Docs / memory** — add a regression test; record the failure mode.
8. **Final report** — see template.

**Implementation boundaries:** minimal diff scoped to the bug; no unrelated refactors; restricted areas need approval.

**Validation commands:** reproduce command → `npm test`/`npx vitest run <file>` → `npm run typecheck` → `npm run build`.

**Evidence required:** before (fails) and after (passes) output; the new regression test.

**Stop conditions:** bug no longer reproduces + regression test passes; or 2 failed attempts → escalate.

**Human approval gates:** fix requires auth/RLS/schema/prod changes.

**Final report template:** Root cause → fix (files) → before/after evidence → regression test → residual risk.

**Durable memory updates:** add the failure mode to `known-failure-modes.md`; if recurring, add to `do-not-repeat.md`.
