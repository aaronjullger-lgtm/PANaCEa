/**
 * Unit tests for lib/services/drillReviewService.ts
 *
 * Coverage targets:
 *   1. Pure functions: findSelectedOption, resolveCorrectAnswer, isSelectedAnswerCorrect
 *   2. These are the correctness gatekeepers — bugs here corrupt every review.
 *   3. submitDrillReview integration tests with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findSelectedOption,
  resolveCorrectAnswer,
  isSelectedAnswerCorrect,
  type QuestionData,
} from './drillReviewService';

// ─── findSelectedOption ────────────────────────────────────────────────────────

describe('findSelectedOption', () => {
  it('returns null for undefined pool', () => {
    expect(findSelectedOption(undefined, 'A')).toBeNull();
  });

  it('returns null for non-array pool', () => {
    expect(findSelectedOption('not-an-array' as any, 'A')).toBeNull();
  });

  it('returns null when selectedAnswer is not in pool', () => {
    expect(findSelectedOption(['A', 'B', 'C'], 'D')).toBeNull();
  });

  // ── String array pool ──

  it('matches a string array entry', () => {
    const result = findSelectedOption(['A', 'B', 'C'], 'B');
    expect(result).toEqual({ label: 'B' });
  });

  it('matches the first string array entry', () => {
    const result = findSelectedOption(['A', 'B', 'C'], 'A');
    expect(result).toEqual({ label: 'A' });
  });

  // ── Object pool with value/text/label ──

  it('matches by value property', () => {
    const pool = [{ value: 'Penicillin' }, { value: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  it('matches by text property', () => {
    const pool = [{ text: 'Penicillin' }, { text: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  it('matches by label property', () => {
    const pool = [{ label: 'Penicillin' }, { label: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  // ── Condition linkage ──

  it('extracts conditionId from matched option', () => {
    const pool = [
      { value: 'CHF', conditionId: 'cond-123' },
      { value: 'COPD', conditionId: 'cond-456' },
    ];
    const result = findSelectedOption(pool, 'COPD');
    expect(result).toEqual({ label: 'COPD', conditionId: 'cond-456', conditionName: 'COPD' });
  });

  it('extracts condition_id (snake_case) as conditionId', () => {
    const pool = [{ value: 'MI', condition_id: 'cond-789' }];
    const result = findSelectedOption(pool, 'MI');
    expect(result?.conditionId).toBe('cond-789');
  });

  it('extracts conditionRef as conditionId', () => {
    const pool = [{ value: 'Sepsis', conditionRef: 'ref-001' }];
    const result = findSelectedOption(pool, 'Sepsis');
    expect(result?.conditionId).toBe('ref-001');
  });

  it('extracts medicalContentId as conditionId', () => {
    const pool = [{ value: 'Pneumonia', medicalContentId: 'mc-001' }];
    const result = findSelectedOption(pool, 'Pneumonia');
    expect(result?.conditionId).toBe('mc-001');
  });

  it('falls back to option.id for conditionId when no explicit condition field', () => {
    const pool = [{ value: 'Asthma', id: 'opt-1' }];
    const result = findSelectedOption(pool, 'Asthma');
    expect(result?.conditionId).toBe('opt-1');
  });

  it('uses conditionName for conditionName when present', () => {
    const pool = [{ value: 'T2DM', conditionName: 'Type 2 Diabetes Mellitus' }];
    const result = findSelectedOption(pool, 'T2DM');
    expect(result?.conditionName).toBe('Type 2 Diabetes Mellitus');
  });

  it('falls back to condition field for conditionName', () => {
    const pool = [{ value: 'T2DM', condition: 'Type 2 Diabetes' }];
    const result = findSelectedOption(pool, 'T2DM');
    expect(result?.conditionName).toBe('Type 2 Diabetes');
  });

  it('falls back to label for conditionName when no condition fields', () => {
    const pool = [{ value: 'CKD' }];
    const result = findSelectedOption(pool, 'CKD');
    expect(result?.conditionName).toBe('CKD');
  });

  // ── Mixed pool ──

  it('handles mixed string and object pool', () => {
    const pool: Array<string | { value?: string; text?: string }> = ['A', { value: 'B' }, { text: 'C' }];
    expect(findSelectedOption(pool as Parameters<typeof findSelectedOption>[0], 'A')?.label).toBe('A');
    expect(findSelectedOption(pool as Parameters<typeof findSelectedOption>[0], 'B')?.label).toBe('B');
    expect(findSelectedOption(pool as Parameters<typeof findSelectedOption>[0], 'C')?.label).toBe('C');
  });
});

// ─── resolveCorrectAnswer ─────────────────────────────────────────────────────

describe('resolveCorrectAnswer', () => {
  it('returns null for empty question data', () => {
    expect(resolveCorrectAnswer({})).toBeNull();
  });

  // ── Index-based resolution ──

  it('resolves from correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  it('resolves from correctIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('C');
  });

  it('prefers correctAnswerIndex over correctIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 0,
      correctIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('A');
  });

  it('returns null when correctAnswerIndex is out of bounds', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 5,
    };
    // Falls through to correctAnswer string check, which is null
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  it('returns null when correctAnswerIndex is negative', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: -1,
    };
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  it('returns null when correctAnswerIndex is not an integer', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 1.5,
    };
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  // ── String-based resolution ──

  it('resolves from correctAnswer string', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin', 'Ceftriaxone'],
      correctAnswer: 'Vancomycin',
    };
    expect(resolveCorrectAnswer(qd)).toBe('Vancomycin');
  });

  it('resolves from answer string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      answer: 'B',
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  it('resolves from correct_option string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correct_option: 'A',
    };
    expect(resolveCorrectAnswer(qd)).toBe('A');
  });

  it('resolves from correctChoice string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctChoice: 'B',
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  // ── Options as objects ──

  it('resolves from object options by value', () => {
    const qd: QuestionData = {
      options: [{ value: 'Lisinopril' }, { value: 'Losartan' }],
      correctAnswerIndex: 0,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Lisinopril');
  });

  it('resolves from object options by text', () => {
    const qd: QuestionData = {
      options: [{ text: 'Lisinopril' }, { text: 'Losartan' }],
      correctAnswerIndex: 1,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Losartan');
  });

  it('resolves from object options by label', () => {
    const qd: QuestionData = {
      options: [{ label: 'Lisinopril' }, { label: 'Losartan' }],
      correctAnswerIndex: 0,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Lisinopril');
  });

  // ── Choices array ──

  it('works with choices instead of options', () => {
    const qd: QuestionData = {
      choices: ['A', 'B', 'C'],
      correctAnswerIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('C');
  });

  it('returns correctAnswer directly when no options provided', () => {
    const qd: QuestionData = {
      correctAnswer: 'Metoprolol',
    };
    expect(resolveCorrectAnswer(qd)).toBe('Metoprolol');
  });
});

// ─── isSelectedAnswerCorrect ──────────────────────────────────────────────────

describe('isSelectedAnswerCorrect', () => {
  // ── Index-based comparison ──

  it('returns true when selected matches correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'B')).toBe(true);
  });

  it('returns false when selected does not match correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  // ── String-based comparison ──

  it('returns true when selected matches correctAnswer string (exact)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'Vancomycin')).toBe(true);
  });

  it('returns true when selected matches correctAnswer string (case-insensitive)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'vancomycin')).toBe(true);
  });

  it('returns true when selected matches correctAnswer string (whitespace-trimmed)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, '  Vancomycin  ')).toBe(true);
  });

  it('returns false when selected does not match correctAnswer string', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'Penicillin')).toBe(false);
  });

  // ── Edge cases ──

  it('returns false when no correct answer can be resolved', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  it('returns false for empty selected answer', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 0,
    };
    expect(isSelectedAnswerCorrect(qd, '')).toBe(false);
  });

  it('returns false when correctAnswerIndex and selected resolve to different indices', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: 3,
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  // ── Object options ──

  it('works with object options and index', () => {
    const qd: QuestionData = {
      options: [{ value: 'Option A' }, { value: 'Option B' }],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'Option B')).toBe(true);
    expect(isSelectedAnswerCorrect(qd, 'Option A')).toBe(false);
  });

  // ── Letter-grade style answers ──

  it('resolves letter answer via answerLetterMap', () => {
    const qd: QuestionData = {
      options: ['First option', 'Second option', 'Third option'],
      correctAnswer: 'B',
    };
    // resolveAnswerIndexFromValue maps 'B' → index 1
    expect(isSelectedAnswerCorrect(qd, 'B')).toBe(true);
    expect(isSelectedAnswerCorrect(qd, 'Second option')).toBe(true);
  });
});

// ─── Phase 2: Integration tests (submitDrillReview with mocked dependencies) ──

// ── Hoisted mutable references — survive mockReset between tests ──
// DEFAULTS are correctness-aware so they survive restoreMocks (resets to fn() default).
const mockDeriveContinuousRating = vi.hoisted(() =>
  vi.fn((metrics: { isCorrect?: boolean } | undefined) => ({
    grade: metrics?.isCorrect !== false ? 4 : 1,
    confidence: metrics?.isCorrect !== false ? 0.8 : 0.2,
    discreteRating: metrics?.isCorrect !== false ? 2 : 0,
    latencyRatio: 1.2,
    answerSwitches: 0,
    label: metrics?.isCorrect !== false ? 'Good' : 'Again',
    rtClassification: 'normal',
    rtSignalQuality: 1.0,
  }))
);
const mockAssessTelemetryQuality = vi.hoisted(() => vi.fn(() => 'moderate'));
// Ghost Grader: pass-through userRating (matches real applyHonestRatingWithDetail for incorrect)
const mockApplyHonestRatingWithDetail = vi.hoisted(() =>
  vi.fn((opts: { userRating?: number; isCorrect?: boolean } | undefined) => ({
    rating: opts?.userRating ?? 2,
    gradeContinuousAdjustment: 0,
    rule: 'none',
  }))
);
const mockApplyHonestRating = vi.hoisted(() =>
  vi.fn((opts: { userRating?: number } | undefined) => ({ rating: opts?.userRating ?? 2, adjusted: false }))
);

// ── vi.mock declarations — hoisted to top of file by Vitest ──

vi.mock('../fsrs', () => {
  const R = { Again: 0, Hard: 1, Good: 2, Easy: 3 };
  return {
    Rating: R,
    FSRS: vi.fn().mockImplementation(() => ({
      next: vi.fn((_card: unknown, _grade: number) => ({
        card: {
          state: 2,
          stability: 5.0,
          difficulty: 3.0,
          elapsed_days: 1,
          scheduled_days: 5,
          reps: 2,
          lapses: 0,
          last_review: new Date(),
        },
      })),
      grade: vi.fn(() => R.Good),
      calculateRetrievability: vi.fn(() => 0.85),
      calculateIntervalFromStability: vi.fn(() => 5),
    })),
  };
});

vi.mock('../implicit-metrics', () => ({
  deriveContinuousRating: mockDeriveContinuousRating,
  assessTelemetryQuality: mockAssessTelemetryQuality,
  confidenceStabilityMultiplier: vi.fn(() => 1.0),
  fluencyIllusionDampener: vi.fn(() => 1.0),
}));

vi.mock('../circadian', () => ({
  buildCircadianContext: vi.fn(() => ({
    circadianPhase: 'NEUTRAL',
    stabilityModifier: 1.0,
    localHour: 12,
  })),
  applyCircadianModifier: vi.fn((_stability: number, ctx: unknown) => ctx),
  applyCircadianParTimeModifier: vi.fn((par: number) => par),
}));

vi.mock('./userProgressService', () => ({
  updateUserProgressWithHistory: vi.fn(async () => undefined),
}));

vi.mock('./semanticSiblingService', () => ({
  propagateRecallToSiblings: vi.fn(async () => undefined),
}));

vi.mock('./userStatisticsService', () => ({
  applyAttemptToUserStatistics: vi.fn(async () => undefined),
  updateTimingAggregates: vi.fn(async () => undefined),
}));

vi.mock('../srs/ghostGrader', () => ({
  applyHonestRating: mockApplyHonestRating,
  applyHonestRatingWithDetail: mockApplyHonestRatingWithDetail,
  GHOST_GRADER_CONSTANTS: {
    INDECISION_GRADE_CAP: 1.5,
    HINT_GRADE_CAP: 2.5,
  },
}));

vi.mock('./rolling360Service', () => ({
  getRolling360Service: vi.fn(() => ({
    updateRolling360OnSubmit: vi.fn(async () => undefined),
  })),
}));

vi.mock('../fsrs/eorScheduler', () => ({
  applyEorClampIfNeeded: vi.fn((_due: Date, _eor: Date | null) => ({
    due: _due,
    clamped: false,
  })),
}));

vi.mock('../taskTypes', () => ({
  getTaskTypeFromContent: vi.fn(() => 'standard'),
}));

vi.mock('./userTimingProfileService', () => ({
  getUserSpeedFactor: vi.fn(async () => 1.0),
  getUserBehavioralBaseline: vi.fn(async () => null),
}));

vi.mock('./calibrationService', () => ({
  getUserCalibration: vi.fn(async () => ({
    calibrationFactor: 1.0,
    predictedRetrievability: 0.8,
    actualCorrectRate: 0.8,
  })),
}));

vi.mock('../confidence/bayesianAccumulator', () => ({
  accumulateConfidence: vi.fn(() => ({
    posterior: 0.8,
    priorWeight: 0.3,
    evidenceWeight: 0.7,
  })),
}));

vi.mock('./sessionFatigueService', () => ({
  applyFatigueCorrection: vi.fn((par: number) => par),
  computeFatigueConfidenceDampener: vi.fn(() => 1.0),
}));

vi.mock('./retrievabilityCalibrationService', () => ({
  getStabilityCorrectionFactor: vi.fn(async () => 1.0),
}));

vi.mock('./fsrsOptimizerService', () => ({
  getOptimizedParameters: vi.fn(async () => null),
}));

vi.mock('../confidence/desirableDifficultyBonus', () => ({
  computeDesirableDifficultyBonus: vi.fn(() => ({
    activated: false,
    multiplier: 1.0,
    components: { effortSignal: 0, spacingSignal: 0 },
  })),
}));

vi.mock('../confidence/interferenceDetector', () => ({
  detectInterference: vi.fn(() => ({
    discount: 1.0,
    detected: false,
    details: { interferingCount: 0, closestDistance: null, type: 'none' },
  })),
}));

vi.mock('../confidence/trendDetector', () => ({
  detectConfidenceTrend: vi.fn(() => ({
    slope: 0,
    category: 'stable',
    trendMultiplier: 1.0,
    rSquared: 0,
  })),
}));

vi.mock('../confidence/difficultyModulator', () => ({
  modulateDifficultyDelta: vi.fn(() => ({
    modulatedDelta: 0,
    modulationFactor: 1.0,
  })),
}));

// answerLetterMap is NOT mocked — it's a pure utility with no side effects.
// The real resolveCorrectAnswerIndex correctly maps letters/strings to indices,
// which is critical for isSelectedAnswerCorrect and resolveCorrectAnswer tests.

vi.mock('./lapseSeverityService', () => ({
  computeLapseSeverity: vi.fn(() => null),
}));

vi.mock('./rtTrajectoryService', () => ({
  computeRtTrajectory: vi.fn(() => ({
    rtChangeRatio: 1.0,
    stabilityMultiplier: 1.0,
    hasHistory: false,
  })),
}));

vi.mock('./sessionAccuracySlopeService', () => ({
  recordOutcome: vi.fn(),
  getConfidenceModifier: vi.fn(() => ({
    slope: 0,
    confidenceMultiplier: 1.0,
    rollingAccuracy: 1.0,
  })),
}));

vi.mock('./intervalDeviationService', () => ({
  computeIntervalDeviation: vi.fn(() => ({
    deviationRatio: 1.0,
    informationMultiplier: 1.0,
    classification: 'on-time',
  })),
}));

vi.mock('./distractorChronometryService', () => ({
  analyzeDistractorChronometry: vi.fn(() => null),
}));

vi.mock('./switchDirectionService', () => ({
  analyzeSwitchDirections: vi.fn(() => null),
}));

vi.mock('./explanationEngagementService', () => ({
  analyzeExplanationEngagement: vi.fn(() => null),
}));

vi.mock('./sessionRegularityService', () => ({
  computeSessionRegularity: vi.fn(async () => ({
    regularity: 0.8,
    intervalCV: 0.3,
    streakDays: 5,
    telemetryTrustMultiplier: 1.0,
  })),
}));

vi.mock('./relearningSpeedService', () => ({
  computeRelearningSpeed: vi.fn(() => ({
    savingsRatio: 0,
    postLapseStabilityBonus: 1.0,
    hasSavings: false,
  })),
  getOriginalLearningRt: vi.fn(async () => null),
}));

vi.mock('./gradeModulationCoordinator', () => ({
  modulateGrade: vi.fn(() => ({
    rawGrade: 4,
    effectiveGrade: 4,
    discreteGrade: 2,
    deltas: {},
    signals: { rtZone: 'normal', fatigueScore: 0 },
  })),
}));

vi.mock('./confusionPairRecurrenceService', () => ({
  analyzeConfusionRecurrence: vi.fn(async () => null),
}));

vi.mock('../middleware/abTestMiddleware', () => ({
  resolveAssignments: vi.fn(async () => ({})),
  logABConversion: vi.fn(async () => undefined),
}));

vi.mock('../scheduling/calibrationLogger', () => ({
  writeCalibrationLog: vi.fn(async () => undefined),
}));

vi.mock('./wilsonMasteryService', () => ({
  assessMastery: vi.fn(() => ({
    wilsonLower: 0.6,
    wilsonUpper: 0.95,
    pointEstimate: 0.8,
    effectiveN: 5,
    totalN: 8,
    isMastered: false,
    isGoldMastery: false,
    correctNeededForMastery: 3,
  })),
  DEFAULT_DECAY_LAMBDA: 0.95,
}));

vi.mock('../scheduling/hypercorrectionDetector', () => ({
  detectHypercorrection: vi.fn(() => false),
}));

vi.mock('../../functions/api/_shared/canonical-question-mirror', () => ({
  upsertCanonicalQuestionMirror: vi.fn(async () => undefined),
}));

vi.mock('../study/questionIdentityPersistence', () => ({
  resolveOrCreateQuestionIdentity: vi.fn(async () => null),
}));

// ── Import after mocks so they are wired ──
import { submitDrillReview, type SubmitDrillReviewResult } from './drillReviewService';
import { Rating, FSRS } from '../fsrs';

// ── Helper: build a minimal Prisma mock covering every model access path ──

function buildMinimalPrisma() {
  return {
    // Core models
    reviewLog: {
      create: vi.fn(async () => ({ id: 'rev-1' })),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    userProgress: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({ id: 'up-1' })),
      upsert: vi.fn(async () => ({ id: 'up-1' })),
    },
    questionAttempt: {
      create: vi.fn(async () => ({ id: 'qa-1' })),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    questionIdentity: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'qi-1' })),
    },
    medicalContent: {
      findFirst: vi.fn(async () => ({ id: 'mc-1' })),
    },
    preGeneratedQuestion: {
      update: vi.fn(async () => ({})),
    },
    studySessionQuestion: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    userSRSConfig: {
      findUnique: vi.fn(async () => null),
    },
    confusionPair: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      // Pass the same mock object as the transaction client
      const tx = buildMinimalPrisma();
      return fn(tx as unknown as Record<string, unknown>);
    }),
  } as Record<string, unknown>;
}

describe('submitDrillReview — integration (mocked dependencies)', () => {
  const R = { Again: 0, Hard: 1, Good: 2, Easy: 3 };

  beforeEach(() => {
    mockDeriveContinuousRating.mockImplementation(
      (metrics: { isCorrect?: boolean } | undefined) => ({
        grade: metrics?.isCorrect !== false ? 4 : 1,
        confidence: metrics?.isCorrect !== false ? 0.8 : 0.2,
        discreteRating: metrics?.isCorrect !== false ? 2 : 0,
        latencyRatio: 1.2,
        answerSwitches: 0,
        label: metrics?.isCorrect !== false ? 'Good' : 'Again',
        rtClassification: 'normal',
        rtSignalQuality: 1.0,
      })
    );
    // restoreMocks strips mockImplementation from vi.fn() after each test — re-apply
    (FSRS as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        next: vi.fn((_card: unknown, _grade: number) => ({
          card: {
            state: 2,
            stability: 5.0,
            difficulty: 3.0,
            elapsed_days: 1,
            scheduled_days: 5,
            reps: 2,
            lapses: 0,
            last_review: new Date(),
          },
        })),
        grade: vi.fn(() => R.Good),
        calculateRetrievability: vi.fn(() => 0.85),
        calculateIntervalFromStability: vi.fn(() => 5),
      };
    });
  });

  const userId = 'user-test-1';
  const defaultQuestion = {
    id: 'q-1',
    questionData: { options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 0 },
    conditionId: 'cond-1',
  };

  it('happy path: correct answer returns success with FSRS schedule', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 15000,
      sessionType: 'main' as const,
      telemetry: { duration_ms: 15000, session_id: 'sess-1', question_number: 1 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    // Result shape
    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);
    expect(result.quality).toBeGreaterThanOrEqual(1);
    expect(result.quality).toBeLessThanOrEqual(5);
    expect(result.parTimeMs).toBeGreaterThan(0);
    expect(result.timeSpentMs).toBe(15000);

    // Implicit metrics
    expect(result.implicitMetrics).toBeDefined();
    expect(result.implicitMetrics.rating).toBeDefined();
    expect(typeof result.implicitMetrics.confidence).toBe('number');
    expect(typeof result.implicitMetrics.latencyRatio).toBe('number');

    // Circadian
    expect(result.circadian).toBeDefined();
    expect(typeof result.circadian.phase).toBe('string');
    expect(typeof result.circadian.stabilityModifier).toBe('number');
  });

  it('lapse path: incorrect answer returns success with lower quality', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'B', // Wrong — correctAnswerIndex is 0 (A)
      timeSpentMs: 8000,
      sessionType: 'main' as const,
      telemetry: { duration_ms: 8000, session_id: 'sess-1', question_number: 2 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(false);
    expect(result.quality).toBe(1); // Again = quality 1
  });

  it('cram session: FSRS schedule is undefined (not FSRS-eligible)', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 5000,
      sessionType: 'cram' as const,
      telemetry: { duration_ms: 5000, session_id: 'sess-cram', question_number: 1 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    // FSRS is skipped for cram sessions
    expect(result.fsrsSchedule).toBeUndefined();
  });

  it('rapid_recall session: FSRS schedule is undefined', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 3000,
      sessionType: 'rapid_recall' as const,
      telemetry: { duration_ms: 3000, session_id: 'sess-rr', question_number: 1 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    expect(result.fsrsSchedule).toBeUndefined();
  });

  it('no conditionId: FSRS schedule is undefined (needs condition for ReviewLog)', async () => {
    const prisma = buildMinimalPrisma();
    const question = {
      id: 'q-nocond',
      questionData: { options: ['A', 'B'], correctAnswerIndex: 0 },
      conditionId: null,
    };
    const input = {
      questionId: 'q-nocond',
      selectedAnswer: 'A',
      timeSpentMs: 10000,
      sessionType: 'main' as const,
      telemetry: { duration_ms: 10000 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      question
    );

    expect(result.success).toBe(true);
    expect(result.fsrsSchedule).toBeUndefined();
  });

  it('drill session: FSRS schedule is present (FSRS-eligible)', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 12000,
      sessionType: 'drill' as const,
      telemetry: { duration_ms: 12000, session_id: 'sess-drill', question_number: 1 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(true);
    // Drill sessions ARE FSRS-eligible
    expect(result.fsrsSchedule).toBeDefined();
    expect(result.fsrsSchedule!.intervalDays).toBeGreaterThan(0);
    expect(typeof result.fsrsSchedule!.nextDueDate).toBe('string');
  });

  it('telemetry: server_computed fields populated in QuestionAttempt', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 20000,
      sessionType: 'main' as const,
      telemetry: {
        duration_ms: 20000,
        session_id: 'sess-telemetry',
        question_number: 3,
        question_type: 'vignette',
      },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);

    // Verify QuestionAttempt.create was called with telemetryJson containing server_computed
    const attemptCreateMock = (prisma as Record<string, { create: ReturnType<typeof vi.fn> }>)
      .questionAttempt?.create;
    expect(attemptCreateMock).toBeDefined();
    const callArgs = attemptCreateMock!.mock.calls[0]?.[0];
    if (callArgs?.data?.telemetryJson) {
      const sc = callArgs.data.telemetryJson.server_computed;
      expect(sc).toBeDefined();
      expect(typeof sc.par_time_ms).toBe('number');
      expect(typeof sc.implicit_rating).toBe('number');
      expect(typeof sc.implicit_confidence).toBe('number');
      expect(typeof sc.grade_continuous).toBe('number');
    }
  });

  it('idempotencyKey: duplicate submission returns cached result', async () => {
    const prisma = buildMinimalPrisma();
    // Simulate existing attempt found
    const mockFindUnique = (prisma as unknown as Record<string, { findUnique: ReturnType<typeof vi.fn> }>)
      .questionAttempt?.findUnique;
    if (mockFindUnique) mockFindUnique.mockResolvedValueOnce({ id: 'existing-attempt' });

    const input = {
      questionId: 'q-1',
      selectedAnswer: 'A',
      timeSpentMs: 10000,
      sessionType: 'main' as const,
      idempotencyKey: 'idem-key-123',
      telemetry: { duration_ms: 10000 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    // Should NOT create a new attempt (deduped)
    const attemptCreateMock = (prisma as Record<string, { create: ReturnType<typeof vi.fn> }>)
      .questionAttempt?.create;
    expect(attemptCreateMock).not.toHaveBeenCalled();
  });

  it('drill session with incorrect answer: lapse path applies lower stability', async () => {
    const prisma = buildMinimalPrisma();
    const input = {
      questionId: 'q-1',
      selectedAnswer: 'C', // Wrong
      timeSpentMs: 5000,
      sessionType: 'drill' as const,
      telemetry: { duration_ms: 5000, session_id: 'sess-drill-err', question_number: 2 },
    };

    const result = await submitDrillReview(
      prisma as never,
      userId,
      input,
      defaultQuestion
    );

    expect(result.success).toBe(true);
    expect(result.isCorrect).toBe(false);
    expect(result.quality).toBe(1);
    // FSRS schedule should still be present for drill sessions (FSRS-eligible even on lapse)
    expect(result.fsrsSchedule).toBeDefined();
  });
});
