---
name: no-ai-slop-visual-audit
description: Audit UI for generic "AI slop" and template feel, and steer it back to PANaCEa's clinical product identity. Use for landing/marketing pages and any new UI that risks looking generic.
---

# No-AI-slop visual audit

Catch UI that looks like a generic AI/template site and realign it to the product identity in `AGENTS.md` and `ui-design-system.mdc`.

## When to use

- Landing/marketing pages, hero sections, or any new UI that might read as generic.

## Instructions

1. Open the screen in a browser (`npm run dev`, port 3000) and screenshot it.
2. Flag "slop" signals (reject these — from AGENTS.md "should NOT feel like"):
   - Huge generic gradients, blob/mesh backgrounds, glassmorphism-for-its-own-sake.
   - Stock-photo doctors, fake AI/robot mascots, random emoji icons.
   - Meaningless floating shapes/particles, excessive neon, purple-startup-template vibes.
   - Low-contrast text, decorative motion that doesn't explain learning/diagnosis/progress.
   - Centered single-column "SaaS hero + 3 feature cards + pricing" boilerplate with no product specificity.
3. Steer toward identity: clinical diagnostic workstation / medical atlas / exam-readiness command center — precise clinical UI, organ-system/vitals-inspired data, Stormy Slate tokens, meaningful motion.
4. Fix within tokens/primitives (see `design-system-enforcement`, `ui-polish-pass`); leaf components only.

## Stop conditions

- Stop when the screen reads as product-specific and passes `visual-design-quality-gate.mdc`.

## Verification

- Before/after screenshots (light + dark); each flagged item addressed or justified.
- Hex scan clean; `npm run lint` + `npm run typecheck`.

## Do not claim success unless

- Screenshots show the de-slopped result; the design gate passes.

## Recovery

- Genuine fix needs a shared primitive or new dependency → flag for approval instead of hacking around it.
- Backend-dependent content missing locally → audit layout/identity on static/empty states and note the gap.
