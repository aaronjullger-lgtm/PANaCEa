# AI Learning Engine Implementation Plan

Date: 2026-05-02

Current grade after this pass: **68/100 (D+)**. Target grade for launch: **82/100 (B)** with no P0 blockers and all P1 risks either fixed or explicitly mitigated.

## Prioritized Phases

| Phase | Goal | File-Level Tasks | Verification |
|---|---|---|---|
| A. Stabilization | Stop unsafe AI/study behavior | Done: `osce/live-engine.ts` fail closed; done: `study/session/generate.ts` stop auto-approved dynamic fallback; remaining: central eligibility predicate | Route tests |
| B. Question hardening | Trust only valid AI questions | Add `lib/schemas/generatedQuestion.ts`; update `_shared/question-generator.ts`, `generate-enhanced.ts`, LangChain parser | Schema and malformed-AI tests |
| C. Explanation quality | Consistent teaching contract | Add `ExplanationV1`; update `explain-rag.ts` and generation prompts | Explanation schema tests |
| D. Taxonomy | Canonical blueprint mapping | Add taxonomy module; normalize `blueprint.ts`, `topic-map.ts`, rotation maps | Taxonomy compatibility tests |
| E. Attempt to progress | Make learning data durable | Unify `questions/attempt.ts` and `drillReviewService.ts`; transaction progress + Rolling360 | Idempotency/transaction tests |
| F. FSRS/review queue | Correct due dates and selection | Completed interval recompute; add urgency/context tests; shared due selector | FSRS and selector tests |
| G. Study plan/scheduling | Real adaptive schedule | Pick canonical planner; add missed-day recovery and availability caps | Planner simulation tests |
| H. Recommendations | Traceable next best action | Merge recommendation services; emit reason traces | Recommendation ranking tests |
| I. Cleanup | Remove fake intelligence | Quarantine mock/demo/legacy services and old prompts | Import graph checks |
| J. Verification | Launch confidence | End-to-end learning-pipeline simulation | E2E tests |

## Prompt Standardization Plan

- Create versioned prompt modules for question generation, explanation generation, and study recommendations.
- Every prompt must declare output schema version, allowed taxonomy values, clinical constraints, and rejection behavior.
- All AI responses must be parsed through schema validators before storage or display.

## Rollback Plan

- FSRS interval recompute can be reverted by restoring `scheduled_days` from `fsrs.next()` output, but that would reintroduce stale due dates after stability modifiers.
- OSCE Live API fail-closed rollback must not restore server-key browser fallback; acceptable rollback is a temporary 503-only route while token minting is fixed.
- Question-generation hardening should ship behind a shortage fallback flag so learner sessions fail safe rather than serve unvalidated content.

## Launch Checklist

- No P0 findings open. Current pass fixed the two confirmed P0s; keep regression tests in CI.
- No learner-facing route returns unvalidated AI-generated questions.
- All generated questions and explanations pass canonical schemas.
- Due review selection uses final FSRS intervals.
- Attempt submission, progress, and review log writes are transactionally consistent.
- Dashboard recommendations include data-backed reason traces.
- End-to-end pipeline simulation passes with valid, invalid, and edge-case AI responses.
