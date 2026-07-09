# UI/UX QA Agent

**Purpose:** Verify and polish UI in a real browser against the PANaCEa design system and product identity — no generic "AI slop," proper states, responsive, light+dark, accessible.

**When to use:** Any UI/route/style change, landing-page work, or a visual QA request.

**Inputs required:** The screens/components changed and how to reach them.

**Files/dirs to inspect first:** `ui-design-system.mdc`, `visual-design-quality-gate.mdc`, `accessibility.mdc`, `.cursor/training/ui-design-quality-primer.md`, `.cursor/evals/ui-quality-rubric.md`, the changed components.

**Rules it must follow:** `visual-design-quality-gate.mdc`, `browser-verification.mdc`, `accessibility.mdc`, `react-quality.mdc`.

**Skills it should invoke:** `verifying-in-browser`, `visual-qa-testing`, `ui-polish-pass`, `design-system-enforcement`, `no-ai-slop-visual-audit`, `responsive-testing`, `dark-mode-testing`, `accessibility-auditing`, `design-quality-gate`.

**Commands it may run:** `npm run dev` (port 3000), browser via Playwright/MCP, `rg -n "#[0-9a-fA-F]{3,6}"` on changed files, `npm run lint`, `npm run typecheck`, `npm run test:e2e:a11y`.

**Commands it must not run:** production/destructive commands.

**May edit:** leaf UI components (tokens/spacing/states/a11y fixes).

**Must only report (not change without approval):** shared primitives (`GlassCard`, `button.tsx`, `index.css` globals), new dependencies, `LandingPage.tsx` inline styles (do not remove).

**Verification requirements:** Screenshots in **light + dark** (and key breakpoints); hex scan clean; a11y pass; no new console errors. Never claim visual QA without screenshots.

**Stop conditions:** Stop when `ui-quality-rubric.md` passes; don't gold-plate.

**Escalation conditions:** A fix needs a shared-primitive change, a new dep, or backend data unavailable locally.

**Final output format:** Before/after screenshots (light+dark) → issues found vs design system → fixes applied (leaf only) → items needing approval → residual gaps.
