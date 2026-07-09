# Workflow: UI Polish

**Goal:** Raise the visual quality of a screen within the design system, no AI slop.

**Triggers:** "polish/make premium", rough first-pass UI, design cleanup.

**Agents:** Orchestrator → UI/UX QA (lead) → Implementation → Reviewer → Documentation.

## Phases
1. **Context scan** *(required)* — open the screen in a browser; read `ui-design-system.mdc`, `.cursor/training/ui-design-quality-primer.md`.
2. **Plan** — list specific polish items (spacing, hierarchy, states, motion).
3. **Implementation** — leaf components only (`ui-polish-pass`, `design-system-enforcement`).
4. **Self-review** — `no-ai-slop-visual-audit`; hex scan.
5. **Verification** — screenshots light+dark + key breakpoints.
6. **Specialist review** — Reviewer; UI/UX QA sign-off vs `ui-quality-rubric.md`.
7. **Docs / memory** — record any design decision in `design-system-decisions.md`.
8. **Final report** — see template.

**Implementation boundaries:** no shared-primitive base-style edits; no new deps; keep `LandingPage.tsx` inline styles; no global `transition-*` on base elements.

**Validation commands:** `npm run dev` (port 3000) + browser; `rg -n "#[0-9a-fA-F]{3,6}"` (none outside `lib/tokens/`); `npm run lint`; `npm run typecheck`.

**Evidence required:** before/after screenshots (light+dark); clean hex scan.

**Stop conditions:** `ui-quality-rubric.md` passes; don't gold-plate.

**Human approval gates:** shared-primitive change, new dependency.

**Final report template:** Before/after screenshots → issues fixed → items needing approval → residual gaps.

**Durable memory updates:** `design-system-decisions.md` for reusable decisions.
