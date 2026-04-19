import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleReviews } from './retentionAwareScheduler';
import type { PrismaClient } from '@prisma/client/edge';

// Mock Prisma client
const mockReviewLogFindFirst = vi.fn();
const mockUserProgressFindFirst = vi.fn();
const mockPrisma = {
  reviewLog: {
    findFirst: mockReviewLogFindFirst,
  },
  userProgress: {
    findFirst: mockUserProgressFindFirst,
  },
} as unknown as PrismaClient;

describe('Retention‑Aware Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return low‑confidence item when no review data', async () => {
    mockReviewLogFindFirst.mockResolvedValue(null);
    mockUserProgressFindFirst.mockResolvedValue(null);

    const gaps = [{ taxonomyCode: 'Cardiovascular', subcategory: null }];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps);

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.taxonomyCode).toBe('Cardiovascular');
    expect(scheduled[0]!.confidence).toBe('LOW');
    expect(scheduled[0]!.currentStability).toBeNull();
    expect(scheduled[0]!.recommendedReviewDate).toBeNull();
  });

  it('should recommend immediate review when stability below minimum', async () => {
    const lastReviewedAt = new Date(Date.now() - 86400000); // 1 day ago
    mockReviewLogFindFirst.mockResolvedValue({
      stability: 0.05,
      reviewedAt: lastReviewedAt,
    });
    mockUserProgressFindFirst.mockResolvedValue({
      fsrsParams: { w: [ /* not needed */ ] },
    });

    const gaps = [{ taxonomyCode: 'Pulmonary' }];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps, {
      minStability: 0.1,
    });

    expect(scheduled[0]!.currentStability).toBe(0.05);
    expect(scheduled[0]!.recommendedReviewDate).toBeInstanceOf(Date);
    expect(scheduled[0]!.urgencyScore).toBe(1.0);
    expect(scheduled[0]!.confidence).toBe('HIGH');
  });

  it('should schedule a future review when retrievability is above threshold', async () => {
    const lastReviewedAt = new Date(Date.now() - 2 * 86400000); // 2 days ago
    mockReviewLogFindFirst.mockResolvedValue({
      stability: 10.0, // high stability
      reviewedAt: lastReviewedAt,
    });
    mockUserProgressFindFirst.mockResolvedValue({
      fsrsParams: { w: Array(21).fill(0).map((_, i) => i === 19 ? 0.0658 : i === 20 ? 0.1542 : 0) },
    });

    const gaps = [{ taxonomyCode: 'Gastrointestinal' }];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps, {
      targetRetention: 0.9,
      tolerance: 0.05,
    });

    // Expect a future date (since stability high, threshold not reached)
    expect(scheduled[0]!.daysUntilReview).toBeGreaterThan(0);
    expect(scheduled[0]!.recommendedReviewDate!.getTime()).toBeGreaterThan(Date.now());
    expect(scheduled[0]!.urgencyScore).toBeLessThan(1.0);
    expect(scheduled[0]!.confidence).toBe('LOW');
  });

  it('should fetch FSRS parameters from user progress', async () => {
    const lastReviewedAt = new Date(Date.now() - 5 * 86400000);
    mockReviewLogFindFirst.mockResolvedValue({
      stability: 5.0,
      reviewedAt: lastReviewedAt,
    });
    mockUserProgressFindFirst.mockResolvedValue({
      fsrsParams: { w: Array(21).fill(0).map((_, i) => i === 19 ? 0.1 : i === 20 ? 0.2 : 0) },
    });

    const gaps = [{ taxonomyCode: 'Musculoskeletal' }];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps);

    // No assertion on exact values, just that it didn't crash
    expect(scheduled[0]!.currentStability).toBe(5.0);
  });

  it('should sort by urgency descending', async () => {
    // Mock two systems with different stabilities
    mockReviewLogFindFirst
      .mockResolvedValueOnce({ stability: 1.0, reviewedAt: new Date() })
      .mockResolvedValueOnce({ stability: 20.0, reviewedAt: new Date() });
    mockUserProgressFindFirst.mockResolvedValue({
      fsrsParams: { w: Array(21).fill(0) },
    });

    const gaps = [
      { taxonomyCode: 'SystemA' },
      { taxonomyCode: 'SystemB' },
    ];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps);
    expect(scheduled).toHaveLength(2);
    // SystemA with lower stability should have higher urgency
    expect(scheduled[0]!.urgencyScore).toBeGreaterThanOrEqual(scheduled[1]!.urgencyScore);
  });

  it('should handle missing w[19]/w[20] with defaults', async () => {
    const lastReviewedAt = new Date();
    mockReviewLogFindFirst.mockResolvedValue({
      stability: 5.0,
      reviewedAt: lastReviewedAt,
    });
    mockUserProgressFindFirst.mockResolvedValue({
      fsrsParams: { w: [ /* only 19 elements */ ] },
    });

    const gaps = [{ taxonomyCode: 'Neurology' }];
    const scheduled = await scheduleReviews(mockPrisma, 'user123', gaps);

    expect(scheduled[0]!.currentStability).toBe(5.0);
    // Should not throw
  });
});