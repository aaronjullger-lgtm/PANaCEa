# Workflow: Visual QA

**Goal:** Verify UI correctness/quality with browser evidence (report-first; fixes optional).

**Triggers:** UI PR, landing-page change, "does this look right?", pre-merge visual check.

**Agents:** Orchestrator → UI/UX QA (lead) → (Implementation only if fixing) → Reviewer.

## Phases
1. **Context scan** *(required)* — identify affected screens; read the design gate rules.
2. **Plan** — list screens + states + viewports + themes to check.
3. **Implementation** — none by default (report-first); leaf fixes only if asked.
4. **Self-review** — compare against `ui-design-system.mdc` + `no-ai-slop-visual-audit`.
5. **Verification** — capture screenshots (light+dark, mobile/tablet/desktop).
6. **Specialist review** — a11y quick pass (`accessibility-auditing`).
7. **Docs / memory** — note recurring drift in `design-system-decisions.md`.
8. **Final report** — see template.

**Implementation boundaries:** default report-only; any fix is leaf-only + needs re-verification.

**Validation commands:** `npm run dev` + browser; `rg` hex scan; optional `npm run test:e2e:a11y`.

**Evidence required:** screenshot grid (theme × breakpoint) with issues annotated.

**Stop conditions:** all target screens captured and assessed.

**Human approval gates:** any shared-primitive fix.

**Final report template:** Screenshot grid → issues mapped to design-system rules → severity → recommended fixes.

**Durable memory updates:** log repeated visual drift patterns.
