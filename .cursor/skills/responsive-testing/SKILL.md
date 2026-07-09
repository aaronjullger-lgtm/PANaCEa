---
name: responsive-testing
description: Verify a page/component works across mobile, tablet, and desktop breakpoints. Use after layout changes or when building responsive UI.
---

# Responsive testing

Check layout and interaction across viewport sizes.

## When to use

- After layout/CSS changes or when adding new screens.
- When the design must work on mobile (the design system requires mobile-first, lighter fallbacks for heavy 3D).

## Instructions

1. Run `npm run dev` (localhost:3000) and open the target screen.
2. Test at representative widths: mobile 375px, tablet 768px, desktop 1280px, wide 1440px+.
   - In a browser MCP/Playwright, set the viewport for each size; in Chrome DevTools, use device toolbar.
3. At each width verify: no horizontal scroll/overflow, readable text, tap targets ≥ 44px, no clipped content, and that Tailwind responsive prefixes (`sm:`/`md:`/`lg:`) behave.
4. Confirm heavy sections (charts, `three`/3D) have lighter mobile fallbacks and lazy-load.
5. Screenshot each breakpoint.

## Verification

- Screenshots at mobile/tablet/desktop attached.
- No overflow or clipped/overlapping elements at any tested width.
- Interactive elements remain reachable and tappable on mobile.

## Failure recovery

- Overflow: find the offending fixed width/`min-w`; prefer fluid units and `max-w-*` containers (`max-w-6xl` / `--content-max-width`).
- Layout thrash from animations on mobile: gate with `useReducedMotion()` and simplify.
- If a component can't be made responsive without touching a shared primitive, flag for approval.
