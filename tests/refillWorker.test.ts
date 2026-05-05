// SAFE-OVERRIDE: Writing new test file for refillWorker - no destructive operations
// Tests for lib/services/reservoir/refillWorker.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/services/reservoir/reservoirPolicy', () => ({
  RESERVOIR_POLICY: {
    LOW_WATER_MARK: 15,
    HIGH_WATER_MARK: 40,
    REFILL_BATCH_SIZE: 25,
    PRIORITY: { OVERDUE_REVIEW: 9, CONFUSION_REMEDIATION: 8, DUE_REVIEW: 7, NEW_BLUEPRINT_GAP: 6, NEW_STANDARD: 5, BACKFILL: 3 },
  },
  computeExpiry: vi.fn(() => new Date(Date.now() + 48 * 3600_000)),
}));

vi.mock('../lib/services/reservoir/reservoirService', () => ({
  bulkInsertReservoirItems: vi.fn((_p: any, items: any[]) => Promise.resolve(items.length)),
}));

vi.mock('../lib/services/reservoir/confusionPairBoost', () => ({
  boostReservoirItems: vi.fn((_p: any, _u: string, t: any[]) => Promise.resolve({ boostedCount: t.length > 0 ? 2 : 0 })),
}));

vi.mock('../lib/services/mainSessionQuestionSelector', () => ({
  ALLOWED_VALIDATION_STATUSES: ['approved', 'pending'],
}));

import {
  executeRefill,
  parseReservoirScope,
  type RefillJobPayload,
} from '../lib/services/reservoir/refillWorker';

function makeMockPrisma(o: Record<string, any> = {}): any {
  return {
    studentReservoirItem: { findMany: vi.fn().mockResolvedValue([]) },
    userQuestionSeen: { findMany: vi.fn().mockResolvedValue([]) },
    userProgress: { findMany: vi.fn().mockResolvedValue([]) },
    preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
    question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    medicalContent: { findMany: vi.fn().mockResolvedValue([]) },
    ...o,
  };
}

function makePayload(overrides: Partial<RefillJobPayload> = {}): RefillJobPayload {
  return { userId: 'user-001', scope: 'adaptive', deficit: 10, reason: 'low_water', isReservoirRefill: true, ...overrides };
}

function makeQ(id: string, o: Record<string, any> = {}) {
  return { id, system: 'Cardiovascular', difficulty: 'moderate', questionOrder: 'first', taskCategory: 'diagnosis', flagCount: 0, qualityScore: 0.85, validationStatus: 'approved', ...o };
}

function makeDue(cid: string, o: Record<string, any> = {}) {
  return { conditionId: cid, system: 'Cardiovascular', fsrsDifficulty: 5, nextReviewAt: new Date(Date.now() - 2 * 86400_000), ...o };
}

function conditionQueryIds(where: any): string[] {
  const ids: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string') ids.push(value);
    if (value && typeof value === 'object' && Array.isArray((value as any).in)) {
      ids.push(...(value as any).in.map(String));
    }
  };

  add(where?.conditionId);
  add(where?.medicalContentId);
  for (const clause of where?.OR ?? []) {
    add(clause.conditionId);
    add(clause.medicalContentId);
  }
  return ids;
}

function queryMatchesCondition(where: any, id: string): boolean {
  return conditionQueryIds(where).includes(id);
}

describe('refillWorker', () => {
  describe('scope parsing', () => {
    it('parses condition and encoded subcategory scopes', () => {
      expect(parseReservoirScope('condition:cond-123')).toEqual({
        kind: 'condition',
        conditionId: 'cond-123',
      });
      expect(parseReservoirScope('subcategory:CV:valve%20disease')).toEqual({
        kind: 'subcategory',
        system: 'CV',
        subcategory: 'valve disease',
      });
    });
  });

  describe('executeRefill basic flow', () => {
    it('returns zero counts when deficit is 0', async () => {
      const r = await executeRefill(makeMockPrisma(), makePayload({ deficit: 0 }));
      expect(r.reviewsQueued).toBe(0);
      expect(r.poolQueued).toBe(0);
      expect(r.totalInserted).toBe(0);
      expect(r.skipped).toBe(0);
      expect(r.errors).toHaveLength(0);
    });

    it('returns empty when no due reviews and no pool', async () => {
      const r = await executeRefill(makeMockPrisma(), makePayload({ deficit: 10 }));
      expect(r.reviewsQueued).toBe(0);
      expect(r.poolQueued).toBe(0);
    });

    it('skips reviews with no conditionId', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('')]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q-1')]) },
      });
      const r = await executeRefill(p, makePayload({ deficit: 10 }));
      expect(r.reviewsQueued).toBe(0);
    });
  });

  describe('Phase 1 FSRS Due Reviews', () => {
    it('queues FSRS due reviews', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('cond-cv')]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q-1', { conditionId: 'cond-cv' })]) },
      });
      const r = await executeRefill(p, makePayload());
      expect(r.reviewsQueued).toBe(1);
    });

    it('finds review questions when UserProgress stores a MedicalContent id', async () => {
      const p = makeMockPrisma({
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([{ id: 'mc-cv', conditionId: 'cond-cv' }]),
        },
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('mc-cv')]) },
        preGeneratedQuestion: {
          findMany: vi.fn().mockImplementation((a: any) =>
            queryMatchesCondition(a.where, 'mc-cv')
              ? Promise.resolve([makeQ('q-med-review', { conditionId: 'cond-cv', medicalContentId: 'mc-cv' })])
              : Promise.resolve([])
          ),
        },
      });

      const r = await executeRefill(p, makePayload());

      expect(r.reviewsQueued).toBe(1);
      expect(p.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { conditionId: { in: ['mc-cv', 'cond-cv'] } },
              { medicalContentId: { in: ['mc-cv'] } },
            ]),
          }),
        })
      );
    });

    it('does not queue standard Question rows for due reviews because reservoir FK targets PreGeneratedQuestion', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('cond-cv')]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
        question: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'q-standard-1', system: 'Cardiovascular', conditionId: 'cond-cv', difficulty: 'medium' },
          ]),
        },
      });

      const r = await executeRefill(p, makePayload());

      expect(r.reviewsQueued).toBe(0);
      expect(p.question.findMany).not.toHaveBeenCalled();
    });

    it('sets OVERDUE_REVIEW priority for reviews over 1 day old', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('c1', { nextReviewAt: new Date(Date.now() - 2 * 86400_000) })]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q-1', { conditionId: 'c1' })]) },
      });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      await executeRefill(p, makePayload());
      const ins = (bulkInsertReservoirItems as any).mock.calls[0][1];
      expect(ins[0].priority).toBe(9);
      expect(ins[0].isReview).toBe(true);
      expect(ins[0].questionSource).toBe('review');
    });

    it('sets DUE_REVIEW priority for reviews within 1 day', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('c1', { nextReviewAt: new Date(Date.now() - 12 * 3600_000) })]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q-1', { conditionId: 'c1' })]) },
      });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      await executeRefill(p, makePayload());
      expect((bulkInsertReservoirItems as any).mock.calls[0][1][0].priority).toBe(7);
    });

    it('respects deficit limit for reviews', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => makeDue('c' + i))) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const id = conditionQueryIds(a.where)[0] ?? 'any';
          return Promise.resolve([makeQ('q-' + id, { conditionId: id })]);
        }) },
      });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).reviewsQueued).toBeLessThanOrEqual(4);
    });

    it('avoids questions already in reservoir', async () => {
      const p = makeMockPrisma({
        studentReservoirItem: { findMany: vi.fn().mockResolvedValue([{ questionId: 'q-existing' }]) },
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('c1')]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q-existing', { conditionId: 'c1' }), makeQ('q-new', { conditionId: 'c1' })]) },
      });
      expect((await executeRefill(p, makePayload())).reviewsQueued).toBe(1);
    });

    it('catches Phase 1 errors and continues', async () => {
      const p = makeMockPrisma({ userProgress: { findMany: vi.fn().mockRejectedValue(new Error('DB timeout')) } });
      const r = await executeRefill(p, makePayload());
      expect(r.errors[0]).toContain('Phase 1');
    });
  });

  describe('Phase 2 New Cards', () => {
    it('queues new pool questions', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('p1'), makeQ('p2')]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBeGreaterThan(0);
    });

    it('sets NEW_STANDARD priority for pool questions', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('p1')]) } });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      await executeRefill(p, makePayload({ deficit: 5 }));
      const item = (bulkInsertReservoirItems as any).mock.calls[0][1].find((i: any) => i.questionSource === 'pool');
      expect(item.priority).toBe(5);
      expect(item.isReview).toBe(false);
    });

    it('applies system filter for system: scope', async () => {
      const p = makeMockPrisma({
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => a.where.system === 'CV' ? Promise.resolve([makeQ('q1', { system: 'CV' })]) : Promise.resolve([])) },
      });
      expect((await executeRefill(p, makePayload({ deficit: 5, scope: 'system:CV' }))).poolQueued).toBeGreaterThan(0);
    });

    it('applies condition filter for condition: scope instead of filling from the global pool', async () => {
      const p = makeMockPrisma({
        preGeneratedQuestion: {
          findMany: vi.fn().mockImplementation((a: any) =>
            queryMatchesCondition(a.where, 'cond-123')
              ? Promise.resolve([makeQ('q1', { conditionId: 'cond-123' })])
              : Promise.resolve([])
          ),
        },
      });

      expect(
        (await executeRefill(p, makePayload({ deficit: 5, scope: 'condition:cond-123' }))).poolQueued
      ).toBeGreaterThan(0);
      expect(p.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conditionId: { in: ['cond-123'] },
          }),
        })
      );
    });

    it('uses MedicalContent ids when refilling a condition-scoped pool from a study-plan target', async () => {
      const p = makeMockPrisma({
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([{ id: 'mc-123', conditionId: 'cond-123' }]),
        },
        preGeneratedQuestion: {
          findMany: vi.fn().mockImplementation((a: any) =>
            queryMatchesCondition(a.where, 'mc-123')
              ? Promise.resolve([makeQ('q-mc', { conditionId: 'cond-123', medicalContentId: 'mc-123' })])
              : Promise.resolve([])
          ),
        },
      });

      const result = await executeRefill(
        p,
        makePayload({ deficit: 5, scope: 'condition:mc-123' })
      );

      expect(result.poolQueued).toBeGreaterThan(0);
      expect(p.userProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conditionId: { in: ['mc-123'] },
          }),
        })
      );
      expect(p.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { conditionId: { in: ['mc-123', 'cond-123'] } },
              { medicalContentId: { in: ['mc-123'] } },
            ]),
          }),
        })
      );
    });

    it('does not queue standard Question rows for scoped reservoir fills because reservoir FK targets PreGeneratedQuestion', async () => {
      const p = makeMockPrisma({
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
        question: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'q-main-1', system: 'CV', conditionId: 'cond-123', difficulty: 'medium' },
          ]),
        },
      });

      const result = await executeRefill(
        p,
        makePayload({ deficit: 5, scope: 'condition:cond-123' })
      );

      expect(result.poolQueued).toBe(0);
      expect(p.question.findMany).not.toHaveBeenCalled();
    });

    it('skips flagCount >= 3', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { flagCount: 5 })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(0);
    });

    it('skips qualityScore < 0.4', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { qualityScore: 0.2 })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(0);
    });

    it('skips validationStatus rejected', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { validationStatus: 'rejected' })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(0);
    });

    it('allows pending validation status', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { validationStatus: 'pending', qualityScore: 0.7 })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(1);
    });

    it('catches Phase 2 errors', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockRejectedValue(new Error('fail')) }, question: { findMany: vi.fn().mockRejectedValue(new Error('fail')) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).errors.some((e: string) => e.includes('Phase 2'))).toBe(true);
    });

    it('prefers least-seen questions', async () => {
      const p = makeMockPrisma({
        userQuestionSeen: { findMany: vi.fn().mockResolvedValue([{ questionId: 'q3', timesShown: 3 }, { questionId: 'q1', timesShown: 1 }]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q3'), makeQ('q1')]) },
      });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      await executeRefill(p, makePayload({ deficit: 2 }));
      expect((bulkInsertReservoirItems as any).mock.calls[0][1][0].questionId).toBe('q1');
    });
  });

  describe('Phase 2.5 Confusion Boost', () => {
    it('calls boost when items exist', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      await executeRefill(p, makePayload({ deficit: 5 }));
      const { boostReservoirItems } = await import('../lib/services/reservoir/confusionPairBoost');
      expect(boostReservoirItems).toHaveBeenCalled();
    });

    it('skips when confusionScope is false', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      const { boostReservoirItems } = await import('../lib/services/reservoir/confusionPairBoost');
      vi.clearAllMocks();
      await executeRefill(p, makePayload({ deficit: 5, confusionScope: false }));
      expect(boostReservoirItems).not.toHaveBeenCalled();
    });

    it('skips when no items', async () => {
      const { boostReservoirItems } = await import('../lib/services/reservoir/confusionPairBoost');
      vi.clearAllMocks();
      await executeRefill(makeMockPrisma(), makePayload({ deficit: 0 }));
      expect(boostReservoirItems).not.toHaveBeenCalled();
    });

    it('reports boosted count', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).confusionBoostedCount).toBe(2);
    });

    it('handles boost errors non-fatally', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      const { boostReservoirItems } = await import('../lib/services/reservoir/confusionPairBoost');
      (boostReservoirItems as any).mockRejectedValueOnce(new Error('down'));
      const r = await executeRefill(p, makePayload({ deficit: 5 }));
      expect(r.errors.some((e: string) => e.includes('Phase 2.5'))).toBe(true);
      expect(r.totalInserted).toBeGreaterThan(0);
    });
  });

  describe('Phase 3 Insert', () => {
    it('calls bulkInsert with items', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1'), makeQ('q2')]) } });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      await executeRefill(p, makePayload({ deficit: 5 }));
      expect(bulkInsertReservoirItems).toHaveBeenCalledTimes(1);
      expect((bulkInsertReservoirItems as any).mock.calls[0][1].length).toBeGreaterThan(0);
    });

    it('totalInserted matches', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      const r = await executeRefill(p, makePayload({ deficit: 5 }));
      expect(r.totalInserted).toBe(r.reviewsQueued + r.poolQueued);
    });

    it('handles insert errors', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1')]) } });
      const { bulkInsertReservoirItems } = await import('../lib/services/reservoir/reservoirService');
      (bulkInsertReservoirItems as any).mockRejectedValueOnce(new Error('fail'));
      const r = await executeRefill(p, makePayload({ deficit: 5 }));
      expect(r.errors.some((e: string) => e.includes('Phase 3'))).toBe(true);
      expect(r.totalInserted).toBe(0);
    });
  });

  describe('Adjacency sorting TARGETED', () => {
    it('handles TARGETED session', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([
          makeDue('cp', { system: 'Pulmonary', nextReviewAt: new Date(Date.now() - 86400_000) }),
          makeDue('cc', { system: 'Cardiovascular', nextReviewAt: new Date(Date.now() - 86400_000) }),
        ]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const id = conditionQueryIds(a.where)[0] ?? 'any';
          return Promise.resolve([makeQ('q-' + id, { conditionId: id })]);
        }) },
      });
      expect((await executeRefill(p, makePayload({ deficit: 10, scope: 'system:CV' }))).reviewsQueued).toBeGreaterThan(0);
    });

    it('falls back to chronological without primarySystem', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([
          makeDue('c1', { nextReviewAt: new Date(Date.now() - 5 * 86400_000) }),
          makeDue('c2', { nextReviewAt: new Date(Date.now() - 86400_000) }),
        ]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const id = conditionQueryIds(a.where)[0] ?? 'any';
          return Promise.resolve([makeQ('q-' + id, { conditionId: id })]);
        }) },
      });
      expect((await executeRefill(p, makePayload({ scope: 'adaptive' }))).reviewsQueued).toBe(2);
    });
  });

  describe('Blueprint weighted global scope', () => {
    it('queries multiple systems for global scope', async () => {
      let calls = 0;
      const p = makeMockPrisma({
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation(() => { calls++; return Promise.resolve(Array.from({ length: 5 }, (_, i) => makeQ('qs' + i))); }) },
        question: { findMany: vi.fn().mockResolvedValue([]) },
      });
      await executeRefill(p, makePayload({ deficit: 10, scope: 'adaptive' }));
      expect(calls).toBeGreaterThan(1);
    });
  });

  describe('Combined reviews and pool', () => {
    it('fills remaining deficit with pool after reviews', async () => {
      const p = makeMockPrisma({
        userProgress: { findMany: vi.fn().mockResolvedValue([makeDue('c1'), makeDue('c2'), makeDue('c3')]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const c = conditionQueryIds(a.where)[0];
          if (c) return Promise.resolve([makeQ('qr-' + c, { conditionId: c })]);
          return Promise.resolve([makeQ('p1'), makeQ('p2'), makeQ('p3'), makeQ('p4'), makeQ('p5')]);
        }) },
      });
      const r = await executeRefill(p, makePayload({ deficit: 10 }));
      expect(r.reviewsQueued).toBe(3);
      expect(r.poolQueued).toBeGreaterThan(0);
      expect(r.reviewsQueued + r.poolQueued).toBeLessThanOrEqual(10);
    });
  });

  describe('Quality gate boundaries', () => {
    it('accepts qualityScore 0.4', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { qualityScore: 0.4 })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(1);
    });

    it('rejects qualityScore 0.39', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { qualityScore: 0.39 })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(0);
    });

    it('accepts qualityScore undefined', async () => {
      const p = makeMockPrisma({ preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([makeQ('q1', { qualityScore: undefined })]) } });
      expect((await executeRefill(p, makePayload({ deficit: 5 }))).poolQueued).toBe(1);
    });
  });

  describe('Result structure', () => {
    it('has all required fields', async () => {
      const r = await executeRefill(makeMockPrisma(), makePayload({ deficit: 5 }));
      expect(r).toHaveProperty('reviewsQueued');
      expect(r).toHaveProperty('poolQueued');
      expect(r).toHaveProperty('generated');
      expect(r).toHaveProperty('totalInserted');
      expect(r).toHaveProperty('skipped');
      expect(r).toHaveProperty('confusionBoostedCount');
      expect(r).toHaveProperty('errors');
      expect(r.generated).toBe(0);
    });
  });
});
