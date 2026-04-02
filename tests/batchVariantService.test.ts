/**
 * Tests for batchVariantService — Sprint 1E
 *
 * Tests the pure/exported constants and type contracts.
 * DB-integrated functions (assessPoolHealth, generateBatchVariants,
 * getLeastSeenQuestionForCondition) require Prisma and are tested
 * via integration tests or manual cron invocation.
 */

import { describe, it, expect } from 'vitest';
import {
  TARGET_VARIANTS_PER_CONDITION,
  MAX_BATCH_SIZE,
  GENERATION_DELAY_MS,
  type ConditionCoverage,
  type BatchGenerationResult,
  type PoolHealthReport,
} from '../lib/services/batchVariantService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate pool health computation from raw condition data */
function computeHealthFromConditions(
  conditions: Array<{ conditionId: string; system: string; questionCount: number }>
): PoolHealthReport {
  const coverageBySystem: PoolHealthReport['coverageBySystem'] = {};  let healthy = 0, thin = 0, empty = 0;
  const thinList: ConditionCoverage[] = [];

  for (const c of conditions) {
    const sys = c.system;
    if (!coverageBySystem[sys]) {
      coverageBySystem[sys] = { total: 0, healthy: 0, thin: 0, empty: 0 };
    }
    coverageBySystem[sys].total++;
    const deficit = Math.max(0, TARGET_VARIANTS_PER_CONDITION - c.questionCount);

    if (c.questionCount === 0) {
      empty++;
      coverageBySystem[sys].empty++;
      thinList.push({ ...c, deficit });
    } else if (c.questionCount < TARGET_VARIANTS_PER_CONDITION) {
      thin++;
      coverageBySystem[sys].thin++;
      thinList.push({ ...c, deficit });
    } else {
      healthy++;
      coverageBySystem[sys].healthy++;
    }
  }

  return {
    totalConditions: conditions.length,
    healthyConditions: healthy,
    thinConditions: thin,
    emptyConditions: empty,
    coverageBySystem,
    thinConditionsList: thinList,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Batch Variant Service — Constants', () => {
  it('target variants per condition is at least 3', () => {
    expect(TARGET_VARIANTS_PER_CONDITION).toBeGreaterThanOrEqual(3);
  });

  it('max batch size is a reasonable limit', () => {
    expect(MAX_BATCH_SIZE).toBeGreaterThan(0);
    expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(200);
  });

  it('generation delay prevents API hammering', () => {
    expect(GENERATION_DELAY_MS).toBeGreaterThanOrEqual(500);
  });
});

describe('Batch Variant Service — Pool Health Logic', () => {
  it('classifies conditions correctly: healthy, thin, empty', () => {
    const conditions = [
      { conditionId: 'c1', system: 'cardiovascular', questionCount: 5 },
      { conditionId: 'c2', system: 'cardiovascular', questionCount: 2 },
      { conditionId: 'c3', system: 'pulmonary', questionCount: 0 },
      { conditionId: 'c4', system: 'pulmonary', questionCount: 3 },
    ];

    const health = computeHealthFromConditions(conditions);
    expect(health.totalConditions).toBe(4);
    expect(health.healthyConditions).toBe(2); // c1 (5>=3), c4 (3>=3)
    expect(health.thinConditions).toBe(1);    // c2 (2<3)
    expect(health.emptyConditions).toBe(1);   // c3 (0)
  });
  it('computes deficit correctly', () => {
    const conditions = [
      { conditionId: 'c1', system: 'neuro', questionCount: 1 },
      { conditionId: 'c2', system: 'neuro', questionCount: 0 },
    ];

    const health = computeHealthFromConditions(conditions);
    // deficit = TARGET (3) - count
    expect(health.thinConditionsList[0]!.deficit).toBe(2); // c2 empty: 3-0=3, but c1 is thin: 3-1=2
    // Actually c2 is empty (deficit=3), c1 is thin (deficit=2)
    // thinConditionsList includes both (empty + thin)
    const deficits = health.thinConditionsList.map(c => c.deficit).sort((a,b) => b-a);
    expect(deficits).toEqual([3, 2]);
  });

  it('tracks per-system coverage breakdown', () => {
    const conditions = [
      { conditionId: 'c1', system: 'cardiovascular', questionCount: 5 },
      { conditionId: 'c2', system: 'cardiovascular', questionCount: 1 },
      { conditionId: 'c3', system: 'cardiovascular', questionCount: 0 },
      { conditionId: 'c4', system: 'endocrine', questionCount: 4 },
    ];

    const health = computeHealthFromConditions(conditions);
    expect(health.coverageBySystem['cardiovascular']).toEqual({
      total: 3, healthy: 1, thin: 1, empty: 1,
    });
    expect(health.coverageBySystem['endocrine']).toEqual({
      total: 1, healthy: 1, thin: 0, empty: 0,
    });
  });
  it('handles all-healthy conditions gracefully', () => {
    const conditions = [
      { conditionId: 'c1', system: 'pulmonary', questionCount: 5 },
      { conditionId: 'c2', system: 'pulmonary', questionCount: 10 },
    ];

    const health = computeHealthFromConditions(conditions);
    expect(health.healthyConditions).toBe(2);
    expect(health.thinConditions).toBe(0);
    expect(health.emptyConditions).toBe(0);
    expect(health.thinConditionsList).toHaveLength(0);
  });

  it('handles empty input', () => {
    const health = computeHealthFromConditions([]);
    expect(health.totalConditions).toBe(0);
    expect(health.healthyConditions).toBe(0);
    expect(health.thinConditions).toBe(0);
    expect(health.emptyConditions).toBe(0);
    expect(health.thinConditionsList).toHaveLength(0);
    expect(health.coverageBySystem).toEqual({});
  });
});

describe('Batch Variant Service — BatchGenerationResult contract', () => {
  it('result shape matches interface contract', () => {
    const result: BatchGenerationResult = {
      generated: 10,
      failed: 2,
      skipped: 3,
      conditionsCovered: ['c1', 'c2'],
      errors: [{ conditionId: 'c3', error: 'timeout' }],
      durationMs: 15000,
    };

    expect(result.generated + result.failed + result.skipped).toBe(15);
    expect(result.conditionsCovered).toHaveLength(2);
    expect(result.errors[0]!.conditionId).toBe('c3');
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
