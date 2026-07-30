# StudyPanacea UI Redesign Execution Plan

Last updated: 2026-05-14

Status: living implementation plan. This document guides future redesign work only; it does not authorize backend rewrites, auth changes, dependency installs, or UI implementation by itself.

Source documents:

- `AGENTS.md`
- `docs/ui-redesign-audit.md`

## Setup Log

### 2026-05-14 Frontend dependency and shadcn preparation

Package manager:

- Detected npm from root `package-lock.json`.
- No root `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, or `bun.lockb` was used.
- `podcast-service/` has its own `package.json` and `package-lock.json`; it was not modified for this UI redesign setup.

Project architecture:

- Root app is React/Vite, not Next.js.
- There is no root `app/` directory.
- A root `pages/` directory exists, but routing is handled by React Router through `App.tsx`, `config/AppRoutes.tsx`, and `config/routeRegistry.ts`.
- Do not assume Next.js App Router or Pages Router conventions for redesign implementation.

Existing configuration confirmed:

- Tailwind is configured through `tailwind.config.js`, `postcss.config.js`, and `index.css`.
- shadcn/ui is configured through `components.json`.
- shadcn aliases point to `@/components`, `@/components/ui`, `@/lib/utils`, and `@/hooks`.
- Existing UI primitives already included project-owned `button.tsx`, `card.tsx`, `dialog.tsx`, `progress.tsx`, `command.tsx`, and a custom `Badge.tsx`.

Retained runtime packages from this setup:

- `motion` for the redesigned landing interactions that use `motion/react`.
- `three` for on-demand NIH anatomy atlas scenes in `components/anatomy/AnatomyModelCanvas.tsx`.
- `@tanstack/react-table` for the dashboard question-review table.

Consolidation note:

- The initial setup also installed `gsap`, `@react-three/fiber`, and `@react-three/drei`.
- Those packages were removed during consolidation because the shipped implementation does not use GSAP or React Three Fiber. The public hero uses a lightweight 2D canvas scene, and the authenticated anatomy viewer lazy-loads raw Three.js only after user intent.

Already present, not reinstalled directly:

- `lucide-react`
- `recharts`

shadcn command used:

```bash
npx shadcn@latest add tabs sheet tooltip table dropdown-menu scroll-area separator skeleton avatar --yes
```

shadcn components added:

- `components/ui/tabs.tsx`
- `components/ui/sheet.tsx`
- `components/ui/tooltip.tsx`
- `components/ui/table.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/separator.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/avatar.tsx`

shadcn components already present or project-owned:

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/progress.tsx`
- `components/ui/Badge.tsx`

Notes:

- The repository has `core.ignorecase=true`, so adding a lowercase `components/ui/badge.tsx` alongside existing `components/ui/Badge.tsx` is unsafe on this workspace. Treat the existing Badge as the available badge primitive until a deliberate case-safe rename plan is approved.
- Dependency audit is clean after consolidation (`npm uninstall` reported 0 vulnerabilities).
- The first redesign implementation has since landed; see `docs/follow-up-ui-polish.md` for shipped changes and remaining follow-ups.

Verification commands run:

```bash
npm run lint
npm run typecheck
npm run build
```

Verification results:

- `npm run lint` passed with existing raw-hex design-token warnings and no errors.
- `npm run typecheck` passed.
- `npm run build` passed.

## 1. Product Narrative

One-sentence positioning:

StudyPanacea is the Diagnostic Atlas OS for PANCE readiness, turning practice questions, clinical image training, weak-area diagnosis, and readiness analytics into a daily study prescription.

Core user promise:

Every learner should know what to study next, why it matters for PANCE readiness, how their weak areas are changing, and which action will move them forward today.

Landing page emotional goal:

The landing page should make a prospective user feel that StudyPanacea is a precise clinical learning instrument: serious, premium, board-focused, and built for the way medical professionals interpret evidence.

Dashboard functional goal:

The dashboard should behave like an exam-readiness command center that diagnoses risk, prioritizes the next study action, shows organ-system mastery, and routes the user into practice, review, image training, or tutor support.

## 2. Visual Concept

Name:

Diagnostic Atlas OS

Visual metaphors:

- Diagnostic workstation: dark clinical canvas, precise panels, command surfaces, status rails, and scanner-like motion.
- Medical atlas: anatomical linework, organ-system maps, labeled structures, layered tissue patterns, and clinical reference textures.
- Vitals monitor: readiness signals, pulse states, progress rhythms, risk flags, and stability indicators.
- Study prescription: daily dose, protocol, rationale, expected impact, and follow-up action.
- Imaging lab: image viewer chrome, scan bands, contrast controls, finding callouts, and differential hints.

Colors:

- Base: dark clinical navy, near-black blue, deep slate, and high-contrast off-white text.
- Primary accents: cyan and clinical blue for scanner/action states.
- Secondary accents: violet for intelligence/tutor context and pulse pink for urgency or active signal.
- Supporting accents: green for stable/mastered, amber for watch/review, red only for critical risk or safety language.
- Avoid huge generic gradients, uncontrolled neon, and one-note blue-gradient startup palettes.
- Keep light-theme support because the existing app has light and dark token systems, but lead the redesign from a premium dark command-center default.

Spacing:

- Use generous page gutters and dense-but-readable dashboard panels.
- Prefer 8px-based spacing with larger 24px, 32px, and 48px rhythm for section separation.
- Use compact spacing only inside data-dense panels such as vitals, heatmaps, tables, and rails.
- Avoid nested card stacks. A panel can contain controls or repeated rows, but page sections should not become cards inside cards.

Typography assumptions:

- Use Poppins for primary headings, entity names, and major navigation labels.
- Use Inter for body copy, clinical descriptions, labels, and explanatory text.
- Use JetBrains Mono for scores, percentages, lab-like values, readiness metrics, time, and tabular data.
- Keep letter spacing at 0 unless a current component has a specific accessibility-tested label pattern.
- Use tabular numerals for metrics and dashboard values.

Iconography rules:

- Use Lucide icons for general interface actions.
- Use Healthicons or existing anatomy motifs for clinical concepts when they improve comprehension.
- Icon-only controls must have accessible labels and visible focus states.
- Do not use emoji icons in production UI.
- Do not use fake AI mascots or decorative robot imagery.
- Icons should reinforce workflow meaning: scan, review, image lab, weak area, readiness, tutor, plan, and progress.

3D/anatomy rules:

- Use 3D sparingly and only when it clarifies anatomy, organ systems, image interpretation, or readiness scanning.
- Do not add React Three Fiber, drei, or additional 3D runtime dependencies until a phase explicitly calls for it and dependency changes are approved. The current implementation uses isolated, on-demand Three.js only for the protected visualizer.
- Prefer high-quality 2D atlas-inspired SVG, linework, and scanner motifs for the first implementation pass.
- Current launch hero uses a lightweight client canvas scanner in `components/landing/HeroCanvas.tsx`; reserve R3F for a future approved real 3D anatomy scene.
- The authenticated `/visualizer` page now has ten on-demand Three.js anatomy scenes using license-tracked NIH GLBs: public-domain heart plus CC-BY cardiopulmonary, HRA left kidney, HRA liver, HRA main bronchus, HRA pancreas, HRA spleen, HRA prostate, HRA spinal cord, and right femur models. Keep this pattern behind user intent and do not move it into landing first paint.
- Heavy 3D must be dynamically imported, hidden behind a mobile fallback, and disabled or simplified for reduced-motion users.
- Do not use unlicensed medical assets.

## 3. Landing Page Information Architecture

Current implementation target:

- `components/landing/LandingPage.tsx`
- `components/landing/Hero.tsx`
- `components/landing/HeroCanvas.tsx`
- `components/landing/content.ts`
- Route-local landing sections under `components/landing/`

`components/landing/LandingPage.tsx` is the canonical public landing page. Preserve the existing Clerk sign-in and sign-up flow.

### Hero: PANCE Readiness Scanner

Purpose:

Position StudyPanacea as an active diagnostic readiness system, not a passive question bank.

Content:

- Direct headline around PANCE readiness diagnosis.
- Supporting copy about practice, image training, weak-area targeting, and adaptive workflow.
- Primary CTA to start the adaptive plan.
- Secondary CTA to sign in or inspect workflow.
- Scanner-style product preview with readiness score, risk bands, organ-system signals, and next prescribed action.

Visual notes:

- First viewport should immediately show command-center UI, anatomical/scanner linework, and clinical metrics.
- Avoid stock doctor imagery and generic gradient hero layouts.
- Keep a hint of the next section visible on desktop and mobile.

### Diagnostic Scroll Story

Purpose:

Explain the transformation from raw practice performance to actionable diagnosis.

Content:

- Step 1: capture practice and image-training signals.
- Step 2: diagnose weak areas and readiness risk.
- Step 3: prescribe daily study actions.
- Step 4: stabilize progress toward exam readiness.

Visual notes:

- Use scan bands, assembling panels, organ-system labels, and evidence traces.
- Use Framer Motion scroll reveals first. Use GSAP only if pinned/scrubbed storytelling is explicitly approved later.

### Training Modes Dock

Purpose:

Show breadth without overwhelming the page.

Content:

- Practice questions.
- Clinical image training.
- Weak-area review.
- Adaptive study path.
- Daily challenge or session runner.
- AI tutor support.

Visual notes:

- Use a dock or instrument tray metaphor.
- Each mode should connect to a user action, not just a feature label.

### Clinical Image Training Viewer

Purpose:

Make image interpretation feel like a core product advantage.

Content:

- Simulated viewer with finding markers, differential prompts, confidence/rationale panel, and review action.
- Use only approved mock content and avoid unverified clinical claims.

Visual notes:

- Use scanner frame, contrast controls, finding callouts, and subdued anatomy linework.
- Do not use unlicensed radiology, dermatology, or procedure images.

### Dashboard Analytics Preview

Purpose:

Preview the authenticated command center.

Content:

- Readiness vitals.
- Organ-system heatmap.
- Timeline toward exam date.
- Today's study prescription.
- Review debt or missed-topic queue.

Visual notes:

- Align with the actual adaptive dashboard structure so the landing preview does not become a fake product.
- Use static mock data in a dedicated file until live data is required.

### Outcomes / Study Workflow

Purpose:

Show how the learner moves through a complete study loop.

Content:

- Diagnose.
- Practice.
- Review.
- Train images.
- Reassess readiness.
- Repeat.

Visual notes:

- Avoid inventing medical or outcome claims.
- Claims must be framed as workflow benefits unless validated data exists.

### Final CTA

Purpose:

Convert once the user understands the system.

Content:

- Concise restatement of the promise.
- Primary CTA to start the adaptive plan.
- Secondary CTA to sign in.

Visual notes:

- Keep it premium and restrained.
- Use command-center closure rather than a generic marketing banner.

## 4. Dashboard Information Architecture

Current implementation target:

- `components/navigation/command-center/CommandCenterWorkspace.tsx`
- `components/dashboard/adaptive/page/DashboardPage.tsx`
- `components/dashboard/adaptive/page/DashboardShell.tsx`
- `components/dashboard/adaptive/page/DashboardSlot.tsx`
- `components/dashboard/adaptive/widgets/registry.tsx`
- `components/dashboard/adaptive/visuals/`
- `components/layout/AppLayout.tsx`
- `components/layout/NavRail.tsx`

Preserve the adaptive dashboard data contracts and route behavior.

### Dashboard Shell

Purpose:

Provide the Diagnostic Atlas OS frame for authenticated study.

Required behavior:

- Keep skip link, landmarks, responsive nav, command search, offline indicator, auth controls, and mobile navigation.
- Make the shell feel clinical and operational without reducing content clarity.
- Avoid adding route-specific state to `App.tsx` or `config/AppRoutes.tsx`.

### Readiness Vitals

Purpose:

Show high-level exam readiness at a glance.

Metrics:

- Readiness estimate.
- Review debt.
- Weak-area urgency.
- Exam horizon.
- Stability or trend.

Next action:

Each metric must route to practice, review, study path, or a relevant detail view.

### Today's Study Prescription

Purpose:

Answer "What should I do now?"

Content:

- Recommended session type.
- Duration or question count.
- Rationale.
- Expected target system or weak area.
- Primary launch action.
- Fallback action when data is sparse.

Next action:

Start session, resume session, review due cards, or open study path.

### Organ System Heatmap

Purpose:

Show mastery and risk by organ system.

Content:

- Organ systems.
- Status color.
- Confidence or evidence level.
- Recent trend.
- Weak-area entry point.

Chart strategy:

Use existing chart/SVG primitives first. Use Recharts for charted data when axes, legends, and tooltips are needed.

### PANCE Readiness Timeline

Purpose:

Show progress toward exam readiness over time.

Content:

- Current state.
- Projected readiness.
- Review milestones.
- Risk events or knowledge gaps.
- Study plan checkpoints.

Motion:

Use "Assemble" for initial construction and "Stabilize" for settled trend states.

### Clinical Image Lab

Purpose:

Expose image-training workflows from the dashboard.

Content:

- Due or recommended image set.
- Modality or clinical category.
- Accuracy/confidence signal.
- Next image-training action.

Asset rule:

Use approved or synthetic assets only. Do not introduce stock medical photography as the primary visual.

### Question Review Table

Purpose:

Make misses and flagged questions actionable.

Content:

- Topic.
- Organ system.
- Miss reason or confidence.
- Date/recentness.
- Review action.
- Status.

Table strategy:

Use existing table patterns initially. Consider TanStack Table only if serious sorting, filtering, pagination, and column control are needed.

### AI Tutor Drawer

Purpose:

Provide contextual help without taking over the dashboard.

Content:

- Current weak-area context.
- Suggested question to ask.
- Recent mistake summary.
- Tutor launch action.

Behavior:

- Drawer must be keyboard accessible.
- Use Radix-backed dialog/drawer patterns where possible.
- Do not change auth or API assumptions in the UI phase.

## 5. Motion Choreography

Motion must explain learning, diagnosis, progress, or readiness. It should not exist only as decoration.

### Scan

Meaning:

System is inspecting readiness, an organ system, an image, or a study signal.

Usage:

- Hero scanner sweep.
- Image viewer scan band.
- Readiness vitals loading state.
- Heatmap inspection hover.

Rules:

- Keep scan motion subtle and finite.
- Avoid constant scan loops unless the user is actively waiting.

### Diagnose

Meaning:

The product turns raw data into an identified weak area or risk signal.

Usage:

- Transition from practice data to weak-area card.
- Risk badge reveal.
- Differential/finding callout.

Rules:

- Pair the motion with text explaining the result.
- Do not animate a diagnosis without a clear next action.

### Pulse

Meaning:

A metric is alive, changing, due, urgent, or newly updated.

Usage:

- Readiness vitals.
- Review debt.
- Active session status.
- Critical or watch states.

Rules:

- Use sparingly.
- Respect reduced motion.
- Avoid uncontrolled infinite loops.

### Assemble

Meaning:

The command center is organizing multiple signals into a coherent plan.

Usage:

- Dashboard panel entrance.
- Landing analytics preview.
- Timeline construction.

Rules:

- Use staggered but fast reveals.
- Avoid layout shift during hydration.

### Dissect

Meaning:

The UI breaks down a topic, image, question, or organ system into meaningful layers.

Usage:

- Image viewer findings.
- Organ-system detail drilldown.
- Question review explanation.

Rules:

- Reveal one layer at a time.
- Keep content readable before and after motion.

### Stabilize

Meaning:

The system settles into a recommendation, trend, or steady state.

Usage:

- Final state after scan/diagnosis.
- Readiness timeline resting state.
- Study prescription card after loading.

Rules:

- End motion in a calm, legible state.
- Do not leave panels floating, bouncing, or shimmering continuously.

## 6. Technical Architecture

### Proposed file structure

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
  ClinicalImageTrainingViewer.tsx
  DashboardAnalyticsPreview.tsx
  DiagnosticScrollStory.tsx
  FinalCta.tsx
  LandingHero.tsx
  TrainingModesDock.tsx
  landingMockData.ts

components/dashboard/adaptive/command-center/
  CommandCenterFrame.tsx
  ClinicalImageLabPanel.tsx
  OrganSystemHeatmap.tsx
  QuestionReviewPanel.tsx
  ReadinessTimeline.tsx
  ReadinessVitals.tsx
  StudyPrescriptionPanel.tsx
  TutorDrawerLauncher.tsx

components/dashboard/adaptive/visuals/
  anatomyMotifs.ts
  medicalPatterns.ts
  signalPalettes.ts

lib/tokens/
  medical.ts
```

Only create these files when the relevant phase begins. Do not scaffold unused files.

### Client/server component boundaries

This repository is currently React/Vite, not Next.js App Router. There are no React Server Components.

Client/UI boundary:

- UI components live under `components/`.
- Routing stays in `config/AppRoutes.tsx` and `config/routeRegistry.ts`.
- Lazy imports stay in `config/lazyComponents.tsx`.
- Data-consuming dashboard components should receive typed props or consume existing hooks at the current container level.

Server/API boundary:

- Cloudflare Pages Functions live under `functions/api/`.
- Do not build backend logic as part of the UI redesign.
- Do not change auth token behavior unless a specific UI flow requires a small compatibility fix.
- Existing API clients and hooks remain the source of truth for live data.

### Animation boundaries

- Use Framer Motion already present in the repo.
- Keep route-level transitions in existing config where practical.
- Keep complex section choreography inside route-local components.
- Prefer CSS transitions for simple color, border, and shadow states.
- Do not add GSAP unless a later phase explicitly requires pinned or scrubbed scroll scenes.

### 3D lazy-loading strategy

- Phase 1 and Phase 2 should use 2D atlas-inspired visuals.
- The current hero scanner uses a lightweight client canvas scene instead of shipping Three/R3F to the live landing route.
- If 3D is approved later, place 3D components behind `React.lazy` or dynamic import.
- Load 3D only when the section is near viewport or explicitly opened.
- Provide static SVG or image fallback on mobile, reduced-motion, low-power, and unsupported contexts.
- Keep 3D isolated so it never blocks dashboard use.

### Mock data strategy

- Do not hard-code mock metrics inside presentation components.
- Put landing mock data in `components/landing/redesign/landingMockData.ts`.
- Put dashboard-only mock data in dashboard fixture files or a dedicated route-local mock file.
- Label mock data clearly as illustrative.
- Do not invent real medical outcome claims.
- Replace mock dashboard data with existing hooks whenever a live data contract already exists.

### Dashboard chart strategy

- Use existing adaptive dashboard signals first.
- Use SVG/CSS for simple heatmaps, rails, and scanner motifs.
- Use Recharts for line, area, bar, and composed dashboard charts.
- Use existing graph libraries only where graph relationships are required.
- Do not add chart dependencies during the redesign foundation phase.

## 7. Performance Budget

Budget rules:

- Heavy 3D must use dynamic import.
- Mobile must have lighter non-3D fallbacks.
- All motion must respect `prefers-reduced-motion`.
- No uncontrolled infinite animation loops unless the user is actively waiting or a state must be monitored.
- Avoid hydration or animation layout shift.
- Images must be sized, compressed, lazy-loaded where below the fold, and licensed or generated for this product.
- Avoid adding route-specific CSS to global `index.css` unless it is a reusable token, primitive, or app-wide utility.
- Avoid expanding the Tailwind safelist unless there is no stable class alternative.
- Do not add new polling for visual components.
- Maintain existing lazy route boundaries.

Verification commands:

- `npm run build`
- `npm run build:check-size`
- `npm run test:e2e -- tests/e2e/a11y-regression.spec.ts` when auth/test setup allows meaningful coverage

## 8. Accessibility Checklist

Keyboard navigation:

- All landing CTAs, auth controls, dashboard panels, nav items, table controls, drawers, and modal controls must be keyboard reachable.
- Interactive cards must either be real links/buttons or contain explicit controls.

Focus states:

- Preserve visible focus on dark and light surfaces.
- Do not remove global focus-visible styles.
- Icon buttons must have a visible focus ring.

Text contrast:

- Body text, labels, chart annotations, metric values, and disabled states must remain readable on glass and dark surfaces.
- Do not place low-opacity text over busy anatomy or scanner backgrounds.

Reduced motion:

- Use `prefers-reduced-motion` and Framer Motion reduced-motion hooks/config.
- Replace scan, pulse, and assemble animations with static state changes when reduced motion is requested.

Semantic landmarks:

- Keep skip navigation.
- Preserve `main`, `nav`, `header`, dialog, and section semantics.
- Landing sections should have meaningful headings.

ARIA labels:

- Icon-only controls need `aria-label`.
- Decorative anatomy, grid, scanner, and texture layers should be `aria-hidden`.
- Charts and heatmaps need text summaries or accessible labels.
- Drawers and dialogs need accessible titles and descriptions.

## 9. Implementation Phases

### Phase 0: Plan and Inventory

Status:

- Planned by this document.

Files to create/edit:

- `docs/studypanacea-ui-exec-plan.md`
- Optional later update to `docs/ui-redesign-audit.md` if scope changes.

Acceptance criteria:

- The execution plan exists.
- It reflects `AGENTS.md` and `docs/ui-redesign-audit.md`.
- It does not implement UI.
- It identifies first implementation phase and verification commands.

Verification commands:

- `git diff --check -- docs/studypanacea-ui-exec-plan.md`

### Phase 1: Medical Token and Primitive Foundation

Files to create/edit:

- `index.css`
- `lib/tokens/index.ts`
- `lib/tokens/colors.ts`
- `lib/tokens/typography.ts`
- Optional: `lib/tokens/medical.ts`
- `components/ui/medical/MedicalSurface.tsx`
- `components/ui/medical/AtlasPanel.tsx`
- `components/ui/medical/CommandPanel.tsx`
- `components/ui/medical/DiagnosticMetric.tsx`
- `components/ui/medical/SignalBadge.tsx`
- Optional: `components/ui/medical/AnatomyMotif.tsx`

Acceptance criteria:

- New tokens support Diagnostic Atlas OS without breaking existing light/dark themes.
- Medical primitives are typed and composable.
- No full route redesign is included.
- No dependency installs are required.
- Components respect focus, contrast, reduced motion, and responsive constraints.
- Existing shadcn-style primitives remain usable.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run lint:design-tokens`

### Phase 2: Landing Page Redesign

Files to create/edit:

- `components/landing/LandingPage.tsx`
- `components/landing/content.ts`
- `components/landing/Hero.tsx`
- `components/landing/HeroCanvas.tsx`
- `components/landing/DiagnosticScrollStory.tsx`
- `components/landing/TrainingModesDock.tsx`
- `components/landing/ClinicalImageTraining.tsx`
- `components/landing/DashboardPreview.tsx`

Acceptance criteria:

- Landing first viewport clearly reads as PANCE readiness scanner and Diagnostic Atlas OS.
- Required sections are present.
- Clerk sign-in/sign-up behavior is preserved.
- No real medical claims are invented.
- No stock medical photography becomes the primary visual direction.
- Mock data is isolated outside presentation components.
- Mobile and reduced-motion fallbacks are implemented.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:a11y`
- `npm run test:e2e -- tests/e2e/a11y-regression.spec.ts`

### Phase 3: Dashboard Shell and Command Center

Files to create/edit:

- `components/layout/AppLayout.tsx`
- `components/layout/NavRail.tsx`
- `components/navigation/command-center/CommandCenterWorkspace.tsx`
- `components/dashboard/adaptive/page/DashboardPage.tsx`
- `components/dashboard/adaptive/page/DashboardShell.tsx`
- `components/dashboard/adaptive/page/DashboardShellSections.tsx`
- `components/dashboard/adaptive/page/DashboardSlot.tsx`
- `components/dashboard/adaptive/widgets/registry.tsx`
- `components/dashboard/adaptive/command-center/CommandCenterFrame.tsx`
- `components/dashboard/adaptive/command-center/ReadinessVitals.tsx`
- `components/dashboard/adaptive/command-center/StudyPrescriptionPanel.tsx`
- `components/dashboard/adaptive/command-center/OrganSystemHeatmap.tsx`
- `components/dashboard/adaptive/command-center/ReadinessTimeline.tsx`

Acceptance criteria:

- `/study` becomes a clear exam-readiness command center.
- Existing dashboard data contracts and actions are preserved.
- Every visible metric has a next action or explanation.
- App shell remains responsive and keyboard accessible.
- Mobile nav and protected route behavior are unchanged.
- No new backend endpoints are required.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run build:check-size`
- `npm run test:e2e -- tests/e2e/a11y-regression.spec.ts`

### Phase 4: Clinical Image Lab, Review Table, and Tutor Drawer

Files to create/edit:

- `components/dashboard/adaptive/command-center/ClinicalImageLabPanel.tsx`
- `components/dashboard/adaptive/command-center/QuestionReviewPanel.tsx`
- `components/dashboard/adaptive/command-center/TutorDrawerLauncher.tsx`
- Existing image training, review, or tutor components only where integration is needed.
- Existing fixture/mock files if live data is not available.

Acceptance criteria:

- Clinical Image Lab exposes a clear next image-training action.
- Question Review Table supports accessible review actions and readable dense data.
- AI Tutor Drawer is keyboard accessible and context-aware.
- Mock data is isolated and clearly marked.
- No auth or backend behavior changes are introduced.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:a11y`

### Phase 5: Optional 3D Anatomy/Scanner Prototype

Dependency condition:

- Do not start this phase until 3D is explicitly approved.

Files to create/edit:

- Possible dependency updates in `package.json` and lockfile if approved.
- `components/landing/redesign/AnatomyScannerScene.lazy.tsx`
- `components/landing/redesign/AnatomyScannerFallback.tsx`
- Optional shared 3D utilities under `components/ui/medical/three/`

Acceptance criteria:

- 3D is dynamically imported.
- Mobile and reduced-motion fallbacks exist.
- 3D does not block landing or dashboard interaction.
- Bundle size impact is measured.
- The scene communicates anatomy, readiness scanning, or organ-system insight rather than decoration.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run build:check-size`
- `npm run test:e2e -- tests/e2e/a11y-regression.spec.ts`

### Phase 6: Hardening and Release Readiness

Files to create/edit:

- Relevant tests under `tests/`.
- Documentation updates under `docs/`.
- Minor component fixes discovered during verification.

Acceptance criteria:

- Landing, `/study`, `/practice`, `/progress`, and mobile nav are visually coherent.
- Reduced-motion, keyboard, and contrast checks pass.
- Build and production typecheck pass.
- Bundle size remains within agreed budget or increases are documented.
- Known limitations are documented.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:all`
- `npm run build`
- `npm run build:check-size`
- `npm run test`
- `npm run test:a11y`
- `npm run test:e2e`

## 10. Non-goals

- Do not build backend logic as part of this redesign plan.
- Do not alter auth unless required to preserve or repair an existing UI flow.
- Do not invent real medical claims, performance claims, or outcome statistics.
- Do not use unlicensed medical assets.
- Do not use stock medical photography as the primary visual direction.
- Do not migrate the app to Next.js unless explicitly requested.
- Do not install new dependencies without approval.
- Do not remove existing functionality during visual redesign phases.
- Do not bypass `config/routeRegistry.ts`, `config/AppRoutes.tsx`, or existing lazy route conventions.
