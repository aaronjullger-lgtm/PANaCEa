# Production Implementation Roadmap

## Summary
This roadmap is optimized for:

- getting the frontend meaningfully functional fast
- minimizing duplicated logic
- avoiding temporary hacks
- creating stable foundations for later adaptive features

Guiding principle: do not build more learner features on top of the current split session/routing contracts. The fastest path to a working frontend is to first make the shared runtime boring and consistent, then light up the existing learner surfaces in a dependency-aware order.

Linear note: I did not use the Linear plugin directly because you asked for roadmap design, not issue creation. The ticket breakdown below is already shaped to map cleanly into Linear epics and child issues.

---

## Layer 1: Foundational Data/State Cleanup

### Workstream 1.1: Unify learner routing and app-shell boundaries
- Objective: reduce app-shell coupling so learner surfaces can be turned on without repeated `App.tsx` edits and view-state hacks.
- Features covered: practice catalog, command center, route/view sync, drill routing, 404/deep-link behavior.
- Why it belongs in this phase: every later frontend feature depends on stable navigation and view ownership; delaying this multiplies rework.
- Likely files/modules involved:
  - `App.tsx`
  - `config/AppRoutes.tsx`
  - `config/routeRegistry.ts`
  - `hooks/useAppNavigation.ts`
  - `components/layout/DrillViewRouter.tsx`
  - `docs/architecture/APP_DECOMPOSITION.md`
- Dependencies: none.
- Risks:
  - regressions in refresh/deep-link behavior for view-state modes
  - accidental breakage of session transitions while moving rendering boundaries
- Acceptance criteria:
  - all learner-facing routes deep-link and refresh correctly
  - no new learner surface requires editing large conditional blocks in `App.tsx`
  - drill modes still exit and navigate consistently
- Suggested ticket breakdown:
  - Extract learner view renderer from `App.tsx`
  - Move remaining learner view-state branches behind route-aware renderer boundaries
  - Add route regression tests for `/study`, `/practice`, `/daily-challenges`, `/progress`, representative `/modes/*`, and `/session/:id`

### Workstream 1.2: Make session generation contract canonical
- Objective: establish one shared frontend/backend contract for starting learner sessions.
- Features covered: core adaptive, commuter mode, full sit-down test, rolling360 exam-readiness CTA, any “start study” action.
- Why it belongs in this phase: this is the biggest current source of duplicated logic and hidden breakage.
- Likely files/modules involved:
  - `hooks/useSessionGenerator.ts`
  - `lib/api/schemas/sessions.ts`
  - `lib/sdk/sessionsClient.ts`
  - `functions/api/study/session/generate.ts`
  - `components/session/CoreAdaptiveSession.tsx`
  - `components/modes/FullSitDownTestMode.tsx`
  - `components/modes/CommuterMode.tsx`
  - `components/dashboard/Rolling360/ExamReadinessCard.tsx`
- Dependencies: workstream 1.1 preferred but not strictly required.
- Risks:
  - old session consumers still sending legacy modes like `mainSession`
  - mixed response shapes leaking into callers
- Acceptance criteria:
  - all learner session starters use the same request type and response shape
  - no frontend caller sends legacy session modes unsupported by the production endpoint
  - long-session flows still navigate to `/session/:id` with valid data
- Suggested ticket breakdown:
  - Audit all callers of `/api/study/session/generate`
  - Normalize request/response types in shared schemas and SDK
  - Migrate all learner consumers to canonical contract
  - Add contract tests for adaptive, review, focused/system/subcategory/condition entry points

### Workstream 1.3: Normalize shared persistence and local state behavior
- Objective: separate durable learner data from local UX caches and remove placeholder/shared-state traps.
- Features covered: user stats, offline drill submission, bookmarks/recent modes/recent conditions, tooltip/nav contextual state.
- Why it belongs in this phase: later adaptive and analytics layers depend on trustworthy persisted state.
- Likely files/modules involved:
  - `hooks/useUserStats.ts`
  - `hooks/useDrillFSRS.ts`
  - `lib/services/sync/syncManager.ts`
  - `lib/stores/useNavRailStore.ts`
  - `lib/stores/useTooltipStore.ts`
  - library bookmark/recent-condition hooks
- Dependencies: none.
- Risks:
  - conflating local convenience cache with server truth
  - retaining placeholder stores that look production-ready but are not
- Acceptance criteria:
  - local storage is limited to cache/recovery/personal convenience state
  - review and progress persistence always flows through production APIs
  - placeholder NavRail related-module behavior is either replaced or explicitly feature-gated
- Suggested ticket breakdown:
  - Document persistence ownership by state domain
  - Remove or gate placeholder contextual NavRail module generation
  - Verify offline review queue and re-sync paths against current APIs
  - Add stale-cache and sign-out/sign-in state consistency tests

---

## Layer 2: Core Study Flow Functionality

### Workstream 2.1: Light up core adaptive study and session runner
- Objective: make the main learner study path consistently start, render, submit, replenish, and complete.
- Features covered: adaptive session, scope selector, quiz runtime, session runner.
- Why it belongs in this phase: this is the first meaningful frontend milestone for the actual study product.
- Likely files/modules involved:
  - `components/session/CoreAdaptiveSession.tsx`
  - `components/session/SessionScopeSelector.tsx`
  - `components/session/QuizView.tsx`
  - `components/session/hooks/*`
  - `functions/api/study/resolve-blueprint.ts`
  - `functions/api/study/check-distribution.ts`
  - `functions/api/study/session/generate.ts`
  - `functions/api/questions/session.ts`
  - `functions/api/questions/attempt.ts`
- Dependencies:
  - Layer 1.1
  - Layer 1.2
- Risks:
  - session-start succeeds but queue/replenishment semantics differ by entrypoint
  - subtle regressions in telemetry or FSRS submission
- Acceptance criteria:
  - user can start adaptive study from the main frontend and complete a session end-to-end
  - queue replenishment works
  - attempts persist and feed progress/review state
  - empty/error states are actionable, not silent
- Suggested ticket breakdown:
  - Stabilize adaptive startup and scope selection
  - Verify quiz runtime against session runner assumptions
  - Unify attempt submission and completion/summarization paths
  - Add end-to-end test for adaptive session start → answer → summary

### Workstream 2.2: Standardize drill-mode runtime on shared drill infrastructure
- Objective: ensure all study drills behave like first-class product surfaces, not bespoke mini-apps.
- Features covered: photo, ECG, derm, imaging, pharm, first-line, guideline, mini-lab, anatomy, physiology, ICD, elaboration, teach-back, contrastive, antibiotics, fluids, code blue, diagnostic puzzle where applicable.
- Why it belongs in this phase: these are already mostly present and can make the frontend feel complete quickly once the shared platform is trusted.
- Likely files/modules involved:
  - `components/layout/DrillViewRouter.tsx`
  - `hooks/useDrillFSRS.ts`
  - `hooks/game/*`
  - `functions/api/drills/*`
  - `functions/api/questions/*drill*`
- Dependencies:
  - Layer 1.1
  - Layer 1.3
  - core review pipeline stability from Layer 2.1
- Risks:
  - drift between drill-specific hooks and shared FSRS/review semantics
  - inconsistent exit/loading/error handling
- Acceptance criteria:
  - representative drill families all start from the frontend, submit reviews, and show scheduling feedback
  - drill session lifecycle is consistent across mode families
  - no drill bypasses `useDrillFSRS` for production review persistence
- Suggested ticket breakdown:
  - Audit all drill hooks for shared runtime parity
  - Fix drill loading/error/empty state consistency
  - Verify FSRS submission across representative drill families
  - Add drill smoke suite covering at least one mode from each major category

### Workstream 2.3: Make exam and daily challenge surfaces production-stable
- Objective: finish the learner surfaces that make the frontend feel broad and alive after core study is online.
- Features covered: commuter mode, full sit-down test, grand rounds, diagnostic puzzle, medical Wordle, daily challenges hub.
- Why it belongs in this phase: these deliver visible frontend completeness quickly once the session contract is fixed.
- Likely files/modules involved:
  - `components/modes/CommuterMode.tsx`
  - `components/modes/FullSitDownTestMode.tsx`
  - `components/pages/DailyChallengesHub.tsx`
  - `hooks/useDiagnosticPuzzle.ts`
  - `hooks/useWordleGame.ts`
  - `functions/api/grand-rounds/*`
  - `functions/api/diagnostic-puzzle/*`
  - `functions/api/games/wordle/*`
- Dependencies:
  - Layer 1.2
  - Layer 2.1
- Risks:
  - long-session exam modes still depending on outdated start semantics
  - daily challenge surfaces masking API failures with weak empty states
- Acceptance criteria:
  - commuter and full exam flows start successfully from the frontend
  - daily challenge cards reflect real completion state
  - Wordle and diagnostic puzzle load and submit against production endpoints
- Suggested ticket breakdown:
  - Migrate commuter and exam surfaces to canonical session start
  - Verify daily challenge hub data loading and completion states
  - Add daily challenge regression tests for load and submit flows

### Workstream 2.4: Keep OSCE online without expanding scope prematurely
- Objective: preserve and harden the existing virtual patient experience without stacking new complexity on unstable code.
- Features covered: patient encounter session, OSCE history, grading, interventions.
- Why it belongs in this phase: it is core learner value, but it already has enough platform behind it; the task is stabilization, not reinvention.
- Likely files/modules involved:
  - `components/modes/PatientEncounterMode.tsx`
  - `hooks/useEncounterReducer.ts`
  - `components/modes/osce/*`
  - `functions/api/osce/*`
- Dependencies:
  - Layer 1.1 for route/app-shell stability
- Risks:
  - large component and reducer surface make regressions expensive
  - tempting to add new OSCE capabilities before current behavior is fully verified
- Acceptance criteria:
  - user can run OSCE sessions, interact, complete, and review history
  - auth ownership and session lookup remain correct
  - no new feature work lands in OSCE before reducer boundaries are respected
- Suggested ticket breakdown:
  - Verify current OSCE happy path and failure path
  - Stabilize reducer/component boundaries and loading/error states
  - Add ownership/history/intervention regression coverage

---

## Layer 3: Scheduling and Planning Systems

### Workstream 3.1: Turn review queue and daily study planning into reliable product primitives
- Objective: make “what should I study now?” trustworthy and reusable across dashboard, progress, and study path surfaces.
- Features covered: review queue, daily load, daily plan, study-plan today, review forecast.
- Why it belongs in this phase: planning systems depend on stable session/progress data from Layer 2 and should precede higher-order adaptation.
- Likely files/modules involved:
  - `functions/api/dashboard/review-queue.ts`
  - `functions/api/study/daily-load.ts`
  - `functions/api/users/me/daily-plan.ts`
  - `functions/api/study-plan/today.ts`
  - `functions/api/analytics/review-forecast.ts`
  - `components/dashboard/TodayPlanCard.tsx`
  - `components/dashboard/DailyLoadWidget.tsx`
  - `components/dashboard/ReviewCalendar.tsx`
- Dependencies:
  - Layer 2.1
  - Layer 1.3
- Risks:
  - planning UI pulling from multiple inconsistent sources
  - recommendations diverging from real queue state
- Acceptance criteria:
  - daily plan, review queue, and forecast surfaces derive from one coherent backend truth
  - planner cards no longer contradict study-start actions
- Suggested ticket breakdown:
  - Define source-of-truth ownership for queue vs daily plan vs forecast
  - Harmonize frontend planner widgets around those APIs
  - Add planner consistency tests against persisted progress data

### Workstream 3.2: Bring study path and scheduling recommendations to a stable product baseline
- Objective: make study path recommendations explainable, regenerable, and safe to accept.
- Features covered: study path dashboard, recommendation view, regenerate/accept/progress flows, scheduler gantt.
- Why it belongs in this phase: it builds directly on the planning primitives, not before them.
- Likely files/modules involved:
  - `functions/api/study-path/*`
  - `components/dashboard/StudyPathDashboard/*`
  - `pages/ProgressPage.tsx`
  - `components/analytics/SmartSchedulerGantt.tsx`
- Dependencies:
  - Workstream 3.1
  - stable goals/preferences data
- Risks:
  - optimizer explanations drifting from actual schedule generation
  - fallback states masking invalid plans
- Acceptance criteria:
  - study path loads, regenerates, accepts, and shows progress consistently
  - planner explanation matches the generated plan inputs
  - progress page and study path do not present conflicting schedule advice
- Suggested ticket breakdown:
  - Verify study path recommendation API contract
  - Align StudyPath dashboard states with actual plan lifecycle
  - Wire progress page scheduler view to accepted plan data
  - Add regenerate/accept/progress tests

### Workstream 3.3: Normalize goals and preferences as planning inputs
- Objective: ensure scheduling/planning consumes real learner preferences and goal data, not hardcoded defaults.
- Features covered: exam date, rotation context, reminder settings, session defaults, push preference inputs to planning.
- Why it belongs in this phase: adaptive and dashboard layers should not invent planning context independently.
- Likely files/modules involved:
  - `functions/api/user/goals.ts`
  - `functions/api/user/preferences.ts`
  - `functions/api/users/me/exam-readiness.ts`
  - `components/settings/*`
  - any dashboard cards using goal/preference state
- Dependencies:
  - Workstream 3.1
- Risks:
  - hidden defaults in cron/planning code overriding user intent
  - duplicate preference reads across components
- Acceptance criteria:
  - planning systems consume a consistent goal/preference layer
  - user-visible planner behavior changes when those inputs change
- Suggested ticket breakdown:
  - Inventory planner inputs and their canonical owner
  - Remove hardcoded planning defaults where user data exists
  - Add settings-to-planner propagation tests

---

## Layer 4: Analytics and Performance Dashboards

### Workstream 4.1: Make the primary dashboard trustworthy before expanding analytics
- Objective: make the dashboard answer the learner’s immediate questions without stale or contradictory data.
- Features covered: dashboard stats, rolling360 cards, readiness widgets, drill recommendations, daily triad, main dashboard layout.
- Why it belongs in this phase: analytics should sit on top of working study and planning data, not precede them.
- Likely files/modules involved:
  - `components/dashboard/DashboardPage.tsx`
  - `components/dashboard/Rolling360/*`
  - `components/dashboard/DrillRecommendationCard.tsx`
  - `components/dashboard/DailyTriad.tsx`
  - `functions/api/dashboard/*`
  - `functions/api/user/rolling-360-stats.ts`
- Dependencies:
  - Layers 2 and 3
- Risks:
  - too many widgets pulling from mismatched contracts
  - graceful degradation hiding broken backend assumptions
- Acceptance criteria:
  - dashboard loads with meaningful content for active learners
  - drill recommendations and readiness cards align with current review/planning state
  - empty states for new users are explicit and non-broken
- Suggested ticket breakdown:
  - Audit dashboard widgets for source-of-truth ownership
  - Remove or defer widgets that still rely on placeholder/incomplete data
  - Add dashboard regression suite for active user and new user states

### Workstream 4.2: Consolidate “deep analytics” around stable APIs
- Objective: make progress and analytics pages reliable instead of broad but brittle.
- Features covered: progress page, gap analysis, calibration dashboard, confusion/error pattern widgets, knowledge graph, learner profile widgets.
- Why it belongs in this phase: these are valuable once the primary dashboard is trustworthy and underlying data is stable.
- Likely files/modules involved:
  - `pages/ProgressPage.tsx`
  - `components/dashboard/GapAnalysisDashboard.tsx`
  - `components/dashboard/CalibrationDashboard/*`
  - `components/dashboard/KnowledgeGraphWidget.tsx`
  - `components/dashboard/ErrorPatternWidget.tsx`
  - `functions/api/analytics/*`
- Dependencies:
  - Workstream 4.1
  - persisted study and review history from Layer 2
- Risks:
  - analytics sprawl with overlapping definitions of the same metric
  - 404/partial data responses leading to misleading UI
- Acceptance criteria:
  - each deep-analytics widget has a known API owner and tested empty/error state
  - no widget silently falls back to invented values
- Suggested ticket breakdown:
  - Metric ownership audit for analytics endpoints
  - Standardize widget fetch/error/empty contracts
  - Add targeted regression tests for analytics widgets with missing data

### Workstream 4.3: Tie clinical profile and system-level dashboards to real learner data
- Objective: ensure clinical profile and system analytics are a dependable input to later personalization.
- Features covered: clinical profile dashboard, system radar/heatmaps, timing and diagnosis bias cards.
- Why it belongs in this phase: these become adaptive inputs in Layer 5, so they must be stabilized first.
- Likely files/modules involved:
  - `components/dashboard/ClinicalProfile/*`
  - `functions/api/user/clinical-profile.ts`
  - `functions/api/user/analytics.ts`
  - `functions/api/analytics/learner-profile.ts`
- Dependencies:
  - Workstream 4.2
- Risks:
  - profile widgets becoming decorative instead of actionable
  - inconsistencies between profile APIs and recommendations/adaptive logic
- Acceptance criteria:
  - clinical profile loads reliably and uses real learner history
  - system strengths/weaknesses match other analytics surfaces
- Suggested ticket breakdown:
  - Verify clinical profile API contract
  - Align profile widgets with shared metric definitions
  - Add cross-surface consistency checks

---

## Layer 5: Adaptive Learning and Personalization

### Workstream 5.1: Make recommendations the first stable adaptive layer
- Objective: turn recommendations into the primary adaptive loop before more ambitious personalization.
- Features covered: recommendation list/generate/action flows, drill recommendation widgets, action cards.
- Why it belongs in this phase: it is the lowest-risk adaptive layer that already has persistence and visible frontend value.
- Likely files/modules involved:
  - `components/dashboard/RecommendationFeed.tsx`
  - `components/dashboard/DrillRecommendationCard.tsx`
  - `components/dashboard/RecommendedActionCard.tsx`
  - `functions/api/recommendations/*`
  - `lib/recommendationEngine.ts`
  - `lib/services/adaptiveLearning.ts`
- Dependencies:
  - Layer 3 planning primitives
  - Layer 4 trustworthy metrics
- Risks:
  - recommendation generation not matching actual available study actions
  - frontend caching making stale recs look live
- Acceptance criteria:
  - recommendations are actionable from the frontend
  - actioning a recommendation results in a valid learner flow
  - pending/completed/dismissed state remains consistent across refresh
- Suggested ticket breakdown:
  - Align recommendation generation with real study actions
  - Standardize recommendation status lifecycle
  - Add rec start/complete/dismiss integration tests

### Workstream 5.2: Personalize dashboard and practice surfaces from stable learner context
- Objective: use learner stage, goals, and performance to change what the frontend surfaces by default.
- Features covered: dashboard personalization, visible mode filtering, exam label/session CTA changes, rotation focus.
- Why it belongs in this phase: only worth doing once metrics and planner inputs are trustworthy.
- Likely files/modules involved:
  - `lib/services/dashboardPersonalization.ts`
  - `components/dashboard/DashboardPage.tsx`
  - `components/dashboard/TrainingMenu.tsx`
  - `pages/PracticePage.tsx`
  - user profile/goal/preference APIs
- Dependencies:
  - Layers 3 and 4
- Risks:
  - personalization logic diverging across dashboard and practice entry surfaces
  - hidden logic making product behavior hard to reason about
- Acceptance criteria:
  - user context produces consistent default surfaces across dashboard and practice
  - personalization rules are centralized, not copied into components
- Suggested ticket breakdown:
  - Audit personalization rules and centralize them
  - Apply same learner-context rules across dashboard/practice/command center
  - Add stage-context snapshot tests

### Workstream 5.3: Close the loop between concept gaps, readiness, and scheduled review
- Objective: build the stable backend-fed adaptive loop that later features can extend without hacks.
- Features covered: concept gaps, exam readiness, pance-readiness, review scheduling signals, adaptive profile updates.
- Why it belongs in this phase: this is where “adaptive” stops being UI logic and becomes system behavior.
- Likely files/modules involved:
  - `functions/api/ai/learning/*`
  - `functions/api/users/me/exam-readiness.ts`
  - `functions/api/questions/attempt.ts`
  - `functions/api/user/update-fsrs-params.ts`
  - `lib/services/conceptQuestionSelector.ts`
  - related readiness/profile widgets
- Dependencies:
  - Layers 2 through 4
- Risks:
  - recommendation layer and adaptive profile layer evolving independently
  - overfitting adaptation before data quality is verified
- Acceptance criteria:
  - learner actions update adaptive profile inputs through one traceable pipeline
  - readiness and concept-gap outputs influence downstream planning/recommendation surfaces coherently
- Suggested ticket breakdown:
  - Trace concept-gap updates from attempt submission through learner profile APIs
  - Align readiness/profile outputs with recommendation and planner consumers
  - Add end-to-end adaptive loop verification

### Workstream 5.4: Defer social adaptation until the product foundation is stable
- Objective: explicitly keep study groups and live collaboration out of the critical adaptive path until their platform exists.
- Features covered: study groups, leaderboards, live collaboration, peer benchmarking.
- Why it belongs in this phase: these are adaptation-adjacent but currently blocked and should not distort the core roadmap.
- Likely files/modules involved:
  - `components/social/StudyGroupDashboard.tsx`
  - `services/domain/studyGroupService.ts`
  - `components/collaboration/LiveStudySession.tsx`
  - `services/domain/realTimeCollaborationService.ts`
  - future `functions/api/social/*`
  - future `functions/api/collaboration/*`
- Dependencies:
  - stable learner metrics and user identity
  - dedicated backend/platform design
- Risks:
  - trying to ship collaboration with placeholder or purely client-side assumptions
  - inventing live-session contracts in frontend code
- Acceptance criteria:
  - study groups remain explicitly deferred or feature-gated until backed by production APIs
  - live collaboration is not treated as “partially online” without models and backend support
- Suggested ticket breakdown:
  - Define epic for social API implementation using existing `StudyGroup` schema
  - Define design doc for live collaboration data model and WS contract
  - Keep UI feature-gated until platform work is complete

---

## Layer 6: Polish, QA, Instrumentation, and Edge Cases

### Workstream 6.1: Harden error, empty, offline, and auth-sync states
- Objective: make learner surfaces resilient instead of merely functional.
- Features covered: all major study, dashboard, library, and challenge surfaces.
- Why it belongs in this phase: once core functionality exists, reliability becomes the main differentiator.
- Likely files/modules involved:
  - major learner pages/components
  - `hooks/useUserStats.ts`
  - `hooks/useDrillFSRS.ts`
  - common error/loading components
  - endpoints that still surface “user not found / not synced yet”
- Dependencies:
  - Layers 1 through 5
- Risks:
  - masking real backend errors with generic messaging
  - retry loops for non-retryable failures
- Acceptance criteria:
  - every learner-critical surface has a tested loading, empty, offline, and auth-failure state
  - non-retryable errors are not endlessly retried
- Suggested ticket breakdown:
  - Inventory missing resilience states across learner-critical pages
  - Standardize error classifications and retry semantics
  - Add auth-sync and offline recovery tests

### Workstream 6.2: Add instrumentation around key learner journeys
- Objective: make production behavior measurable before further optimization.
- Features covered: session start, drill start, recommendation actions, planner acceptance, daily challenge completion, library save/useful, OSCE completion.
- Why it belongs in this phase: instrumentation is only valuable once the journeys themselves are stable.
- Likely files/modules involved:
  - `hooks/useAnalyticsTracking.ts`
  - `services/analytics/*`
  - frontend CTA handlers across dashboard/practice/challenges/library
  - any shared event-tracking layer
- Dependencies:
  - stable workflows from earlier layers
- Risks:
  - duplicate event definitions across components
  - analytics noise from transitional implementations
- Acceptance criteria:
  - core learner funnels are evented with one shared taxonomy
  - event names and payloads are centralized and documented
- Suggested ticket breakdown:
  - Define learner funnel event taxonomy
  - Instrument core study and recommendation flows
  - Add event contract checks in tests where practical

### Workstream 6.3: Run product QA as a layered regression matrix
- Objective: verify the product by learner journey, not by component count.
- Features covered: study start, drill review persistence, planning, dashboard, library, daily challenges, OSCE.
- Why it belongs in this phase: this is the release gate for “fully online.”
- Likely files/modules involved:
  - `e2e/*`
  - route registry
  - learner-critical pages and endpoints
- Dependencies:
  - all previous layers
- Risks:
  - broad surface area creating false confidence from partial testing
  - missing refresh/deep-link cases in the hybrid router
- Acceptance criteria:
  - there is a named regression checklist for each learner-critical journey
  - “fully online” means passing the learner-journey matrix, not just component rendering
- Suggested ticket breakdown:
  - Create journey-based QA matrix
  - Add E2E coverage for core flows
  - Add release checklist and manual verification notes for edge cases

---

## Recommended Execution Order
1. Layer 1.1 and 1.2
2. Layer 1.3
3. Layer 2.1
4. Layer 2.2 and 2.3 in parallel
5. Layer 2.4
6. Layer 3.1
7. Layer 3.2 and 3.3
8. Layer 4.1
9. Layer 4.2 and 4.3
10. Layer 5.1
11. Layer 5.2 and 5.3
12. Layer 6
13. Separate post-roadmap epic for social groups and live collaboration

## Suggested Linear Epic Structure
- Epic A: Frontend foundation and session contract
- Epic B: Core study runtime
- Epic C: Scheduling and study planning
- Epic D: Dashboard and analytics reliability
- Epic E: Adaptive recommendations and personalization
- Epic F: Production hardening and QA
- Epic G: Deferred social and collaboration platform

## Defaults and Assumptions
- The roadmap excludes admin/internal authoring tooling.
- Social groups and live collaboration are intentionally not on the critical path for “frontend meaningfully functional fast.”
- Existing schema for recommendations, groups, goals, preferences, pearls, progress, and diagnostic puzzle is treated as valid unless implementation exposes migration issues.
- Any feature that still depends on placeholder-only contracts should remain gated rather than patched with temporary frontend hacks.
