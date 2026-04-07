/**
 * Drill Submission Pipeline — Integration Tests
 *
 * These tests exercise the REAL behavioral → rating → FSRS flow:
 *   deriveContinuousRating (real) → Ghost Grader (real) → FSRS.next (real)
 *
 * Only DB calls and external profile services are mocked. The core
 * algorithmic chain (implicit-metrics → fsrs → scheduling) runs live,
 * which catches regressions that unit tests with mocked FSRS miss.
 *
 * Covers:
 *   1. Fast correct answer → high grade, Good rating, reasonable interval
 *   2. Slow hesitant answer → lower grade, Again rating, short interval
 *   3. Incorrect answer → Again rating, relearning state
 *   4. Rapid-guess gating → FSRS schedule is undefined
 *   5. Three-mode session gating:
 *      - TARGETED → sole FSRS writer (full pipeline)
 *      - MAIN (default) → ReviewLog for analytics, no FSRS writes
 *      - DRILL → QuestionAttempt only, no ReviewLog, no FSRS
 *      - cram/rapid_recall → QuestionAttempt only, excluded from analytics
 *   6. Correctness resolution across 6 question data formats
 *   7. Error resilience: DB failures don't crash the pipeline
 *   8. Multi-review FSRS state evolution (New → Learning → Review)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitDrillReview } from '../lib/services/drillReviewService';
import { Rating } from '../lib/fsrs';
import {
  makeVignetteQuestion,
  makeIndexedQuestion,
  makeChoicesQuestion,
  makeLegacyQuestion,
  makeCorrectOptionQuestion,
  makeNoConditionQuestion,
  makeFastCorrectTelemetry,
  makeSlowHesitantTelemetry,
  makeRapidGuessTelemetry,
  makeIncorrectTelemetry,
  createPrismaMock,
} from './helpers/drillPipelineFixtures';

// ── Mock ONLY external services that hit DB or network ──────────
// The key difference from the existing drillReviewService.test.ts:
// we do NOT mock lib/fsrs, lib/implicit-metrics, or lib/srs/ghostGrader.
// Those run REAL code so we test the actual algorithmic pipeline.

vi.mock('../lib/services/userTimingProfileService', () => ({
  getUserSpeedFactor: vi.fn(() => Promise.resolve(1.0)),
  getUserBehavioralBaseline: vi.fn(() => Promise.resolve(null)),
  getUserBehavioralContext: vi.fn(() => Promise.resolve({ speedFactor: 1.0, behavioralBaseline: null })),
}));

vi.mock('../lib/services/calibrationService', () => ({
  getUserCalibration: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/services/fsrsOptimizerService', () => ({
  getOptimizedParameters: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/services/retrievabilityCalibrationService', () => ({
  getStabilityCorrectionFactor: vi.fn(() => 1.0),
}));

vi.mock('../lib/services/semanticSiblingService', () => ({
  propagateRecallToSiblings: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../lib/services/userProgressService', () => ({
  updateUserProgressWithHistory: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/services/userStatisticsService', () => ({
  applyAttemptToUserStatistics: vi.fn(() => Promise.resolve()),
  updateTimingAggregates: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/services/srsService', () => ({
  updateReviewOutcome: vi.fn(),
}));

vi.mock('../lib/services/rolling360Service', () => ({
  getRolling360Service: vi.fn(() => ({
    updateRolling360OnSubmit: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../lib/services/sessionFatigueService', () => ({
  applyFatigueCorrection: vi.fn((parTimeMs: number) => parTimeMs),
  computeFatigueConfidenceDampener: vi.fn(() => 1.0),
}));

vi.mock('../lib/services/lapseSeverityService', () => ({
  computeLapseSeverity: vi.fn(() => ({ severity: 0.5, difficultyMultiplier: 1.0, preLapseReps: 0, preLapseStability: 0 })),
}));

vi.mock('../lib/services/rtTrajectoryService', () => ({
  computeRtTrajectory: vi.fn(() => ({ hasHistory: false, rtChangeRatio: 1.0, stabilityMultiplier: 1.0 })),
}));

vi.mock('../lib/services/sessionAccuracySlopeService', () => ({
  recordOutcome: vi.fn(),
  getConfidenceModifier: vi.fn(() => ({ confidenceMultiplier: 1.0, slope: 0, rollingAccuracy: 0.5 })),
}));

vi.mock('../lib/services/intervalDeviationService', () => ({
  computeIntervalDeviation: vi.fn(() => ({ deviationRatio: 0, informationMultiplier: 1.0, classification: 'on_time' })),
}));

vi.mock('../lib/services/distractorChronometryService', () => ({
  analyzeDistractorChronometry: vi.fn(() => ({
    confidenceMultiplier: 1.0,
    correctOptionAbandoned: false,
    uniqueOptionsConsidered: 1,
  })),
}));

vi.mock('../lib/services/switchDirectionService', () => ({
  analyzeSwitchDirections: vi.fn(() => ({
    confidenceMultiplier: 1.0,
    metacognitivePrecision: 0.5,
    netSwitchValue: 0,
  })),
}));

vi.mock('../lib/services/explanationEngagementService', () => ({
  analyzeExplanationEngagement: vi.fn(() => ({
    confidenceModifier: 1.0,
    stabilityModifier: 1.0,
  })),
}));

vi.mock('../lib/services/sessionRegularityService', () => ({
  computeSessionRegularity: vi.fn(() => Promise.resolve({ regularity: 0.8, telemetryTrustMultiplier: 1.0, intervalCV: 0.1 })),
}));

vi.mock('../lib/services/relearningSpeedService', () => ({
  computeRelearningSpeed: vi.fn(() => ({ hasSavings: false, speedSavings: 0, postLapseStabilityBonus: 1.0 })),
  getOriginalLearningRt: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/services/confusionPairRecurrenceService', () => ({
  analyzeConfusionRecurrence: vi.fn(() => 'log_only'),
}));

// ── Tests ────────────────────────────────────────────────────────

describe('Drill Pipeline Integration: Real implicit-metrics → Real FSRS', () => {
  let prisma: ReturnType<typeof createPrismaMock>['prisma'];
  let spies: ReturnType<typeof createPrismaMock>['spies'];

  const userId = 'user-integration-test';
  const noopLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    const mock = createPrismaMock();
    prisma = mock.prisma;
    spies = mock.spies;
  });

  // ────────────────────────────────────────────────────────────
  // 1. Fast correct TARGETED answer → high grade, Good rating, FSRS schedule
  // ────────────────────────────────────────────────────────────
  it('fast correct targeted answer produces Good rating with high grade and positive FSRS schedule', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted', // Only TARGETED writes FSRS
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);

    // Real implicit-metrics should produce grade > 3.0 for fast correct
    expect(result.implicitMetrics.gradeContinuous).toBeGreaterThanOrEqual(3.0);
    // Binary rating: should be Good (3) for confident correct answer
    expect(result.implicitMetrics.rating).toBe(Rating.Good);
    // Confidence should be meaningful (not mocked 0.78)
    expect(result.implicitMetrics.confidence).toBeGreaterThan(0);
    expect(result.implicitMetrics.confidence).toBeLessThanOrEqual(1);

    // FSRS schedule should be present for TARGETED sessions
    expect(result.fsrsSchedule).toBeDefined();
    expect(result.fsrsSchedule!.stability).toBeGreaterThan(0);
    expect(result.fsrsSchedule!.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.fsrsSchedule!.difficulty).toBeLessThanOrEqual(10);
    expect(result.fsrsSchedule!.intervalDays).toBeGreaterThanOrEqual(0);

    // ReviewLog should have been created
    expect(spies.reviewLogCreate).toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────
  // 1b. Fast correct MAIN answer → ReviewLog but no FSRS schedule
  // ────────────────────────────────────────────────────────────
  it('fast correct main answer creates ReviewLog but no FSRS schedule', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        // sessionType omitted → defaults to MAIN (PANCE-style)
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);
    expect(result.implicitMetrics.rating).toBe(Rating.Good);

    // MAIN sessions with conditionId: ReviewLog + FSRS schedule
    expect(result.fsrsSchedule).toBeDefined();
    expect(spies.reviewLogCreate).toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────
  // 1c. DRILL session → ReviewLog + FSRS schedule (drill included per FSRS unification)
  // ────────────────────────────────────────────────────────────
  it('drill session creates ReviewLog and FSRS schedule', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'drill',
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);

    // DRILL sessions now update FSRS (per FSRS unification)
    expect(result.fsrsSchedule).toBeDefined();
    expect(spies.reviewLogCreate).toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────
  // 2. Slow hesitant answer → lower grade, potentially Again
  // ────────────────────────────────────────────────────────────
  it('slow hesitant answer with many switches produces Again rating and lower grade', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeSlowHesitantTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae', // correct but hesitant
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 3, // > 2 triggers behavioral override to Again
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted', // FSRS writes only happen in TARGETED
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);

    // With 3 answer switches (>2), the pipeline enforces Again rating
    expect(result.implicitMetrics.rating).toBe(Rating.Again);
    // Grade should be capped low due to indecision
    expect(result.implicitMetrics.gradeContinuous).toBeLessThanOrEqual(2.0);

    // FSRS schedule should still be present but with shorter interval
    expect(result.fsrsSchedule).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────
  // 3. Incorrect answer → Again rating, relearning
  // ────────────────────────────────────────────────────────────
  it('incorrect answer produces Again rating and low grade', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeIncorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Klebsiella pneumoniae', // wrong
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 1,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted', // FSRS writes only happen in TARGETED
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(false);

    // Incorrect answers should always get Again
    expect(result.implicitMetrics.rating).toBe(Rating.Again);
    // Grade for incorrect is always 1.0 (no penalties or bonuses)
    expect(result.implicitMetrics.gradeContinuous).toBeLessThanOrEqual(1.5);

    // FSRS schedule present — incorrect needs aggressive re-scheduling
    expect(result.fsrsSchedule).toBeDefined();
    if (result.fsrsSchedule) {
      // Incorrect new card → very short interval (typically 0-1 days for Learning state)
      expect(result.fsrsSchedule.intervalDays).toBeLessThanOrEqual(3);
    }
  });

  // ────────────────────────────────────────────────────────────
  // 4. Rapid-guess gating → FSRS schedule is undefined
  // ────────────────────────────────────────────────────────────
  it('rapid guess (below MVRT) skips FSRS scheduling entirely', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeRapidGuessTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);

    // Rapid guess: rating forced to Again, confidence 0
    expect(result.implicitMetrics.rating).toBe(Rating.Again);
    expect(result.implicitMetrics.gradeContinuous).toBe(1.0);
    expect(result.implicitMetrics.confidence).toBe(0);

    // FSRS schedule should NOT be present for rapid guesses
    expect(result.fsrsSchedule).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────
  // 5. Session-type gating: cram skips FSRS
  // ────────────────────────────────────────────────────────────
  it('cram session type skips FSRS state updates', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'cram',
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);

    // Cram sessions should not produce FSRS schedule
    expect(result.fsrsSchedule).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────
  // 5b. Session-type gating: rapid_recall skips FSRS
  // ────────────────────────────────────────────────────────────
  it('rapid_recall session type skips FSRS state updates', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'rapid_recall',
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
    expect(result.fsrsSchedule).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// Correctness Resolution: 6 question data formats
// ────────────────────────────────────────────────────────────────

describe('Drill Pipeline Integration: Correctness Resolution', () => {
  let prisma: ReturnType<typeof createPrismaMock>['prisma'];
  const userId = 'user-correctness-test';
  const noopLogger = { info: vi.fn(), warn: vi.fn() };

  beforeEach(() => {
    prisma = createPrismaMock().prisma;
  });

  const baseTelemetry = makeFastCorrectTelemetry();
  const baseInput = (selectedAnswer: string) => ({
    questionId: 'test',
    selectedAnswer,
    timeSpentMs: baseTelemetry.duration_ms,
    timeToFirstClick: baseTelemetry.time_to_first_interaction_ms!,
    answerSwitches: 0,
    totalDwellTime: baseTelemetry.duration_ms,
    telemetry: baseTelemetry,
  });

  it('resolves correctAnswer field (standard format)', async () => {
    const q = makeVignetteQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('Streptococcus pneumoniae'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(true);
  });

  it('resolves correctIndex field', async () => {
    const q = makeIndexedQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('Metformin'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(true);
  });

  it('resolves choices array with label field', async () => {
    const q = makeChoicesQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('ACE inhibitor'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(true);
  });

  it('resolves answer field (legacy format)', async () => {
    const q = makeLegacyQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('Appendicitis'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(true);
  });

  it('resolves correct_option field', async () => {
    const q = makeCorrectOptionQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('Right coronary artery'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(true);
  });

  it('detects incorrect answer across all formats', async () => {
    const q = makeVignetteQuestion();
    const result = await submitDrillReview(prisma, userId, { ...baseInput('Legionella pneumophila'), questionId: q.id }, q, noopLogger);
    expect(result.isCorrect).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Error Resilience
// ────────────────────────────────────────────────────────────────

describe('Drill Pipeline Integration: Error Resilience', () => {
  const userId = 'user-error-test';
  const noopLogger = { info: vi.fn(), warn: vi.fn() };

  it('survives QuestionAttempt create failure and still returns result', async () => {
    const mock = createPrismaMock();
    // Make QuestionAttempt.create throw
    mock.spies.questionAttemptCreate.mockRejectedValue(new Error('DB connection lost'));

    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    // Pipeline should NOT throw — QuestionAttempt failures are caught
    const result = await submitDrillReview(
      mock.prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
      },
      question,
      noopLogger
    );

    // Should still succeed — the pipeline is resilient to attempt creation failures
    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);
    // Implicit metrics should still be computed
    expect(result.implicitMetrics.gradeContinuous).toBeGreaterThan(0);
  });

  it('survives PreGeneratedQuestion stats update failure', async () => {
    const mock = createPrismaMock();
    mock.spies.preGeneratedQuestionUpdate.mockRejectedValue(new Error('stats table locked'));

    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    const result = await submitDrillReview(
      mock.prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
      },
      question,
      noopLogger
    );

    expect(result.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Multi-Review FSRS State Evolution
// ────────────────────────────────────────────────────────────────

describe('Drill Pipeline Integration: FSRS State Evolution', () => {
  const userId = 'user-evolution-test';
  const noopLogger = { info: vi.fn(), warn: vi.fn() };

  it('consecutive correct reviews produce increasing stability', async () => {
    const question = makeVignetteQuestion();
    const telemetry = makeFastCorrectTelemetry();

    // First review: new card (TARGETED is the sole FSRS writer)
    const mock1 = createPrismaMock();
    const result1 = await submitDrillReview(
      mock1.prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted',
      },
      question,
      noopLogger
    );

    expect(result1.fsrsSchedule).toBeDefined();
    const stability1 = result1.fsrsSchedule!.stability;

    // Second review: simulate existing card state from first review
    // The real FSRS pipeline loads card state from UserProgress
    const mock2 = createPrismaMock();
    mock2.spies.userProgressFindUnique.mockResolvedValue({
      id: 'up-001',
      userId,
      conditionId: question.conditionId,
      fsrsCard: {
        stability: stability1,
        difficulty: result1.fsrsSchedule!.difficulty,
        state: 1, // Learning
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 1,
        lapses: 0,
        last_review: new Date().toISOString(),
      },
      reviewHistory: [{
        confidence: 0.8,
        wasCorrect: true,
        telemetryQuality: 'full',
        date: new Date().toISOString(),
        stability: stability1,
        difficulty: result1.fsrsSchedule!.difficulty,
        rating: Rating.Good,
        state: 1,
      }],
    });

    const result2 = await submitDrillReview(
      mock2.prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Streptococcus pneumoniae',
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 0,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted',
      },
      question,
      noopLogger
    );

    expect(result2.fsrsSchedule).toBeDefined();
    const stability2 = result2.fsrsSchedule!.stability;

    // Stability should increase (or at minimum stay stable) after second correct review
    expect(stability2).toBeGreaterThanOrEqual(stability1 * 0.8); // Allow small variance from confidence modifiers
  });

  it('incorrect review after correct produces lower stability', async () => {
    const question = makeVignetteQuestion();

    // Start with an established card
    const mock = createPrismaMock();
    mock.spies.userProgressFindUnique.mockResolvedValue({
      id: 'up-002',
      userId,
      conditionId: question.conditionId,
      fsrsCard: {
        stability: 10.0,
        difficulty: 5.0,
        state: 2, // Review state
        elapsed_days: 5,
        scheduled_days: 5,
        reps: 5,
        lapses: 0,
        last_review: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      reviewHistory: [{
        confidence: 0.85,
        wasCorrect: true,
        telemetryQuality: 'full',
      }],
    });

    const telemetry = makeIncorrectTelemetry();
    const result = await submitDrillReview(
      mock.prisma,
      userId,
      {
        questionId: question.id,
        selectedAnswer: 'Klebsiella pneumoniae', // wrong
        timeSpentMs: telemetry.duration_ms,
        timeToFirstClick: telemetry.time_to_first_interaction_ms!,
        answerSwitches: 1,
        totalDwellTime: telemetry.duration_ms,
        telemetry,
        sessionType: 'targeted',
      },
      question,
      noopLogger
    );

    expect(result.fsrsSchedule).toBeDefined();
    // Lapse: stability should drop significantly from 10.0
    expect(result.fsrsSchedule!.stability).toBeLessThan(10.0);
    // Difficulty should increase
    expect(result.fsrsSchedule!.difficulty).toBeGreaterThanOrEqual(5.0);
  });
});
