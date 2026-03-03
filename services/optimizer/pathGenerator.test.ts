import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStudyPlan } from './pathGenerator';
import type { PrismaClient } from '@prisma/client/edge';
import type { PathGeneratorInput } from '@/types/study-path';

// Mock Prisma client
const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  taxonomyMapping: {
    findMany: vi.fn(),
  },
} as any as PrismaClient;

describe('Path Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.taxonomyMapping.findMany.mockResolvedValue([]);
  });

  it('should generate a plan with basic input', async () => {
    const input: PathGeneratorInput = {
      userId: 'user123',
      constraints: {
        dailyMinutesLimit: 60,
        targetRetention: 0.9,
      },
      gaps: [
        {
          taxonomyCode: 'Cardiovascular',
          subcategory: null,
          currentAccuracy: 0.7,
          targetAccuracy: 0.9,
          gap: 0.2,
          reviewCount: 10,
          lastReviewedAt: new Date('2026-01-01'),
        },
      ],
      scheduledReviews: [
        {
          taxonomyCode: 'Cardiovascular',
          subcategory: null,
          recommendedReviewDate: new Date('2026-03-05'),
          urgencyScore: 0.8,
          confidence: 'HIGH',
        },
      ],
      blueprintPriorities: [
        {
          taxonomyCode: 'Cardiovascular',
          subcategory: null,
          priorityScore: 0.9,
          weightDeviation: 0.1,
        },
      ],
    };

    const result = await generateStudyPlan(mockPrisma, input);

    // Basic output validation
    expect(result).toHaveProperty('plan');
    expect(result).toHaveProperty('alternatives');
    expect(result).toHaveProperty('rationale');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('canRegenerate');

    expect(result.plan).toHaveProperty('id');
    expect(result.plan).toHaveProperty('userId', 'user123');
    expect(result.plan).toHaveProperty('generatedAt');
    expect(result.plan).toHaveProperty('sessions');
    expect(Array.isArray(result.plan.sessions)).toBe(true);
    expect(result.plan.totalEstimatedMinutes).toBeGreaterThan(0);
    expect(result.plan.confidence).toBeGreaterThanOrEqual(0);
    expect(result.plan.confidence).toBeLessThanOrEqual(1);
    expect(result.plan.metadata).toHaveProperty('blueprintCoverage');
    expect(result.plan.metadata).toHaveProperty('projectedRetentionIncrease');
    expect(result.plan.metadata).toHaveProperty('fatigueRisk');

    // Alternatives should be an array of up to 3 plans
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    for (const alt of result.alternatives) {
      expect(alt).toHaveProperty('sessions');
      expect(alt).toHaveProperty('totalEstimatedMinutes');
    }

    // Rationale should be a non‑empty string
    expect(typeof result.rationale).toBe('string');
    expect(result.rationale.length).toBeGreaterThan(0);

    // Confidence should be a number between 0 and 1
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // canRegenerate should be boolean
    expect(typeof result.canRegenerate).toBe('boolean');
  });

  it('should respect dailyMinutesLimit constraint', async () => {
    const input: PathGeneratorInput = {
      userId: 'user123',
      constraints: {
        dailyMinutesLimit: 30, // low limit
      },
      gaps: [
        {
          taxonomyCode: 'Cardiovascular',
          subcategory: null,
          currentAccuracy: 0.7,
          targetAccuracy: 0.9,
          gap: 0.2,
          reviewCount: 10,
          lastReviewedAt: new Date(),
        },
        {
          taxonomyCode: 'Pulmonary',
          subcategory: null,
          currentAccuracy: 0.6,
          targetAccuracy: 0.9,
          gap: 0.3,
          reviewCount: 5,
          lastReviewedAt: new Date(),
        },
      ],
      scheduledReviews: [],
      blueprintPriorities: [],
    };

    const result = await generateStudyPlan(mockPrisma, input);
    // Each session's total estimated minutes should not exceed daily limit
    for (const session of result.plan.sessions) {
      const sessionMinutes = session.topics.reduce((sum, t) => sum + t.estimatedMinutes, 0);
      expect(sessionMinutes).toBeLessThanOrEqual(30);
    }
  });

  it('should handle empty input gracefully', async () => {
    const input: PathGeneratorInput = {
      userId: 'user123',
      constraints: {},
      gaps: [],
      scheduledReviews: [],
      blueprintPriorities: [],
    };

    const result = await generateStudyPlan(mockPrisma, input);
    expect(result.plan.sessions).toEqual([]);
    expect(result.plan.totalEstimatedMinutes).toBe(0);
    expect(result.plan.metadata.blueprintCoverage).toEqual({});
    expect(result.plan.metadata.projectedRetentionIncrease).toBe(0);
  });
});