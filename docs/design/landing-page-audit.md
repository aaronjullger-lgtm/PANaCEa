# Landing Page Audit & Rebuild Notes

_Date: 2026-06-15 · Branch: `claude/funny-einstein-lv3bh7`_

## Current-state findings (before rebuild)

- **Framework / stack:** React 19.2 + TypeScript (strict) + Vite 6.2, TailwindCSS 3.4,
  Motion/Framer Motion 12, Clerk auth, deployed to Cloudflare Pages. Three.js is installed
  but the landing hero used a hand-rolled **2D canvas** scanner (`HeroCanvas.tsx`), not R3F.
- **Entry / routing:** `App.tsx` renders `components/landing/LandingPage` for unauthenticated
  users and as a public fallback when auth is slow/blocked.
- **Design system:** A mature "Atlas" diagnostic theme (`theme-diagnostic-atlas`) with CSS
  variable tokens in `index.css` (`--atlas-accent-cyan/blue/violet/pulse-pink`, success,
  warning, clinical white, glass surfaces, medical grid, scanner line, focus ring) and a
  reusable primitive set in `components/studypanacea/` (MedicalGlassCard, ScannerFrame,
  SectionHeader, PremiumCTAButton, MetricVital, OrganSystemBadge, MedicalGridBackground).
- **Existing sections:** Hero (anatomy scanner) → DiagnosticScrollStory → TrainingModesDock →
  ClinicalImageTraining → DashboardPreview (lazy) → final CTA. Copy was strong but framed the
  product as a **"PANCE readiness scanner / command center"**, and the signature visual was a
  rotating translucent anatomy figure — closer to an "unexplained scan" than to the mandated
  **Clinical Learning Engine** adaptive-loop thesis.
- **Quality already present:** reduced-motion handling, device-capability gating before
  mounting the canvas, lazy-loaded heavy preview, skip-nav, accessible dialogs, semantic
  headings, `prefers-reduced-motion`. This is well above a stock template and was preserved.

## Constraints honored

- Reuse the Atlas token system and `studypanacea` primitives — **no second design system.**
- Binary implicit-rating philosophy: no Hard/Easy or self-rated buttons referenced in copy.
- No invented metrics, testimonials, partnerships, or accreditation. Numbers shown are clearly
  illustrative product-preview values (consistent with the pre-existing content.ts dataset).
- Keep the landing page isolated from authenticated study flows; no R3F/heavy deps forced in.

## Installed capabilities verified

| Capability | Status | Use |
|---|---|---|
| `panacea-style-system` skill | present | design-token / visual-hierarchy guidance (the repo's equivalent of `ui-ux-pro-max`, which is **not** installed) |
| `aidesigner` skill + MCP | present | available; not used — repo-native Atlas system is stronger for brand fit |
| Higgsfield AI MCP | present, **free plan / 10 credits** | insufficient for video; prompt sheet authored at `higgsfield-prompts.md`, one still attempted |
| Motion / Framer Motion 12 | installed | section reveals, hero entrance, legend transitions |
| Three.js 0.184 | installed | **not** required — the signature visual is a performant 2D canvas (lighter, mobile-safe) |
| Lucide React | installed | interface icons |
| React Three Fiber / drei / postprocessing / lenis / xyflow / theatre | **not** installed | deliberately not added — see `dependency-decision-record.md` |

## What was preserved / removed / rewritten

- **Rewritten:** `Hero.tsx` (reframed to the Clinical Learning Engine thesis + new visual).
- **New:** `ClinicalLearningEngine.tsx` (signature visual), `StudyPrescription.tsx`
  (dominant "one next best action" proof), `ENGINE_STAGES` data + `--atlas-accent-gold` token.
- **Preserved:** DiagnosticScrollStory, TrainingModesDock, ClinicalImageTraining,
  DashboardPreview, final CTA, auth dialog, header/footer — all already on-brand and strong.
- **Orphaned but retained (not deleted per repo policy):** `HeroCanvas.tsx`,
  `FloatingDiagnosticLabels` are no longer used by the hero. Left in place; safe to remove in a
  follow-up cleanup once confirmed.

## Implementation risks

- Full-project `tsc` is memory-heavy (documented OOM); use the `--max-old-space-size=4096` flag.
- Canvas text labels are only drawn above ~360px width to avoid mobile clutter; meaning is
  always carried by the DOM legend (screen-reader available, `aria-live`).
