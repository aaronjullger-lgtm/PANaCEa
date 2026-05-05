# Backend Pipeline Audit

Audit date: 2026-05-01

| Stage | Status | Evidence | Risks | Verification |
|---|---|---|---|---|
| User goal / rotation setup | Partial | `functions/api/user/profile.ts`, `functions/api/user/goals.ts`, `prisma/schema.prisma` `UserGoal` | Goals used Clerk ID instead of internal `User.id`; missing `/api/user/goals/:goalId`. | Goals CRUD integration test with Clerk auth and internal user row. |
| Onboarding / baseline | Functional | `functions/api/baseline/submit.ts` | Baseline does not initialize FSRS/progress; answer validation depends on index. | Baseline submit test that writes expected assessment and follow-up plan. |
| Need detection | Partial | `lib/services/dailyStudyAllocatorService.ts`, `lib/services/dashboardAnalyticsService.ts` | Allocator reads `TARGETED`; main session writes may be `READINESS`. | Seed both contexts and compare allocator/dashboard/due outputs. |
| Question generation | Partial | `functions/api/questions/generate.ts`, `functions/api/_shared/question-generator.ts` | Raw JSON parsing, inconsistent persistence into canonical `Question`/`PreGeneratedQuestion`. | AI contract tests for malformed JSON and invalid correct answer. |
| Question storage | Partial | `PreGeneratedQuestion`, `Question`, `functions/api/study/session/generate.ts` | Concept selector and fallback pool use different stores. | Session generation with question only in pregenerated pool. |
| Session creation | Mostly functional | `functions/api/study/session/generate.ts` | Large handler; fallback complexity; session completion can race review sync. | Generate session, submit answers, summarize after sync. |
| Attempt submission | Mostly functional | `functions/api/drills/submit-review.ts`, `functions/api/questions/attempt.ts` | Canonical path and stats-only path coexist; offline drains may bypass FSRS. | Submit-review and offline queue regression tests. |
| Scoring | Strong | `lib/services/drillReviewService.ts`, `functions/api/drills/_shared/reviewQuestionResolver.ts` | Duplicate suppression can collapse legitimate repeat attempts. | Idempotency tests with different session IDs. |
| Explanation | Partial | `functions/api/questions/explain-rag.ts`, generation routes | No uniform explanation persistence contract. | Explanation retrieval contract test. |
| Progress update | Risky | `lib/services/drillReviewService.ts`, `lib/services/userProgressService.ts` | Non-atomic writes can leave attempts without scheduler state. | Forced failure test for ReviewLog/UserProgress writes. |
| Weakness detection | Partial | `lib/services/dashboardAnalyticsService.ts`, `lib/recommendationEngine.ts` | Weakness models not central; some metrics derived heuristically. | Seed attempts and verify weak systems/conditions. |
| FSRS update | Risky | `lib/fsrs.ts`, `lib/services/drillReviewService.ts` | Split `UserProgress`/`UserTopicProgress`/`Card` models; context mismatch. | Context policy test across main/targeted/cram/rapid recall. |
| Due review selection | Partial | `functions/api/srs/due.ts`, `functions/api/srs/next.ts`, `conceptQuestionSelector.ts` | Due endpoints return concepts while sessions need question identities. | Due item can launch a real review question. |
| Study plan | Partial | `lib/services/studyPlanService.ts`, `functions/api/_shared/studyPlanService.ts` | Two implementations and different task shapes. | Targeted task preserves condition IDs and completes correctly. |
| Schedule adjustment | Partial | `functions/api/study-plan/progress.ts`, `functions/api/users/me/daily-plan.ts` | Missed-day recovery is basic; user resolver inconsistent. | Plan progress action test for new user. |
| Dashboard analytics | Mostly functional | `functions/api/dashboard/stats.ts`, `lib/services/dashboardAnalyticsService.ts` | Stale cache, envelope drift, query cost. | Dashboard contract tests against wrapped envelope. |
| Recommendations | Partial | `functions/api/recommendations/*`, `lib/recommendationEngine.ts` | Duplicates daily plan logic and cache invalidation is unclear. | Generate/action/list cache consistency test. |

## Major Broken Links

- **Confirmed P0:** goals route identity and missing item route.
- **Confirmed P1:** session summary can run before queued reviews persist.
- **Confirmed P1:** FSRS/progress writes are not a single transaction.
- **Confirmed P1:** study planning and FSRS context policy are not cohesive.
- **Confirmed P1:** generated AI content is not uniformly schema-validated and persisted.
