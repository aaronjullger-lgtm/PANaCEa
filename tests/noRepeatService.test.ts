import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    userQuestionHistory: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    preGeneratedQuestion: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import {
  recordQuestionSeen,
  getUserSeenQuestions,
  fetchUnseenQuestions,
  getQuestionsWithNoRepeat,
  getRepositoryStats,
} from '../services/noRepeatService';

// Import mocked prisma
import { prisma } from '../lib/prisma';

describe('No-Repeat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordQuestionSeen', () => {
    it('should record a question as seen by user', async () => {
      (prisma.userQuestionHistory.upsert as any).mockResolvedValue({
        id: 'history-id',
        userId: 'user-1',
        questionId: 'q-1',
      });

      await recordQuestionSeen('user-1', 'q-1', {
        questionType: 'mcq',
        system: 'CV',
        wasCorrect: true,
      });

      expect(prisma.userQuestionHistory.upsert).toHaveBeenCalledWith({
        where: {
          userId_questionId: {
            userId: 'user-1',
            questionId: 'q-1',
          },
        },
        update: {
          isCorrect: true,
        },
        create: {
          userId: 'user-1',
          questionId: 'q-1',
          isCorrect: true,
        },
      });
    });
  });

  describe('getUserSeenQuestions', () => {
    it('should return list of seen question IDs', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([
        { questionId: 'q-1' },
        { questionId: 'q-2' },
        { questionId: 'q-3' },
      ]);

      const seenQuestions = await getUserSeenQuestions('user-1');

      expect(seenQuestions).toEqual(['q-1', 'q-2', 'q-3']);
    });

    it('should filter by system when provided', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([
        { questionId: 'q-1' },
      ]);

      await getUserSeenQuestions('user-1', { system: 'CV' });

      const call = (prisma.userQuestionHistory.findMany as any).mock.calls[0][0];
      expect(call.where.system).toBe('CV');
    });
  });

  describe('fetchUnseenQuestions', () => {
    it('should fetch questions user has not seen', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([
        { questionId: 'q-1' },
        { questionId: 'q-2' },
      ]);

      (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
        { id: 'q-3', system: 'CV' },
        { id: 'q-4', system: 'CV' },
      ]);

      const questions = await fetchUnseenQuestions('user-1', { system: 'CV' }, 10);

      expect(questions).toHaveLength(2);
      expect(questions[0].id).toBe('q-3');

      const call = (prisma.preGeneratedQuestion.findMany as any).mock.calls[0][0];
      expect(call.where.id.notIn).toContain('q-1');
      expect(call.where.id.notIn).toContain('q-2');
    });

    it('should prioritize unused questions', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([]);
      (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([]);

      await fetchUnseenQuestions('user-1', {}, 10);

      const call = (prisma.preGeneratedQuestion.findMany as any).mock.calls[0][0];
      expect(call.where.usedAt).toBeNull();
    });
  });

  describe('getQuestionsWithNoRepeat', () => {
    it('should return database questions when available', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([]);
      (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([
        { id: 'q-1' },
        { id: 'q-2' },
        { id: 'q-3' },
      ]);

      const result = await getQuestionsWithNoRepeat('user-1', { system: 'CV' }, 3);

      expect(result.questions).toHaveLength(3);
      expect(result.source).toBe('database');
      expect(result.generated).toBe(0);
    });

    it('should indicate generation needed when no questions available', async () => {
      (prisma.userQuestionHistory.findMany as any).mockResolvedValue([]);
      (prisma.preGeneratedQuestion.findMany as any).mockResolvedValue([]);

      const result = await getQuestionsWithNoRepeat('user-1', { system: 'CV' }, 10);

      expect(result.questions).toHaveLength(0);
      expect(result.needsGeneration).toBe(true);
      expect(result.generationNeeded).toBe(10);
    });
  });

  describe('getRepositoryStats', () => {
    it('should return golden repository statistics', async () => {
      (prisma.preGeneratedQuestion.count as any)
        .mockResolvedValueOnce(5000) // total
        .mockResolvedValueOnce(1200); // unseen

      (prisma.preGeneratedQuestion.groupBy as any).mockResolvedValue([
        { system: 'CV', _count: 1000 },
        { system: 'PULM', _count: 800 },
        { system: 'GI', _count: 700 },
      ]);

      const stats = await getRepositoryStats();

      expect(stats.totalQuestions).toBe(5000);
      expect(stats.unseenByAnyUser).toBe(1200);
      expect(stats.systemBreakdown).toHaveLength(3);
      expect(stats.message).toContain('5000 vetted questions');
    });

    it('should show message when repository is empty', async () => {
      (prisma.preGeneratedQuestion.count as any).mockResolvedValue(0);
      (prisma.preGeneratedQuestion.groupBy as any).mockResolvedValue([]);

      const stats = await getRepositoryStats();

      expect(stats.totalQuestions).toBe(0);
      expect(stats.message).toContain('Start building');
    });
  });
});
