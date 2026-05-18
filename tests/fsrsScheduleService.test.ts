/**
 * Tests for the shared FSRS scheduling helper (computeFSRSUpdate).
 *
 * Validates that:
 * - The helper returns correct result shape for correct/incorrect answers
 * - The confidence pipeline runs without error
 * - Scheduling produces reasonable intervals
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { computeFSRSUpdate } from '../lib/services/fsrsScheduleService';
import { FSRS } from '../lib/fsrs';

// ── Mock all external dependencies ───────────────────────────────────
const mockState = vi.hoisted(() => ({
  intervalFromStability: null as null | ((stability: number) => number),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function () {
    const self: any = {
      userProgress: { findUnique: vi.fn() },
      confusionPair: { findMany: vi.fn() },
      reviewLog: { findMany: vi.fn() },
      $disconnect: vi.fn(),
    };
    return self;
  }),
}));

vi.mock('../lib/fsrs', () => ({
  FSRS: vi.fn(function () {
    return {
      next: vi.fn().mockReturnValue({
        card: {
          stability: 5.0,
          difficulty: 5.0,
          state: 2,
          elapsed_days: 1,
          scheduled_days: 3,
          reps: 1,
          lapses: 0,
          last_review: new Date(),
        },
      }),
      calculateIntervalFromStability: vi.fn((stability: number) =>
        mockState.intervalFromStability?.(stability) ?? 3
      ),
      calculateRetrievability: vi.fn().mockReturnValue(0.9),
    };
  }),
  Rating: { Again: 1, Hard: 2, Good: 3, Easy: 4 },
}));

vi.mock('../lib/circadian', () => ({
  applyCircadianModifier: vi.fn((s: number) => s),
  buildCircadianContext: vi.fn(() => ({
    circadianPhase: 'NEUTRAL',
    stabilityModifier: 1.0,
    localHour: 14,
  })),
}));

vi.mock('../lib/implicit-metrics', () => ({
  confidenceStabilityMultiplier: vi.fn(() => 1.0),
  fluencyIllusionDampener: vi.fn(() => 1.0),
  assessTelemetryQuality: vi.fn(() => 'full'),
}));

vi.mock('../lib/fsrs/eorScheduler', () => ({
  applyEorClampIfNeeded: vi.fn((due: Date) => ({ due, clamped: false })),
}));

vi.mock('../lib/services/fsrsOptimizerService', () => ({
  getOptimizedParameters: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../lib/services/calibrationService', () => ({
  getUserCalibration: vi.fn(() => Promise.resolve({ dampenerFactor: 1.0 })),
}));

vi.mock('../lib/services/retrievabilityCalibrationService', () => ({
  getStabilityCorrectionFactor: vi.fn(() => Promise.resolve(1.0)),
}));

vi.mock('../lib/services/sessionRegularityService', () => ({
  computeSessionRegularity: vi.fn(() =>
    Promise.resolve({
      regularity: 'regular',
      intervalCV: 0.2,
      streakDays: 3,
      telemetryTrustMultiplier: 1.0,
    })
  ),
}));

vi.mock('../lib/services/relearningSpeedService', () => ({
  getOriginalLearningRt: vi.fn(() => Promise.resolve(null)),
  computeRelearningSpeed: vi.fn(() => ({
    hasSavings: false,
    savingsRatio: 0,
    postLapseStabilityBonus: 1.0,
  })),
}));

vi.mock('../lib/services/lapseSeverityService', () => ({
  computeLapseSeverity: vi.fn(() => ({
    severity: 'minor',
    difficultyMultiplier: 1.0,
    preLapseReps: 0,
    preLapseStability: 0,
  })),
}));

vi.mock('../lib/services/rtTrajectoryService', () => ({
  computeRtTrajectory: vi.fn(() => ({
    hasHistory: false,
    rtChangeRatio: 0,
    stabilityMultiplier: 1.0,
  })),
}));

vi.mock('../lib/services/sessionAccuracySlopeService', () => ({
  recordOutcome: vi.fn(),
  getConfidenceModifier: vi.fn(() => ({
    slope: 0,
    confidenceMultiplier: 1.0,
    rollingAccuracy: 0.5,
  })),
}));

vi.mock('../lib/services/intervalDeviationService', () => ({
  computeIntervalDeviation: vi.fn(() => ({
    deviationRatio: 1.0,
    informationMultiplier: 1.0,
    classification: 'on_schedule',
  })),
}));

vi.mock('../lib/services/sessionFatigueService', () => ({
  applyFatigueCorrection: vi.fn((t: number) => t),
  computeFatigueConfidenceDampener: vi.fn(() => 1.0),
}));

vi.mock('../lib/confidence/bayesianAccumulator', () => ({
  accumulateConfidence: vi.fn(() => ({ posterior: 0.78, priorWeight: 0.5 })),
}));

vi.mock('../lib/confidence/desirableDifficultyBonus', () => ({
  computeDesirableDifficultyBonus: vi.fn(() => ({ activated: false, multiplier: 1.0 })),
}));

vi.mock('../lib/confidence/interferenceDetector', () => ({
  detectInterference: vi.fn(() => ({
    discount: 1.0,
    detected: false,
    details: { interferingCount: 0, closestDistance: null, type: 'none' },
  })),
}));

// Store reference for per-test override
const { detectInterference } = await import('../lib/confidence/interferenceDetector');

vi.mock('../lib/confidence/trendDetector', () => ({
  detectConfidenceTrend: vi.fn(() => ({
    slope: 0,
    category: 'stable',
    trendMultiplier: 1.0,
    rSquared: 0,
  })),
}));

vi.mock('../lib/confidence/difficultyModulator', () => ({
  modulateDifficultyDelta: vi.fn(() => ({ modulatedDelta: 0, modulationFactor: 1.0 })),
}));

describe('computeFSRSUpdate', () => {
  const prisma = {
    userProgress: { findUnique: vi.fn() },
    confusionPair: { findMany: vi.fn() },
    reviewLog: { findMany: vi.fn() },
  } as any;

  const baseInput = {
    userId: 'user_123',
    questionId: 'q_456',
    conditionId: 'cond_789',
    system: 'CV',
    rating: 3 as any, // Rating.Good
    gradeContinuous: 3.0,
    implicitConfidence: 0.7,
    isCorrect: true,
    effectiveDurationMs: 25000,
    circadianContext: {
      circadianPhase: 'NEUTRAL',
      stabilityModifier: 1.0,
      localHour: 14,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no existing progress (new card)
    mockState.intervalFromStability = null;
    prisma.userProgress.findUnique.mockResolvedValue(null);
    prisma.confusionPair.findMany.mockResolvedValue([]);
    prisma.reviewLog.findMany.mockResolvedValue([]);
  });

  it('should return correct result shape for a correct answer', async () => {
    const result = await computeFSRSUpdate(prisma, baseInput);

    // Verify result has all expected fields
    expect(result).toHaveProperty('updatedCard');
    expect(result).toHaveProperty('previousCard');
    expect(result).toHaveProperty('clampedNextDue');
    expect(result).toHaveProperty('fsrsSchedule');
    expect(result).toHaveProperty('retrievability');
    expect(result).toHaveProperty('fsrs');
    expect(result).toHaveProperty('confidenceTelemetry');
    expect(result).toHaveProperty('reviewHistory');

    // Verify updated card has required FSRS fields
    expect(result.updatedCard).toHaveProperty('stability');
    expect(result.updatedCard).toHaveProperty('difficulty');
    expect(result.updatedCard).toHaveProperty('state');
    expect(result.updatedCard).toHaveProperty('scheduled_days');
    expect(result.updatedCard).toHaveProperty('reps');
    expect(result.updatedCard).toHaveProperty('lapses');
    expect(result.updatedCard).toHaveProperty('last_review');

    // Verify clampedNextDue is a Date in the future
    expect(result.clampedNextDue).toBeInstanceOf(Date);
    expect(result.clampedNextDue.getTime()).toBeGreaterThan(Date.now() - 1000);

    // Verify fsrsSchedule has the expected shape
    expect(result.fsrsSchedule).toHaveProperty('intervalDays');
    expect(result.fsrsSchedule).toHaveProperty('nextDueDate');
    expect(result.fsrsSchedule).toHaveProperty('stability');
    expect(result.fsrsSchedule).toHaveProperty('difficulty');

    // Verify retrievability is a number between 0 and 1
    expect(typeof result.retrievability).toBe('number');
    expect(result.retrievability).toBeGreaterThanOrEqual(0);
    expect(result.retrievability).toBeLessThanOrEqual(1);

    // Verify confidenceTelemetry is a non-empty object
    expect(result.confidenceTelemetry).toBeDefined();
    expect(typeof result.confidenceTelemetry).toBe('object');
  });

  it('should produce a valid schedule for an incorrect answer', async () => {
    const input = {
      ...baseInput,
      rating: 1 as any, // Rating.Again
      gradeContinuous: 1.0,
      implicitConfidence: 0.3,
      isCorrect: false,
    };

    const result = await computeFSRSUpdate(prisma, input);

    expect(result.updatedCard).toHaveProperty('stability');
    expect(result.updatedCard).toHaveProperty('difficulty');
    expect(result.clampedNextDue).toBeInstanceOf(Date);
    // Incorrect answers should have shorter intervals (re-learning)
    expect(result.fsrsSchedule.intervalDays).toBeLessThanOrEqual(30);
  });

  it('should load existing card state when progress exists', async () => {
    const existingProgress = {
      fsrsCard: {
        stability: 12.5,
        difficulty: 4.8,
        state: 2,
        elapsed_days: 5,
        scheduled_days: 10,
        reps: 3,
        lapses: 0,
        last_review: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      reviewHistory: [
        { confidence: 0.8, wasCorrect: true, telemetryQuality: 'full' },
      ],
    };

    prisma.userProgress.findUnique.mockResolvedValue(existingProgress);

    const result = await computeFSRSUpdate(prisma, baseInput);

    expect(prisma.userProgress.findUnique).toHaveBeenCalledWith({
      where: {
        userId_conditionId_progressContext: {
          userId: 'user_123',
          conditionId: 'cond_789',
          progressContext: 'READINESS',
        },
      },
    });

    // Should return valid result even with existing state
    expect(result.updatedCard).toHaveProperty('stability');
    expect(result.previousCard.stability).toBe(12.5);
  });

  it('should load targeted progress when progressContext is TARGETED', async () => {
    await computeFSRSUpdate(prisma, {
      ...baseInput,
      progressContext: 'TARGETED',
    });

    expect(prisma.userProgress.findUnique).toHaveBeenCalledWith({
      where: {
        userId_conditionId_progressContext: {
          userId: 'user_123',
          conditionId: 'cond_789',
          progressContext: 'TARGETED',
        },
      },
    });
  });

  it('should produce confidence telemetry with expected pipeline keys', async () => {
    const result = await computeFSRSUpdate(prisma, baseInput);

    const tel = result.confidenceTelemetry;
    // The confidence pipeline should include key stages
    expect(tel).toHaveProperty('raw_confidence');
    expect(tel).toHaveProperty('adjusted_confidence');
    expect(tel).toHaveProperty('final_stability');
    expect(tel).toHaveProperty('final_difficulty');
  });

  it('should recompute Review interval from final modified stability', async () => {
    mockState.intervalFromStability = (stability: number) => stability * 2;

    const result = await computeFSRSUpdate(prisma, baseInput);
    const fsrsInstance = vi.mocked(FSRS).mock.results[0]?.value as any;

    expect(fsrsInstance.calculateIntervalFromStability).toHaveBeenCalledWith(
      result.updatedCard.stability
    );
    expect(result.updatedCard.scheduled_days).toBe(result.updatedCard.stability * 2);
    expect(result.fsrsSchedule.intervalDays).toBe(Math.round(result.updatedCard.stability * 2));
  });

  it('should produce a non-null nextReviewDate for any valid input', async () => {
    const result = await computeFSRSUpdate(prisma, baseInput);

    // The key invariant: caller gets a usable next-review date
    expect(result.clampedNextDue).not.toBeNull();
    expect(result.clampedNextDue.getTime()).toBeGreaterThan(0);
    expect(result.fsrsSchedule.nextDueDate).toBeTruthy();
  });

  // ── Interference interval adjustment ──

  it('should not adjust interval when no interference detected', async () => {
    const result = await computeFSRSUpdate(prisma, baseInput);
    expect(result.confidenceTelemetry.interference_interval_multiplier).toBe(1.0);
    expect(result.confidenceTelemetry.interference_adjusted_interval_days).toBe(3);
  });

  it('should increase interval when same-condition interference detected', async () => {
    (detectInterference as any).mockReturnValueOnce({
      discount: 0.88,
      detected: true,
      details: { interferingCount: 2, closestDistance: 2, type: 'same_condition' },
    });

    const result = await computeFSRSUpdate(prisma, baseInput);
    expect(result.confidenceTelemetry.interference_interval_multiplier).toBeGreaterThan(1.0);
    // Interval should be pushed out
    expect(result.confidenceTelemetry.interference_adjusted_interval_days).toBeGreaterThan(3);
  });

  it('should moderately increase interval for confusion-pair interference', async () => {
    (detectInterference as any).mockReturnValueOnce({
      discount: 0.92,
      detected: true,
      details: { interferingCount: 1, closestDistance: 5, type: 'confusion_pair' },
    });

    const result = await computeFSRSUpdate(prisma, baseInput);
    expect(result.confidenceTelemetry.interference_interval_multiplier).toBeGreaterThan(1.0);
    // Same-condition gives bigger boost than confusion-pair at same distance
    // (tested implicitly — we just verify it's less than the max 1.8 cap)
    expect(result.confidenceTelemetry.interference_interval_multiplier).toBeLessThanOrEqual(1.8);
  });

  it('should include interference telemetry fields', async () => {
    const result = await computeFSRSUpdate(prisma, baseInput);
    expect(result.confidenceTelemetry).toHaveProperty('interference_interval_multiplier');
    expect(result.confidenceTelemetry).toHaveProperty('interference_adjusted_interval_days');
  });
});
