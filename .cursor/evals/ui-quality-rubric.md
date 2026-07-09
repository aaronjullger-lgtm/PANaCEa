# Rubric: UI Quality

Grades UI work (used by UI/UX QA + `design-quality-gate`). Anchored to `ui-design-system.mdc`.

## Pass criteria (all required)
- Browser-verified with screenshots in **light + dark** (and key breakpoints for layout changes).
- Tokens only (no raw hex outside `lib/tokens/`; no `bg-black`/`#000000`).
- Primitives reused; no shared-primitive base edits without approval.
- Real loading/empty/error states; `tabular-nums` on numbers; one primary CTA.
- AA contrast; visible focus; ≥44px targets; reduced-motion-safe.
- No "AI slop" (generic gradients/blobs/neon/emoji icons/stock photos).

## Scoring (0–5)
- 5: on-system, verified light+dark+responsive, product-specific. 3: minor drift, still verified. 1: partial verification. 0: any automatic failure.

## Evidence required
- Screenshots (theme × breakpoint); clean `rg -n "#[0-9a-fA-F]{3,6}"`; lint/typecheck pass.

## Automatic failure conditions
- Visual quality claimed without screenshots/browser.
- Raw hex / `bg-black` introduced; shared primitive edited without approval.
- New UI/animation/3D dependency without approval; `LandingPage.tsx` inline styles removed.
- Global `transition-*` added to base elements.

## Examples of unacceptable claims
- "Looks great 👍" (no screenshots).
- "Added a gradient hero to modernize it" (slop + off-system).

## Must be reported
- Before/after screenshots, issues vs design system, fixes applied (leaf), approval-needed items.
