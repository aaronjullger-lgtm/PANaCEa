# Study Product Dependency Map

## Summary
Scope assumed: all learner-facing study surfaces, excluding admin/internal tooling.

Source of truth for this map is the current code wiring, not older completion docs. The major cross-cutting reality is:

- The learner product is split between React Router pages and a large view-state shell.
- Core quiz and drill persistence already exist through `QuestionAttempt`, `ReviewLog`, `UserProgress`, recommendations, pearls, and diagnostic puzzle models.
- The highest rework risk is not missing UI. It is mismatched shared contracts and app-shell coupling.
- Social groups and live collaboration are the only learner-facing areas that are clearly not production-online yet.

## Dependency Map

| Major feature | Frontend components involved | Route/page entry points | Hooks/state stores involved | APIs/services required | Local storage or persistence needs | Analytics/event tracking needs | Data model requirements | Shared logic dependencies | Current blockers |
|---|---|---|---|---|---|---|---|---|---|
| App shell, navigation, study catalog | `App`, `AppRoutes`, `AppLayout`, `DrillViewRouter`, `PracticePage`, `CommandCenterPage`, command center workspace | `/study`, `/practice`, `/progress`, `/daily-challenges`, `/modes/*` | `useAppNavigation`, `useUserStats`, `useViewTransition`, `useNavRailStore` | Route registry, training mode registry, recent-mode recorder | Recent modes and user stats mirror in local storage | Page/mode-open events, recent mode usage | No new schema; stable route and mode contract | Shared route registry, mode registry, app shell composition | Dual routing model, heavy prop drilling, placeholder NavRail related-module store |
| Core adaptive session and session runner | `CoreAdaptiveSession`, `SessionScopeSelector`, `QuizView`, `SessionRunner` | `/core-adaptive`, `/session/:sessionId` | `useSessionGenerator`, `useQuizTimer`, `useQuizReplenishment`, `useQuizSessionRecovery`, `useUnifiedKinetics`, `useAnalyticsTracking` | `/api/study/resolve-blueprint`, `/api/study/check-distribution`, `/api/study/session/generate`, `/api/questions/session`, `/api/questions/attempt`, reservoir and concept selection services | Session recovery in local storage; durable attempts/reviews in DB | Telemetry, pacing, answer changes, session summaries, FSRS writes | `StudySession`, `QuestionAttempt`, `ReviewLog`, `UserProgress`, `UserGoal`, `UserPreferences` | Blueprint resolution, reservoir, FSRS, session summary services | Broken shared session-start contract across consumers; two overlapping session entrypoints; app-shell coupling |
| Drill platform and mode runtime | Drill session components, drill landing pages, drill shell/router | `/modes/ecg-drill`, `/modes/photo-drill`, `/modes/mini-lab`, other `/modes/*` | `useDrillFSRS`, per-drill hooks like photo, pharm, anatomy, ICD, teach-back, contrastive | `/api/drills/submit-review`, mode-specific question/drill endpoints | Offline review queue via sync manager; drill review persistence in DB | Answer telemetry, streaks, correctness, FSRS next-review feedback | `QuestionAttempt`, `ReviewLog`, `UserProgress`, question/content tables | Drill FSRS hook, sync manager, question services | Platform mostly exists; main blocker is route/view-state coupling and some content/media fallbacks |
| Exam simulation surfaces | `FullSitDownTestMode`, commuter mode, exam-readiness cards, simulator surfaces | `/modes/full-sit-down-test`, `/modes/commuter-mode`, simulator entry CTAs | `useSessionGenerator`, quiz/session hooks | `/api/study/session/generate`, exam/session APIs where applicable | Durable session attempts and exam history; local recovery for long sessions | Exam completion, timing, fatigue/stamina metrics | Same session models as core adaptive; user goals for exam context | Shared session generation and quiz runtime | Consumers still send legacy `mainSession`-style requests; long-session flows depend on fixing shared contract first |
| OSCE / virtual patient | `PatientEncounterMode`, encounter workstation and OSCE panels | `/modes/patient-encounter`, simulation routes | `useEncounterReducer`, clinical fidelity settings hook | `/api/osce/session`, `/api/osce/chat`, `/api/osce/intervene`, `/api/osce/complete`, `/api/osce/history`, grading services | Persistent session history, case state, grading output | Encounter grading, intervention logs, history, completion stats | `PatientEncounterCase` and existing OSCE session/history tables | AI grading/chat pipeline, encounter reducer, rubric logic | Feature is mostly online; blocker is implementation risk from a very large component and reducer surface |
| Dashboard, recommendations, study path | Dashboard pages, Rolling360 widgets, `RecommendationFeed`, `StudyPathDashboard`, progress surfaces | `/study`, `/progress`, `/study/path` | `useUserStats`, `useRolling360Stats`, `useSessionGenerator` | `/api/dashboard/stats`, `/api/dashboard/review-queue`, `/api/recommendations`, `/api/recommendations/generate`, `/api/recommendations/action`, `/api/users/me/daily-plan`, `/api/users/me/exam-readiness` | Recommendation cache in local storage; persisted rec state and user goals in DB | Recommendation impressions, starts, dismissals/completions, dashboard engagement | `StudyRecommendation`, `UserGoal`, `UserPreferences`, performance/review tables | Recommendation services, daily-plan logic, exam-readiness logic | Backend mostly exists; main blocker is broken session-start CTA contract and some empty-state handling for unsynced users |
| Clinical library, knowledge, pearls, my library | `ClinicalReferenceLibrary`, condition detail views, `KnowledgeBaseHub`, pearls panels, library pages | `/study/knowledge`, legacy `/study/reference`, `/medical-database`, my library surfaces | `useSemanticSearch`, bookmarks/recent-condition hooks, `useTooltipStore`, `useNavRailStore` | `/api/content/systems`, `/api/content/library`, `/api/conditions/*`, `/api/user/pearls*`, study resource APIs | Local bookmarks/recent conditions; durable pearls and saved state in DB | Search usage, bookmark/save/useful actions, content opens | `Condition`, `MedicalContent`, `ClinicalPearl`, user-pearl links and progress data | Semantic search, retrievability helpers, content/reference configs | Core feature is online; blockers are placeholder contextual NavRail data and content/media completeness, not missing platform APIs |
| Daily challenges and games | `DailyChallengesHub`, `GrandRoundsMode`, `DiagnosticPuzzleMode`, `MedicalWordleMode` | `/daily-challenges`, `/modes/grand-rounds`, `/modes/diagnostic-puzzle`, `/modes/medical-wordle` | `useDiagnosticPuzzle`, `useWordleGame` | `/api/grand-rounds/*`, `/api/diagnostic-puzzle/*`, `/api/games/wordle/*` | Daily state and streak persistence in DB | Completion status, streaks, attempts, challenge review metrics | `DiagnosticPuzzle` plus existing challenge attempt state | Daily reset logic, challenge APIs | No structural blocker; older docs saying Wordle/social were absent are stale for games, not for social |
| Study groups | `StudyGroupDashboard` | learner-facing collaboration workspace | Local component state only; stub service exists | Expected `/api/social/groups`, `/api/social/leaderboard`, `/api/social/groups/join` | DB persistence for groups and members is expected but not wired | Group creation/join, leaderboard, participation | `StudyGroup` and `StudyGroupMember` already exist in schema | Study group domain service | Blocked by missing production API layer and missing persistence wiring to existing models |
| Live collaboration / real-time peer study | `LiveStudySession`, collaboration workspace | `/live-collaboration` | `useRealTimeCollaboration` service and local component state | Expected `/api/collaboration/ws` plus live session/group endpoints | Requires persistent or semi-persistent live session, chat, participant, leaderboard state; none is wired | Presence, answer speed, chat, leaderboard deltas, session participation | Missing shared models for live sessions, participants, messages, presence snapshots | WebSocket event contract, group membership, leaderboard logic | Hard blocked by missing shared data model and missing backend/WebSocket work |

## Blocker Buckets

### 1. Features that can be completed immediately in the frontend
- Practice catalog, command center, and navigation polish.
- Daily challenges hub and challenge-card UX.
- Recommendation feed presentation, caching, and empty/error-state polish.
- Clinical library browsing, search UX, bookmarks, recent-condition UX.
- Drill discoverability and mode-card/frontdoor improvements.

### 2. Features blocked by missing shared data models
- Live collaboration needs first-class shared models for live sessions, participants, chat messages, and presence or an explicit decision that these are ephemeral and not persisted.
- Session generation consumers need a single stable shared session-start request/response contract. This is a contract-model gap more than a DB-schema gap, but it is still a shared-model blocker.
- Contextual NavRail related modules are still placeholder-only and need a real shared relation model/service if they are intended to ship as contextual study navigation.

### 3. Features blocked by missing persistence
- Study groups have schema presence but no wired persistence behavior in the domain/service layer.
- Live collaboration has no persistence strategy for chat history, live session records, participation state, or leaderboard snapshots.
- Any “resume long session across devices” behavior for commuter or full exam modes should be considered blocked until session persistence/resume semantics are defined beyond current local recovery.

### 4. Features blocked by missing backend/API work
- Study groups are blocked by missing `/api/social/*` production endpoints.
- Live collaboration is blocked by missing `/api/collaboration/ws` and any supporting REST/session endpoints.
- Any peer benchmarking surface that depends on real-time or group APIs remains blocked until social/collaboration APIs exist.

### 5. Features that should be refactored before implementation
- App shell and routed view composition: too much learner product still hangs off one view-state tree.
- Shared session generation: all consumers should stop talking to the backend in different dialects.
- `QuizView` and session state orchestration: add more session types only after the shared session-start contract is unified.
- `PatientEncounterMode`: additional OSCE features should land after reducer/component boundaries are stabilized.
- `useNavRailStore`: stop extending placeholder contextual-module behavior before replacing it with a real provider or API-backed store.

## Dependency-Aware Execution Sequence

1. **Stabilize the cross-cutting contracts first.**
   - Make one learner-session start contract authoritative.
   - Map every session-starting surface to that contract.
   - Stop mixing “legacy main session” semantics with concept-scope generation semantics.

2. **Do the minimum refactor that prevents repeated routing/session rework.**
   - Isolate view rendering from the app shell.
   - Keep the current route registry as the source of truth.
   - Avoid a full routing rewrite now, but stop adding new work directly into the current app-shell prop chain.

3. **Repair all existing session-start consumers before adding any new learner flow.**
   - Core adaptive.
   - Full sit-down test.
   - Commuter mode.
   - Rolling360 / exam-readiness CTAs.
   - Any dashboard action that starts a study session.

4. **Finish frontend-only learner surfaces on top of the fixed contracts.**
   - Practice page and command center.
   - Daily challenges workspace.
   - Recommendation feed UX.
   - Clinical library UX and study-path UI polish.

5. **Wire product features that already have real schema backing but incomplete app integration.**
   - Recommendation action tracking and retry/empty-state behavior.
   - Library contextual modules or explicit deferral of that feature.
   - Any pearls/library preference surfaces that still depend on placeholder local-only state.

6. **Ship study groups as a bounded backend phase on existing schema.**
   - Add production endpoints against `StudyGroup` and `StudyGroupMember`.
   - Reuse existing learner auth and leaderboard patterns.
   - Only then expose the social dashboard in navigation as an online feature.

7. **Design live collaboration as a separate platform phase, not an extension of study groups.**
   - Define the event contract first.
   - Decide what is ephemeral vs persisted.
   - Add missing shared models if persistence is required.
   - Only after that, build WebSocket/API infrastructure.

8. **Implement live collaboration last.**
   - Join/leave.
   - Presence.
   - Live leaderboard.
   - Chat.
   - Collaborative answering.
   - Graceful degraded state when WS is unavailable.

## Public Interfaces and Type Changes Required
- Unify learner session start into one shared request/response type used by all frontend consumers and the session-generation endpoint.
- Preserve one canonical route/mode registry as the only study inventory source.
- For social groups, define a stable REST contract that matches the existing group schema.
- For live collaboration, define the WebSocket event schema before implementation. Do not let the current frontend service invent the contract.

## Test Plan
- Deep-link and refresh test for `/study`, `/practice`, `/daily-challenges`, `/progress`, and representative `/modes/*` routes.
- Session-start acceptance test from command center, commuter mode, full sit-down test, and exam-readiness CTA.
- Submission test proving quiz and drill answers still write `QuestionAttempt`, `ReviewLog`, and `UserProgress`.
- Recommendation fetch, generate, action, and empty-state test.
- Clinical library systems fetch, content fetch, pearls save/useful, bookmark/recent-condition behavior test.
- Daily challenge test for Grand Rounds, Diagnostic Puzzle, and Wordle load plus completion state persistence.
- Social group contract test for create, join, list, leaderboard once APIs exist.
- Live collaboration connect/join/chat/submit/disconnect test only after the collaboration contract is formalized.

## Assumptions and Defaults
- “Fully online” means production-ready on the Cloudflare learner stack, not merely mounted in the UI.
- Admin/internal tools are out of scope.
- Existing schema for recommendations, pearls, progress, goals, diagnostic puzzle, and study groups is considered usable unless a specific migration is discovered during implementation.
- Older completion docs are treated as non-authoritative when they conflict with current code and endpoint presence.
