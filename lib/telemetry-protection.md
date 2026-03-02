/**
 * Telemetry Protection: Rapid Guess Bypass
 * 
 * EXISTING IMPLEMENTATION in drillReviewService.ts (lines 350-380)
 * 
 * Logic:
 * 1. Detect rapid guess: telemetry.rapid_guess === true OR timeSpentMs < 500ms
 * 2. Log to ReviewLog with review_type: 'rapid_guess' (for analytics)
 * 3. Skip FSRS state update (UserProgress.reviewHistory) via isRapidGuess gate
 * 4. Still record QuestionAttempt for telemetry tracking
 * 
 * Key code section:
 * ```typescript
 * const isRapidGuess = telemetry?.rapid_guess ?? numericTime < 500;
 * 
 * // ... ReviewLog creation with review_type: 'rapid_guess' ...
 * 
 * // Only update FSRS state for non-rapid-guess reviews
 * if (!isRapidGuess) {
 *   await updateUserProgressWithHistory(prisma, {
 *     userId,
 *     conditionId: question.conditionId,
 *     fsrsCard: updatedCard,
 *     rating,
 *     accuracy: isCorrect ? 1.0 : 0.0,
 *   });
 * }
 * ```
 * 
 * Result: Accidental taps/rapid guesses are logged but do NOT pollute SRS scheduling.
 */

export const TELEMETRY_PROTECTION_NOTES = `
Rapid guess protection is ACTIVE in drillReviewService.ts.
No additional code needed.
`;
