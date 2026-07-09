# Workflow: Accessibility Audit

**Goal:** Find and (optionally) fix WCAG issues with automated + manual evidence.

**Triggers:** a11y audit request, UI PR, weekly a11y automation.

**Agents:** Orchestrator → UI/UX QA (lead) → (Implementation for leaf fixes) → Reviewer.

## Phases
1. **Context scan** *(required)* — target pages; read `accessibility.mdc`, `.cursor/training/ui-design-quality-primer.md`.
2. **Plan** — pages + checks (keyboard, focus, names, contrast, reduced motion).
3. **Implementation** — safe leaf fixes (aria-label, labels, focus order).
4. **Self-review** — re-run axe on changed pages.
5. **Verification** — `npx playwright install` (once) → `npm run test:e2e:a11y`; manual keyboard/contrast in light+dark.
6. **Specialist review** — Reviewer.
7. **Docs / memory** — record recurring a11y misses.
8. **Final report** — see template.

**Implementation boundaries:** never remove focus outlines; never add global `transition-*` to base elements; no shared-primitive edits without approval.

**Validation commands:** `npm run test:e2e:a11y` · `npm run lint` · `npm run typecheck`.

**Evidence required:** axe violation list (before/after) + manual notes + screenshots.

**Stop conditions:** violations resolved or documented with owners.

**Human approval gates:** shared-primitive/design changes.

**Final report template:** Violations (WCAG criterion + element) → fixes applied → re-run results → remaining issues.

**Durable memory updates:** append recurring a11y patterns to `known-failure-modes.md`.
