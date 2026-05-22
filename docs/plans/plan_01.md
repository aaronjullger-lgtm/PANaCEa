# Feature-Completeness Audit Plan

## Summary
Produce a student-facing feature inventory and gap analysis for PANaCEa grounded in the live frontend wiring, not just file presence. The audit will cover study modes, learning features, scheduling, analytics, progress tracking, exam/test flows, adaptive behavior, question review workflows, data visualization, and calendar/time-based functionality.

Scope defaults:
- In scope: learner-facing routes, view-state modes, session flows, progress/analytics surfaces, review/scheduling UX, and the APIs/hooks they depend on.
- Out of scope: admin/content-authoring pages except where they block or indirectly determine learner-facing functionality.
- Evidence standard: every claim must tie back to specific route/view wiring, component code, hooks/services, API endpoints, and existing tests.

## Audit Method
1. Build the reachable surface map.
   - Enumerate student-visible entrypoints from [`/Users/aaronullger/GitHub/StudyPANaCEa/config/routeRegistry.ts`](/Users/aaronullger/GitHub/StudyPANaCEa/config/routeRegistry.ts), [`/Users/aaronullger/GitHub/StudyPANaCEa/config/navigation.ts`](/Users/aaronullger/GitHub/StudyPANaCEa/config/navigation.ts), [`/Users/aaronullger/GitHub/StudyPANaCEa/config/training-modes.ts`](/Users/aaronullger/GitHub/StudyPANaCEa/config/training-modes.ts), [`/Users/aaronullger/GitHub/StudyPANaCEa/config/AppRoutes.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/config/AppRoutes.tsx), [`/Users/aaronullger/GitHub/StudyPANaCEa/App.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/App.tsx), and [`/Users/aaronullger/GitHub/StudyPANaCEa/components/layout/DrillViewRouter.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/components/layout/DrillViewRouter.tsx).
   - Separate true routes from legacy view-state-only features so the report can call out discoverability, deep-linking, and routing fragility.

2. Inventory features by learner job.
   - Group features into: study modes, session generation, adaptive logic, review/SRS, analytics/progress, exam/test experiences, calendar/time features, and data visualization.
   - For each feature, trace:
     frontend entrypoint -> component/page -> hook/service -> API endpoint -> domain logic/test coverage
   - Use pages such as [`/Users/aaronullger/GitHub/StudyPANaCEa/pages/PracticePage.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/pages/PracticePage.tsx) and [`/Users/aaronullger/GitHub/StudyPANaCEa/pages/ProgressPage.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/pages/ProgressPage.tsx), plus mode/session components and relevant hooks/services.

3. Classify implementation status with fixed rules.
   - `working`: reachable in UI, wired to data/services, and no obvious broken path or placeholder behavior.
   - `partial`: core path exists but one or more important branches, datasets, or follow-up interactions are missing.
   - `broken`: intended path is wired but likely fails due to missing props, bad fetch path, dead route, mismatched data shape, or disconnected state flow.
   - `stubbed`: visible UI or route exists but behavior is placeholder, mocked, hardcoded, or marked coming soon.
   - `unclear`: evidence exists on both sides and code inspection alone cannot prove runtime status.
   - `UI-only/missing integration` will be called out explicitly even if the overall status is `partial` or `stubbed`.

4. Audit data and domain surfacing.
   - Identify backend/domain capabilities that appear to exist but are weakly surfaced in the learner UI, especially in `functions/api/analytics/*`, `functions/api/questions/*`, `functions/api/reviews/*`, session services, and analytics services.
   - Flag frontend features whose usefulness depends on missing live data, incomplete endpoint adoption, weak state propagation, or fallback-only payload parsing.

5. Audit test evidence without over-crediting it.
   - Review E2E coverage under [`/Users/aaronullger/GitHub/StudyPANaCEa/e2e`](/Users/aaronullger/GitHub/StudyPANaCEa/e2e), targeted API tests in `functions/api`, and unit tests in `tests/`.
   - Distinguish:
     UI smoke or accessibility checks,
     unit tests for algorithms/services,
     API-only coverage,
     and genuine end-to-end user-flow validation.
   - Explicitly mark cases where tests prove internals but do not guarantee a working learner experience.

## Deliverable Shape
The audit output will contain one row/section per feature with:
- Feature name
- Learner-facing location in the app
- Current state: `working / partial / broken / stubbed / unclear`
- Code evidence with file references
- Missing pieces
- Likely dependencies
- Priority: `P0 / P1 / P2 / P3`
- Implementation difficulty: `S / M / L / XL`
- User value: `high / medium / low`

The final synthesis will group findings into:
- Quick wins
- Core missing functionality
- Structural/data-flow problems
- High-risk architectural issues
- Frontend polish gaps

The report will also include:
- A “backend/domain logic not surfaced” section
- A “tests that overstate confidence” section
- A short routing/discoverability note for view-state modes vs router-native pages

## Files and Systems To Inspect
Primary frontend surfaces:
- [`/Users/aaronullger/GitHub/StudyPANaCEa/config/AppRoutes.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/config/AppRoutes.tsx)
- [`/Users/aaronullger/GitHub/StudyPANaCEa/components/layout/DrillViewRouter.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/components/layout/DrillViewRouter.tsx)
- [`/Users/aaronullger/GitHub/StudyPANaCEa/pages/PracticePage.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/pages/PracticePage.tsx)
- [`/Users/aaronullger/GitHub/StudyPANaCEa/pages/ProgressPage.tsx`](/Users/aaronullger/GitHub/StudyPANaCEa/pages/ProgressPage.tsx)
- Training/session/mode components under `components/session`, `components/drill`, `components/modes`, `components/analytics`, `components/dashboard`, `components/pages`

Primary logic and integration layers:
- Session generation hooks/services, including `useSessionGenerator`, `SessionScopeSelector`, session services, and analytics tracking
- Review/scheduling flows in question/review/drill endpoints
- Analytics and prediction services
- Any scheduler, streak, due-review, countdown, calendar, Gantt, or forecast components/hooks

Primary test evidence:
- E2E specs in [`/Users/aaronullger/GitHub/StudyPANaCEa/e2e`](/Users/aaronullger/GitHub/StudyPANaCEa/e2e)
- API tests in `functions/api/**.test.ts`
- Unit/service tests in `tests/`

## Assumptions
- “Frontend present” means reachable through routes, navigation, training menu, command center, or programmatic navigation from learner flows, not merely that a component file exists.
- Student-facing audit excludes admin pages unless those pages are prerequisites for learner-visible functionality.
- No implementation changes will be made during the audit.
- Runtime certainty will come from code-path inspection and existing tests only; anything that requires real data or live environment proof will be labeled `unclear` rather than guessed.
