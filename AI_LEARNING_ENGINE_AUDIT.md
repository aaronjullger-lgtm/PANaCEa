# PANaCEa AI Learning Engine Audit

Date: 2026-05-02 00:09 EDT

## Executive Summary

Overall readiness after this pass: **68/100 (D+)**.

PANaCEa has substantial intelligence infrastructure: an AI gateway, structured question schemas, staged question models, deterministic daily allocation, FSRS review state, study-plan services, and recommendation engines. The full learning loop is not yet production-safe because several active routes still bypass the safest parts of that infrastructure.

Primary launch blockers:

- **P0 Fixed:** `functions/api/osce/live-engine.ts` exposed the server `GEMINI_API_KEY` to the browser as a fallback Live API credential. Fixed in this pass by failing closed when ephemeral token creation fails.
- **P0 Fixed:** `functions/api/study/session/generate.ts` dynamically generated questions, persisted them as `validationStatus: 'approved'`, assigned synthetic quality fields, and served them immediately when the reservoir was short. Fixed in this pass by refusing learner-facing dynamic generation on shortage and changing the unused persistence helper to create `pending` questions only.
- **P1 Confirmed:** Generated-question and explanation paths use multiple prompt formats, manual JSON parsing, and inconsistent schemas.
- **P1 Confirmed:** Some active study/review routes can select questions without enforcing approved-production lifecycle filters.
- **P1 Revised:** FSRS core math is solid, but production scheduling used stale intervals after post-FSRS stability modifiers. Fixed in this pass for `drillReviewService` and `fsrsScheduleService`.
- **P1 Confirmed:** Progress, readiness, and recommendations are partly data-backed but include stale, weakly attributed, or disconnected metrics.

## Intelligence-Layer Architecture Map

| Area | Active Files | Current Role | Status |
|---|---|---|---|
| AI gateway | `lib/ai/aiGateway.ts`, `functions/api/_shared/ai-service.ts` | Provider abstraction, Gemini calls, structured output helper | Partly adopted |
| Direct AI calls | `functions/api/questions/explain-rag.ts`, `functions/api/clinical-eye/analyze.ts`, `functions/api/conditions/[identifier]/structured.ts`, `lib/search.ts` | Raw Gemini/fetch integrations | P1 fragmentation |
| Question generation | `functions/api/questions/generate-enhanced.ts`, `functions/api/questions/generate-batch.ts`, `functions/api/_shared/question-generator.ts`, `lib/questionGenerator.ts`, `lib/langchain/chains/questionGeneration.ts`, `lib/services/question/generationService.ts` | Prompt construction, parsing, validation, storage | Fragmented |
| Question staging/review | `functions/api/_shared/staging-questions.ts`, `functions/api/admin/*`, Prisma `StagedQuestion`, `PreGeneratedQuestion`, `Question` | Review and promotion | Incomplete metadata preservation |
| Study session assembly | `functions/api/study/session/generate.ts`, `lib/services/conceptQuestionSelector.ts` | Selects due/new questions and fallback generated content | Active P0 bypass fixed; route-filter work remains |
| Attempts/scoring | `functions/api/questions/attempt.ts`, `lib/services/drillReviewService.ts`, `functions/api/drills/submit-review.ts`, `functions/api/srs/submit.ts` | Persists attempts, review logs, FSRS updates | Mixed canonical paths |
| Progress and weakness | `lib/services/userProgressService.ts`, `lib/services/rolling360Service.ts`, `functions/api/analytics/readiness-projection.ts` | Updates mastery and readiness | Attribution gaps |
| FSRS | `lib/fsrs.ts`, `lib/services/drillReviewService.ts`, `lib/services/fsrsScheduleService.ts` | Core scheduling, confidence modifiers, due dates | Core good; schedule bug fixed |
| Review queue | `lib/services/conceptQuestionSelector.ts`, `functions/api/reviews/*`, `functions/api/drills/*` | Due review and targeted selection | Good baseline; inconsistent filters |
| Study plan | `lib/services/dailyStudyAllocatorService.ts`, `lib/services/studyPlanService.ts`, `functions/api/study-plan/today.ts`, `functions/api/_shared/studyPlanService.ts` | Deterministic allocation and daily plan | Useful but duplicated |
| Recommendation engine | `lib/recommendationEngine.ts`, `lib/services/recommendationService.ts`, `functions/api/recommendations/generate.ts` | Next study actions | Partly data-backed |
| Taxonomy/blueprints | `lib/constants/blueprint.ts`, `config/topic-map.ts`, `config/rotation-systems.ts`, `lib/services/blueprintCoverageService.ts`, `src/types/index.ts` | PANCE/EOR/system mapping | Conflicting sources |

## Intelligence Category Readiness Table

| Category | Grade | Severity | Evidence | Main Blockers | Recommended Fix |
|---|---:|---|---|---|---|
| AI provider architecture | 66 D | P1 | `aiGateway.ts`, `_shared/ai-service.ts`, direct Gemini routes | Live API key fallback fixed; gateway bypasses and timeout gaps remain | Enforce gateway policy, timeout, structured calls, redacted logging |
| Prompt quality and maintainability | 76 C | P1 | `generate-enhanced.ts`, `_shared/question-generator.ts`, `lib/questionGenerator.ts` | Duplicated prompts and contracts | Central prompt registry with schema-bound templates |
| Question generation quality | 72 C | P1 | `study/session/generate.ts`, `_shared/question-generator.ts` | Active auto-approval path fixed; remaining prompt/schema fragmentation | Require validation/review before learner use everywhere |
| Question schema validation | 63 D | P1 | `question-schema.ts`, `parseQuestionResponse` fallback | Manual parsing and partial validation | Validate with canonical Zod schema before persistence |
| Question metadata and blueprint mapping | 67 D | P1 | `blueprint.ts`, `topic-map.ts`, Prisma string fields | Multiple taxonomies and free strings | Canonical taxonomy service and normalization |
| Clinical accuracy controls | 58 F | P1 | staging/admin approval flow | AI content can enter loop without clinical review | Automated safety checks plus human review for new AI content |
| Explanation and rationale quality | 70 C | P1 | `explain-rag.ts`, `QuestionExplanation` models | Mixed plain text/schema formats | Canonical explanation schema with distractor rationales |
| Distractor explanation quality | 66 D | P1 | `_shared/question-generator.ts`, `question-schema.ts` | Required keys inconsistent with examples | Require per-choice rationale keyed to answer choice IDs |
| Difficulty calibration | 66 D | P2 | prompt difficulty strings, stats fields | Prompt-only difficulty; weak empirical recalibration | Track observed difficulty and update calibrated difficulty |
| Study session integration | 70 C | P1 | `study/session/generate.ts` | Dynamic fallback now fails safe; remaining selector filters vary by route | Shared production eligibility predicate |
| Attempt scoring and persistence | 78 C | P1 | `questions/attempt.ts`, `drillReviewService.ts` | Dual paths; Rolling360 skip risk | One canonical transactional submit path |
| Weakness detection | 64 D | P1 | `userProgressService.ts`, `rolling360Service.ts` | Weak weighting and attribution gaps | Recency/difficulty/confidence weighted weakness model |
| Progress calculation | 67 D | P1 | `UserProgress`, `UserTopicProgress` | System not consistently written; swallowed failures | Transactional progress updates and attribution tests |
| FSRS/spaced repetition correctness | 82 B | P1 revised | `lib/fsrs.ts`, `drillReviewService.ts` | Stale post-modifier interval fixed this pass | Continue tests for states, lapse, missed days, urgency |
| Review queue selection | 74 C | P1 | `conceptQuestionSelector.ts`, review routes | Some routes bypass production filters | Shared selector with lifecycle guards |
| Study plan generation | 72 C | P2 | `dailyStudyAllocatorService.ts`, `studyPlanService.ts` | Duplicate implementations and limited missed-day recovery | Pick canonical planner and connect due/weak/exam signals |
| Schedule generation | 66 D | P2 | `study-plan/today.ts`, plan item models | Shift/availability/replanning gaps | Persist schedule with workload caps and recovery |
| Exam-date and rotation targeting | 67 D | P2 | `rotation-systems.ts`, `eorScheduler.ts` | Partial EOR maps; urgency inconsistently connected | Canonical exam context and urgency propagation |
| Dashboard recommendation logic | 68 D | P1 | `recommendationEngine.ts`, `recommendationService.ts` | Mixed static and live signals | Single next-best-action ranker with reason trace |
| Adaptive personalization | 64 D | P1 | FSRS telemetry, progress, plan services | Signals not consistently joined | User-state snapshot feeding planner and recommendations |
| Testing and QA | 70 C | P1 | vitest suites, mock AI tests | Mocks often validate happy paths only | Malformed AI, E2E learning loop, route safety tests |
| Monitoring, logging, cost control | 61 D | P1 | provider routes, logger calls | Fragmented rate limits; prompt/output logging risk | Usage budget, redaction, per-feature model policy |
| Deprecated/conflicting logic | 58 F | P1 | mock/demo/legacy services | Duplicate old AI/study systems still importable | Deprecation table and guarded cleanup |

## Full Learning Pipeline Table

| Stage | Input | Output | Files | DB Models | Current Status | Blockers | Verification |
|---|---|---|---|---|---|---|---|
| User profile/goal | Clerk user, goals, exam date, rotation | Study context | `study-plan/today.ts`, `studyPlanService.ts` | `User`, `StudyPlan` | Partial | Inconsistent context propagation | Unit plus route tests |
| Blueprint/topic mapping | System/topic strings | Canonical tags | `blueprint.ts`, `topic-map.ts` | `Question`, `UserProgress` | Fragmented | Free-string drift | Taxonomy normalization tests |
| Question generation | topic/difficulty | AI question JSON | `generate-enhanced.ts`, `_shared/question-generator.ts` | `StagedQuestion`, `PreGeneratedQuestion` | Unsafe | Auto-approved dynamic fallback | Schema and route safety tests |
| Question validation | AI JSON | accepted/rejected question | `question-schema.ts`, validators | `Question` | Incomplete | Manual parsing/fallbacks | Invalid AI response tests |
| Study session | due/new/weak areas | session items | `study/session/generate.ts`, `conceptQuestionSelector.ts` | `StudySession`, `StudySessionQuestion` | Partially safe | Fallback generation | E2E session tests |
| Answer attempt | selected answer, telemetry | attempt + score | `questions/attempt.ts`, `drillReviewService.ts` | `QuestionAttempt`, `ReviewLog` | Functional | Dual submit paths | Idempotency tests |
| Progress update | attempt/review | mastery/weakness | `userProgressService.ts` | `UserProgress`, `UserTopicProgress` | Partial | System attribution and swallowed failure | Transaction tests |
| FSRS update | rating, card, telemetry | new card/due date | `lib/fsrs.ts`, `drillReviewService.ts` | `ReviewLog`, `UserProgress.fsrsCard` | Improved | More edge-state coverage needed | FSRS tests |
| Due review selection | progress due dates | review queue | `conceptQuestionSelector.ts` | `UserProgress`, `Question` | Functional | Route filter inconsistency | Query tests |
| Study plan | due/weak/exam/workload | plan items | `dailyStudyAllocatorService.ts` | `StudyPlan`, plan items | Useful | Duplicated planners | Planner tests |
| Schedule adjustment | missed/complete sessions | revised tasks | plan services | `StudyPlanItem` | Limited | missed-day recovery | Simulation tests |
| Dashboard recommendation | plan/progress/due | next best action | `recommendationEngine.ts` | `StudyRecommendation` | Mixed | static/legacy service | trace tests |

## P0 Launch Blockers

| Finding | Status | Evidence | Required Action |
|---|---|---|---|
| Live OSCE API could expose server Gemini key | Fixed this pass | `functions/api/osce/live-engine.ts` | Keep fail-closed route test and redaction check |
| Dynamic questions can be served as approved | Fixed this pass | `functions/api/study/session/generate.ts` dynamic generation/persistence path | Add regression test coverage to prevent re-enabling learner-facing dynamic generation |

## P1 Serious Issues

| Finding | Status | Evidence | Required Action |
|---|---|---|---|
| Direct AI calls bypass gateway policy | Confirmed | `explain-rag.ts`, `clinical-eye/analyze.ts`, `conditions/[identifier]/structured.ts`, `lib/search.ts` | Migrate to `aiGateway` structured/text helpers |
| Prompt/schema fragmentation | Confirmed | Multiple question-generation files | Centralize prompts and schemas |
| Active routes bypass approved-content filters | Confirmed | `custom-session.ts`, `second-chance.ts`, `smart-review.ts`, `due-siblings.ts`, `targeted-daily/today.ts` | Shared production question predicate |
| Attempt/progress path not fully transactional | Confirmed | `questions/attempt.ts`, `drillReviewService.ts`, `userProgressService.ts` | Canonical transaction and retry semantics |
| Readiness loses system attribution | Confirmed | `UserProgress.system`, `userProgressService.ts`, `readiness-projection.ts` | Write and test system on progress updates |
| Study recommendations not fully traceable | Confirmed | `recommendationEngine.ts`, `recommendationService.ts` | Emit reason trace with source metrics |

## Deprecated/Conflicting Systems

| File/Area | Issue | Evidence | Action | Risk |
|---|---|---|---|---|
| `functions/api/_shared/aiQuestionService.ts` | Mock/draft generation language remains | Placeholder implementation comments and heuristic validation | Replace or quarantine | Mock content can look production-like |
| `lib/questionGenerator.ts` | Legacy manual JSON parser and test fast-path | `gateway.callText` then `JSON.parse`; mock response in tests | Supersede with schema-bound generator | Malformed AI can pass |
| `lib/langchain/chains/questionGeneration.ts` | Validation fallback returns raw parsed JSON | `parseQuestionResponse` fallback | Make schema failure fatal | Bad contracts leak downstream |
| `lib/services/recommendationService.ts` | Legacy local Prisma recommendation path | Different logic from edge recommendation engine | Deprecate or merge | Conflicting dashboard behavior |
| Multiple taxonomy files | Duplicate category systems | `blueprint.ts`, `topic-map.ts`, `src/types/index.ts` | Canonical taxonomy module | Misleading analytics |

## Recommended Implementation Order

1. Add route-level regression coverage for the OSCE Live token failure path.
2. Centralize generated-question and explanation schemas.
3. Route all AI output parsing through structured schema validation.
4. Create shared production question eligibility predicate and apply to all selectors.
5. Normalize taxonomy fields and add compatibility mapping.
6. Unify attempt submission, progress update, and FSRS persistence transaction.
7. Connect due reviews, weak areas, exam context, plan, and dashboard recommendations through one traceable user-state snapshot.
8. Remove or quarantine mock/legacy intelligence paths.
9. Add malformed-AI and end-to-end learning-pipeline simulations.
