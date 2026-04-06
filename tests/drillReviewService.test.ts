import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FSRS, Rating } from '../lib/fsrs';
import { submitDrillReview } from '../lib/services/drillReviewService';
import type { SubmitDrillReviewInput } from '../lib/services/drillReviewService';
import { buildCircadianContext } from '../lib/circadian';
import { deriveContinuousRating } from '../lib/implicit-metrics';
import { applyHonestRating, applyHonestRatingWithDetail } from '../lib/srs/ghostGrader';
import { propagateRecallToSiblings } from '../lib/services/semanticSiblingService';
import { updateUserProgressWithHistory } from '../lib/services/userProgressService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from '../lib/services/userStatisticsService';
import { updateReviewOutcome } from '../lib/services/srsService';

// Mock all external dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function() {
    const self: any = {
      questionAttempt: { create: vi.fn(), findFirst: vi.fn() },
      reviewLog: { create: vi.fn(), findMany: vi.fn() },
      userProgress: { findUnique: vi.fn(), update: vi.fn() },
      medicalContent: { findFirst: vi.fn() },
      confusionPair: { upsert: vi.fn(), findMany: vi.fn() },
      preGeneratedQuestion: { update: vi.fn() },
      card: { upsert: vi.fn() },
      userTopicProgress: { upsert: vi.fn() },
      $transaction: vi.fn(function(fn: Function) { return fn(self); }),
      $disconnect: vi.fn(),
    };
    return self;
  }),
}));

// Track current FSRS instance for tests
let currentFsrsInstance: any;

vi.mock('../lib/fsrs', () => ({
  FSRS: vi.fn(function() {
    currentFsrsInstance = {
      next: vi.fn().mockReturnValue({ card: { stability: 0, difficulty: 0, state: 0 } }),
      calculateRetrievability: vi.fn().mockReturnValue(0),
    };
    return currentFsrsInstance;
  }),
  Rating: {
    Again: 1,
    Hard: 2,
    Good: 3,
    Easy: 4,
  },
}));

vi.mock('../lib/circadian', () => ({
  buildCircadianContext: vi.fn(function() {
    return {
      circadianPhase: 'NEUTRAL',
      stabilityModifier: 1.0,
      localHour: 14,
    };
  }),
  applyCircadianModifier: vi.fn(function(stability) { return stability; }),
  applyCircadianParTimeModifier: vi.fn(function(parTimeMs) { return parTimeMs; }),
}));

vi.mock('../lib/implicit-metrics', () => ({
  deriveContinuousRating: vi.fn(function() {
    return {
      grade: 3.42,
      confidence: 0.78,
      discreteRating: Rating.Good,
    };
  }),
  applyStabilityModifierFromGrade: vi.fn(function() { return 1.0; }),
  assessTelemetryQuality: vi.fn(function() { return 'full'; }),
  confidenceStabilityMultiplier: vi.fn(function() { return 1.0; }),
  fluencyIllusionDampener: vi.fn(function() { return 1.0; }),
}));

vi.mock('../lib/srs/ghostGrader', () => ({
  applyHonestRating: vi.fn(function({ userRating }) { return userRating; }),
  applyHonestRatingWithDetail: vi.fn(function({ userRating }) {
    return { rating: userRating, rule: 'none', gradeContinuousAdjustment: 0 };
  }),
  GHOST_GRADER_CONSTANTS: { INDECISION_GRADE_CAP: 1.5 },
}));

vi.mock('../lib/services/semanticSiblingService', () => ({
  propagateRecallToSiblings: vi.fn(function() { return []; }),
}));

vi.mock('../lib/services/userProgressService', () => ({
  updateUserProgressWithHistory: vi.fn(),
}));

vi.mock('../lib/services/userStatisticsService', () => ({
  applyAttemptToUserStatistics: vi.fn(),
  updateTimingAggregates: vi.fn(),
}));

vi.mock('../lib/services/srsService', () => ({
  updateReviewOutcome: vi.fn(),
}));

vi.mock('../lib/taskTypes', () => ({
  getTaskTypeFromContent: vi.fn(function() { return 'diagnosis'; }),
}));

vi.mock('../lib/services/userTimingProfileService', () => ({
  getUserSpeedFactor: vi.fn(function() { return Promise.resolve(1.0); }),
  getUserBehavioralBaseline: vi.fn(function() { return Promise.resolve(null); }),
}));

vi.mock('../lib/services/sessionFatigueService', () => ({
  applyFatigueCorrection: vi.fn(function(parTimeMs) { return parTimeMs; }),
  computeFatigueConfidenceDampener: vi.fn(function() { return 1.0; }),
}));

vi.mock('../lib/services/rolling360Service', () => ({
  getRolling360Service: vi.fn(function() {
    return { updateRolling360OnSubmit: vi.fn() };
  }),
}));

vi.mock('../lib/fsrs/eorScheduler', () => ({
  applyEorClampIfNeeded: vi.fn(function(due) { return { due, clamped: false }; }),
}));

// Mocks for services used by fsrsScheduleService (extracted helper)
vi.mock('../lib/services/fsrsOptimizerService', () => ({
  getOptimizedParameters: vi.fn(function() { return Promise.resolve(undefined); }),
}));

vi.mock('../lib/services/calibrationService', () => ({
  getUserCalibration: vi.fn(function() { return Promise.resolve({ dampenerFactor: 1.0 }); }),
}));

vi.mock('../lib/services/retrievabilityCalibrationService', () => ({
  getStabilityCorrectionFactor: vi.fn(function() { return Promise.resolve(1.0); }),
}));

vi.mock('../lib/services/sessionRegularityService', () => ({
  computeSessionRegularity: vi.fn(function() { return Promise.resolve({ regularity: 'regular', intervalCV: 0.2, streakDays: 3, telemetryTrustMultiplier: 1.0 }); }),
}));

vi.mock('../lib/services/relearningSpeedService', () => ({
  getOriginalLearningRt: vi.fn(function() { return Promise.resolve(null); }),
  computeRelearningSpeed: vi.fn(function() { return { hasSavings: false, savingsRatio: 0, postLapseStabilityBonus: 1.0 }; }),
}));

vi.mock('../lib/services/lapseSeverityService', () => ({
  computeLapseSeverity: vi.fn(function() { return { severity: 'minor', difficultyMultiplier: 1.0, preLapseReps: 0, preLapseStability: 0 }; }),
}));

vi.mock('../lib/services/rtTrajectoryService', () => ({
  computeRtTrajectory: vi.fn(function() { return { hasHistory: false, rtChangeRatio: 0, stabilityMultiplier: 1.0 }; }),
}));

vi.mock('../lib/services/sessionAccuracySlopeService', () => ({
  recordOutcome: vi.fn(),
  getConfidenceModifier: vi.fn(function() { return { slope: 0, confidenceMultiplier: 1.0, rollingAccuracy: 0.5 }; }),
}));

vi.mock('../lib/services/intervalDeviationService', () => ({
  computeIntervalDeviation: vi.fn(function() { return { deviationRatio: 1.0, informationMultiplier: 1.0, classification: 'on_schedule' }; }),
}));

vi.mock('../lib/confidence/bayesianAccumulator', () => ({
  accumulateConfidence: vi.fn(function() { return { posterior: 0.78, priorWeight: 0.5 }; }),
}));

vi.mock('../lib/confidence/desirableDifficultyBonus', () => ({
  computeDesirableDifficultyBonus: vi.fn(function() { return { activated: false, multiplier: 1.0 }; }),
}));

vi.mock('../lib/confidence/interferenceDetector', () => ({
  detectInterference: vi.fn(function() { return { discount: 1.0, detected: false, details: { interferingCount: 0, closestDistance: null, type: 'none' } }; }),
}));

vi.mock('../lib/confidence/trendDetector', () => ({
  detectConfidenceTrend: vi.fn(function() { return { slope: 0, category: 'stable', trendMultiplier: 1.0, rSquared: 0 }; }),
}));

vi.mock('../lib/confidence/difficultyModulator', () => ({
  modulateDifficultyDelta: vi.fn(function() { return { modulatedDelta: 0, modulationFactor: 1.0 }; }),
}));

vi.mock('../lib/utils/questionComplexity', () => ({
  calculateParTime: vi.fn(function() { return 30000; }),
}));

vi.mock('../../types/telemetry', () => ({
  getMVRTThreshold: vi.fn(function() { return 2000; }),
}));

describe('submitDrillReview', () => {
  let prisma: PrismaClient;
  const userId = 'user_123';
  const questionId = 'q_456';
  const conditionId = 'cond_789';
  const medicalContentId = 'med_999';

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
  });

  describe('Happy Path – Main Session with Condition ID', () => {
    it('should create ReviewLog with float columns and compute retrievability', async () => {
      // Arrange
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Correct Answer',
        timeSpentMs: 25000,
        timeToFirstClick: 5000,
        answerSwitches: 0,
        sessionType: 'main',
        telemetry: {
          duration_ms: 25000,
          time_to_first_interaction_ms: 5000,
          rapid_guess: false,
        },
      };

      const question = {
        id: questionId,
        conditionId,
        medicalContentId,
        system: 'CV',
        questionData: {
          options: [
            { value: 'Correct Answer', text: 'Correct' },
            { value: 'Wrong Answer', text: 'Wrong' },
          ],
          correctAnswer: 'Correct Answer',
        },
      };

      // Mock FSRS card data
      const fsrsCard = {
        stability: 12.5,
        difficulty: 0.3,
        state: 2,
        elapsed_days: 5.0,
        scheduled_days: 10.0,
        reps: 3,
        lapses: 0,
        last_review: new Date(Date.now() - 5 * 86400000),
      };
      (prisma.userProgress.findUnique as Mock).mockImplementation(() => {
        console.log('userProgress.findUnique called');
        return Promise.resolve({ fsrsCard });
      });
      (prisma.medicalContent.findFirst as Mock).mockResolvedValue({ conditionId, system: 'CV' });
      (prisma.questionAttempt.findFirst as Mock).mockResolvedValue(null); // No existing attempt
      (prisma.questionAttempt.create as Mock).mockResolvedValue({ id: 'attempt_123' });
      (prisma.reviewLog.create as Mock).mockImplementation((args) => {
        console.log('reviewLog.create called with', args);
        return Promise.resolve({});
      });
      // Mock FSRS instance
      const fsrsInstance = {
        next: vi.fn(),
        calculateRetrievability: vi.fn(),
      };
      vi.mocked(FSRS).mockImplementation(function() { return fsrsInstance; });
      fsrsInstance.next.mockReturnValue({
        card: { ...fsrsCard, stability: 15.0, difficulty: 0.28 },
      });
      fsrsInstance.calculateRetrievability.mockReturnValue(0.85);

      // Act
      const result = await submitDrillReview(prisma, userId, input, question);

      // Assert
      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(result.implicitMetrics.gradeContinuous).toBe(3.42);
      expect(result.implicitMetrics.confidence).toBe(0.78);

      // Verify ReviewLog creation with new float columns
      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade: Rating.Good,
            grade_continuous: 3.42,
            implicit_confidence: 0.78,
            stability: 12.5,
            difficulty: 0.3,
            retrievability: 0.85, // computed
          }),
        })
      );

      expect(fsrsInstance.next).toHaveBeenCalled();
      expect(fsrsInstance.calculateRetrievability).toHaveBeenCalled();

      // Verify QuestionAttempt creation
      expect(prisma.questionAttempt.create).toHaveBeenCalled();
    });
  
    describe('Peer validation statistics', () => {
      it('should increment timesServed and timesCorrect when answer is correct', async () => {
        // Arrange
        const input: SubmitDrillReviewInput = {
          questionId,
          selectedAnswer: 'Correct Answer',
          timeSpentMs: 25000,
          timeToFirstClick: 5000,
          answerSwitches: 0,
          sessionType: 'main',
          telemetry: {
            duration_ms: 25000,
            time_to_first_interaction_ms: 5000,
            rapid_guess: false,
          },
        };
  
        const question = {
          id: questionId,
          conditionId,
          medicalContentId,
          system: 'CV',
          questionData: {
            options: [
              { value: 'Correct Answer', text: 'Correct' },
              { value: 'Wrong Answer', text: 'Wrong' },
            ],
            correctAnswer: 'Correct Answer',
          },
        };
  
        // Mock dependencies
        (prisma.userProgress.findUnique as Mock).mockResolvedValue({ fsrsCard: null });
        (prisma.medicalContent.findFirst as Mock).mockResolvedValue({ conditionId, system: 'CV' });
        (prisma.questionAttempt.findFirst as Mock).mockResolvedValue(null); // No existing attempt
        (prisma.questionAttempt.create as Mock).mockResolvedValue({ id: 'attempt_123' });
        (prisma.reviewLog.create as Mock).mockResolvedValue({});
        vi.mocked(FSRS).mockImplementation(() => ({
          next: vi.fn().mockReturnValue({ card: {} }),
          calculateRetrievability: vi.fn().mockReturnValue(0.85),
        }));
        vi.mocked(deriveContinuousRating).mockReturnValue({
          grade: 3.42,
          confidence: 0.78,
          discreteRating: Rating.Good,
        });
  
        // Act
        await submitDrillReview(prisma, userId, input, question);
  
        // Assert
        expect(prisma.preGeneratedQuestion.update).toHaveBeenCalledWith({
          where: { id: questionId },
          data: {
            timesServed: { increment: 1 },
            timesCorrect: { increment: 1 },
          },
        });
      });
  
      it('should increment timesServed and timesIncorrect when answer is incorrect', async () => {
        const input: SubmitDrillReviewInput = {
          questionId,
          selectedAnswer: 'Wrong Answer',
          timeSpentMs: 25000,
          timeToFirstClick: 5000,
          answerSwitches: 0,
          sessionType: 'main',
          telemetry: {
            duration_ms: 25000,
            time_to_first_interaction_ms: 5000,
            rapid_guess: false,
          },
        };
  
        const question = {
          id: questionId,
          conditionId,
          medicalContentId,
          system: 'CV',
          questionData: {
            options: [
              { value: 'Correct Answer', text: 'Correct' },
              { value: 'Wrong Answer', text: 'Wrong' },
            ],
            correctAnswer: 'Correct Answer',
          },
        };
  
        // Mock dependencies (same as above)
        (prisma.userProgress.findUnique as Mock).mockResolvedValue({ fsrsCard: null });
        (prisma.medicalContent.findFirst as Mock).mockResolvedValue({ conditionId, system: 'CV' });
        (prisma.questionAttempt.findFirst as Mock).mockResolvedValue(null); // No existing attempt
        (prisma.questionAttempt.create as Mock).mockResolvedValue({ id: 'attempt_123' });
        (prisma.reviewLog.create as Mock).mockResolvedValue({});
        vi.mocked(FSRS).mockImplementation(() => ({
          next: vi.fn().mockReturnValue({ card: {} }),
          calculateRetrievability: vi.fn().mockReturnValue(0.85),
        }));
        vi.mocked(deriveContinuousRating).mockReturnValue({
          grade: 1.5,
          confidence: 0.5,
          discreteRating: Rating.Again,
        });
  
        await submitDrillReview(prisma, userId, input, question);
  
        expect(prisma.preGeneratedQuestion.update).toHaveBeenCalledWith({
          where: { id: questionId },
          data: {
            timesServed: { increment: 1 },
            timesIncorrect: { increment: 1 },
          },
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should skip ReviewLog for cram sessions', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 30000,
        sessionType: 'cram',
      };
      const question = { id: questionId, conditionId, questionData: {} };

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.reviewLog.create).not.toHaveBeenCalled();
      expect(prisma.questionAttempt.create).toHaveBeenCalled();
    });

    it('should skip ReviewLog for rapid‑recall sessions', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 30000,
        sessionType: 'rapid_recall',
      };
      const question = { id: questionId, conditionId, questionData: {} };

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    });

    it('should handle rapid guess (duration < 500ms)', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 300,
        telemetry: { duration_ms: 300, rapid_guess: true },
      };
      const question = { id: questionId, conditionId, questionData: {} };

      await submitDrillReview(prisma, userId, input, question);

      // DEV-001: Rapid guess should create ReviewLog but skip FSRS state updates
      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade: 1, // Rating.Again
            grade_continuous: 1.0,
            review_type: 'rapid_guess',
            state: 0,
            stability: 0,
            difficulty: 0,
            retrievability: 0,
            telemetry: expect.objectContaining({
              server_computed: expect.objectContaining({
                rapid_guess: true,
                implicit_confidence: expect.any(Number),
              }),
            }),
          }),
        })
      );

      // Verify FSRS state update was NOT called for rapid guess
      expect(updateUserProgressWithHistory).not.toHaveBeenCalled();

      expect(prisma.questionAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telemetryJson: expect.objectContaining({
              server_computed: expect.objectContaining({ is_rapid_guess: true }),
            }),
          }),
        })
      );
    });

    it('should not call FSRS.next() for rapid guesses', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 250,
        telemetry: { duration_ms: 250, rapid_guess: true },
      };
      const question = { id: questionId, conditionId, questionData: {} };

      // Set up mocks
      (prisma.questionAttempt.findFirst as Mock).mockResolvedValue(null); // No existing attempt
      (prisma.reviewLog.create as Mock).mockResolvedValue({});
      (prisma.questionAttempt.create as Mock).mockResolvedValue({ id: 'attempt_123' });

      const fsrsBeforeCount = (FSRS as Mock).mock.calls.length;
      await submitDrillReview(prisma, userId, input, question);

      // Verify FSRS was never instantiated for rapid guess
      expect((FSRS as Mock).mock.calls.length).toBe(fsrsBeforeCount);
    });

    it('should skip FSRS when conditionId is missing', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 30000,
      };
      const question = { id: questionId, conditionId: null, questionData: {} };

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.reviewLog.create).not.toHaveBeenCalled();
      expect(prisma.questionAttempt.create).toHaveBeenCalled();
    });

    it('should apply behavioral overrides (slow response)', async () => {
      // Override rating from Easy to Good
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Correct Answer',
        timeSpentMs: 60000, // > parTime * 1.5 (parTime assumed 30000)
        telemetry: { duration_ms: 60000 },
      };
      const question = {
        id: questionId,
        conditionId,
        questionData: { correctAnswer: 'Correct Answer' },
      };

      // Mock deriveContinuousRating to return Easy initially
      (deriveContinuousRating as Mock).mockReturnValueOnce({
        grade: 4.0,
        confidence: 0.8,
        discreteRating: Rating.Easy,
      });

      // Mock FSRS and required database calls
      (prisma.userProgress.findUnique as Mock).mockResolvedValue({
        fsrsCard: {
          stability: 10.0,
          difficulty: 0.5,
          state: 2,
          elapsed_days: 5.0,
          scheduled_days: 10.0,
          reps: 3,
          lapses: 0,
          last_review: new Date(Date.now() - 5 * 86400000),
        },
      });
      (prisma.medicalContent.findFirst as Mock).mockResolvedValue({ conditionId, system: 'CV' });
      const fsrsInstance = {
        next: vi.fn(),
        calculateRetrievability: vi.fn(),
      };
      vi.mocked(FSRS).mockImplementation(function() { return fsrsInstance; });
      fsrsInstance.next.mockReturnValue({
        card: {
          stability: 10.0,
          difficulty: 0.5,
          state: 2,
          elapsed_days: 5.0,
          scheduled_days: 10.0,
          reps: 3,
          lapses: 0,
          last_review: new Date(Date.now() - 5 * 86400000),
        },
      });
      fsrsInstance.calculateRetrievability.mockReturnValue(0.85);

      await submitDrillReview(prisma, userId, input, question);

      // Expect rating to be Good after override
      expect(applyHonestRatingWithDetail).toHaveBeenCalled();
      // Verify ReviewLog grade is Good (3)
      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade: Rating.Good,
          }),
        })
      );
    });

    it('should cap rating at Again when answer switches > 2 (binary system)', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Correct Answer',
        timeSpentMs: 20000,
        answerSwitches: 3,
      };
      const question = {
        id: questionId,
        conditionId,
        questionData: { correctAnswer: 'Correct Answer' },
      };

      (deriveContinuousRating as Mock).mockReturnValueOnce({
        grade: 4.0,
        confidence: 0.8,
        discreteRating: Rating.Easy,
      });

      await submitDrillReview(prisma, userId, input, question);

      // Binary system: Easy(4)→Good(3) normalize, switches>2→Again(1)
      expect(applyHonestRatingWithDetail).toHaveBeenCalledWith(
        expect.objectContaining({ userRating: Rating.Again })
      );
    });

    it('should store extreme float values correctly', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Correct Answer',
        timeSpentMs: 1000,
      };
      const question = {
        id: questionId,
        conditionId,
        questionData: { correctAnswer: 'Correct Answer' },
      };

      // Mock extreme grade and confidence
      (deriveContinuousRating as Mock).mockReturnValueOnce({
        grade: 1.0,
        confidence: 0.5,
        discreteRating: Rating.Again,
      });

      // Mock extreme stability and elapsed days
      (prisma.userProgress.findUnique as Mock).mockResolvedValue({
        fsrsCard: {
          stability: 0.01,
          difficulty: 0.9,
          state: 2,
          elapsed_days: 365,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          last_review: new Date(),
        },
      });
      // Mock FSRS instance
      const fsrsInstance = {
        next: vi.fn(),
        calculateRetrievability: vi.fn(),
      };
      vi.mocked(FSRS).mockImplementation(function() { return fsrsInstance; });
      fsrsInstance.next.mockReturnValue({
        card: {
          stability: 0.01,
          difficulty: 0.9,
          state: 2,
          elapsed_days: 365,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          last_review: new Date(),
        },
      });
      fsrsInstance.calculateRetrievability.mockReturnValue(0.001);

      await submitDrillReview(prisma, userId, input, question);

      // With timeSpentMs=1000 (< MVRT 2000ms), this hits the rapid-guess path.
      // Rapid guesses read live card state (Improvement 3) and set grade to Again.
      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade: Rating.Again,
            grade_continuous: 1.0,
            stability: 0.01,
          }),
        })
      );
    });

    it('should handle missing telemetry gracefully', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Answer',
        timeSpentMs: 15000,
        // no telemetry object
      };
      const question = { id: questionId, conditionId, questionData: {} };

      await expect(
        submitDrillReview(prisma, userId, input, question)
      ).resolves.not.toThrow();

      expect(prisma.questionAttempt.create).toHaveBeenCalled();
    });

    it('should record confusion pair when incorrect answer matches another condition', async () => {
      const input: SubmitDrillReviewInput = {
        questionId,
        selectedAnswer: 'Wrong Answer',
        timeSpentMs: 20000,
      };
      const question = {
        id: questionId,
        conditionId,
        medicalContentId,
        questionData: {
          correctAnswer: 'Correct Answer',
          condition: 'Hypertension',
          options: [
            { value: 'Correct Answer', text: 'Correct', conditionId, condition: 'Hypertension', conditionName: 'Hypertension' },
            { value: 'Wrong Answer', text: 'Wrong', conditionId: 'cond_888', condition: 'Hypotension', conditionName: 'Hypotension' },
          ],
        },
      };

      // Mock medicalContent finds for correct and selected conditions
      (prisma.medicalContent.findFirst as Mock)
        .mockResolvedValueOnce({ id: 'correctId', condition: 'Hypertension', conditionId })
        .mockResolvedValueOnce({ id: 'selectedId', condition: 'Hypotension', conditionId: 'cond_888' });
      // Mock userProgress for FSRS
      (prisma.userProgress.findUnique as Mock).mockResolvedValue({
        fsrsCard: {
          stability: 12.5,
          difficulty: 0.3,
          state: 2,
          elapsed_days: 5.0,
          scheduled_days: 10.0,
          reps: 3,
          lapses: 0,
          last_review: new Date(Date.now() - 5 * 86400000),
        },
      });
      // Mock FSRS instance
      const fsrsInstance = {
        next: vi.fn(),
        calculateRetrievability: vi.fn(),
      };
      vi.mocked(FSRS).mockImplementation(function() { return fsrsInstance; });
      fsrsInstance.next.mockReturnValue({
        card: {
          stability: 15.0,
          difficulty: 0.28,
          state: 2,
          elapsed_days: 5.0,
          scheduled_days: 10.0,
          reps: 3,
          lapses: 0,
          last_review: new Date(),
        },
      });
      fsrsInstance.calculateRetrievability.mockReturnValue(0.85);
      // Mock questionAttempt creation
      (prisma.questionAttempt.findFirst as Mock).mockResolvedValue(null); // No existing attempt
      (prisma.questionAttempt.create as Mock).mockResolvedValue({ id: 'attempt_123' });

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.confusionPair.upsert).toHaveBeenCalled();
    });
  });
});