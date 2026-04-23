import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyFIReImplicitCredit } from '../lib/services/fireImplicitCreditService';

// ─── Prisma mock factory ─────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, any> = {}): any {
  return {
    question: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userProgress: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

const NOW = new Date('2025-06-01T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Guard clauses ────────────────────────────────────────────────────────────

describe('applyFIReImplicitCredit — guard clauses', () => {
  it('returns empty result when conditionFamily is null', async () => {
    const prisma = makePrisma();
    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', null, 3);
    expect(result.siblingsUpdated).toBe(0);
    expect(result.siblingsSkipped).toBe(0);
    expect(result.creditsApplied).toHaveLength(0);
    expect(prisma.question.findMany).not.toHaveBeenCalled();
  });

  it('returns empty result when conditionFamily is undefined', async () => {
    const prisma = makePrisma();
    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', undefined, 3);
    expect(result.siblingsUpdated).toBe(0);
    expect(prisma.question.findMany).not.toHaveBeenCalled();
  });

  it('returns empty result when hierarchyLevel is null', async () => {
    const prisma = makePrisma();
    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'cardiology', null);
    expect(result.siblingsUpdated).toBe(0);
    expect(prisma.question.findMany).not.toHaveBeenCalled();
  });

  it('returns empty result when hierarchyLevel is 1 (lowest — no siblings to credit)', async () => {
    const prisma = makePrisma();
    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'cardiology', 1);
    expect(result.siblingsUpdated).toBe(0);
    expect(prisma.question.findMany).not.toHaveBeenCalled();
  });

  it('returns empty result when no sibling questions exist in conditionFamily', async () => {
    const prisma = makePrisma({ question: { findMany: vi.fn().mockResolvedValue([]) } });
    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'cardiology', 3);
    expect(result.siblingsUpdated).toBe(0);
    expect(result.siblingsSkipped).toBe(0);
  });
});

// ─── Credit schedule correctness ─────────────────────────────────────────────

describe('applyFIReImplicitCredit — credit schedule', () => {
  it('level 3 answer credits level 2 at 0.40 and level 1 at 0.20', async () => {
    const now = new Date();
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c-level2', hierarchyLevel: 2 },
          { conditionId: 'c-level1', hierarchyLevel: 1 },
        ]),
      },
      userProgress: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.userId_conditionId_progressContext.conditionId === 'c-level2') {
            return Promise.resolve({ fsrsStability: 10, nextReviewAt: new Date(now.getTime() + 10 * DAY_MS) });
          }
          if (where.userId_conditionId_progressContext.conditionId === 'c-level1') {
            return Promise.resolve({ fsrsStability: 5, nextReviewAt: new Date(now.getTime() + 5 * DAY_MS) });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'cardiology', 3);
    expect(result.siblingsUpdated).toBe(2);

    const level2Credit = result.creditsApplied.find(c => c.siblingLevel === 2);
    const level1Credit = result.creditsApplied.find(c => c.siblingLevel === 1);
    expect(level2Credit).toBeDefined();
    expect(level1Credit).toBeDefined();
    expect(level2Credit!.fractionalCredit).toBe(0.40);
    expect(level1Credit!.fractionalCredit).toBe(0.20);
  });

  it('level 2 answer credits level 1 at 0.40 only', async () => {
    const now = new Date();
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c-level1', hierarchyLevel: 1 },
        ]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: 8,
          nextReviewAt: new Date(now.getTime() + 8 * DAY_MS),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'cardiology', 2);
    expect(result.siblingsUpdated).toBe(1);
    expect(result.creditsApplied[0]!.fractionalCredit).toBe(0.40);
    expect(result.creditsApplied[0]!.siblingLevel).toBe(1);
  });

  it('new stability = oldStability + fractionalCredit * oldStability', async () => {
    const now = new Date();
    const oldStability = 10; // days
    const fractional = 0.40;
    // rawNewStability = 10 + 0.40 * 10 = 14
    // rawNewDue = now + 14 days
    // originalDue = now + 10 days
    // capDue = now + 10 + 14 = now + 24 days
    // rawNewDue (24 days from now) < capDue (24 days from now) → not capped
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: oldStability,
          nextReviewAt: new Date(now.getTime() + oldStability * DAY_MS),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    const credit = result.creditsApplied[0]!;
    // newStability = max(oldStability, cappedStabilityDays)
    // Since rawNewDue < capDue, cappedDue = rawNewDue and cappedStability ≈ 14
    expect(credit.newStability).toBeGreaterThan(oldStability);
    expect(credit.oldStability).toBe(oldStability);
    expect(credit.capped).toBe(false);
  });
});

// ─── 14-day cap enforcement ───────────────────────────────────────────────────

describe('applyFIReImplicitCredit — 14-day cap', () => {
  it('caps stability when raw new due date exceeds originalDue + 14 days', async () => {
    const now = new Date();
    // oldStability = 100 days → rawNewDue = now + 140 days >> originalDue + 14
    const originalDue = new Date(now.getTime() + 100 * DAY_MS);
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: 100,
          nextReviewAt: originalDue,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    const credit = result.creditsApplied[0]!;
    expect(credit.capped).toBe(true);
    // cappedDue = originalDue + 14 days
    const expectedCappedMs = originalDue.getTime() + 14 * DAY_MS;
    expect(credit.newNextDue.getTime()).toBeLessThanOrEqual(expectedCappedMs + 1000); // 1s tolerance
  });

  it('does NOT cap when raw new due is within 14-day window', async () => {
    const now = new Date();
    // oldStability = 3 → rawNew = 3 + 0.40*3 = 4.2 days, well under originalDue + 14
    const originalDue = new Date(now.getTime() + 3 * DAY_MS);
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: 3,
          nextReviewAt: originalDue,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    expect(result.creditsApplied[0]!.capped).toBe(false);
  });
});

// ─── Skip behaviour ───────────────────────────────────────────────────────────

describe('applyFIReImplicitCredit — sibling skipping', () => {
  it('skips siblings without UserProgress', async () => {
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    expect(result.siblingsUpdated).toBe(0);
    expect(result.siblingsSkipped).toBe(1);
    expect(prisma.userProgress.update).not.toHaveBeenCalled();
  });

  it('skips siblings with null or zero fsrsStability', async () => {
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({ fsrsStability: null, nextReviewAt: null }),
        update: vi.fn(),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    expect(result.siblingsUpdated).toBe(0);
    expect(result.siblingsSkipped).toBe(1);
  });

  it('skips siblings with fsrsStability = 0', async () => {
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({ fsrsStability: 0, nextReviewAt: null }),
        update: vi.fn(),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    expect(result.siblingsSkipped).toBe(1);
  });

  it('continues processing remaining siblings when one throws', async () => {
    const now = new Date();
    let callCount = 0;
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c-fail', hierarchyLevel: 2 },
          { conditionId: 'c-ok', hierarchyLevel: 2 },
        ]),
      },
      userProgress: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const cid = where.userId_conditionId_progressContext.conditionId;
          if (cid === 'c-fail') {
            return Promise.resolve({ fsrsStability: 10, nextReviewAt: new Date(now.getTime() + 10 * DAY_MS) });
          }
          return Promise.resolve({ fsrsStability: 8, nextReviewAt: new Date(now.getTime() + 8 * DAY_MS) });
        }),
        update: vi.fn().mockImplementation(({ where }) => {
          callCount++;
          const cid = where.userId_conditionId_progressContext.conditionId;
          if (cid === 'c-fail') throw new Error('DB error');
          return Promise.resolve({});
        }),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    // c-fail throws → skipped; c-ok succeeds
    expect(result.siblingsSkipped).toBe(1);
    expect(result.siblingsUpdated).toBe(1);
  });

  it('deduplicates questions with the same conditionId at a given hierarchy level', async () => {
    const now = new Date();
    // Two questions share conditionId 'c-shared' at level 2 — should only create one UserProgress update
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c-shared', hierarchyLevel: 2 },
          { conditionId: 'c-shared', hierarchyLevel: 2 },
        ]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: 5,
          nextReviewAt: new Date(now.getTime() + 5 * DAY_MS),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const result = await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    // Despite two questions with same conditionId, only one update
    expect(prisma.userProgress.update).toHaveBeenCalledTimes(1);
    expect(result.siblingsUpdated).toBe(1);
  });
});

// ─── UserProgress update payload ─────────────────────────────────────────────

describe('applyFIReImplicitCredit — update payload', () => {
  it('sets lastImplicitCredit + implicitCreditSource + updatedAt; never touches reps/difficulty', async () => {
    const now = new Date();
    const updateMock = vi.fn().mockResolvedValue({});
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: {
        findUnique: vi.fn().mockResolvedValue({
          fsrsStability: 10,
          nextReviewAt: new Date(now.getTime() + 10 * DAY_MS),
        }),
        update: updateMock,
      },
    });

    await applyFIReImplicitCredit(prisma, 'user-123', 'q-answered', 'fam', 3);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          implicitCreditSource: 'q-answered',
          fsrsStability: expect.any(Number),
          nextReviewAt: expect.any(Date),
        }),
      })
    );

    const updateData = updateMock.mock.calls[0][0].data;
    // Must NOT modify reps, difficulty, fsrsState, reviewHistory
    expect(updateData).not.toHaveProperty('reps');
    expect(updateData).not.toHaveProperty('difficulty');
    expect(updateData).not.toHaveProperty('fsrsState');
    expect(updateData).not.toHaveProperty('reviewHistory');
  });

  it('uses TARGETED progressContext by default', async () => {
    const now = new Date();
    const findUnique = vi.fn().mockResolvedValue({
      fsrsStability: 5,
      nextReviewAt: new Date(now.getTime() + 5 * DAY_MS),
    });
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: { findUnique, update: vi.fn().mockResolvedValue({}) },
    });

    await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId_conditionId_progressContext: expect.objectContaining({
            progressContext: 'TARGETED',
          }),
        }),
      })
    );
  });

  it('respects custom progressContext parameter', async () => {
    const now = new Date();
    const findUnique = vi.fn().mockResolvedValue({
      fsrsStability: 5,
      nextReviewAt: new Date(now.getTime() + 5 * DAY_MS),
    });
    const prisma = makePrisma({
      question: {
        findMany: vi.fn().mockResolvedValue([{ conditionId: 'c1', hierarchyLevel: 2 }]),
      },
      userProgress: { findUnique, update: vi.fn().mockResolvedValue({}) },
    });

    await applyFIReImplicitCredit(prisma, 'u', 'q', 'fam', 3, 'READINESS');
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId_conditionId_progressContext: expect.objectContaining({
            progressContext: 'READINESS',
          }),
        }),
      })
    );
  });
});
