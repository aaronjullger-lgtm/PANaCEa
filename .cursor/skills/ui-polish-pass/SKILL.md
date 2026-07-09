---
name: ui-polish-pass
description: Actively improve the polish of a screen (spacing, hierarchy, consistency, states) within the design system. Use when asked to "polish"/"make it feel premium" or after a rough first implementation.
---

# UI polish pass

Improve visual quality intentionally, staying inside the design system. See `visual-design-quality-gate.mdc` and `ui-design-system.mdc`; audit-only work belongs in `visual-qa-testing` / `no-ai-slop-visual-audit`.

## When to use

- A screen works but looks rough/generic and needs a quality lift.

## Instructions

1. Open the screen in a browser (`npm run dev`, port 3000; dev-auth URL for authed views).
2. Polish within tokens/primitives:
   - Rhythm: consistent spacing scale, aligned grids, `max-w-*` containers.
   - Hierarchy: clear primary action (one CTA), type scale, `tabular-nums` on numbers.
   - Surfaces: correct `GlassCard`/elevation/`rounded-xl`/borders; no raw hex.
   - States: real loading/empty/error via existing components.
   - Motion: subtle, `useReducedMotion()`-gated.
3. Avoid AI slop (see `no-ai-slop-visual-audit`): no generic gradients/blobs/neon/emoji icons.
4. Change leaf components only; do not edit shared primitive base styles without approval.

## Stop conditions

- Stop when the gate in `visual-design-quality-gate.mdc` passes; don't gold-plate.

## Verification

- Before/after screenshots in light + dark.
- `rg -n "#[0-9a-fA-F]{3,6}"` on changed files → none outside `lib/tokens/`.
- `npm run lint` + `npm run typecheck`.

## Do not claim success unless

- Screenshots show the improvement and the design gate passes.

## Recovery

- A polish needs a shared-primitive change → flag for approval instead.
- Regression at another breakpoint/theme → re-check responsive + dark.
