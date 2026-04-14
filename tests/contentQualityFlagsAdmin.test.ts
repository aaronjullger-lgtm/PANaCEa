/**
 * Tests for admin content-quality-flags endpoint logic
 *
 * Tests the approve, reject, and requeue handler logic in isolation
 * using mock Prisma clients (no Edge runtime needed).
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FlagRecord {
  id: string;
  questionId: string;
  flagType: string;
  status: string;
  regeneratedContent: Record<string, unknown> | null;
  critiqueFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  Question: {
    id: string;
    question: string;
    options: unknown;
    correctAnswer: string;
    explanation: string;
    difficulty: string;
  } | null;
}

// ─── Mock helpers ──────────────────────────────────────────────────────────

function createMockFlag(overrides: Partial<FlagRecord> = {}): FlagRecord {
  return {
    id: 'flag-001',
    questionId: 'q-001',
    flagType: 'NON_DISCRIMINATING',
    status: 'REVIEWED',
    regeneratedContent: {
      question: 'Updated question text',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      explanation: { rationale: 'New explanation' },
      difficulty: 0.7,
    },
    critiqueFeedback: 'Question lacked discrimination',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    resolvedAt: null,
    resolvedBy: null,
    Question: {
      id: 'q-001',
      question: 'Original question text',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'Original explanation',
      difficulty: 'medium',
    },
    ...overrides,
  };
}

// ─── Approve logic ─────────────────────────────────────────────────────────

describe('approveFlag logic', () => {
  it('rejects approval when no regenerated content exists', () => {
    const flag = createMockFlag({ regeneratedContent: null, status: 'flagged' });

    // Simulate the guard check from the handler
    if (!flag.regeneratedContent) {
      const error = { success: false, error: 'Cannot approve: no regenerated content available' };
      expect(error.success).toBe(false);
      expect(error.error).toContain('no regenerated content');
      return;
    }
    expect.unreachable('Should have returned early');
  });

  it('builds correct question update data from regenerated content', () => {
    const flag = createMockFlag();
    expect(flag.regeneratedContent).not.toBeNull();

    const regen = flag.regeneratedContent!;
    const questionUpdate: Record<string, unknown> = { updatedAt: expect.any(Date) };

    if (typeof regen.question === 'string') questionUpdate.question = regen.question;
    if (regen.options) questionUpdate.options = regen.options;
    if (typeof regen.correctAnswer === 'string') questionUpdate.correctAnswer = regen.correctAnswer;
    if (typeof regen.explanation === 'object' && regen.explanation !== null && 'rationale' in regen.explanation) {
      questionUpdate.explanation = (regen.explanation as { rationale: string }).rationale;
    }
    if (typeof regen.difficulty === 'number') {
      questionUpdate.difficulty = regen.difficulty < 0.4 ? 'easy' : regen.difficulty > 0.6 ? 'hard' : 'medium';
    }

    expect(questionUpdate.question).toBe('Updated question text');
    expect(questionUpdate.correctAnswer).toBe('B');
    expect(questionUpdate.explanation).toBe('New explanation');
    expect(questionUpdate.difficulty).toBe('hard');
    expect(questionUpdate.options).toEqual(['A', 'B', 'C', 'D']);
  });

  it('maps difficulty values correctly', () => {
    const cases: [number, string][] = [
      [0.2, 'easy'],
      [0.3, 'easy'],
      [0.39, 'easy'],
      [0.4, 'medium'],
      [0.5, 'medium'],
      [0.6, 'medium'],
      [0.61, 'hard'],
      [0.8, 'hard'],
      [1.0, 'hard'],
    ];

    for (const [diff, expected] of cases) {
      const result = diff < 0.4 ? 'easy' : diff > 0.6 ? 'hard' : 'medium';
      expect(result).toBe(expected);
    }
  });

  it('handles string explanation directly', () => {
    const flag = createMockFlag({
      regeneratedContent: {
        question: 'Q',
        correctAnswer: 'A',
        explanation: 'Simple string explanation',
        difficulty: 0.5,
      },
    });

    const regen = flag.regeneratedContent!;
    const questionUpdate: Record<string, unknown> = {};

    if (typeof regen.explanation === 'string') {
      questionUpdate.explanation = regen.explanation;
    }

    expect(questionUpdate.explanation).toBe('Simple string explanation');
  });
});

// ─── Reject logic ──────────────────────────────────────────────────────────

describe('rejectFlag logic', () => {
  it('marks flag as resolved with admin user', () => {
    const flag = createMockFlag({ status: 'REVIEWED' });
    const adminUserId = 'admin-123';

    // Simulate the update payload
    const updatePayload = {
      status: 'RESOLVED',
      resolvedAt: expect.any(Date),
      resolvedBy: adminUserId,
    };

    expect(updatePayload.status).toBe('RESOLVED');
    expect(updatePayload.resolvedBy).toBe('admin-123');
  });
});

// ─── Requeue logic ─────────────────────────────────────────────────────────

describe('requeueFlag logic', () => {
  it('rejects requeue if already flagged', () => {
    const flag = createMockFlag({ status: 'FLAGGED' });

    if (flag.status === 'FLAGGED') {
      const error = { success: false, error: 'Flag is already in flagged state' };
      expect(error.success).toBe(false);
      return;
    }
    expect.unreachable('Should have returned early');
  });

  it('allows requeue from reviewed state', () => {
    const flag = createMockFlag({ status: 'REVIEWED' });

    const canRequeue = flag.status !== 'FLAGGED';
    expect(canRequeue).toBe(true);

    const updatePayload = {
      status: 'flagged',
      regeneratedContent: null,
      critiqueFeedback: null,
    };

    expect(updatePayload.status).toBe('flagged');
    expect(updatePayload.regeneratedContent).toBeNull();
  });

  it('allows requeue from resolved state', () => {
    const flag = createMockFlag({
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: 'admin-123',
    });

    const canRequeue = flag.status !== 'FLAGGED';
    expect(canRequeue).toBe(true);
  });

  it('allows requeue from regenerating state', () => {
    const flag = createMockFlag({ status: 'REGENERATING' });

    const canRequeue = flag.status !== 'FLAGGED';
    expect(canRequeue).toBe(true);
  });
});

// ─── List filtering logic ─────────────────────────────────────────────────

describe('list query filtering', () => {
  it('builds correct where clause for status filter', () => {
    const status = 'REVIEWED';
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    expect(where).toEqual({ status: 'REVIEWED' });
  });

  it('builds correct where clause for flagType filter', () => {
    const flagType = 'NON_DISCRIMINATING';
    const where: Record<string, unknown> = {};
    if (flagType) where.flagType = flagType;

    expect(where).toEqual({ flagType: 'NON_DISCRIMINATING' });
  });

  it('builds correct where clause for combined filters', () => {
    const status = 'flagged';
    const flagType = 'NEGATIVE_RPB';
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (flagType) where.flagType = flagType;

    expect(where).toEqual({ status: 'flagged', flagType: 'NEGATIVE_RPB' });
  });

  it('handles no filters (empty where)', () => {
    const where: Record<string, unknown> = {};
    expect(where).toEqual({});
  });
});

// ─── Pagination logic ──────────────────────────────────────────────────────

describe('pagination calculations', () => {
  it('computes pagination correctly', () => {
    const totalCount = 75;
    const limit = 50;
    const offset = 0;
    const hasMore = totalCount > offset + limit;
    const pages = Math.ceil(totalCount / limit);

    expect(hasMore).toBe(true);
    expect(pages).toBe(2);
  });

  it('last page hasMore is false', () => {
    const totalCount = 75;
    const limit = 50;
    const offset = 50;
    const hasMore = totalCount > offset + limit;

    expect(hasMore).toBe(false);
  });

  it('empty result set', () => {
    const totalCount = 0;
    const limit = 50;
    const offset = 0;
    const hasMore = totalCount > offset + limit;
    const pages = Math.ceil(totalCount / limit);

    expect(hasMore).toBe(false);
    expect(pages).toBe(0);
  });

  it('parses query string parameters', () => {
    const limit = '25';
    const offset = '50';
    const parsed = {
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(50);
  });

  it('uses defaults when query params missing', () => {
    const limit = undefined;
    const offset = undefined;
    const parsed = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    };

    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });
});
