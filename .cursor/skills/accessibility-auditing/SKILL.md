---
name: accessibility-auditing
description: Audit a page/component for WCAG issues (keyboard, focus, names, contrast) using axe + manual checks. Use when asked for an a11y audit or after significant UI changes.
---

# Accessibility auditing

Find and report WCAG issues with automated + manual checks. Pair with `.cursor/rules/accessibility.mdc`.

## When to use

- Explicit accessibility audit requests.
- After adding/changing interactive UI, forms, or navigation.

## Instructions

1. Automated pass (preferred): the repo has `@axe-core/playwright`.
   ```bash
   npx playwright install   # once
   npm run test:e2e:a11y    # playwright.ci-a11y.config.ts
   ```
   For a single page, write/adjust a short axe Playwright check targeting that route.
2. Manual keyboard pass: Tab through the screen — every interactive element must be reachable, in logical order, with a visible focus ring; Enter/Space activate; Esc closes modals; focus is trapped in dialogs and restored on close.
3. Names & semantics: icon-only buttons have `aria-label`; inputs have labels; headings are ordered; native elements used before ARIA roles.
4. Contrast: verify text meets AA (gold uses `--color-accent-button`). Check both light and dark.
5. Reduced motion: confirm animations are gated by `useReducedMotion()`.

## Verification

- axe run output captured (violations list) and/or manual findings with screenshots.
- Each issue names the WCAG criterion and the element.
- Re-run axe after fixes to confirm resolution.

## Failure recovery

- Do not remove focus outlines to "fix" contrast — fix the color instead.
- Never add global `transition-*` to `a, button, [role="button"]` (breaks Framer Motion site-wide).
- If a fix needs a shared primitive change, flag for approval.
