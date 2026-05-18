# StudyPanacea Design System Component Map

Last updated: 2026-05-17

This map prevents future UI work from drifting between legacy app primitives and the StudyPanacea redesign primitives.

## Canonical Redesign Primitives

Use these for new Diagnostic Atlas OS landing, dashboard, and anatomy atlas work:

- `components/studypanacea/MedicalGlassCard.tsx` for premium glass panels, scanner-framed dashboard cards, atlas viewers, and command-center surfaces.
- `components/studypanacea/SectionHeader.tsx` for marketing and dashboard section headings with eyebrow/title/description structure.
- `components/studypanacea/MetricVital.tsx` for readiness, accuracy, retention, pace, and other vitals-style metrics.
- `components/studypanacea/ScannerFrame.tsx` for diagnostic image viewers, 3D preview frames, and synthetic clinical panels.
- `components/studypanacea/OrganSystemBadge.tsx` for organ-system status labels.
- `components/studypanacea/PremiumCTAButton.tsx` for StudyPanacea landing CTAs.
- `components/studypanacea/AnimatedNumber.tsx` for reduced-motion-safe metric transitions.

## Legacy UI Primitives

Keep these in place for existing non-redesign surfaces unless a route is actively being migrated:

- `components/ui/GlassCard.tsx` is still used by existing analytics and navigation hub widgets.
- `components/ui/Badge.tsx` is the canonical badge primitive for existing shared app surfaces.
- `components/loading/index.tsx` is the canonical loading and skeleton surface.

Do not rename `components/ui/Badge.tsx` to lowercase in this workspace without a dedicated case-safe migration. The repository has used case-sensitive imports, and the local Git configuration has treated a lowercase shadcn `badge.tsx` as unsafe beside the existing `Badge.tsx`.

## Migration Rules

- New StudyPanacea redesign components should import from `@/components/studypanacea`.
- Existing analytics, study, library, and navigation components can keep `@/components/ui/GlassCard` until those surfaces are deliberately redesigned.
- Use `@/components/studypanacea/SectionHeader` for product-specific section headers; the old `components/ui/SectionHeader.tsx` path has been removed after import usage reached zero.
- Use `@/components/loading` for skeletons; the old `components/ui/SkeletonLoader.tsx` shim has been removed after import usage reached zero.
- When touching a route-local redesign component, prefer one surface primitive per panel. Do not wrap `MedicalGlassCard` inside `GlassCard` or vice versa.
- Use `MedicalGlassCard` `active` for visual state only. Use `pressed` or `aria-pressed` only when the card represents a persistent selected/toggled state.
- Avoid adding new primitive variants unless they map to a real product state: readiness, weak-area risk, image-lab status, review debt, tutor context, or atlas model state.
- Prefer semantic tokens and atlas CSS variables over raw hex values.

## Current Duplication Decision

The duplicate primitives are intentionally not collapsed into a single implementation yet because the legacy app and the StudyPanacea redesign have different layout assumptions. The safe path is:

1. Keep old primitives stable for existing routes.
2. Use StudyPanacea primitives for new Diagnostic Atlas OS work.
3. Migrate legacy routes opportunistically when their visual system is redesigned.
4. Delete legacy primitives only after import usage reaches zero.

Resolved on 2026-05-17:

- `components/ui/SectionHeader.tsx` deleted after active import usage reached zero.
- `components/ui/SkeletonLoader.tsx` deleted after active import usage reached zero.
- `pages/LandingPage.tsx` deleted; the public route uses `components/landing/LandingPage.tsx`.
