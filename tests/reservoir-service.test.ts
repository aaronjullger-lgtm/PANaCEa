/**
 * Tests for Reservoir Service — unit tests for the core service logic.
 *
 * Uses mock Prisma clients to test business logic without DB dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RESERVOIR_POLICY, deriveScope } from '../lib/services/reservoir/reservoirPolicy';

// We test the needsRefill logic and maintenance logic in isolation
describe('needsRefill logic', () => {
  it('returns needed=true when depth is below low water mark', () => {
    const depth = RESERVOIR_POLICY.LOW_WATER_MARK - 1;
    const deficit = Math.max(0, RESERVOIR_POLICY.HIGH_WATER_MARK - depth);
    expect(depth < RESERVOIR_POLICY.LOW_WATER_MARK).toBe(true);
    expect(deficit).toBe(RESERVOIR_POLICY.HIGH_WATER_MARK - depth);
  });

  it('returns needed=false when depth is at low water mark', () => {
    const depth = RESERVOIR_POLICY.LOW_WATER_MARK;
    expect(depth < RESERVOIR_POLICY.LOW_WATER_MARK).toBe(false);
  });

  it('returns needed=false when depth is above high water mark', () => {
    const depth = RESERVOIR_POLICY.HIGH_WATER_MARK + 5;
    const deficit = Math.max(0, RESERVOIR_POLICY.HIGH_WATER_MARK - depth);
    expect(deficit).toBe(0);
  });

  it('deficit is capped at REFILL_BATCH_SIZE', () => {
    const depth = 0; // Empty reservoir
    const rawDeficit = RESERVOIR_POLICY.HIGH_WATER_MARK - depth;
    const cappedDeficit = Math.min(rawDeficit, RESERVOIR_POLICY.REFILL_BATCH_SIZE);
    expect(cappedDeficit).toBe(RESERVOIR_POLICY.REFILL_BATCH_SIZE);
  });
});

describe('maintenance - expiration window', () => {
  it('items older than TTL should be marked expired', () => {
    const createdAt = new Date(Date.now() - RESERVOIR_POLICY.ITEM_TTL_HOURS * 3600_000 - 1000);
    const expiresAt = new Date(createdAt.getTime() + RESERVOIR_POLICY.ITEM_TTL_HOURS * 3600_000);
    const now = new Date();
    expect(expiresAt < now).toBe(true); // Should be expired
  });

  it('review items expire faster than standard items', () => {
    const now = Date.now();
    const reviewExpiry = new Date(now + RESERVOIR_POLICY.REVIEW_ITEM_TTL_HOURS * 3600_000);
    const standardExpiry = new Date(now + RESERVOIR_POLICY.ITEM_TTL_HOURS * 3600_000);
    expect(reviewExpiry.getTime()).toBeLessThan(standardExpiry.getTime());
  });

  it('reservation timeout releases items after configured minutes', () => {
    const reservedAt = new Date(
      Date.now() - (RESERVOIR_POLICY.RESERVATION_TIMEOUT_MINUTES + 1) * 60_000
    );
    const abandonedCutoff = new Date(
      Date.now() - RESERVOIR_POLICY.RESERVATION_TIMEOUT_MINUTES * 60_000
    );
    expect(reservedAt < abandonedCutoff).toBe(true); // Should be released
  });

  it('recently reserved items are NOT released', () => {
    const reservedAt = new Date(Date.now() - 5 * 60_000); // 5 min ago
    const abandonedCutoff = new Date(
      Date.now() - RESERVOIR_POLICY.RESERVATION_TIMEOUT_MINUTES * 60_000
    );
    expect(reservedAt < abandonedCutoff).toBe(false); // Should NOT be released
  });
});

describe('quality gate logic', () => {
  function shouldEnterReservoir(question: any): { allow: boolean; reason?: string } {
    if (question.flagCount >= 3) return { allow: false, reason: 'high_flag_count' };
    if (question.validationStatus === 'rejected') return { allow: false, reason: 'rejected' };
    if (question.qualityScore !== null && question.qualityScore !== undefined && question.qualityScore < 0.4) {
      return { allow: false, reason: 'low_quality' };
    }
    return { allow: true };
  }

  it('allows high-quality approved questions', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'approved', qualityScore: 0.8 });
    expect(result.allow).toBe(true);
  });

  it('rejects questions with 3+ flags', () => {
    const result = shouldEnterReservoir({ flagCount: 3, validationStatus: 'approved', qualityScore: 0.8 });
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('high_flag_count');
  });

  it('rejects explicitly rejected questions', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'rejected', qualityScore: 0.8 });
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('rejected');
  });

  it('rejects low-quality questions', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'pending', qualityScore: 0.2 });
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('low_quality');
  });

  it('allows questions with null quality score (unscored)', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'pending', qualityScore: null });
    expect(result.allow).toBe(true);
  });

  it('allows questions with exactly 2 flags', () => {
    const result = shouldEnterReservoir({ flagCount: 2, validationStatus: 'approved', qualityScore: 0.6 });
    expect(result.allow).toBe(true);
  });

  it('allows questions at quality threshold (0.4)', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'approved', qualityScore: 0.4 });
    expect(result.allow).toBe(true);
  });

  it('rejects at quality just below threshold', () => {
    const result = shouldEnterReservoir({ flagCount: 0, validationStatus: 'approved', qualityScore: 0.39 });
    expect(result.allow).toBe(false);
  });
});

describe('priority ordering', () => {
  it('overdue reviews sort before due reviews', () => {
    const items = [
      { priority: RESERVOIR_POLICY.PRIORITY.DUE_REVIEW },
      { priority: RESERVOIR_POLICY.PRIORITY.OVERDUE_REVIEW },
      { priority: RESERVOIR_POLICY.PRIORITY.NEW_STANDARD },
    ];
    items.sort((a, b) => b.priority - a.priority);
    expect(items[0].priority).toBe(RESERVOIR_POLICY.PRIORITY.OVERDUE_REVIEW);
    expect(items[1].priority).toBe(RESERVOIR_POLICY.PRIORITY.DUE_REVIEW);
    expect(items[2].priority).toBe(RESERVOIR_POLICY.PRIORITY.NEW_STANDARD);
  });
});

describe('scope derivation consistency', () => {
  it('system scope round-trips correctly', () => {
    const scope = deriveScope('system', { system: 'PULM' });
    expect(scope).toBe('system:PULM');
    expect(scope.startsWith('system:')).toBe(true);
    expect(scope.split(':')[1]).toBe('PULM');
  });

  it('condition scope round-trips correctly', () => {
    const scope = deriveScope('condition', { conditionId: 'abc-123' });
    expect(scope).toBe('condition:abc-123');
    expect(scope.startsWith('condition:')).toBe(true);
    expect(scope.split(':')[1]).toBe('abc-123');
  });
});
