import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Set environment variable for API key
beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-api-key';
});

// Mock Google Generative AI first
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                hasMedicalErrors: false,
                issues: [],
                severity: 'none',
              }),
            },
          }),
        };
      }
    },
  };
});

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    stagingQuestion: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    preGeneratedQuestion: {
      create: vi.fn(),
    },
  },
}));

import { 
  saveToStaging, 
  runAdequacyCheck,
  getStagingStats,
} from '../services/stagingQuestionService';

// Import mocked prisma
import { prisma } from '../lib/prisma';

describe('Staging Question Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveToStaging', () => {
    it('should save question to staging with correct data', async () => {
      const questionData = {
        type: 'mcq',
        question: 'What is the most common cause of appendicitis?',
        correctAnswer: 'A',
        explanation: {
          rationale: 'This is a detailed explanation that is more than fifty words long to meet the adequacy check requirement for explanation length. It provides comprehensive medical information about the topic.',
        },
        system: 'GI',
        conditionId: 'appendicitis',
        difficulty: 'medium',
      };

      (prisma.stagingQuestion.create as any).mockResolvedValue({
        id: 'test-id',
        ...questionData,
      });

      const result = await saveToStaging(questionData);

      expect(prisma.stagingQuestion.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('test-id');
    });

    it('should count words in explanation', async () => {
      const questionData = {
        type: 'mcq',
        explanation: {
          rationale: 'This explanation has exactly ten words in it to test.',
        },
      };

      (prisma.stagingQuestion.create as any).mockResolvedValue({
        id: 'test-id',
        explanationLength: 10,
      });

      await saveToStaging(questionData);

      const call = (prisma.stagingQuestion.create as any).mock.calls[0][0];
      expect(call.data.aiGrade.explanationLength).toBe(10);
    });
  });

  describe('runAdequacyCheck', () => {
    it('should check question adequacy with correct answer and long explanation', async () => {
      const mockQuestion = {
        id: 'test-id',
        questionData: {
          question: 'Test question?',
          correctAnswer: 'A',
          explanation: {
            rationale: 'This is a very long explanation that contains more than fifty words which is the minimum requirement for the adequacy check to pass successfully. It provides detailed medical information and reasoning about why the answer is correct and why other options are incorrect. This ensures students understand the concept thoroughly.',
          },
        },
      };

      (prisma.stagingQuestion.findUnique as any).mockResolvedValue(mockQuestion);
      (prisma.stagingQuestion.update as any).mockResolvedValue({});

      const result = await runAdequacyCheck('test-id');

      // Basic checks that should always pass
      expect(result.hasCorrectAnswer).toBe(true);
      expect(result.explanationLength).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeGreaterThan(0);
      
      // With correct answer and long explanation, score should be at least 0.8
      // (0.4 for correct answer + 0.4 for explanation length)
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });

    it('should fail question with short explanation', async () => {
      const mockQuestion = {
        id: 'test-id',
        questionData: {
          question: 'Test question?',
          correctAnswer: 'A',
          explanation: {
            rationale: 'Short explanation.',
          },
        },
      };

      (prisma.stagingQuestion.findUnique as any).mockResolvedValue(mockQuestion);
      (prisma.stagingQuestion.update as any).mockResolvedValue({});

      const result = await runAdequacyCheck('test-id');

      expect(result.isValid).toBe(false);
      expect(result.explanationLength).toBeLessThan(50);
    });

    it('should fail question without correct answer', async () => {
      const mockQuestion = {
        id: 'test-id',
        questionData: {
          question: 'Test question?',
          correctAnswer: null,
          explanation: {
            rationale: 'This is a very long explanation that contains more than fifty words which is the minimum requirement for the adequacy check to pass. It provides detailed medical information.',
          },
        },
      };

      (prisma.stagingQuestion.findUnique as any).mockResolvedValue(mockQuestion);
      (prisma.stagingQuestion.update as any).mockResolvedValue({});

      const result = await runAdequacyCheck('test-id');

      expect(result.isValid).toBe(false);
      expect(result.hasCorrectAnswer).toBe(false);
    });
  });

  describe('getStagingStats', () => {
    it('should return statistics about staging queue', async () => {
      (prisma.stagingQuestion.count as any)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // pending
        .mockResolvedValueOnce(60) // passed
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(5) // flagged
        .mockResolvedValueOnce(55) // promoted
        .mockResolvedValueOnce(15); // discarded

      const stats = await getStagingStats();

      expect(stats.total).toBe(100);
      expect(stats.pending).toBe(20);
      expect(stats.passed).toBe(60);
      expect(stats.failed).toBe(10);
      expect(stats.flagged).toBe(5);
      expect(stats.promoted).toBe(55);
      expect(stats.discarded).toBe(15);
    });
  });
});
