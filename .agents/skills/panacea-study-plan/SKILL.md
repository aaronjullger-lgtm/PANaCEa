---
name: "panacea-study-plan"
description: "Use to work on PANaCEa's study plan generation, daily planning, StudyPlanTask V2 consolidation, progress tracking, task completion, and study scheduling. Trigger when asked about study plans, daily plans, study scheduling, plan generation, task consolidation, or progress tracking integration."
---

# PANaCEa Study Plan

You own the study plan subsystem: daily plan generation, StudyPlanTask lifecycle, progress tracking, plan regeneration, and the V2 consolidation from the split service architecture.

## First Files

- `CLAUDE.md` for scheduler and plan architecture
- `functions/api/_shared/studyPlanService.ts` — Edge plan service
- `lib/services/studyPlanService.ts` — client-side plan service
- `functions/api/study-plan/today.ts` — today's plan endpoint
- `functions/api/study-plan/progress.ts` — plan progress endpoint
- `functions/api/users/me/daily-plan.ts` — daily plan compatibility
- `prisma/schema.prisma` — StudyPlan, StudyPlanTask, DailyPlan models
- `functions/api/study/session/generate.ts` — session generation with topic mastery
- `lib/services/drillReviewService.ts` — review submission advances plan tasks
- `NEXT_IMPLEMENTATION_PLAN.md` — V2 consolidation tasks

## Architecture

```
User Activity → ReviewLog → ensureStudyPlanWindow → StudyPlan + StudyPlanTasks
                                    ↓
                              Daily Plan (today's actionable items)
                                    ↓
                              Session Launch → Session Generation
                                    ↓
                              Review Submission → Task Completion → Plan Progress
```

## Current State (from scorecard: 80/100)

### Completed
- Review submissions advance linked daily study-plan tasks
- Task completion when question targets met
- Study-plan window regeneration from real review activity
- Stale pending plans refreshed after new review data
- Completed/in-progress plans preserved during regeneration
- Current-plan output routes single-system tasks as `mode=system`
- New locally generated targeted tasks use `mode=targeted`
- Compatibility task sanitization canonicalizes stale modes
- Today's adaptive plan renders on `/progress`

### Still Open (V2 Consolidation)
- Full cross-route StudyPlanTask V2 contract unified between `_shared/studyPlanService.ts` and `lib/services/studyPlanService.ts`
- Re-inspect active normalized task shape
- `conditionIds`, `reviewCardIds`, `linkedSessionId`, dashboard review coverage inputs
- Study-path, study-plan, daily-plan compatibility route alignment
- Keep compatibility endpoint shapes stable during consolidation

## Rules

- Preserve completed and in-progress plan rows during regeneration
- Plan tasks must map to real FSRS cards or real condition targets
- Do not create plans with zero valid tasks
- Task completion must be atomic with review submission
- Compatibility routes must not break during V2 migration
- Plan generation reads latest real ReviewLog, not cached/estimated data
- Never expose other users' plan data

## Common Traps

- Regenerating plans and overwriting completed tasks
- Creating duplicate plans for the same day/user
- Plan tasks with stale/missing conditionIds or cardIds
- V2 tasks not backwards-compatible with V1 daily-plan endpoint
- Session generation not linking back to plan task
- Plan completion not triggering next-day plan generation

## Tests To Look For

- `functions/api/_shared/studyPlanService.test.ts`
- `functions/api/study-plan/progress.test.ts`
- `functions/api/study-plan/today.test.ts`
- `hooks/useStudyPlanLaunch.test.tsx`
- `tests/drillReviewService.test.ts` — plan task completion from review
- `functions/api/users/me/daily-plan.test.ts` — compatibility endpoint

## Verification

```bash
npx vitest run functions/api/_shared/studyPlanService.test.ts functions/api/study-plan/progress.test.ts functions/api/study-plan/today.test.ts hooks/useStudyPlanLaunch.test.tsx tests/drillReviewService.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
npm run test:critical
```
