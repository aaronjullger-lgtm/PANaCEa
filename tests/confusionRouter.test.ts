/**
 * Tests for Confusion-Driven Adaptive Drill Router
 *
 * @module tests/confusionRouter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Setup ───────────────────────────────────────────────────────────────

const USER_ID = 'user-test-001';
const CONDITION_A_ID = 'cond-crohns';
const CONDITION_B_ID = 'cond-uc';
const CONDITION_C_ID = 'cond-epidural';
const CONDITION_D_ID = 'cond-subdural';

function createMockPrisma(overrides: Record<string, any> = {}): any {
  return {
    confusionPair: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userProgress: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    medicalContent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    condition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    preGeneratedQuestion: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    question: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('confusionRouter', () => {
  describe('computeRoutingScore (via getConfusionBasedDrillQueue)', () => {
    // We test the scoring logic indirectly through the queue builder.
    // This avoids importing the private scoring function directly.

    it('ranks high-severity recent pairs above low-severity old ones', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);

      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 6,
              lastOccurrence: twoDaysAgo,
            },
            {
              realConditionId: CONDITION_C_ID,
              mistakenForId: CONDITION_D_ID,
              count: 2,
              lastOccurrence: sevenDaysAgo,
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([
            { id: CONDITION_A_ID, name: "Crohn's Disease" },
            { id: CONDITION_B_ID, name: 'Ulcerative Colitis' },
            { id: CONDITION_C_ID, name: 'Epidural Hematoma' },
            { id: CONDITION_D_ID, name: 'Subdural Hematoma' },
          ]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      expect(queue.items).toHaveLength(2);
      // High-severity, recent pair should rank first
      expect(queue.items[0]!.pairKey).toBe(`${CONDITION_A_ID}|${CONDITION_B_ID}`);
      expect(queue.items[0]!.severity).toBe('high');
      expect(queue.items[1]!.pairKey).toBe(`${CONDITION_C_ID}|${CONDITION_D_ID}`);
      expect(queue.items[1]!.severity).toBe('low');
      // Routing scores should reflect the ranking
      expect(queue.items[0]!.routingScore).toBeGreaterThan(queue.items[1]!.routingScore);
    });

    it('returns empty queue when no confusion pairs exist', async () => {
      const mockPrisma = createMockPrisma();

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID);

      expect(queue.totalPairs).toBe(0);
      expect(queue.items).toHaveLength(0);
      expect(queue.userId).toBe(USER_ID);
      expect(queue.reservoirScope).toBe(`confusion-remediation:${USER_ID}`);
    });

    it('respects limit option', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue(
            Array.from({ length: 5 }, (_, i) => ({
              realConditionId: `cond-${i}`,
              mistakenForId: `cond-${i + 100}`,
              count: i + 2,
              lastOccurrence: new Date(),
            }))
          ),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        limit: 3,
        includeScheduling: false,
      });

      expect(queue.items).toHaveLength(3);
    });

    it('respects minCount filter', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 5,
              lastOccurrence: new Date(),
            },
            {
              realConditionId: CONDITION_C_ID,
              mistakenForId: CONDITION_D_ID,
              count: 1,
              lastOccurrence: new Date(),
            },
          ]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        minCount: 3,
        includeScheduling: false,
      });

      // Only the count=5 pair passes the filter (loadUserConfusionPairs has its own minCount=2,
      // but our minCount=3 override should further filter)
      expect(queue.items).toHaveLength(1);
      expect(queue.items[0]!.confusionCount).toBe(5);
    });
  });

  describe('scheduling info', () => {
    it('includes FSRS data when includeScheduling is true', async () => {
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 86400_000);

      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 3,
              lastOccurrence: now,
            },
          ]),
        },
        userProgress: {
          findMany: vi.fn().mockResolvedValue([
            {
              conditionId: CONDITION_A_ID,
              nextReviewAt: overdueDate.toISOString(),
              fsrsStability: 5.2,
              fsrsDifficulty: 6.1,
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([
            { id: CONDITION_A_ID, name: "Crohn's Disease" },
          ]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: true,
      });

      expect(queue.items).toHaveLength(1);
      const info = queue.items[0]!.schedulingInfo;
      expect(info.hasOverdueReview).toBe(true);
      expect(info.correctConditionProgress).not.toBeNull();
      expect(info.correctConditionProgress!.stability).toBe(5.2);
      expect(info.correctConditionProgress!.difficulty).toBe(6.1);
      // Retrievability should be estimated (overdue by 1 day, stability 5.2)
      expect(info.correctConditionProgress!.retrievability).toBeLessThan(1);
    });

    it('omits scheduling data when includeScheduling is false', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 3,
              lastOccurrence: new Date(),
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      expect(queue.items).toHaveLength(1);
      expect(queue.items[0]!.schedulingInfo.correctConditionProgress).toBeNull();
      expect(queue.items[0]!.schedulingInfo.hasOverdueReview).toBe(false);
    });
  });

  describe('drill type suggestion', () => {
    it('suggests contrastive for high-severity recent pairs', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 5,
              lastOccurrence: new Date(),
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      expect(queue.items[0]!.suggestedDrillType).toBe('contrastive');
    });

    it('suggests ddx for medium-severity pairs', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 3,
              lastOccurrence: new Date(),
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      expect(queue.items[0]!.suggestedDrillType).toBe('ddx');
    });
  });

  describe('condition names', () => {
    it('populates condition names from MedicalContent', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 3,
              lastOccurrence: new Date(),
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([
            { id: CONDITION_A_ID, name: "Crohn's Disease" },
            { id: CONDITION_B_ID, name: 'Ulcerative Colitis' },
          ]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      expect(queue.items[0]!.correctConditionName).toBe("Crohn's Disease");
      expect(queue.items[0]!.mistakenConditionName).toBe('Ulcerative Colitis');
    });

    it('falls back to condition ID when name unavailable', async () => {
      const mockPrisma = createMockPrisma({
        confusionPair: {
          findMany: vi.fn().mockResolvedValue([
            {
              realConditionId: CONDITION_A_ID,
              mistakenForId: CONDITION_B_ID,
              count: 3,
              lastOccurrence: new Date(),
            },
          ]),
        },
        medicalContent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        condition: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });

      const { getConfusionBasedDrillQueue } = await import('../services/core/confusionRouter');

      const queue = await getConfusionBasedDrillQueue(mockPrisma, USER_ID, {
        includeScheduling: false,
      });

      // Falls back to raw condition ID
      expect(queue.items[0]!.correctConditionName).toBe(CONDITION_A_ID);
      expect(queue.items[0]!.mistakenConditionName).toBe(CONDITION_B_ID);
    });
  });

  describe('reservoir scope', () => {
    it('builds correct scope string', async () => {
      const { buildReservoirScope } = await import('../services/core/confusionRouter');

      const scope = buildReservoirScope(USER_ID);
      expect(scope).toBe(`confusion-remediation:${USER_ID}`);
    });
  });

  describe('buildConfusionReservoirItems', () => {
    it('finds questions for confusion pair conditions', async () => {
      const now = new Date();
      const queue = {
        userId: USER_ID,
        totalPairs: 1,
        items: [
          {
            pairKey: `${CONDITION_A_ID}|${CONDITION_B_ID}`,
            correctConditionId: CONDITION_A_ID,
            mistakenConditionId: CONDITION_B_ID,
            correctConditionName: "Crohn's Disease",
            mistakenConditionName: 'Ulcerative Colitis',
            confusionCount: 3,
            severity: 'medium' as const,
            daysSinceLastOccurrence: 0,
            routingScore: 10,
            suggestedDrillType: 'contrastive' as const,
            schedulingInfo: {
              correctConditionProgress: null,
              mistakenConditionProgress: null,
              hasOverdueReview: false,
            },
          },
        ],
        generatedAt: now.toISOString(),
        reservoirScope: `confusion-remediation:${USER_ID}`,
      };

      const mockPrisma = createMockPrisma({
        preGeneratedQuestion: {
          findFirst: vi.fn().mockImplementation((args: any) => {
            if (args.where.conditionId === CONDITION_A_ID) {
              return { id: 'q-crohns-1', system: 'GI', difficulty: 'moderate', questionOrder: 'second', taskCategory: 'diagnosis' };
            }
            if (args.where.conditionId === CONDITION_B_ID) {
              return { id: 'q-uc-1', system: 'GI', difficulty: 'moderate', questionOrder: 'second', taskCategory: 'diagnosis' };
            }
            return null;
          }),
        },
      });

      const { buildConfusionReservoirItems } = await import('../services/core/confusionRouter');

      const items = await buildConfusionReservoirItems(mockPrisma, USER_ID, queue);

      expect(items).toHaveLength(2);
      // Correct condition gets higher priority (OVERDUE_REVIEW = 9)
      const correctItem = items.find((i) => i.questionId === 'q-crohns-1');
      const mistakenItem = items.find((i) => i.questionId === 'q-uc-1');
      expect(correctItem).toBeDefined();
      expect(correctItem!.priority).toBe(9);
      expect(correctItem!.scope).toBe(`confusion-remediation:${USER_ID}`);
      expect(mistakenItem).toBeDefined();
      expect(mistakenItem!.priority).toBe(7);
    });

    it('returns empty when no questions found', async () => {
      const now = new Date();
      const queue = {
        userId: USER_ID,
        totalPairs: 1,
        items: [
          {
            pairKey: `${CONDITION_A_ID}|${CONDITION_B_ID}`,
            correctConditionId: CONDITION_A_ID,
            mistakenConditionId: CONDITION_B_ID,
            correctConditionName: 'A',
            mistakenConditionName: 'B',
            confusionCount: 2,
            severity: 'low' as const,
            daysSinceLastOccurrence: 1,
            routingScore: 5,
            suggestedDrillType: 'recall' as const,
            schedulingInfo: {
              correctConditionProgress: null,
              mistakenConditionProgress: null,
              hasOverdueReview: false,
            },
          },
        ],
        generatedAt: now.toISOString(),
        reservoirScope: `confusion-remediation:${USER_ID}`,
      };

      const mockPrisma = createMockPrisma();

      const { buildConfusionReservoirItems } = await import('../services/core/confusionRouter');

      const items = await buildConfusionReservoirItems(mockPrisma, USER_ID, queue);
      expect(items).toHaveLength(0);
    });
  });
});
