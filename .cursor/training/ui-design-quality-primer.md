# UI Design Quality Primer

Make UI feel like a clinical diagnostic workstation, inside the design system. Authoritative: `.cursor/rules/ui-design-system.mdc`, `visual-design-quality-gate.mdc`, `accessibility.mdc`; rubric: `.cursor/evals/ui-quality-rubric.md`.

## Must-haves
- Tokens only (Stormy Slate CSS vars); no raw hex outside `lib/tokens/`, no `bg-black`/`#000000`.
- Reuse primitives (`GlassCard`, `Button`, `EmptyState`, `SkeletonLoader`); don't edit their base styles.
- Real loading/empty/error states; `tabular-nums` on numbers; one primary CTA per screen; Lucide icons.
- Works in light + dark, AA contrast (gold text → `--color-accent-button`), responsive, keyboard-accessible, reduced-motion-safe.

## No AI slop (product identity)
- Reject generic gradients/blobs, stock-photo doctors, robot mascots, random emoji icons, meaningless particles, excessive neon, low-contrast text, and "hero + 3 cards + pricing" boilerplate with no product specificity. See `no-ai-slop-visual-audit` skill.

## Verify (never claim UI without evidence)
- `npm run dev` (port 3000) + browser screenshots (light+dark, key breakpoints); `rg -n "#[0-9a-fA-F]{3,6}"` clean; `npm run lint` + `npm run typecheck`.

## Approval required
- Shared-primitive changes, new UI/animation/3D dependencies.
