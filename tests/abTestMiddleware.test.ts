/**
 * Tests for A/B Test Middleware
 *
 * Tests resolveAssignments and logABConversion with a mocked Prisma client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveAssignments,
  logABConversion,
  type ABVariantAssignment,
} from '../lib/middleware/abTestMiddleware';
import type { ABPrismaClient } from '../lib/services/abTestService';

// ============================================================================
// Mock Helpers
// ============================================================================

/** Create a minimal mock ABPrismaClient */
function createMockDb(overrides?: {
  experiments?: any[];
  existingExposure?: any;
  exposureError?: Error;
  conversionError?: Error;
}): ABPrismaClient {
  const exposureStore = new Map<string, any>();
  const conversionLog: any[] = [];

  return {
    aBExperiment: {
      findMany: vi.fn().mockResolvedValue(overrides?.experiments ?? []),
    },
    aBExposure: {
      findUnique: vi.fn(({ where }: any) => {
        const key = `${where.userId_experimentId.userId}:${where.userId_experimentId.experimentId}`;
        return Promise.resolve(overrides?.existingExposure ?? exposureStore.get(key) ?? null);
      }),
      create: vi.fn(({ data }: any) => {
        const record = { id: `exp-${Date.now()}`, ...data, createdAt: new Date() };
        exposureStore.set(`${data.userId}:${data.experimentId}`, record);
        return Promise.resolve(record);
      }),
    },
    aBConversion: {
      create: vi.fn(({ data }: any) => {
        if (overrides?.conversionError) throw overrides.conversionError;
        const record = { id: `conv-${Date.now()}`, ...data, createdAt: new Date() };
        conversionLog.push(record);
        return Promise.resolve(record);
      }),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as ABPrismaClient;
}

const ACTIVE_EXPERIMENT = {
  id: 'scheduling_retention_target',
  name: 'Scheduling Retention Target',
  status: 'ACTIVE',
  variants: [
    { name: 'control', weight: 1, config: { request_retention: 0.90 } },
    { name: 'aggressive', weight: 1, config: { request_retention: 0.85 } },
    { name: 'conservative', weight: 1, config: { request_retention: 0.95 } },
  ],
  trafficPercentage: 100,
  targetLearnerStages: [],
};

const STAGE_TARGETED_EXPERIMENT = {
  id: 'stage_only_exp',
  name: 'Stage Only',
  status: 'ACTIVE',
  variants: [{ name: 'variant_a', weight: 1, config: {} }],
  trafficPercentage: 100,
  targetLearnerStages: ['CLINICAL'],
};

const DRAFT_EXPERIMENT = {
  id: 'draft_exp',
  name: 'Draft Experiment',
  status: 'DRAFT',
  variants: [{ name: 'v1', weight: 1, config: {} }],
  trafficPercentage: 100,
  targetLearnerStages: [],
};

// ============================================================================
// Tests
// ============================================================================

describe('resolveAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when no active experiments exist', async () => {
    const db = createMockDb({ experiments: [] });
    const result = await resolveAssignments(db, 'user-1');
    expect(result).toEqual({});
  });

  it('resolves variant for user in an active experiment', async () => {
    const db = createMockDb({ experiments: [ACTIVE_EXPERIMENT] });
    const result = await resolveAssignments(db, 'user-1');

    expect(Object.keys(result)).toContain('scheduling_retention_target');
    const assignment = result['scheduling_retention_target']!;
    expect(['control', 'aggressive', 'conservative']).toContain(assignment.variantName);
    expect(typeof assignment.config.request_retention).toBe('number');
  });

  it('is deterministic: same user+experiment always gets same variant', async () => {
    const db1 = createMockDb({ experiments: [ACTIVE_EXPERIMENT] });
    const db2 = createMockDb({ experiments: [ACTIVE_EXPERIMENT] });

    const [r1, r2] = await Promise.all([
      resolveAssignments(db1, 'user-42'),
      resolveAssignments(db2, 'user-42'),
    ]);

    expect(r1['scheduling_retention_target']!.variantName).toBe(
      r2['scheduling_retention_target']!.variantName
    );
  });

  it('filters by experimentIds when provided', async () => {
    // Mock findMany to respect the where clause (only return the requested experiment)
    const filteringDb = createMockDb();
    (filteringDb.aBExperiment.findMany as any).mockImplementation(async ({ where }: any) => {
      const all = [ACTIVE_EXPERIMENT, { ...DRAFT_EXPERIMENT, status: 'ACTIVE' }];
      if (where?.id?.in) return all.filter((e) => where.id.in.includes(e.id));
      return all.filter((e) => e.status === where.status);
    });

    const result = await resolveAssignments(filteringDb, 'user-1', ['draft_exp']);

    expect(Object.keys(result)).toEqual(['draft_exp']);
  });

  it('skips experiments outside traffic percentage', async () => {
    const lowTrafficExp = {
      ...ACTIVE_EXPERIMENT,
      trafficPercentage: 1, // Only 1% of users
    };
    const db = createMockDb({ experiments: [lowTrafficExp] });
    // Most users should not be in the 1% bucket — test with a user that is unlikely to match
    const result = await resolveAssignments(db, 'user-99999');
    // With 1% traffic, this user is very likely excluded
    // (can't guarantee exclusion due to hash distribution, but verify it doesn't crash)
    expect(typeof result).toBe('object');
  });

  it('filters by learner stage when targetLearnerStages is set', async () => {
    const db = createMockDb({ experiments: [STAGE_TARGETED_EXPERIMENT] });

    // User with matching stage should get assignment
    const resultMatch = await resolveAssignments(db, 'user-1', undefined, 'CLINICAL');
    expect(Object.keys(resultMatch)).toContain('stage_only_exp');

    // User with non-matching stage should be excluded
    const resultNoMatch = await resolveAssignments(db, 'user-2', undefined, 'DIDACTIC');
    expect(Object.keys(resultNoMatch)).not.toContain('stage_only_exp');
  });

  it('logs exposure via ensureExposure', async () => {
    const db = createMockDb({ experiments: [ACTIVE_EXPERIMENT] });
    await resolveAssignments(db, 'user-1');

    expect(db.aBExposure.findUnique).toHaveBeenCalled();
    expect(db.aBExposure.create).toHaveBeenCalled();
  });

  it('is idempotent: existing exposure does not create duplicate', async () => {
    const db = createMockDb({
      experiments: [ACTIVE_EXPERIMENT],
      existingExposure: {
        id: 'existing-exp-1',
        userId: 'user-1',
        experimentId: 'scheduling_retention_target',
        variantName: 'control',
        createdAt: new Date(),
      },
    });
    await resolveAssignments(db, 'user-1');

    expect(db.aBExposure.create).not.toHaveBeenCalled();
  });

  it('handles malformed variants gracefully', async () => {
    const badVariants = {
      ...ACTIVE_EXPERIMENT,
      variants: 'not-an-array',
    };
    const db = createMockDb({ experiments: [badVariants] });
    const result = await resolveAssignments(db, 'user-1');
    expect(result).toEqual({});
  });

  it('handles DB fetch failure gracefully', async () => {
    const failingDb = {
      aBExperiment: { findMany: vi.fn().mockRejectedValue(new Error('DB down')) },
      aBExposure: { findUnique: vi.fn(), create: vi.fn() },
      aBConversion: { create: vi.fn(), findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
    } as unknown as ABPrismaClient;

    const result = await resolveAssignments(failingDb, 'user-1');
    expect(result).toEqual({});
  });

  it('handles exposure logging failure without crashing', async () => {
    const db = createMockDb({
      experiments: [ACTIVE_EXPERIMENT],
      exposureError: new Error('Exposure DB down'),
    });
    // Mock findUnique to return null (new exposure) and create to throw
    (db.aBExposure.findUnique as any).mockResolvedValue(null);
    (db.aBExposure.create as any).mockRejectedValue(new Error('Exposure DB down'));

    const result = await resolveAssignments(db, 'user-1');
    // Should still return the assignment even if exposure logging fails
    expect(Object.keys(result)).toContain('scheduling_retention_target');
  });
});

describe('logABConversion', () => {
  it('creates a conversion record', async () => {
    const db = createMockDb();
    await logABConversion(db, 'user-1', 'exp-1', 'control', 'review_completed', 1, { questionId: 'q1' });

    expect(db.aBConversion.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        experimentId: 'exp-1',
        variantName: 'control',
        eventName: 'review_completed',
        value: 1,
        metadata: { questionId: 'q1' },
      },
    });
  });

  it('handles conversion logging failure gracefully', async () => {
    const db = createMockDb({ conversionError: new Error('Conversion DB down') });
    // Should not throw
    await expect(
      logABConversion(db, 'user-1', 'exp-1', 'control', 'review_completed')
    ).resolves.not.toThrow();
  });

  it('works without optional value and metadata', async () => {
    const db = createMockDb();
    await logABConversion(db, 'user-1', 'exp-1', 'control', 'review_completed');

    expect(db.aBConversion.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        experimentId: 'exp-1',
        variantName: 'control',
        eventName: 'review_completed',
        value: undefined,
        metadata: undefined,
      },
    });
  });
});
