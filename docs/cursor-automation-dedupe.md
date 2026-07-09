# Cursor Automation Dedupe

Audit of overlap/conflict/staleness across the agent-config surfaces, and what was done to keep the system cohesive rather than a pile of near-duplicate prompts. Surfaces inspected: `.cursor/rules/`, `.cursor/skills/`, `.cursor/hooks.json`, `.cursor/README.md`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.claude/skills/`, and the docs added in this PR.

## Guiding principle

**One concern, one home.** When two surfaces would say the same thing, the authoritative one keeps the content and the others **reference** it. New rules/skills added in this pass are scoped to a distinct job and cross-link instead of repeating.

## Overlaps found and how they were resolved

| Overlap | Surfaces | Resolution |
|---------|----------|------------|
| Design-system guidance | existing `ui-design-system.mdc` (authoritative, "Stormy Slate") vs. new `visual-design-quality-gate.mdc`, skills `design-system-enforcement` / `visual-qa-testing` / `no-ai-slop-visual-audit` | `ui-design-system.mdc` remains the single source of truth. The gate rule + skills are short and **reference** it; they add a pass/fail checklist and the "no AI slop" lens rather than restating tokens. |
| Browser verification | `react-quality.mdc` + skills `verifying-in-browser` / `visual-qa-testing` vs. new `browser-verification.mdc` | The new rule is a thin "don't claim UI works without browser evidence" gate that points to the skills; the skills keep the step-by-step. |
| Anti-hallucination | `project-context.mdc` + `architecture-boundaries.mdc` vs. new `anti-hallucination-imports.mdc` + skill `route-and-import-verification` | Core context stays in `project-context`; the new rule/skill focus narrowly on *verifying imports/routes resolve* and reference the caveat list (missing `routes/`, `tokenMatchCache.ts`). |
| Agent SOP | existing `agent-operating-procedure.mdc` vs. new `cloud-agent-operating-mode.mdc` | `agent-operating-procedure` keeps the general SOP; `cloud-agent-operating-mode` adds only cloud-specific runtime facts (injected secrets, broken dev paths, git/PR flow, final report) and references the SOP. |
| Context persistence | existing skill `saving-workspace-context` vs. new skills `repo-memory-update` + `long-running-handoff` | `saving-workspace-context` is the umbrella; `repo-memory-update` specializes in *which durable file* to edit; `long-running-handoff` specializes in the *next-agent handoff note format*. Each cross-references. |
| Test triage | existing `parallel-test-fixing` vs. new `failure-triage` | `failure-triage` is general (build/type/lint/runtime) and delegates the many-failing-tests case to `parallel-test-fixing`. |
| Security review | existing `security-review.mdc` + `auditing-security` vs. new `pr-review-quality-gate.mdc` + `pr-review` | PR-review surfaces cover correctness/scope/tests and **reference** the security rule/skill for the security portion. |
| Verification commands | repeated npm scripts across many files | Centralized in `testing-and-verification.mdc`; other rules/skills say "run the verification ladder (see `testing-and-verification.mdc`)" instead of re-listing. |

## Conflicting guidance found

- **Autonomy vs. safety gates.** `autonomous-behavior.mdc` and `.cursorrules` grant broad permission to run `git`/deploy/migration commands ("execute, don't instruct"). New safety rules + the `beforeShellExecution` hook add gates for **destructive/production/secret** actions. **Reconciled framing:** full autonomy for *safe, reversible* actions; **ask/deny** for destructive, production-touching, or secret-exposing actions. The new rules state this explicitly so they complement rather than contradict the autonomy rule.
- **Deploy/migrations.** `.cursorrules`/`autonomous-behavior` imply deploys/migrations are fine; `supabase-security.mdc` + `security-review.mdc` require approval for production migrations/deploys. Reconciled: production migrations/deploys require human approval (also flagged by the hook).

## Duplicated skills found

- No exact duplicates between `.cursor/skills/` and the pre-existing `.agents/skills/` (~40 domain skills) or `.claude/skills/`. The `.cursor/skills/` set is intentionally scoped to **agent-workflow/QA/verification/memory**, while `.agents/skills` covers **PANaCEa domain logic** (FSRS, sessions, content, OSCE, Prisma). The `.cursor/README.md` notes this split. New skills were checked against both directories before adding.

## Stale Next.js assumptions found

- **None in the repo's committed rules.** `project-conventions.mdc` and `CLAUDE.md` correctly state Vite. To prevent community-copied drift, `react-quality.mdc` and `project-context.mdc` explicitly assert "React 19 + Vite + React Router 7, **not** Next.js; no `next/*`, no server components, no `app/` routing." (This is the single most common stale assumption in copied community rules.)

## Unsafe / too-generic instructions found and tightened

- Generic community rules often say "run tests" or "format code" without commands. All PANaCEa rules/skills use the **actual npm scripts** (`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:critical`, `npm run build`).
- Generic "auto-fix lint/format everything" guidance is unsafe in a large repo with a known-failing baseline. Replaced with scoped, non-destructive checks and an explicit "do not fix unrelated files to reach green" instruction.
- Generic MCP "just add these servers" advice is unsafe. Replaced with read-only/dev defaults, dashboard-secret handling, and a prompt-injection warning.

## Net changes made for cohesion

- Added focused, cross-referencing rules and skills (no content copied from community repos).
- Centralized the verification ladder and design-system truth; others reference them.
- Documented the autonomy-vs-safety reconciliation so the rule set is internally consistent.
- Preserved all pre-existing rules/skills and `.cursorrules` (compat only); nothing was deleted.
- Switched `.gitignore` from ignoring all of `.cursor/` to a selective unignore so curated config is tracked while `.cursor/mcp.json` and hook logs stay out of git.
