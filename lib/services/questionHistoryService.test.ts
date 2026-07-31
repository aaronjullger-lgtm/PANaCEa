/**
 * Tests for questionHistoryService — database "time travel" for temporal queries
 *
 * Mocks Prisma singleton and process.env.DATABASE_URL guard.
 * Tests all exported functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid to get deterministic IDs
vi.mock('uuid', () => ({ v4: () => 'test-uuid-001' }));

// Mock prisma singleton — use vi.hoisted so the reference survives hoisting
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    questionHistory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  saveQuestionVersion,
  getQuestionAtTime,
  getQuestionHistory,
  compareQuestionVersions,
  revertQuestionToVersion,
  getQuestionsModifiedInRange,
  getQuestionAuditTrail,
  pruneQuestionHistory,
} from '@/lib/services/questionHistoryService';

describe('questionHistoryService', () => {
  const origEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  describe('saveQuestionVersion', () => {
    it('creates version 1 for new question', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue(null);
      (mockPrisma.questionHistory.create as any).mockResolvedValue({});

      const version = await saveQuestionVersion('q-1', { stem: 'Test question' });

      expect(version).toBe(1);
      expect(mockPrisma.questionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionId: 'q-1',
            version: 1,
            questionData: { stem: 'Test question' },
          }),
        }),
      );
    });

    it('increments version when previous exists', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue({
        id: 'old-id',
        version: 3,
        validTo: null,
      });
      (mockPrisma.questionHistory.update as any).mockResolvedValue({});
      (mockPrisma.questionHistory.create as any).mockResolvedValue({});

      const version = await saveQuestionVersion('q-1', { stem: 'Updated' }, 'admin', 'Fix typo');

      expect(version).toBe(4);
      expect(mockPrisma.questionHistory.update).toHaveBeenCalledWith({
        where: { id: 'old-id' },
        data: { validTo: expect.any(Date) },
      });
      expect(mockPrisma.questionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 4,
            changedBy: 'admin',
            changeReason: 'Fix typo',
          }),
        }),
      );
    });

    it('does not close previous version if already has validTo', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue({
        id: 'old-id',
        version: 2,
        validTo: new Date('2024-01-01'),
      });
      (mockPrisma.questionHistory.create as any).mockResolvedValue({});

      const version = await saveQuestionVersion('q-1', { stem: 'New' });

      expect(version).toBe(3);
      expect(mockPrisma.questionHistory.update).not.toHaveBeenCalled();
    });

    it('returns 1 and skips DB when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const version = await saveQuestionVersion('q-1', { stem: 'Test' });
      expect(version).toBe(1);
      expect(mockPrisma.questionHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('getQuestionAtTime', () => {
    it('returns snapshot valid at given time', async () => {
      const ts = new Date('2024-06-15');
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue({
        questionId: 'q-1',
        version: 2,
        questionData: { stem: 'V2 stem' },
        changedBy: 'admin',
        changeReason: 'Updated',
        validFrom: new Date('2024-06-01'),
        validTo: null,
      });

      const result = await getQuestionAtTime('q-1', ts);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(2);
      expect(result!.questionData).toEqual({ stem: 'V2 stem' });
      expect(result!.changedBy).toBe('admin');
      expect(result!.changeReason).toBe('Updated');
    });

    it('returns null when no version found', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue(null);
      const result = await getQuestionAtTime('q-1', new Date());
      expect(result).toBeNull();
    });

    it('returns null when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await getQuestionAtTime('q-1', new Date());
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockRejectedValue(new Error('DB error'));
      const result = await getQuestionAtTime('q-1', new Date());
      expect(result).toBeNull();
    });
  });

  describe('getQuestionHistory', () => {
    it('returns full version history', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([
        {
          questionId: 'q-1',
          version: 1,
          questionData: { stem: 'V1' },
          changedBy: null,
          changeReason: null,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('2024-02-01'),
        },
        {
          questionId: 'q-1',
          version: 2,
          questionData: { stem: 'V2' },
          changedBy: 'admin',
          changeReason: 'Updated',
          validFrom: new Date('2024-02-01'),
          validTo: null,
        },
      ]);

      const result = await getQuestionHistory('q-1');
      expect(result).not.toBeNull();
      expect(result!.versions.length).toBe(2);
      expect(result!.currentVersion.version).toBe(2);
      expect(result!.currentVersion.questionData).toEqual({ stem: 'V2' });
    });

    it('returns null for non-existent question', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([]);
      const result = await getQuestionHistory('q-999');
      expect(result).toBeNull();
    });

    it('returns null when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await getQuestionHistory('q-1');
      expect(result).toBeNull();
    });
  });

  describe('compareQuestionVersions', () => {
    it('finds differences between two versions', async () => {
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 1,
          questionData: { stem: 'Old stem', options: ['A', 'B'] },
        })
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 2,
          questionData: { stem: 'New stem', options: ['A', 'B'] },
        });

      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).not.toBeNull();
      expect(result!.differences.length).toBe(1);
      expect(result!.differences[0]!.field).toBe('stem');
      expect(result!.differences[0]!.oldValue).toBe('Old stem');
      expect(result!.differences[0]!.newValue).toBe('New stem');
    });

    it('returns empty differences when versions are identical', async () => {
      const data = { stem: 'Same', options: ['A'] };
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce({ questionId: 'q-1', version: 1, questionData: data })
        .mockResolvedValueOnce({ questionId: 'q-1', version: 2, questionData: data });

      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).not.toBeNull();
      expect(result!.differences.length).toBe(0);
    });

    it('returns null when one version is missing', async () => {
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ questionId: 'q-1', version: 2, questionData: {} });

      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).toBeNull();
    });

    it('detects nested object differences', async () => {
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 1,
          questionData: { meta: { difficulty: 'easy', system: 'Cardiology' } },
        })
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 2,
          questionData: { meta: { difficulty: 'hard', system: 'Cardiology' } },
        });

      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).not.toBeNull();
      expect(result!.differences.length).toBe(1);
      expect(result!.differences[0]!.field).toBe('meta.difficulty');
      expect(result!.differences[0]!.oldValue).toBe('easy');
      expect(result!.differences[0]!.newValue).toBe('hard');
    });

    it('detects added and removed keys', async () => {
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 1,
          questionData: { stem: 'Test', oldField: 'removed' },
        })
        .mockResolvedValueOnce({
          questionId: 'q-1',
          version: 2,
          questionData: { stem: 'Test', newField: 'added' },
        });

      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).not.toBeNull();
      expect(result!.differences.length).toBe(2);
      const fields = result!.differences.map((d) => d.field);
      expect(fields).toContain('oldField');
      expect(fields).toContain('newField');
    });

    it('returns null when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await compareQuestionVersions('q-1', 1, 2);
      expect(result).toBeNull();
    });
  });

  describe('revertQuestionToVersion', () => {
    it('reverts to a previous version successfully', async () => {
      (mockPrisma.questionHistory.findFirst as any)
        .mockResolvedValueOnce({
          id: 'v1-id',
          version: 1,
          questionData: { stem: 'Original' },
        })
        .mockResolvedValueOnce(null); // for saveQuestionVersion's findFirst
      (mockPrisma.questionHistory.create as any).mockResolvedValue({});

      const result = await revertQuestionToVersion('q-1', 1, 'admin', 'Wrong answer');
      expect(result).toBe(true);
      expect(mockPrisma.questionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changedBy: 'admin',
            changeReason: 'Reverted to version 1: Wrong answer',
          }),
        }),
      );
    });

    it('returns false when target version does not exist', async () => {
      (mockPrisma.questionHistory.findFirst as any).mockResolvedValue(null);

      const result = await revertQuestionToVersion('q-1', 999, 'admin', 'Fix');
      expect(result).toBe(false);
    });

    it('returns false when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await revertQuestionToVersion('q-1', 1, 'admin', 'Fix');
      expect(result).toBe(false);
    });
  });

  describe('getQuestionsModifiedInRange', () => {
    it('returns grouped question counts in range', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([
        { questionId: 'q-1' },
        { questionId: 'q-1' },
        { questionId: 'q-2' },
      ]);

      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = await getQuestionsModifiedInRange(start, end);

      expect(result.length).toBe(2);
      const q1 = result.find((r) => r.questionId === 'q-1');
      expect(q1!.versions).toBe(2);
      const q2 = result.find((r) => r.questionId === 'q-2');
      expect(q2!.versions).toBe(1);
    });

    it('returns empty array when no modifications in range', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([]);
      const result = await getQuestionsModifiedInRange(new Date('2024-01-01'), new Date('2024-01-02'));
      expect(result).toEqual([]);
    });

    it('returns empty array when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const result = await getQuestionsModifiedInRange(new Date(), new Date());
      expect(result).toEqual([]);
    });
  });

  describe('getQuestionAuditTrail', () => {
    it('returns audit trail with change counts', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([
        {
          questionId: 'q-1',
          version: 1,
          questionData: { stem: 'V1' },
          changedBy: null,
          changeReason: null,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('2024-02-01'),
        },
        {
          questionId: 'q-1',
          version: 2,
          questionData: { stem: 'V2' },
          changedBy: 'admin',
          changeReason: 'Fix',
          validFrom: new Date('2024-02-01'),
          validTo: null,
        },
      ]);

      const trail = await getQuestionAuditTrail('q-1');
      expect(trail.length).toBe(2);
      expect(trail[0]!.changeCount).toBe(0);
      expect(trail[1]!.changeCount).toBe(1);
      expect(trail[1]!.changedBy).toBe('admin');
    });

    it('returns empty array for non-existent question', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([]);
      const trail = await getQuestionAuditTrail('q-999');
      expect(trail).toEqual([]);
    });

    it('returns empty array when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const trail = await getQuestionAuditTrail('q-1');
      expect(trail).toEqual([]);
    });
  });

  describe('pruneQuestionHistory', () => {
    it('deletes old versions beyond keepVersions', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ id: `old-${i}` })),
      );
      (mockPrisma.questionHistory.deleteMany as any).mockResolvedValue({ count: 5 });

      const deleted = await pruneQuestionHistory('q-1', 10);
      expect(deleted).toBe(5);
      expect(mockPrisma.questionHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: expect.arrayContaining(['old-0', 'old-4']) } },
      });
    });

    it('returns 0 when no versions to prune', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue([]);
      const deleted = await pruneQuestionHistory('q-1', 10);
      expect(deleted).toBe(0);
    });

    it('returns 0 when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      const deleted = await pruneQuestionHistory('q-1', 10);
      expect(deleted).toBe(0);
    });

    it('defaults to keeping 10 versions', async () => {
      (mockPrisma.questionHistory.findMany as any).mockResolvedValue(
        Array.from({ length: 2 }, (_, i) => ({ id: `old-${i}` })),
      );
      (mockPrisma.questionHistory.deleteMany as any).mockResolvedValue({ count: 2 });

      const deleted = await pruneQuestionHistory('q-1');
      expect(deleted).toBe(2);
    });
  });
});
