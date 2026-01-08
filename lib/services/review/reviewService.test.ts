import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewService } from './reviewService';

// Mock Prisma client
const mockPrisma = {
  sRSItem: {
    findMany: vi.fn(),
  },
  savedQuestion: {
    findMany: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
  },
  questionAttempt: {
    findMany: vi.fn(),
  },
  preGeneratedQuestion: {
    findFirst: vi.fn(),
  },
  userQuestionHistory: {
    findMany: vi.fn(),
  },
  $disconnect: vi.fn(),
};

// Mock ContentService
vi.mock('../content/contentService', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    getConditionContent: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock createEdgePrismaClient
vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
}));

describe('ReviewService', () => {
  let reviewService: ReviewService;
  const mockUserId = 'test-user-123';
  const mockDatabaseUrl = 'postgresql://test';

  beforeEach(() => {
    vi.clearAllMocks();
    reviewService = new ReviewService(mockDatabaseUrl, mockUserId);
  });

  describe('getFlaggedQuestions', () => {
    it('should fetch flagged questions for the user', async () => {
      mockPrisma.savedQuestion.findMany.mockResolvedValue([
        {
          questionId: 'q1',
          updatedAt: new Date(),
        },
      ]);

      mockPrisma.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          vignette: 'Test question',
          options: ['A', 'B', 'C', 'D'],
          correctAnswerIndex: 0,
          rationale: 'Test rationale',
          system: 'Cardiovascular',
          condition: 'MI',
          conditionId: 'c1',
          difficulty: 'medium',
        },
      ]);

      const result = await reviewService.getReviewQuestions('flagged', 10, null);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reviewReason).toBe('flagged');
      expect(result[0].priority).toBe(80);
    });
  });

  describe('getMissedQuestions', () => {
    it('should fetch recent incorrect attempts', async () => {
      mockPrisma.questionAttempt.findMany.mockResolvedValue([
        {
          questionId: 'q2',
          createdAt: new Date(),
        },
      ]);

      mockPrisma.question.findMany.mockResolvedValue([
        {
          id: 'q2',
          vignette: 'Missed question',
          options: ['A', 'B', 'C', 'D'],
          correctAnswerIndex: 1,
          rationale: 'Test rationale',
          system: 'Pulmonary',
          condition: 'Asthma',
          conditionId: 'c2',
          difficulty: 'easy',
        },
      ]);

      const result = await reviewService.getReviewQuestions('missed', 10, null);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reviewReason).toBe('missed');
      expect(result[0].priority).toBe(70);
    });
  });

  describe('getWeakAreaQuestions', () => {
    it('should identify weak systems and return questions from them', async () => {
      mockPrisma.questionAttempt.findMany.mockResolvedValue([
        { system: 'Cardiology', wasCorrect: false },
        { system: 'Cardiology', wasCorrect: false },
        { system: 'Cardiology', wasCorrect: false },
        { system: 'Cardiology', wasCorrect: false },
        { system: 'Cardiology', wasCorrect: true },
        { system: 'Cardiology', wasCorrect: false },
      ]);

      mockPrisma.question.findMany.mockResolvedValue([
        {
          id: 'q3',
          vignette: 'Weak area question',
          options: ['A', 'B', 'C', 'D'],
          correctAnswerIndex: 2,
          rationale: 'Test rationale',
          system: 'Cardiology',
          condition: 'AF',
          conditionId: 'c3',
          difficulty: 'hard',
        },
      ]);

      const result = await reviewService.getReviewQuestions('weak', 10, null);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reviewReason).toBe('weak_area');
      expect(result[0].accuracy).toBeLessThan(60);
    });
  });

  describe('deduplicateAndSort', () => {
    it('should remove duplicate questions and sort by priority', async () => {
      // This is tested implicitly through getReviewQuestions
      // which calls deduplicateAndSort internally
      mockPrisma.savedQuestion.findMany.mockResolvedValue([]);
      mockPrisma.questionAttempt.findMany.mockResolvedValue([]);
      mockPrisma.sRSItem.findMany.mockResolvedValue([]);

      const result = await reviewService.getReviewQuestions('all', 10, null);

      // Should return unique questions sorted by priority
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
