# Follow-Up UI Polish

Production PR review date: 2026-05-14

This file tracks lower-priority StudyPanacea redesign follow-ups found during the production-readiness review. P0/P1 items should be fixed before merge; the items below are P2/P3 unless a later QA pass proves otherwise.

## Completed In Follow-Up Pass

- Replaced the custom landing auth modal with the existing Radix/shadcn dialog primitive so focus trapping, Escape handling, outside-click dismissal, and focus restoration are handled by tested infrastructure.
- Added and hardened `npm run test:ui-smoke:preview`, which builds the app, starts a strict-port local `vite preview`, mocks same-origin API responses, checks the landing page plus protected study route at desktop/mobile/reduced-motion viewports, and shuts the preview process down cleanly.
- Deleted legacy unused landing components after an import audit: `HeroSection`, `FeaturesGrid`, `HowItWorks`, `SocialProof`, `FinalCTA`, and the old isolated `landing.css`.
- Tightened active StudyPanacea copy by replacing outcome-claim language such as “pass buffer” and patient-diagnosis-coded labels with safer readiness/study-support language.
- Closed the mobile landing navigation before opening auth dialogs so focus and overlay layering stay predictable on small screens.
- Replaced the heavy lazy `HeroCanvas` R3F path with a lightweight client canvas scanner scene. Build output dropped the hero chunk from roughly 870 kB to 4.4 kB and total JS from roughly 6.85 MB to 5.98 MB.
- Removed the obsolete PWA precache ignore for the hero scanner chunk now that it is a small canvas module instead of a heavy WebGL payload.
- Split `DashboardShell.tsx` into a 251-line orchestration component plus route-local `DashboardShellSections.tsx`, preserving widget lazy-loading and auth/routing behavior.
- Added license-tracked NIH heart, cardiopulmonary, HRA kidney, HRA liver, HRA main bronchus, HRA pancreas, HRA spleen, HRA prostate, HRA spinal cord, and right femur GLBs and wired them into the authenticated visualizer as on-demand 3D atlas scenes with system filters.
- Hardened the on-demand anatomy viewer with WebGL support failure copy, loading progress, GPU context cleanup, fullscreen state synchronization, visible focus states, structure hover/focus highlighting, asset-size/license metadata, and reduced-motion-safe selected-structure overlays.
- Added NIH asset verifier performance budgets: each checked-in atlas GLB must stay under 8 MB, and the total NIH GLB payload must stay under 32 MB unless the budget is deliberately changed.
- Added `docs/design-system-component-map.md` and tightened `MedicalGlassCard` accessibility semantics so visual `active` state no longer automatically announces a toggle unless `pressed` or `aria-pressed` is explicitly provided.
- Replaced hardcoded RGB/RGBA styling in newly added atlas chart, SVG, visualizer, and anatomy viewer surfaces with atlas CSS variables, opacity props, `color-mix`, or computed CSS token reads.
- Expanded `npm run test:ui-smoke:preview` coverage with product-specific landing section assertions, mobile horizontal-overflow detection, the protected visualizer route, and a guard that unauthenticated/landing smoke routes do not eagerly fetch GLB anatomy assets.
- Replaced the generic unauthenticated `/visualizer` gate copy with anatomy-specific sign-in intent and added a regression test so the route keeps StudyPanacea’s product-specific voice.
- Consolidated protected-route auth gate copy into a route-intent table and added product-specific unauthenticated copy for clinical image training, clinical profile, adaptive practice, daily challenges, concept explorer, weak-area analysis, lecture conversion, collaboration, study database, settings, and technique-check workspaces.
- Migrated `StudyHeatmap` away from raw hex/RGBA chart colors to centralized token references and CSS color mixing.

## Design System

- Continue opportunistic migration using `docs/design-system-component-map.md`: new Diagnostic Atlas OS work should use `components/studypanacea/*`; legacy analytics/navigation surfaces may keep `components/ui/GlassCard.tsx` until those routes are redesigned. Use `components/studypanacea/SectionHeader.tsx` for section headings and `components/loading/index.tsx` for skeletons.
- Continue replacing raw hex colors outside `lib/tokens/`; `StudyHeatmap` is now token-clean, but lint still passes because the repo-wide warning budget is high, not because the repo is fully token-clean.
- Consider adding CSS aliases only when they are intentional public tokens. New atlas components should prefer `--atlas-accent-*` variables or Tailwind `atlas.*` classes.

## Accessibility

- Run a manual keyboard pass on the full unauthenticated landing page and authenticated dashboard, including mobile navigation, AI Tutor drawer, table sorting, filters, and auth dialog.
- Run a screen-reader pass for the Recharts timeline and synthetic image lab. Text tables and summaries exist, but announcements should be validated with real assistive tech.
- Review every `aria-pressed` use. It is correct for selected filter/tile controls, but generic interactive cards should avoid toggle semantics unless they represent persistent state.

## Performance

- Keep Three isolated to on-demand 3D anatomy scenes. The current public landing hero remains a lightweight canvas scene, and 3D runtime chunks are excluded from PWA precache.
- Keep checked-in NIH atlas models inside `npm run verify:anatomy-assets` budgets: 8 MB per GLB and 32 MB total model payload. Larger anatomy assets need compression, streaming, or a separately approved hosting strategy.
- Run browser-level Lighthouse/Web Vitals on a deployed preview. Current verification used Vite build, bundle-size script, and local Playwright smoke only.

## Product/Data

- Wire clinical image accuracy and confidence mismatch to real telemetry when available. They are clearly marked as mock/calibrating today, which is safe, but the product value improves when they stop being fallback-only.
- Route training dock actions into real app flows once mode-specific routes/actions are confirmed.
- Add empty/error states for live AI Tutor endpoint failures that distinguish auth, network, model, and safety failures more precisely.
- Consider adding route-level screenshots or visual regression coverage for the landing hero, scroll story, clinical image lab, and dashboard command center.

## Verification

- Investigate the full `npm test` runtime. The production review ran targeted dashboard Vitest coverage successfully, but the complete suite produced no progress output for several minutes in this local session and had to be stopped.
- Extend `npm run test:ui-smoke:preview` with deeper authenticated dashboard fixtures once a stable local Clerk/test-auth harness exists. The current command mocks same-origin API responses and tolerates known Clerk vendor auth responses while still failing page errors, unexpected console errors, unexpected HTTP failures, missing critical landing sections, mobile horizontal overflow, and accidental eager GLB requests.

## Content Safety

- Keep synthetic clinical image panels until licensed medical imagery is available and reviewed.
- Verify provenance for the existing `public/images/*.jpg` ECG assets before any redesigned clinical image workflow surfaces them. The redesigned landing/dashboard image lab does not use those files.
- If legacy landing components are ever recovered from history, remove fake testimonial/outcome copy unless it is sourced and approved.
- Keep AI Tutor copy in study-support framing; do not let UI copy imply real patient diagnosis, treatment advice, or clinician replacement.
