# DrillReviewService Unit Test Design

## Overview
This document contains the complete unit test suite for `submitDrillReview` covering the high‑fidelity FSRS data collection upgrade. The tests are written for Vitest (the project’s test runner) and assume the schema changes (`grade_continuous`, `implicit_confidence`, non‑null `retrievability`) have been applied.

## Test File Location
`tests/drillReviewService.test.ts`

## Mock Strategy
- PrismaClient mocked with `vi.fn()`
- FSRS, circadian, implicit‑metrics, ghostGrader, and other services mocked
- Each test sets up the mocks needed for its scenario

## Test Code

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FSRS, Rating } from '../lib/fsrs';
import { submitDrillReview } from '../lib/services/drillReviewService';
import type { SubmitDrillReviewInput } from '../lib/services/drillReviewService';
import { buildCircadianContext } from '../lib/circadian';
import { deriveContinuousRating } from '../lib/implicit-metrics';
import { applyHonestRating } from '../lib/srs/ghostGrader';
import { propagateRecallToSiblings } from '../lib/services/semanticSiblingService';
import { updateUserProgressWithHistory } from '../lib/services/userProgressService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from '../lib/services/userStatisticsService';
import { updateReviewOutcome } from '../lib/services/srsService';

// Mock all external dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    questionAttempt: { create: vi.fn() },
    reviewLog: { create: vi.fn() },
    userProgress: { findUnique: vi.fn(), update: vi.fn() },
    medicalContent: { findFirst: vi.fn() },
    confusionPair: { upsert: vi.fn() },
    $disconnect: vi.fn(),
  })),
}));

vi.mock('../lib/fsrs', () => ({
  FSRS: vi.fn(() => ({
    next: vi.fn(),
    calculateRetrievability: vi.fn(),
  })),
  Rating: {
    Again: 1,
    Hard: 2,
    Good: 3,
    Easy: 4,
  },
}));

vi.mock('../lib/circadian', () => ({
  buildCircadianContext: vi.fn(() => ({
    circadianPhase: 'NEUTRAL',
    stabilityModifier: 1.0,
    localHour: 14,
  })),
  applyCircadianModifier: vi.fn((stability) => stability),
}));

vi.mock('../lib/implicit-metrics', () => ({
  deriveContinuousRating: vi.fn(() => ({
    grade: 3.42,
    confidence: 0.78,
    discreteRating: Rating.Good,
  })),
  applyStabilityModifierFromGrade: vi.fn(() => 1.0),
}));

vi.mock('../lib/srs/ghostGrader', () => ({
  applyHonestRating: vi.fn(({ userRating }) => userRating),
}));

vi.mock('../lib/services/semanticSiblingService', () => ({
  propagateRecallToSiblings: vi.fn(() => []),
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
      (prisma.userProgress.findUnique as Mock).mockResolvedValue({
        fsrsCard,
      });
      const fsrsInstance = new FSRS();
      (fsrsInstance.next as Mock).mockReturnValue({
        card: { ...fsrsCard, stability: 15.0, difficulty: 0.28 },
      });
      (fsrsInstance.calculateRetrievability as Mock).mockReturnValue(0.85);

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

      // Verify QuestionAttempt creation
      expect(prisma.questionAttempt.create).toHaveBeenCalled();
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
        telemetry: { rapid_guess: true },
      };
      const question = { id: questionId, conditionId, questionData: {} };

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.reviewLog.create).not.toHaveBeenCalled();
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

      await submitDrillReview(prisma, userId, input, question);

      // Expect rating to be Good after override
      expect(applyHonestRating).toHaveBeenCalled();
      // Verify ReviewLog grade is Good (3)
      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade: Rating.Good,
          }),
        })
      );
    });

    it('should cap rating at Hard when answer switches > 2', async () => {
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

      expect(applyHonestRating).toHaveBeenCalledWith(
        expect.objectContaining({ userRating: Rating.Hard })
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
      const fsrsInstance = new FSRS();
      (fsrsInstance.calculateRetrievability as Mock).mockReturnValue(0.001);

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.reviewLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grade_continuous: 1.0,
            implicit_confidence: 0.5,
            stability: 0.01,
            retrievability: 0.001,
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
        },
      };

      // Mock medicalContent finds for correct and selected conditions
      (prisma.medicalContent.findFirst as Mock)
        .mockResolvedValueOnce({ id: 'correctId', condition: 'Hypertension', conditionId })
        .mockResolvedValueOnce({ id: 'selectedId', condition: 'Hypotension', conditionId: 'cond_888' });

      await submitDrillReview(prisma, userId, input, question);

      expect(prisma.confusionPair.upsert).toHaveBeenCalled();
    });
  });
});
```

## Next Steps
1. Review the test design for completeness.
2. Switch to **Code** mode to create the actual test file `tests/drillReviewService.test.ts`.
3. Run the tests (they will fail because the service does not yet populate the new columns).
4. Implement the required changes in `drillReviewService.ts`:
   - Compute retrievability using `fsrs.calculateRetrievability`
   - Add `grade_continuous` and `implicit_confidence` to the `reviewLog.create` data
5. Verify all tests pass.
6. Apply the schema migration (add columns) via a new Prisma migration.
7. Deploy the migration and updated service.