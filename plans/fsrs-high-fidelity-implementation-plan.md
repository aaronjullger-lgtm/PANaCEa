# FSRS High‑Fidelity Learning Curve Implementation Plan

## Objective
Update `drillReviewService.ts` to populate the new `grade_continuous`, `implicit_confidence`, and `retrievability` columns in the `ReviewLog` table, ensuring that all float values are stored with full precision.

## Files to Modify

### 1. `lib/services/drillReviewService.ts`
**Changes:**
- Compute retrievability using the FSRS instance's `calculateRetrievability` method.
- Add `grade_continuous` and `implicit_confidence` to the `data` object passed to `prisma.reviewLog.create`.
- Keep existing `grade` (integer) and `telemetry` JSON unchanged for backward compatibility.

**Location:** Around line 487–528 (the `reviewLog.create` block).

**Current code snippet:**
```typescript
await prisma.reviewLog.create({
  data: {
    userId,
    conditionId: question.conditionId,
    medicalContentId: question.medicalContentId ?? undefined,
    questionId,
    questionType: 'pre_generated',
    grade: rating,
    state: currentCard.state,
    scheduledAt: new Date(
      currentCard.last_review.getTime() + currentCard.scheduled_days * 86400000
    ),
    reviewedAt: reviewDate,
    responseTimeMs: effectiveDurationMs,
    review_type: 'real',
    stability: currentCard.stability,
    difficulty: currentCard.difficulty,
    retrievability: null,
    elapsedDays: currentCard.elapsed_days,
    wasCorrect: isCorrect,
    sessionType: 'MAIN',
    attemptId,
    system: question.system ?? undefined,
    hover_oscillations: hoverOscillations,
    vignette_regressions: vignetteRegressions,
    time_to_first_interaction: timeToFirstInteraction,
    circadian_phase: toCircadianPhaseEnum(circadianContext.circadianPhase),
    telemetry: {
      par_time_ms: parTimeMs,
      latency_ratio: effectiveDurationMs / parTimeMs,
      implicit_confidence: implicitConfidence,
      grade_continuous: gradeContinuous,
      answer_changes: (telemetry?.answer_changes as number | undefined) ?? switches,
      circadian_phase: circadianContext.circadianPhase,
      selection_drift_ms: telemetry?.selection_drift_ms as number | undefined,
      cursor_entropy: telemetry?.cursor_entropy as number | undefined,
      tremor_score: telemetry?.tremor_score as number | undefined,
    },
  },
});
```

**Proposed changes:**
1. **Compute retrievability** before creating the log:
   ```typescript
   const retrievability = fsrs.calculateRetrievability(
     currentCard.elapsed_days,
     currentCard.stability
   );
   ```
2. **Add the three new fields** to the `data` object:
   ```typescript
   grade_continuous: gradeContinuous,
   implicit_confidence: implicitConfidence,
   retrievability,
   ```
3. Remove `retrievability: null` (replace with computed value).

**Updated snippet:**
```typescript
const retrievability = fsrs.calculateRetrievability(
  currentCard.elapsed_days,
  currentCard.stability
);

await prisma.reviewLog.create({
  data: {
    userId,
    conditionId: question.conditionId,
    medicalContentId: question.medicalContentId ?? undefined,
    questionId,
    questionType: 'pre_generated',
    grade: rating,
    grade_continuous: gradeContinuous,
    implicit_confidence: implicitConfidence,
    state: currentCard.state,
    scheduledAt: new Date(
      currentCard.last_review.getTime() + currentCard.scheduled_days * 86400000
    ),
    reviewedAt: reviewDate,
    responseTimeMs: effectiveDurationMs,
    review_type: 'real',
    stability: currentCard.stability,
    difficulty: currentCard.difficulty,
    retrievability,
    elapsedDays: currentCard.elapsed_days,
    wasCorrect: isCorrect,
    sessionType: 'MAIN',
    attemptId,
    system: question.system ?? undefined,
    hover_oscillations: hoverOscillations,
    vignette_regressions: vignetteRegressions,
    time_to_first_interaction: timeToFirstInteraction,
    circadian_phase: toCircadianPhaseEnum(circadianContext.circadianPhase),
    telemetry: {
      par_time_ms: parTimeMs,
      latency_ratio: effectiveDurationMs / parTimeMs,
      implicit_confidence: implicitConfidence,
      grade_continuous: gradeContinuous,
      answer_changes: (telemetry?.answer_changes as number | undefined) ?? switches,
      circadian_phase: circadianContext.circadianPhase,
      selection_drift_ms: telemetry?.selection_drift_ms as number | undefined,
      cursor_entropy: telemetry?.cursor_entropy as number | undefined,
      tremor_score: telemetry?.tremor_score as number | undefined,
    },
  },
});
```

**Note:** The `fsrs` instance is already available in the surrounding scope (line 429). Ensure we use the same instance.

### 2. Update TypeScript Types (Optional)
If the Prisma client types are automatically generated, no manual type updates are needed. However, we may want to adjust the `ReviewLog` type in `@prisma/client`? The `prisma generate` command will update the types automatically after the schema migration.

### 3. Edge Cases Handling
- **New cards (`state === FSRSState.New`):** `elapsed_days` may be 0, `stability` may be 0. `calculateRetrievability` returns 0 when `stability <= 0`. That's fine.
- **Missing conditionId:** The block creating `ReviewLog` is already gated by `question.conditionId && countForFSRS && !isRapidGuess`. No change needed.
- **Rapid guess / cram / rapid_recall:** No `ReviewLog` created, so no new columns to populate.
- **Error handling:** The existing `try/catch` around `reviewLog.create` already logs warnings; no extra handling required.

## Validation Steps

### 1. Run Unit Tests
Execute the newly written test suite (`drillReviewService.test.ts`) to verify:
- The service computes retrievability correctly.
- The new float columns are present in the mock call.
- All edge cases pass.

### 2. Integration Test (Optional)
Create a simple script that calls `submitDrillReview` with a real database (dev environment) and verify the columns are populated.

### 3. TypeScript Compilation
Run `npm run typecheck` to ensure no type errors introduced.

### 4. Linting
Run `npm run lint` and fix any issues.

## Deployment Sequence
1. **Apply schema migration** (as per migration plan).
2. **Regenerate Prisma Edge Client** (run `npm run deploy:hook` or equivalent).
3. **Update `drillReviewService.ts`** with the changes above.
4. **Run unit tests** – all must pass.
5. **Deploy to staging** and verify with real user sessions.
6. **Monitor** for any unexpected errors (e.g., null values in new columns).
7. **Deploy to production** after successful staging validation.

## Rollback Procedure
If the service update causes issues:
1. Revert the changes to `drillReviewService.ts`.
2. The schema columns are nullable, so existing code will ignore them.
3. No need to revert the migration immediately.

## Success Metrics
- All new `ReviewLog` rows have non‑null `grade_continuous` and `implicit_confidence`.
- `retrievability` is populated for all non‑new cards (state ≠ New).
- No regression in existing functionality (FSRS scheduling, telemetry, confusion pairs, etc.).
- Unit test coverage remains at 100% for the modified code paths.

## Timeline
- Implementation: 30 minutes
- Testing & validation: 30 minutes
- Deployment: 10 minutes

## Next Steps
1. Obtain approval for this implementation plan.
2. Switch to **Code** mode to apply the changes.
3. Execute the validation steps.
4. Deploy.