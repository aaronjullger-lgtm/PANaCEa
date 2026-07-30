# StudyPANaCEa UI Redesign Audit and Implementation Plan

Date: 2026-05-14

Scope: repository audit and implementation plan only. No redesign implementation, dependency installs, route removals, or functionality removals were performed in the original audit pass.

Implementation update, 2026-05-17: the first Diagnostic Atlas OS implementation pass has since landed. The current repo retains `motion`, `three`, and `@tanstack/react-table`; it does not retain GSAP, React Three Fiber, or drei. The public landing page now uses split `components/landing/*` modules and a lightweight 2D canvas hero, while the authenticated anatomy viewer lazy-loads raw Three.js only after user intent. See `docs/follow-up-ui-polish.md` and `docs/design-system-component-map.md` for current implementation notes.

## 1. Current Stack Summary

StudyPANaCEa is a React/Vite application with a Cloudflare Pages Functions backend shape. The app does not use a Next.js `app/` or `pages/` directory. It uses root-level entry files and explicit React Router configuration.

Primary app files:

- `index.html`: app shell, font preconnects, early theme script, critical CSS, and Cloudflare CSS optimizer mitigation for `/index.css`.
- `index.tsx`: React entry point and provider tree.
- `App.tsx`: top-level auth gating, signed-in shell setup, onboarding/profile flow, product tour, FSRS optimizer health check, and public landing selection.
- `config/AppRoutes.tsx`: central route renderer for authenticated routes plus legacy view-state fallback.
- `config/routeRegistry.ts`: documented route registry and source of truth for known paths.
- `config/appViews.ts`: view-state IDs and shared Framer Motion variants.
- `config/lazyComponents.tsx`: lazy imports and production placeholder boundaries.

Core dependencies:

- React `19.2.0`, React DOM `19.2.0`, Vite `6.2.0`, `@vitejs/plugin-react`.
- React Router DOM `7.11.0`.
- Tailwind CSS `3.4.18`, `tailwindcss-animate`, PostCSS, Autoprefixer.
- Clerk via `@clerk/clerk-react` and `@clerk/backend`.
- TanStack Query `5.x` with persisted IndexedDB cache through `idb-keyval`.
- Zustand for local state.
- Supabase client, Prisma `7.7.0`, Prisma Accelerate extension, Cloudflare Wrangler.
- Framer Motion for page, shell, landing, card, and session animations.
- Radix Dialog and Progress, `cmdk`, `sonner`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Data and graph visuals through Recharts, Nivo calendar/core, Cytoscape, React Force Graph 2D, Canvas Confetti, and Healthicons React.

The project already has design-system infrastructure:

- `components.json` indicates a shadcn-style setup using Tailwind CSS variables and aliases such as `@/components/ui` and `@/lib/utils`.
- `components/ui/` contains primitives including `button.tsx`, `card.tsx`, `dialog.tsx`, `progress.tsx`, `command.tsx`, `GlassCard.tsx`, and `Input.tsx`.
- `lib/tokens/` contains token exports for colors, typography, spacing, motion, focus, and touch targets.
- `index.css` contains the current CSS variable themes, utility layers, component classes, auth styling, dashboard surface styling, and legacy styles.

Backend and data patterns:

- API routes live under `functions/api/`.
- Client API access is split across `lib/sdk/core.ts`, `lib/utils/apiConfig.ts`, `lib/utils/apiEnvelope.ts`, `hooks/`, and service modules.
- Dashboard analytics uses TanStack Query through `hooks/useDashboardAnalytics.ts`.
- Some user/session state still uses localStorage-first sync through `hooks/useUserStats.ts`.
- Mock and fixture support exists through `VITE_USE_MOCK`, `services/core/mockSessionService.ts`, dashboard fixtures, and production-deferred lazy components.

## 2. Existing Landing Page Structure

The current public landing page used by `App.tsx` is:

- `components/landing/LandingPage.tsx`
- `components/landing/content.ts`

Important distinction: `pages/LandingPage.tsx` and the old split landing artifacts were removed after import verification. `components/landing/LandingPage.tsx` is the canonical public landing page.

Current `components/landing/LandingPage.tsx` structure:

- Skip navigation support through `SkipNavigation`.
- Sticky public header with PANaCEa brand, anchor navigation, Sign In, and Start adaptive plan actions.
- Auth modal state for Clerk Sign In and Sign Up flows.
- Hero section with headline, supporting copy, CTAs, trust metrics, and a simulated command-center preview.
- Platform/features section driven by `FEATURES`.
- Proof/outcomes section driven by `PROOF_POINTS` and `TRUST_STATS`.
- Workflow/how-it-works section.
- Final CTA section.
- Footer.

Strengths:

- The page already has premium motion language through Framer Motion, `useInView`, and reduced-motion branching.
- Clerk auth is embedded in the public flow without a separate route.
- Copy and structure are already specific to PANCE preparation rather than generic education software.
- The page avoids requiring data calls before first public render.

Gaps for the requested direction:

- The hero preview is a simulated SaaS-style product card, not a medical learning command center or diagnostic anatomy atlas.
- Landing styles are largely isolated in `landing.css` with separate `--landing-*` tokens. These do not fully align with the main app's current clinical canvas tokens in `index.css`.
- The page uses premium dark panels, gradients, and metrics, but the first impression is still closer to a high-end SaaS landing page than a clinical atlas.
- The custom auth modal is not built on the existing Radix Dialog primitive, so focus trapping and restoration need review during redesign.
- Legacy landing files should be treated carefully. They may be removed later only after confirming there are no imports or tests depending on them.

## 3. Existing Dashboard Structure

The authenticated command center is route-driven and data-driven.

Primary path:

- `/study` is a protected route.
- `App.tsx` gates protected routes through Clerk and guest-mode logic.
- `config/AppRoutes.tsx` renders authenticated content inside `components/layout/AppLayout.tsx`.
- The main dashboard view is `components/navigation/CommandCenterHub.tsx`, which re-exports `components/navigation/command-center/CommandCenterWorkspace.tsx`.
- `CommandCenterWorkspace.tsx` builds an adaptive dashboard context and renders `components/dashboard/adaptive/page/DashboardPage.tsx`.

Dashboard rendering flow:

- `CommandCenterWorkspace.tsx` reads plan/profile/dashboard data through `useTodayPlan`, `useUserProfile`, `useDashboardAnalytics`, and `useStudyPlanLaunch`.
- `normalizeDashboardSignals` converts product data into dashboard signals.
- `AdaptiveDashboardPage` resolves widgets with `resolveDashboardWidgets`.
- `DashboardShell` lays widgets into named slots:
  - `goal_context`
  - `primary_command`
  - `primary_evidence`
  - `secondary_left`
  - `secondary_right`
  - `below_fold_primary`
  - `below_fold_secondary`
- `DashboardSlot` maps selected widget IDs to registered widget components.

Current adaptive widgets include:

- Goal context
- Today command
- Baseline command
- Maintenance command
- Insight stack
- Review coverage
- Readiness pulse
- Exam horizon
- Load guardrail
- Catch-up plan
- Maintenance rhythm
- Mastery urgency matrix
- Plan protocol strip
- Blueprint heatmap
- Trust timeline

Visual dashboard assets:

- `components/dashboard/adaptive/visuals/visualTokens.ts`
- `components/dashboard/adaptive/visuals/MedicalPattern.tsx`
- `components/dashboard/adaptive/visuals/AnatomyWatermark.tsx`
- `components/dashboard/adaptive/widgets/ClinicalSessionTicket.tsx`

These files are the strongest current foundation for the requested "medical learning command center / diagnostic anatomy atlas" direction. They already define clinical signal tones, anatomical motifs, paper/grid textures, and decorative anatomy watermarks.

Authenticated app shell:

- `components/layout/AppLayout.tsx` provides sticky header, skip link, app brand, command search, exam countdown, offline indicator, admin/settings/profile controls, and main content frame.
- `components/layout/NavRail.tsx` provides desktop rail and mobile bottom navigation.
- `components/layout/AppProviders.tsx` wraps system integration, toast handling, commuter session support, Sonner toasts, and service worker update prompt.
- `components/layout/AppBrand.tsx` owns the current brand mark and wordmark behavior.

Dashboard routes:

- `/study`
- `/practice`
- `/progress`
- `/daily-challenges`
- `/study/knowledge`
- `/study/utilities`
- `/study/path`
- `/study/main-session`
- `/gap-analysis`
- `/clinical-profile`
- `/medical-database`
- `/live-collaboration`
- `/explorer`
- admin routes under `/admin`
- tool routes such as `/clinical-eye`, `/visualizer`, `/lecture-converter`, and `/technique-check`

Legacy view-state routes still exist through the fallback renderer and should not be broken during redesign.

## 4. Design-System Gaps

The app has a meaningful design-system foundation, but adoption and visual direction are fragmented.

Current strengths:

- Tailwind CSS variables are mapped to shadcn-compatible tokens.
- `components.json` is present and configured for shadcn-style primitives.
- `components/ui/button.tsx` and `components/ui/card.tsx` are mature compared with basic generated primitives.
- `lib/tokens/` provides a central TypeScript token surface.
- `index.css` contains current light/dark clinical variables, semantic status colors, data colors, focus rings, touch target utilities, and many reusable classes.
- Dashboard adaptive visuals already introduce medical motifs and textures.

Main gaps:

- The public landing page has its own token universe in `landing.css`, while the app shell and dashboard use `index.css` and `lib/tokens/`.
- The current main theme is warm clinical teal/gold, while some primitives still imply older gold-first or glass-gradient semantics. Example: `components/ui/button.tsx` primary styling uses `--color-gold-dark` rather than the current `--color-action-primary`.
- Tailwind typography config includes negative letter spacing for display and heading sizes. The redesign should normalize this because the target interface needs precise medical-dashboard legibility.
- Many components still use local utility class compositions rather than shared medical surfaces. This makes the UI feel assembled from local islands rather than one product language.
- Raw button/card/modal patterns still appear broadly across the codebase. The Button/Card/Dialog primitives exist, but they are not yet the universal interface layer.
- Medical visual language exists mostly inside the adaptive dashboard. It has not been elevated into a reusable system for landing, shell, session, practice, and knowledge views.
- The current app shell still reads as a premium productivity dashboard. It needs a clearer command-center frame: diagnostic hierarchy, case context, system status, anatomical map surfaces, evidence rails, and clinically coded urgency.
- Existing design docs such as `docs/DESIGN_SYSTEM.md` and `docs/ANIMATION_SYSTEM_GUIDE.md` appear older than the current token and dashboard implementation. They should be updated after the redesign foundation is chosen.

Recommended design-system target:

- Keep shadcn-style primitives for accessibility and consistency.
- Add a small medical layer on top of existing primitives rather than creating a parallel design system:
  - `MedicalSurface`
  - `AtlasPanel`
  - `CommandPanel`
  - `DiagnosticMetric`
  - `EvidenceRail`
  - `AnatomyMotif`
  - `SignalBadge`
- Promote existing adaptive dashboard visual tokens into reusable app-wide primitives.
- Make the landing page use the same token system as the authenticated app.

## 5. Animation/3D Gaps

Current animation stack:

- Framer Motion is already installed and used throughout the app.
- `config/appViews.ts` defines shared page, widget, modal, toast, hover, stagger, and spring variants.
- `App.tsx` wraps authenticated content in `MotionConfig reducedMotion="user"`.
- Landing page uses Framer Motion plus `useReducedMotion`.
- `index.css` and `tailwind.config.js` define CSS animations such as shimmer, fade-in, fade-in-up, slide-in-right, scale-in, glow-pulse, float, and gradient-shift.
- Reduced motion is handled globally in CSS and locally in key React components.

Current 3D status after the implementation pass:

- `three` is retained for authenticated, user-initiated NIH anatomy atlas scenes.
- React Three Fiber, drei, and GSAP are not retained because no shipped component imports them.
- The public landing hero uses a lightweight 2D canvas scanner scene with reduced-motion and low-device fallbacks.
- Diagnostic and anatomy motifs still rely primarily on CSS, SVG, and canvas; WebGL is isolated to `components/anatomy/AnatomyModelCanvas.tsx`.

Gaps:

- No reusable motion choreography exists for a diagnostic command center: panel scan-in, anatomy layer reveal, case timeline, signal escalation, or protocol handoff.
- The protected anatomy viewer has an isolated Three.js scene, but there is no broader reusable pseudo-3D atlas pattern for public or dashboard surfaces.
- No asset pipeline exists for real anatomical models, rendered atlases, or high-fidelity anatomy plates.
- No clear motion budget exists per route. Some routes use Framer Motion heavily while others use CSS utility animations or no motion.

Recommendation:

- Phase 1 should not add 3D dependencies. Build the command-center and anatomy-atlas feel with existing SVG motifs, layered medical textures, Framer Motion, and real product surfaces first.
- Add React Three Fiber/drei only if the product direction requires a broader interactive anatomy scene graph, not just an atlas-inspired interface or the current isolated Three.js viewer.
- Define a route-level motion budget and keep reduced-motion behavior mandatory.

## 6. Performance Risks

Current performance protections:

- Vite code splitting through lazy route components in `config/lazyComponents.tsx`.
- Production-deferred placeholders for some not-ready modules.
- Bundle size script through `scripts/check-bundle-size.mjs`.
- PWA and Workbox setup in `vite.config.ts`.
- Prisma browser-bundle exclusion plugin in `vite.config.ts`.
- Initial load optimization in `services/initialLoadOptimizer.ts`.
- Cloudflare CSS optimizer mitigation in `index.html`.

Risks to account for during redesign:

- `App.tsx` and `config/AppRoutes.tsx` are large coordination files. Visual redesign work that adds more route-specific state there will increase coupling and bundle risk.
- `components/landing/LandingPage.tsx` is imported directly by `App.tsx`, so landing redesign code can affect the main unauthenticated bundle unless split deliberately.
- `index.css` is large and includes current, legacy, auth, dashboard, component, and utility styles in one file. Redesign work should avoid adding another large set of route-specific CSS there.
- `tailwind.config.js` has a large safelist. New visual utilities should favor tokens and components over additional dynamic class expansion.
- External Google Fonts are inserted by `index.html`; the app also self-hosts Geist Mono. Offline and first-paint behavior can drift if the redesign depends heavily on external font availability.
- The inline critical CSS variables in `index.html` are not fully synchronized with the current warmer clinical tokens in `index.css`. This can cause first-paint mismatch under delayed stylesheet loading.
- The adaptive dashboard fetches multiple analytics endpoints and refreshes every 60 seconds. More animated or data-heavy panels should not add more polling by default.
- Existing graph/chart dependencies are already broad. Adding 3D before the visual system is stable would increase JavaScript cost and interaction risk.
- PWA caching allows large clinical image assets. If the redesign introduces atlas imagery, image size and cache rules need explicit budgets.

Performance principles for implementation:

- Keep redesign components route-local until proven reusable.
- Use existing lazy boundaries.
- Do not add new global CSS blocks for one-off sections.
- Prefer CSS variables and small components over large Tailwind safelist expansion.
- Add real images only with explicit size, format, lazy-loading, and cache strategy.
- Run bundle checks before and after major visual phases.

## 7. Accessibility Risks

Current accessibility strengths:

- Landing and authenticated layout both include skip navigation.
- Global focus-visible styling exists.
- `MotionConfig reducedMotion="user"` and CSS `prefers-reduced-motion` support are present.
- Radix Dialog and Progress are available.
- Button primitives include loading and icon support.
- Dashboard decorative medical patterns and anatomy watermarks are designed as non-interactive visuals.
- `tests/e2e/a11y-regression.spec.ts` uses axe-core against landing and representative app routes.

Risks:

- The landing auth modal is custom and should be checked for focus trap, focus restoration, inert background behavior, and screen reader labelling. A Radix Dialog implementation would reduce this risk.
- Raw `<button>` and custom interactive controls still appear across the codebase. Redesign work should migrate touched areas toward shared primitives instead of adding new local patterns.
- Some small button variants (`xs`, `sm`) are below ideal 44px touch target size. They may be acceptable in dense desktop-only contexts, but mobile command surfaces should use larger controls.
- The a11y regression suite may redirect protected routes when Clerk test credentials are not configured, so passing tests may not prove authenticated dashboard coverage.
- Medical atlas visuals can become noisy for screen reader and low-vision users if decorative layers are not consistently hidden and contrast-tested.
- The redesign goal implies dense information. Density must not come at the expense of hierarchy, keyboard order, contrast, or readable line lengths.
- High-contrast and reduced-motion modes should be verified after every visual phase, not only at the end.

Accessibility implementation requirements:

- Keep skip links and landmarks intact.
- Use Radix-backed primitives for dialogs/popovers where possible.
- Use `aria-hidden` for decorative anatomy textures.
- Preserve visible focus states on dark and light surfaces.
- Verify keyboard navigation in the landing auth flow, dashboard command panels, nav rail, and mobile bottom nav.
- Run axe checks against authenticated pages with configured auth or a deterministic test bypass.

## 8. Recommended File Structure

The redesign should extend the current structure instead of introducing a competing app architecture.

Keep:

- `index.tsx` as the provider entry.
- `App.tsx` as the auth and top-level app coordinator, with minimal new visual logic.
- `config/routeRegistry.ts` and `config/AppRoutes.tsx` as route sources of truth.
- `config/lazyComponents.tsx` for lazy imports.
- `components/layout/` for shell-level changes.
- `components/landing/` for the current public landing page.
- `components/dashboard/adaptive/` for the current command-center dashboard.
- `components/ui/` and `lib/tokens/` as design-system foundations.

Recommended additions:

```text
components/ui/medical/
  AnatomyMotif.tsx
  AtlasPanel.tsx
  CommandPanel.tsx
  DiagnosticMetric.tsx
  EvidenceRail.tsx
  MedicalSurface.tsx
  SignalBadge.tsx

components/landing/redesign/
  AnatomyAtlasPreview.tsx
  CommandCenterPreview.tsx
  EvidenceOutcomes.tsx
  LandingHero.tsx
  WorkflowProtocol.tsx

components/dashboard/adaptive/command-center/
  CommandCenterFrame.tsx
  DiagnosticMapPanel.tsx
  SessionCommandPanel.tsx
  SystemReadinessRail.tsx

components/dashboard/adaptive/visuals/
  anatomyMotifs.ts
  medicalPatterns.ts
  signalPalettes.ts

lib/tokens/
  medical.ts
  motion.ts
```

Notes:

- Some visual files already exist under `components/dashboard/adaptive/visuals/`. The implementation should refactor only when useful, not move files preemptively.
- `lib/tokens/motion.ts` may overlap with existing token exports. Add it only if it consolidates real duplication.
- Route files should not be created for visual-only work.
- Avoid putting dashboard-only primitives into `components/ui/` until they are used by at least two product surfaces.
- Keep landing redesign isolated under `components/landing/` until it is stable, then promote shared pieces to `components/ui/medical/`.

## 9. Dependency Plan

No dependencies should be installed before Phase 1.

Use existing dependencies first:

- Framer Motion for motion choreography.
- Lucide React and Healthicons React for iconography.
- Radix Dialog for modal accessibility.
- Existing Recharts/Nivo/Cytoscape/React Force Graph 2D only where data visualization is already needed.
- Existing SVG pattern and anatomy watermark approach for atlas-inspired surfaces.

Potential later dependencies, only after design validation:

- `@react-three/fiber` and `@react-three/drei` only if the product requires a broader React-managed 3D anatomy atlas beyond the current isolated Three.js viewer.
- Additional Radix primitives such as Tabs, Tooltip, Popover, Select, or Switch if touched flows need accessible interactions that are currently custom-built.
- A dedicated image optimization or asset pipeline only if real anatomy plates or large product screenshots become part of the landing experience.

Avoid unless there is a specific need:

- Adding GSAP or Lottie on top of Framer Motion.
- Adding a second component library.
- Adding a heavy 3D stack for purely decorative depth.
- Adding new charting libraries before rationalizing current chart dependencies.

## 10. Implementation Phases

Phase 0: Alignment and design inventory

- Confirm the target visual direction using the current adaptive dashboard motifs as the baseline.
- Decide whether the first redesign uses 2D atlas-inspired visuals or true 3D anatomy.
- Inventory the current live surfaces that must not regress: landing auth, `/study`, `/practice`, `/progress`, `/study/path`, `/study/knowledge`, session runner, and mobile nav.
- Update design docs only after the new direction is concrete.

Phase 1: Token and primitive foundation

- Normalize medical command-center tokens in `index.css` and `lib/tokens/`.
- Keep light/dark themes and shadcn variable compatibility.
- Create a small `components/ui/medical/` layer only for primitives used immediately.
- Align Button primary/action semantics with the current action token.
- Move touched custom dialogs toward Radix Dialog.
- Do not redesign full routes in this phase.

Phase 2: Landing redesign

- Redesign `components/landing/LandingPage.tsx` and related landing components around a first-viewport command-center/anatomy-atlas signal.
- Preserve Clerk Sign In/Sign Up behavior, guest/auth assumptions, and redirect expectations.
- Replace simulated SaaS panels with product-specific clinical learning surfaces.
- Use shared medical surfaces where they already exist.
- Keep legacy landing files until imports/tests confirm they are unused.

Phase 3: Authenticated shell and command center

- Redesign `components/layout/AppLayout.tsx`, `components/layout/NavRail.tsx`, and command-center surfaces without changing route behavior.
- Extend `components/dashboard/adaptive/` rather than bypassing it.
- Promote `MedicalPattern`, `AnatomyWatermark`, and `visualTokens` into a more coherent command-center frame.
- Preserve `CommandCenterWorkspace.tsx` data contracts and action handlers.

Phase 4: Practice, session, and knowledge surfaces

- Apply the same design language to quiz/session shells, review flows, and knowledge utilities.
- Keep FSRS, review, and session pipeline behavior untouched.
- Replace local one-off cards/buttons only in touched files.
- Verify mobile and dense desktop layouts at every step.

Phase 5: Optional 3D/atlas layer

- Add 3D dependencies only if the product needs interactive anatomical exploration.
- Start with one isolated prototype component and strict bundle budget.
- Provide static fallback visuals and reduced-motion behavior.
- Do not make 3D a dependency for core study workflows.

Phase 6: Verification and hardening

- Run lint, production typecheck, build, and bundle size checks.
- Run Playwright screenshots on landing, `/study`, `/practice`, and mobile nav.
- Run axe checks on public and authenticated states.
- Verify reduced motion, dark mode, high-contrast-relevant data states, loading states, and offline/PWA behavior.

## 11. Exact Scripts Available for Lint, Typecheck, Build, and Dev

Development:

- `npm run dev` -> `vite`
- `npm run dev:server` -> `node --env-file=.env --watch --import tsx server.ts`
- `npm run dev:all` -> `concurrently "npm run dev:server" "npm run dev"`
- `npm run dev:wrangler` -> `wrangler pages dev dist --compatibility-date=2024-11-01 --compatibility-flag=nodejs_compat -- npm run dev`

Build and local serving:

- `npm run build` -> `node scripts/inject-wrangler-env.js && vite build --mode production`
- `npm run pages:build` -> `node scripts/inject-wrangler-env.js && vite build --mode production`
- `npm run build:check-size` -> `node scripts/check-bundle-size.mjs`
- `npm run build:analyze` -> `ANALYZE=true npm run build`
- `npm run preview` -> `vite preview`
- `npm run pages:serve` -> `npm run build && wrangler pages dev dist`
- `npm run pages:dev` -> `wrangler pages dev dist --compatibility-date=2024-11-01 --compatibility-flag=nodejs_compat -- npm run dev`
- `npm run pages:deploy` -> `npm run build && wrangler pages deploy dist`

Lint:

- `npm run lint` -> `eslint . --max-warnings 2000`
- `npm run lint:fix` -> `eslint . --fix --max-warnings 2000`
- `npm run lint:design-tokens` -> `node scripts/lint-design-tokens.mjs`
- `npm run lint:design-tokens:report` -> `node scripts/lint-design-tokens.mjs --report`

Typecheck:

- `npm run typecheck` -> `tsc --noEmit -p tsconfig.production.json`
- `npm run typecheck:all` -> `tsc --noEmit`
- `npm run typecheck:ci` -> `npm run typecheck`

Tests and verification:

- `npm test` -> `npm run test`
- `npm run test` -> `vitest run --passWithNoTests`
- `npm run test:watch` -> `vitest`
- `npm run test:core` -> `vitest run tests/core`
- `npm run test:api` -> `vitest run tests/api`
- `npm run test:billing` -> `vitest run tests/billing`
- `npm run test:srs` -> `vitest run tests/srs`
- `npm run test:ux` -> `vitest run tests/ux`
- `npm run test:e2e` -> `playwright test`
- `npm run test:e2e:ui` -> `playwright test --ui`
- `npm run test:e2e:headed` -> `playwright test --headed`
- `npm run test:e2e:debug` -> `playwright test --debug`
- `npm run test:e2e:report` -> `playwright show-report`
- `npm run test:visual` -> `playwright test tests/e2e --grep @visual`
- `npm run test:production` -> `playwright test --config=playwright.production.config.ts`
- `npm run test:unit` -> `vitest run --config vitest.config.ts`
- `npm run test:unit:watch` -> `vitest --config vitest.config.ts`
- `npm run test:unit:coverage` -> `vitest run --config vitest.config.ts --coverage`
- `npm run test:a11y` -> `npm run test:e2e -- tests/e2e/a11y-regression.spec.ts`
- `npm run verify:production` -> `./scripts/verify-production.sh`

## 12. Questions or Assumptions

These should not block the first implementation pass.

Questions:

- Should `/` remain a public marketing/auth page while `/study` remains the primary authenticated command center?
- Should the first redesign include true interactive 3D anatomy, or should it start with high-fidelity 2D atlas-inspired surfaces?
- Should public copy focus only on PANCE, or should PANRE, EOR, and didactic modes remain visible in the first redesign?
- Are the current landing testimonials and outcome claims fully approved for production marketing use?
- Should legacy landing files be removed after the redesign if import checks confirm they are unused?
- Should the authenticated dashboard prioritize daily session launch, weak-area diagnosis, exam readiness, or spaced-review debt as the dominant first-viewport command?

Assumptions:

- Cloudflare Pages remains the deployment target.
- Clerk remains the auth provider.
- Guest mode should continue to work.
- The current route registry and lazy route strategy should be preserved.
- The adaptive dashboard architecture is the right base for the command-center redesign.
- The redesign should reuse current data contracts and avoid changing API behavior in early phases.
- New dependencies require explicit approval and should not be installed during the audit or initial design-system phase.

## Next Recommended Codex Prompt

```text
Implement Phase 1 from docs/ui-redesign-audit.md: create the medical command-center token and primitive foundation without changing routes or app behavior. Keep changes scoped to index.css, lib/tokens, and new reusable components under components/ui/medical. Do not redesign the landing page yet, do not install dependencies, and verify with lint/typecheck/build where feasible.
```
