---
name: visual-qa-testing
description: Perform structured visual QA on a page or component with screenshots, checking layout, spacing, typography, and design-system adherence. Use after any non-trivial UI change or for landing-page/marketing QA.
---

# Visual QA testing

Systematically inspect the rendered UI and compare against the design system.

## When to use

- After UI changes, or when asked for visual/landing-page QA.
- Before shipping user-facing screens.

## Instructions

1. Run the app (`npm run dev`, localhost:3000) and open the target screen (see `verifying-in-browser`).
2. Capture full-page and key-component screenshots at desktop width first.
3. Check against `.cursor/rules/ui-design-system.mdc`:
   - Colors use Stormy Slate tokens/CSS vars (no raw hex, no `bg-black`/`text-black`; muted slate for data, semantic colors only for status).
   - Typography scale, `tabular-nums` on numeric columns.
   - Spacing/elevation: card radius `rounded-xl`, correct borders/shadows, consistent padding.
   - One primary CTA per screen; icons from Lucide.
4. Look for overflow, clipping, misalignment, inconsistent gaps, contrast issues, and broken images.
5. Note each issue with a screenshot and the specific rule it violates.

## Verification

- Screenshots attached for every claim (never assert visual quality without them).
- Each flagged issue references a concrete design-system rule.
- `git diff --stat` shows only intended UI files if you also made fixes.

## Failure recovery

- If a fix requires touching a shared primitive (`GlassCard`, `button`, `index.css`), stop and flag for approval — those cascade site-wide.
- If rendering depends on backend data that's unavailable locally, QA the static/loading/empty states and document the gap.
