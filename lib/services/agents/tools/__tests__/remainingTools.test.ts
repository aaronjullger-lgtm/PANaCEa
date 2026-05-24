/**
 * Remaining Tool Integration Tests
 *
 * Covers the 5 tools that don't have dedicated test files:
 * contentHealthAudit, questionQualityCheck, databaseIntegrityCheck,
 * fsrsCalibrationStatus, drillCoverageCheck.
 *
 * Uses mocked Prisma for data-dependent logic verification.
 */

import { describe, it, expect, vi } from 'vitest';
import { contentHealthAuditTool } from '../contentHealthAudit';
import { questionQualityCheckTool } from '../questionQualityCheck';
import { databaseIntegrityCheckTool } from '../databaseIntegrityCheck';
import { fsrsCalibrationStatusTool } from '../fsrsCalibrationStatus';
import { drillCoverageCheckTool } from '../drillCoverageCheck';

// ─── contentHealthAudit ─────────────────────────────────────────────────────

describe('contentHealthAudit — Input Validation', () => {
  const tool = contentHealthAuditTool;

  it('accepts valid input', () => {
    expect(() => tool.inputSchema.parse({})).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({ system: 'Cardiovascular', healthThreshold: 0.7, limit: 10 })
    ).not.toThrow();
  });

  it('rejects healthThreshold > 1', () => {
    expect(() => tool.inputSchema.parse({ healthThreshold: 1.5 })).toThrow();
  });

  it('rejects healthThreshold < 0', () => {
    expect(() => tool.inputSchema.parse({ healthThreshold: -1 })).toThrow();
  });
});

describe('contentHealthAudit — Execution', () => {
  it('returns correct metrics with mock data', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn()
          .mockResolvedValueOnce(1000)  // total
          .mockResolvedValueOnce(120)   // below threshold
          .mockResolvedValueOnce(45)    // flagged
          .mockResolvedValueOnce(15),   // needs review
        aggregate: vi.fn().mockResolvedValue({
          _avg: { contentHealthScore: 0.72 },
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'q1', contentHealthScore: 0.3, system: 'CV', question: 'What is...' },
          { id: 'q2', contentHealthScore: 0.35, system: 'PULM', question: 'Which test...' },
        ]),
        groupBy: vi.fn().mockResolvedValue([
          { system: 'CV', _count: { id: 200 }, _avg: { contentHealthScore: 0.65 } },
          { system: 'PULM', _count: { id: 180 }, _avg: { contentHealthScore: 0.71 } },
        ]),
      },
    };

    const result = await contentHealthAuditTool.execute(
      { limit: 2 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.totalQuestions).toBe(1000);
    expect(result.belowThreshold).toBe(120);
    expect(result.flaggedCount).toBe(45);
    expect(result.needsReviewCount).toBe(15);
    expect(result.averageHealthScore).toBe(0.72);
    expect(result.worstOffenders).toHaveLength(2);
    expect(result.bySystem.CV).toBeDefined();
  });

  it('handles zero questions gracefully', async () => {
    const mockPrisma = {
      question: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _avg: { contentHealthScore: null } }),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await contentHealthAuditTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.totalQuestions).toBe(0);
    expect(result.belowThresholdPercent).toBe(0);
    expect(result.worstOffenders).toHaveLength(0);
  });
});

// ─── questionQualityCheck ───────────────────────────────────────────────────

describe('questionQualityCheck — Input Validation', () => {
  const tool = questionQualityCheckTool;

  it('accepts valid input', () => {
    expect(() => tool.inputSchema.parse({ questionId: 'q-123' })).not.toThrow();
    expect(() => tool.inputSchema.parse({ minAttempts: 50 })).not.toThrow();
  });

  it('rejects minAttempts < 5', () => {
    expect(() => tool.inputSchema.parse({ minAttempts: 3 })).toThrow();
  });

  it('rejects minAttempts > 100', () => {
    expect(() => tool.inputSchema.parse({ minAttempts: 101 })).toThrow();
  });
});

describe('questionQualityCheck — Execution', () => {
  it('detects too-easy questions (difficulty < 0.15)', async () => {
    const mockPrisma = {
      questionAttempt: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 30 }, (_, i) => ({
            isCorrect: i < 28, // 93% correct → difficulty 0.07
            timeSpentMs: 2000,
            answerSwitches: 0,
          }))
        ),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: 'q-1' }]),
      },
    };

    const result = await questionQualityCheckTool.execute(
      { questionId: 'q-1' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.results[0]!.needsRefinement).toBe(true);
    const hasTooEasy = result.results[0]!.issues.some((i) =>
      i.startsWith('too_easy')
    );
    expect(hasTooEasy).toBe(true);
  });

  it('detects high switch rate', async () => {
    const mockPrisma = {
      questionAttempt: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 30 }, (_, i) => ({
            isCorrect: i < 15,
            timeSpentMs: 5000,
            answerSwitches: 3,
          }))
        ),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: 'q-2' }]),
      },
    };

    const result = await questionQualityCheckTool.execute(
      { questionId: 'q-2' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.results[0]!.needsRefinement).toBe(true);
    const hasHighSwitches = result.results[0]!.issues.some((i) =>
      i.startsWith('high_switches')
    );
    expect(hasHighSwitches).toBe(true);
  });

  it('includes summary in result', async () => {
    const mockPrisma = {
      questionAttempt: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 30 }, () => ({
            isCorrect: Math.random() > 0.5,
            timeSpentMs: 2000,
            answerSwitches: 1,
          }))
        ),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      question: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: 'q-3' }]),
      },
    };

    const result = await questionQualityCheckTool.execute(
      { questionId: 'q-3' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.summary).toContain('analyzed');
  });
});

// ─── databaseIntegrityCheck ─────────────────────────────────────────────────

describe('databaseIntegrityCheck — Input Validation', () => {
  const tool = databaseIntegrityCheckTool;

  it('accepts orphans check type', () => {
    expect(() => tool.inputSchema.parse({ checkType: 'orphans' })).not.toThrow();
  });

  it('accepts full check type', () => {
    expect(() => tool.inputSchema.parse({ checkType: 'all' })).not.toThrow();
  });

  it('accepts empty input', () => {
    expect(() => tool.inputSchema.parse({})).not.toThrow();
  });
});

describe('databaseIntegrityCheck — Execution', () => {
  it('returns healthy when no orphans found', async () => {
    const mockPrisma = {
      questionAttempt: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      reviewLog: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      card: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      question: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentReservoirItem: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemDifficulty: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      condition: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await databaseIntegrityCheckTool.execute(
      { checkType: 'orphans' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.overallStatus).toBe('healthy');
    expect(result.totalOrphans).toBe(0);
  });

  it('returns 6 orphan check results', async () => {
    const mockPrisma = {
      questionAttempt: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      user: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      reviewLog: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      card: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      question: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      studentReservoirItem: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      itemDifficulty: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      condition: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await databaseIntegrityCheckTool.execute(
      { checkType: 'orphans' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.orphanDetails).toHaveLength(6);
  });

  it('includes timestamp', async () => {
    const mockPrisma = {
      questionAttempt: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      user: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      reviewLog: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      card: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      question: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      studentReservoirItem: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      itemDifficulty: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      condition: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await databaseIntegrityCheckTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.checkedAt).toBeDefined();
    expect(() => new Date(result.checkedAt)).not.toThrow();
  });
});

// ─── fsrsCalibrationStatus ──────────────────────────────────────────────────

describe('fsrsCalibrationStatus — Input Validation', () => {
  const tool = fsrsCalibrationStatusTool;

  it('accepts empty input', () => {
    expect(() => tool.inputSchema.parse({})).not.toThrow();
  });

  it('accepts userId filter', () => {
    expect(() =>
      tool.inputSchema.parse({ userId: 'user-abc', minReviews: 100 })
    ).not.toThrow();
  });

  it('rejects minReviews < 10', () => {
    expect(() => tool.inputSchema.parse({ minReviews: 5 })).toThrow();
  });
});

describe('fsrsCalibrationStatus — Execution', () => {
  it('reports healthy when all metrics are good', async () => {
    const mockPrisma = {
      userProgress: {
        count: vi.fn()
          .mockResolvedValueOnce(500)  // active cards
          .mockResolvedValueOnce(20)   // overdue (4%)
          .mockResolvedValueOnce(5)    // ease hell (1%)
          .mockResolvedValueOnce(200), // 7-day backlog
        aggregate: vi.fn().mockResolvedValue({
          _avg: { fsrsDifficulty: 0.45, fsrsStability: 3.2 },
        }),
      },
    };

    const result = await fsrsCalibrationStatusTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.status).toBe('healthy');
    expect(result.issues).toHaveLength(0);
    expect(result.totalActiveCards).toBe(500);
  });

  it('reports critical when overdue cascade > 20%', async () => {
    const mockPrisma = {
      userProgress: {
        count: vi.fn()
          .mockResolvedValueOnce(500)  // active
          .mockResolvedValueOnce(150)  // overdue (30%)
          .mockResolvedValueOnce(5)    // ease hell
          .mockResolvedValueOnce(300),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { fsrsDifficulty: 0.45, fsrsStability: 3.2 },
        }),
      },
    };

    const result = await fsrsCalibrationStatusTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.status).toBe('critical');
    expect(result.issues.some((i) => i.startsWith('overdue_cascade'))).toBe(true);
  });

  it('reports scope as global when no userId', async () => {
    const mockPrisma = {
      userProgress: {
        count: vi.fn().mockResolvedValue(100),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { fsrsDifficulty: 0.5, fsrsStability: 2.0 },
        }),
      },
    };

    const result = await fsrsCalibrationStatusTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.scope).toBe('global');
  });
});

// ─── drillCoverageCheck ─────────────────────────────────────────────────────

describe('drillCoverageCheck — Input Validation', () => {
  const tool = drillCoverageCheckTool;

  it('accepts drill type filter', () => {
    expect(() =>
      tool.inputSchema.parse({ drillType: 'AnatomyDrill' })
    ).not.toThrow();
  });

  it('accepts system filter', () => {
    expect(() =>
      tool.inputSchema.parse({ system: 'Cardiovascular' })
    ).not.toThrow();
  });

  it('accepts minThreshold', () => {
    expect(() => tool.inputSchema.parse({ minThreshold: 50 })).not.toThrow();
  });

  it('rejects minThreshold < 5', () => {
    expect(() => tool.inputSchema.parse({ minThreshold: 2 })).toThrow();
  });
});

describe('drillCoverageCheck — Execution', () => {
  it('classifies empty drill types as critical', async () => {
    const mockPrisma = {
      drillSessionRecord: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    const result = await drillCoverageCheckTool.execute(
      { drillType: 'AnatomyDrill' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.coverage).toHaveLength(1);
    expect(result.coverage[0]!.status).toBe('critical');
    expect(result.underRepresented).toHaveLength(1);
  });

  it('classifies below-threshold as low', async () => {
    const mockPrisma = {
      drillSessionRecord: {
        count: vi.fn().mockResolvedValue(10),
      },
    };

    const result = await drillCoverageCheckTool.execute(
      { drillType: 'ConditionDrill', minThreshold: 25 },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.coverage[0]!.status).toBe('low');
  });

  it('classifies above-threshold as healthy', async () => {
    const mockPrisma = {
      drillSessionRecord: {
        count: vi.fn().mockResolvedValue(50),
      },
    };

    const result = await drillCoverageCheckTool.execute(
      { drillType: 'PharmDrill' },
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.coverage[0]!.status).toBe('healthy');
  });

  it('includes summary in result', async () => {
    const mockPrisma = {
      drillSessionRecord: {
        count: vi.fn().mockResolvedValue(30),
      },
    };

    const result = await drillCoverageCheckTool.execute(
      {},
      { prisma: mockPrisma, userId: 'test-user', env: {} }
    );

    expect(result.summary).toContain('drill types checked');
    expect(result.summary).toContain('total items');
  });
});
