---
name: design-quality-gate
description: Final pass/fail gate for UI work against the PANaCEa design system before claiming UI done. Use at the end of any UI change.
---

# Design quality gate

Enforce `ui-quality-rubric.md` + `visual-design-quality-gate.mdc` before UI is "done".

## When to use
- Closing out any UI/route/style change or visual QA.

## Gate (all must pass)
- Browser screenshots in **light + dark** (and key breakpoints for layout).
- Tokens only (no raw hex outside `lib/tokens/`, no `bg-black`); primitives reused (no base edits).
- Loading/empty/error states; `tabular-nums`; one primary CTA; AA contrast; focus visible; ≥44px targets; reduced-motion-safe.
- No AI slop (`no-ai-slop-visual-audit`).

## Verification evidence
- Screenshots; `rg -n "#[0-9a-fA-F]{3,6}"` clean; `npm run lint` + `npm run typecheck`.

## Stop conditions
- Pass → done. Fail → fix (leaf only) or escalate shared-primitive/dep needs.

## Do not claim success unless
- Screenshots prove light+dark and the hex scan is clean.

## Recovery
- Fix needs a shared primitive or new dep → `human-approval-gate`.
