---
name: "panacea-study-plan"
description: "Use to work on PANaCEa study plan generation, StudyPlanTask V2 consolidation, daily plan endpoints, progress tracking, adaptive task completion, and learner-facing plan surfaces. Trigger when asked about study plans, daily plans, study scheduling, adaptive tasks, progress plan, or StudyPlanTask consolidation."
---

# PANaCEa Study Plan

You own the study plan pipeline: from FSRS review data through task generation to learner-facing daily plans and progress tracking.

## First Files

- `CLAUDE.md` for FSRS and scaling rules
- `functions/api/_shared/studyPlanService.ts` — Edge study plan service
- `lib/services/studyPlanService.ts` — client-side study plan service
- `functions/api/study-plan/` — study plan API endpoints
- `functions/api/user/review-history.ts` — review history for plan inputs
- `lib/services/drillReviewService.ts` — review → task completion linkage
- `pages/ProgressPage.tsx` — learner-facing progress/plan page
- `components/dashboard/adaptive/` — adaptive dashboard components
- `hooks/useStudyPlanLaunch.ts` — study plan launch hook
- `APP_FUNCTIONALITY_PLAN.md` — known blockers
- `NEXT_IMPLEMENTATION_PLAN.md` — implementation order

## Architecture

```
ReviewLog (submitted) → StudyPlanService → StudyPlanTask (daily)
                                              ├── pending (auto)
                                              ├── in_progress (learner acting)
                                              └── completed (review submission)
                         ↓
                  Daily Plan API → ProgressPage → learner views tasks
```

## Current State (from scorecard: 80/100)

**Completed:**
- Task progress auto-completes from submitted review attempts
- Stale pending plans regenerate from newer review data
- Single-system tasks route as `mode=system`
- Locally generated targeted tasks use `task mode=targeted`
- Compatibility sanitization canonicalizes stale task modes
- Progress page shows actionable adaptive tasks with launch actions

**Remaining (StudyPlanTask V2 consolidation):**
1. Full cross-route contract between `_shared/studyPlanService.ts` and `lib/services/studyPlanService.ts`
2. Consistency for `conditionIds`, `reviewCardIds`, `linkedSessionId` across plan surfaces
3. Dashboard review coverage inputs aligned with plan task tracking
4. Active normalized task shape verified across all consumers
5. Daily plan, study-path, and study-plan compatibility routes consolidated

## Rules

- Study plan tasks derive from real ReviewLog data, not synthetic estimates
- Completed tasks must not be regenerated or overwritten
- In-progress tasks are preserved during regeneration
- Stale pending tasks regenerate when newer review data exists
- Task routing must use the correct mode (`targeted`, `system`, `condition`)
- Compatibility routes must maintain stable output shapes
- No hardcoded task counts — derive from actual FSRS due cards and review history

## Common Traps

- Overwriting completed tasks during regeneration
- Regenerating tasks without checking for newer review data
- Route mismatches: `mode=condition` vs `mode=system` vs `mode=targeted`
- Missing `conditionIds` in targeted task payloads
- Forgetting to link `linkedSessionId` after session launch
- Compatibility endpoint shaping differing from primary endpoint output

## Tests To Look For

- `functions/api/_shared/studyPlanService.test.ts`
- `functions/api/study-plan/progress.test.ts`
- `functions/api/study-plan/today.test.ts`
- `hooks/useStudyPlanLaunch.test.tsx`
- `tests/drillReviewService.test.ts` (auto-completion from reviews)
- `components/dashboard/adaptive/` component tests

## Verification

```bash
npx vitest run functions/api/_shared/studyPlanService.test.ts functions/api/study-plan/progress.test.ts functions/api/study-plan/today.test.ts hooks/useStudyPlanLaunch.test.tsx
npm run test:critical
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```

## Hard Guardrails

- Never invent study plan data — use real ReviewLog and FSRS state
- Never delete completed or in-progress learner task rows
- Preserve backward compatibility on daily plan API shapes
- Frame all plan outputs as learning guidance, not medical advice
- Task counts and projections must be truthful — no inflated metrics
