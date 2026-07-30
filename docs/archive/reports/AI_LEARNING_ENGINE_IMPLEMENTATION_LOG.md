# AI Learning Engine Implementation Log

## Entry: 2026-05-02 00:09 EDT

### Slice
First-pass and second-pass intelligence-layer audit.

### Files Changed
- `AI_LEARNING_ENGINE_AUDIT.md`
- `QUESTION_GENERATION_AUDIT.md`
- `EXPLANATION_AND_RATIONALE_AUDIT.md`
- `ADAPTIVE_LEARNING_PIPELINE_AUDIT.md`
- `FSRS_AND_REVIEW_SCHEDULING_AUDIT.md`
- `STUDY_PLAN_INTELLIGENCE_AUDIT.md`
- `AI_LEARNING_ENGINE_IMPLEMENTATION_PLAN.md`
- `AI_LEARNING_ENGINE_FINAL_REPORT.md`

### Reason
The repository needed a durable, file-level record of AI learning engine readiness, blockers, category grades, and implementation order before repair work continues.

### What Changed
Created the required audit, plan, and report documents with evidence from code tracing and specialized review passes.

### Verification
Documentation review for required tables and required sections.

### Result
Partial. Audit artifacts are present; remaining engineering blockers are tracked in the plan.

### Remaining Risks
The biggest remaining launch blocker is learner-facing exposure of dynamically generated questions before validation and review.

### Follow-Up Tasks
Add route-level regression coverage for OSCE Live token mint failure and continue prompt/schema centralization.

## Entry: 2026-05-02 00:09 EDT

### Slice
FSRS interval correctness after adaptive stability modifiers, plus OSCE Live API credential safety.

### Files Changed
- `lib/fsrs.ts`
- `lib/services/drillReviewService.ts`
- `lib/services/fsrsScheduleService.ts`
- `functions/api/osce/live-engine.ts`
- `tests/fsrs.test.ts`
- `tests/fsrsScheduleService.test.ts`

### Reason
The audit found that final stability modifiers changed FSRS stability after `fsrs.next()` had already calculated `scheduled_days`, causing due dates to ignore confidence, circadian, urgency, and calibration adjustments. The audit also found a P0 path that could return the server Gemini key to the browser if ephemeral token minting failed.

### What Changed
Added `FSRS.calculateIntervalFromStability()`, recomputed Review-state `scheduled_days` from final modified stability in both scheduling paths, and made the OSCE Live route return `503` when a temporary token cannot be created instead of falling back to the server API key.

### Verification
- `npx vitest run tests/fsrs.test.ts tests/fsrsScheduleService.test.ts`
- `npx vitest run tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`

### Result
Pass. 98 targeted tests passed.

### Remaining Risks
Exam urgency is still not consistently passed by all submit routes, and review queue route eligibility filters still need consolidation.

### Follow-Up Tasks
Add route-level tests for OSCE Live token failure and implement the dynamic-question exposure blocker.

## Entry: 2026-05-02 00:13 EDT

### Slice
Study-session dynamic question exposure blocker.

### Files Changed
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `AI_LEARNING_ENGINE_AUDIT.md`
- `QUESTION_GENERATION_AUDIT.md`
- `AI_LEARNING_ENGINE_IMPLEMENTATION_PLAN.md`
- `AI_LEARNING_ENGINE_IMPLEMENTATION_LOG.md`
- `AI_LEARNING_ENGINE_FINAL_REPORT.md`

### Reason
The audit found a P0 path where a thin approved question pool could trigger AI generation during session creation, persist the generated question as approved, and serve it to the learner without clinical review.

### What Changed
The session generator now logs a pool shortage and refuses learner-facing dynamic generation. The unused generated-question persistence helper was also changed to create `pending` records with no validation timestamp if it is reactivated later.

### Verification
- `npx vitest run functions/api/study/session-generate.test.ts tests/questionServingSafety.test.ts`
- `npx vitest run functions/api/study/session-generate.test.ts tests/questionServingSafety.test.ts tests/fsrs.test.ts tests/fsrsScheduleService.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`

### Result
Pass. The focused route safety suite passed, and the combined targeted suite passed with 109 tests.

### Remaining Risks
Other learner-facing routes still need a shared production eligibility predicate, and generated-question schemas remain fragmented.

### Follow-Up Tasks
Create `lib/services/questionEligibility.ts` and replace route-local safety predicates with that shared production filter.
