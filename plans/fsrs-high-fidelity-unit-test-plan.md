# FSRS High-Fidelity Learning Curve Unit Test Plan

## Objective
Validate that `drillReviewService.submitDrillReview` correctly captures FSRS rating and implicit confidence as decimal/float values, logs stability, difficulty, and retrievability as floats, and handles edge cases robustly.

## Schema Changes (Planned)
- Add `grade_continuous` (Float) column to ReviewLog
- Add `implicit_confidence` (Float) column to ReviewLog
- Compute and store `retrievability` (Float) instead of null

## Test Categories

### 1. Happy Path – Main Session with Condition ID
**Setup:**
- Valid question with conditionId, correct answer, normal telemetry
- Session type = 'main' (default)

**Assertions:**
- ReviewLog created with:
  - `grade` = integer rating (1-4)
  - `grade_continuous` = decimal value between 1.0 and 4.0
  - `implicit_confidence` = decimal value between 0.5 and 0.95
  - `stability` = float (pre‑review stability)
  - `difficulty` = float (pre‑review difficulty)
  - `retrievability` = float computed via `fsrs.calculateRetrievability(elapsed_days, stability)`
  - `review_type` = 'real'
  - `sessionType` = 'MAIN'
- QuestionAttempt created with `implicitConfidence` and telemetry JSON
- FSRS schedule returned in response

### 2. Cram & Rapid Recall Sessions
**Setup:** `sessionType = 'cram'` or `'rapid_recall'`
**Assertions:**
- No ReviewLog created (FSRS skipped)
- QuestionAttempt still created
- Response `fsrsSchedule` = undefined

### 3. Rapid Guess Detection
**Setup:** `telemetry.rapid_guess = true` or `duration_ms < 500ms`
**Assertions:**
- ReviewLog not created (even for main session)
- QuestionAttempt flagged as rapid guess in telemetry
- FSRS schedule undefined

### 4. Missing Condition ID
**Setup:** `question.conditionId = null`
**Assertions:**
- No ReviewLog created
- No FSRS update
- QuestionAttempt created (implicit confidence still computed)

### 5. Incorrect Answer
**Setup:** Selected answer wrong
**Assertions:**
- `wasCorrect = false`
- `grade_continuous` near 1.0 (Again)
- `implicit_confidence` high (0.95 per logic)
- ReviewLog created with appropriate rating

### 6. Behavioral Overrides
**Subcases:**
- Slow response (`timeSpentMs > parTimeMs * 1.5`) with correct answer and rating Easy → downgraded to Good
- Answer switches > 2 → rating capped at Hard
- Hover oscillations / vignette regressions / selection drift / tremor → rating adjusted by `applyHonestRating`

**Assertions:** Rating and grade_continuous reflect overrides.

### 7. Edge Cases – Invalid Inputs
- `timeSpentMs` negative or zero
- Missing `telemetry` object
- Missing `selectedAnswer`
- Non‑numeric `timeSpentMs` (string convertible)
- `timeToFirstClick` missing (should substitute `parTimeMs * 0.85`)

**Assertions:** Service does not throw; uses safe defaults; logs warnings.

### 8. Boundary Values for Continuous Metrics
- `grade_continuous` at extremes (1.0, 4.0)
- `implicit_confidence` at extremes (0.5, 0.95)
- `stability` very small (≈0.01) or very large (>36500)
- `elapsed_days` zero (new card) or large (years)

**Assertions:** No NaN or Infinity in stored floats; retrievability clamped between 0 and 1.

### 9. Retrievability Calculation
- Verify `retrievability = fsrs.calculateRetrievability(elapsed_days, stability)`
- Edge: `stability <= 0` → retrievability = 0
- Edge: `elapsed_days = 0` → retrievability = 1 (by formula)
- Ensure `retrievability` is stored as Float (not null)

### 10. Telemetry JSON Preservation
- Existing telemetry fields (answer_changes, hover_oscillations, etc.) remain in `telemetry` column
- New server‑computed fields (grade_continuous, implicit_confidence, latency_ratio) also present in telemetry for backward compatibility

### 11. Concurrent Calls & Idempotency
- Simulate two simultaneous reviews for same question
- Verify no duplicate ReviewLog entries (unique constraints)
- Verify QuestionAttempt IDs are unique

## Mocking Strategy
- **PrismaClient**: mock `prisma.questionAttempt.create`, `prisma.reviewLog.create`, `prisma.userProgress.findUnique`, `prisma.userProgress.update`
- **FSRS**: mock `new FSRS()` and its `next`, `calculateRetrievability` methods
- **Logger**: mock optional logger methods (`info`, `warn`)
- **Circadian context**: mock `buildCircadianContext` to return deterministic phase

## Test File Location
`tests/drillReviewService.test.ts`

## Pre‑requisites
- Jest configured with `ts‑jest`
- Ability to mock ES modules (via `jest.mock`)

## Success Criteria
All tests pass before schema migration; after migration, same tests pass with real database columns.

## Next Steps
1. Write the unit tests (see next document for test code skeleton)
2. Run tests against current implementation (expected failures)
3. Apply schema migration (add columns)
4. Update `drillReviewService` to populate new columns
5. Verify tests pass
6. Deploy migration and service updates