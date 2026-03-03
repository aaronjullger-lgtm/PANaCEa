import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeConfidence, fetchConfidenceData } from './confidenceScorer';
import type { PrismaClient } from '@prisma/client/edge';

// Mock Prisma client
const mockPrisma = {
  reviewLog: {
    findMany: vi.fn(),
  },
} as any as PrismaClient;

describe('Confidence Scorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeConfidence', () => {
    it('should compute confidence with basic input', async () => {
      const input = {
        reviewCounts: {
          Cardiovascular: 50,
          Pulmonary: 10,
        },
        accuracyVariances: {
          Cardiovascular: 0.05,
          Pulmonary: 0.2,
        },
        daysSinceLastReview: {
          Cardiovascular: 5,
          Pulmonary: 45,
        },
        dataDensityThreshold: 60,
      };

      const result = await computeConfidence(null, input);

      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('perTopicConfidence');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('recommendations');

      // Confidence should be a number between 0 and 1
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Per-topic confidence should have entries for each topic
      expect(Object.keys(result.perTopicConfidence)).toEqual(['Cardiovascular', 'Pulmonary']);
      for (const conf of Object.values(result.perTopicConfidence)) {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      }

      // Flags should include NEEDS_MORE_DATA for Pulmonary (review count < threshold)
      expect(result.flags).toContain('NEEDS_MORE_DATA');
      // Flags should include HIGH_VARIANCE for Pulmonary (variance > 0.15)
      expect(result.flags).toContain('HIGH_VARIANCE');
      // Flags should include STALE_DATA for Pulmonary (days > 30)
      expect(result.flags).toContain('STALE_DATA');
      // Flags should include INSUFFICIENT_REVIEWS for Pulmonary (review count < 5)
      // Actually review count is 10, so not insufficient.
      // Check that flags are unique (deduplicated)
      const flagSet = new Set(result.flags);
      expect(result.flags.length).toBe(flagSet.size);

      // Recommendations should include messages
      expect(result.recommendations.length).toBeGreaterThan(0);
      for (const rec of result.recommendations) {
        expect(typeof rec).toBe('string');
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const input = {
        reviewCounts: { Gastrointestinal: 100 },
        // accuracyVariances omitted -> defaults to empty object
        daysSinceLastReview: { Gastrointestinal: 0 },
      };

      const result = await computeConfidence(null, input);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.perTopicConfidence.Gastrointestinal).toBeGreaterThan(0);
      expect(result.flags).not.toContain('HIGH_VARIANCE');
      expect(result.flags).not.toContain('STALE_DATA');
      // Since review count > threshold, no NEEDS_MORE_DATA flag
    });

    it('should produce low confidence when data is sparse', async () => {
      const input = {
        reviewCounts: { Neurology: 2 },
        accuracyVariances: { Neurology: 0.3 },
        daysSinceLastReview: { Neurology: 100 },
      };

      const result = await computeConfidence(null, input);
      expect(result.confidence).toBeLessThan(0.6); // low confidence
      expect(result.flags).toContain('INSUFFICIENT_REVIEWS');
      expect(result.flags).toContain('NEEDS_MORE_DATA');
      expect(result.flags).toContain('HIGH_VARIANCE');
      expect(result.flags).toContain('STALE_DATA');
      expect(result.recommendations).toContain(
        'Consider a calibration session to improve data quality'
      );
    });

    it('should respect custom dataDensityThreshold', async () => {
      const input = {
        reviewCounts: { Cardiology: 30 },
        daysSinceLastReview: { Cardiology: 0 },
        dataDensityThreshold: 20,
      };

      const result = await computeConfidence(null, input);
      // Since review count 30 > threshold 20, confidence should be high (capped at 1)
      expect(result.perTopicConfidence.Cardiology).toBeGreaterThanOrEqual(1);
      expect(result.flags).not.toContain('NEEDS_MORE_DATA');
    });
  });

  describe('fetchConfidenceData', () => {
    it('should fetch and aggregate review data', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      mockPrisma.reviewLog.findMany.mockResolvedValue([
        { system: 'Cardiovascular', wasCorrect: true, reviewedAt: twoDaysAgo },
        { system: 'Cardiovascular', wasCorrect: false, reviewedAt: twoDaysAgo },
        { system: 'Cardiovascular', wasCorrect: true, reviewedAt: twoDaysAgo },
        { system: 'Pulmonary', wasCorrect: true, reviewedAt: thirtyDaysAgo },
        { system: 'Pulmonary', wasCorrect: true, reviewedAt: thirtyDaysAgo },
      ]);

      const result = await fetchConfidenceData(mockPrisma, 'user123');

      expect(mockPrisma.reviewLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          sessionType: 'MAIN',
          system: { not: null },
        },
        select: {
          system: true,
          wasCorrect: true,
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'desc' },
        take: 200,
      });

      expect(result).toHaveProperty('reviewCounts');
      expect(result).toHaveProperty('accuracyVariances');
      expect(result).toHaveProperty('daysSinceLastReview');
      expect(result).toHaveProperty('dataDensityThreshold', 60);

      expect(result.reviewCounts.Cardiovascular).toBe(3);
      expect(result.reviewCounts.Pulmonary).toBe(2);

      // Variance for Cardiovascular: mean = 2/3 ≈ 0.666, variance = (0.666*(1-0.666))/3 ≈ 0.074
      expect(result.accuracyVariances.Cardiovascular).toBeCloseTo(0.074, 2);
      // Pulmonary: mean = 1, variance = 0
      expect(result.accuracyVariances.Pulmonary).toBe(0);

      // Days since last review should be approximate
      expect(result.daysSinceLastReview.Cardiovascular).toBeLessThanOrEqual(3);
      expect(result.daysSinceLastReview.Pulmonary).toBeGreaterThanOrEqual(29);
    });

    it('should filter by taxonomyCodes when provided', async () => {
      mockPrisma.reviewLog.findMany.mockResolvedValue([]);
      await fetchConfidenceData(mockPrisma, 'user123', ['Cardiovascular', 'Pulmonary']);
      expect(mockPrisma.reviewLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            system: { in: ['Cardiovascular', 'Pulmonary'] },
          }),
        })
      );
    });

    it('should handle empty result set', async () => {
      mockPrisma.reviewLog.findMany.mockResolvedValue([]);
      const result = await fetchConfidenceData(mockPrisma, 'user123');
      expect(result.reviewCounts).toEqual({});
      expect(result.accuracyVariances).toEqual({});
      expect(result.daysSinceLastReview).toEqual({});
    });
  });
});