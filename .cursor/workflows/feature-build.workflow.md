# Workflow: Feature Build

**Goal:** Ship a small/medium feature end-to-end, safely and verifiably.

**Triggers:** "add/implement <feature>", new UI + endpoint, new drill/analytics view.

**Agents:** Orchestrator (lead) → Planner → Implementation → UI/UX QA (if UI) → Reviewer → Security (if data/auth) → Documentation.

## Phases
1. **Context scan** *(required)* — read `project-context.mdc`, target subsystem, nearby tests, `.cursor/memory/{project-facts,known-failure-modes,do-not-repeat}.md`. Confirm referenced files/routes exist.
2. **Plan** — Planner produces phased steps + affected files + risks (`agent-task-planning`).
3. **Implementation** — Implementation agent edits within scope (`code-mod-safety`, `using-ui-stack`).
4. **Self-review** — re-read diff vs plan; `git diff --stat` matches scope.
5. **Verification** — see commands below; browser evidence for UI.
6. **Specialist review** — Reviewer (always); UI/UX QA for UI; Security for data/auth.
7. **Docs / memory** — Documentation agent updates plan + any lessons.
8. **Final report** — see template.

**Implementation boundaries:** no shared-primitive edits, no auth/RLS, no FSRS rating changes, no new prod deps, no prod data — without approval.

**Validation commands:** `npm run typecheck` · `npm run lint` · `npm test` (or `test:critical` while iterating) · `npm run build`; UI: `npm run dev` + screenshots.

**Evidence required:** command outputs (pass/fail), `git diff --stat`, screenshots (light+dark) for UI.

**Stop conditions:** all gates pass with evidence; or 2 failed repair attempts → `self-improvement-loop.workflow.md`.

**Human approval gates:** new production dependency, auth/RLS/DB schema, prod config.

**Final report template:** Summary → files changed → commands+results → evidence → deviations → risks → memory updates → next steps.

**Durable memory updates:** append notable decisions to `.cursor/memory/agent-lessons-learned.md`; record checks in `validation-history.md`.
