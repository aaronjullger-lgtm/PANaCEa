import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './recommendation';
import { onRequestGet as onProgressGet } from './progress';
import type { CloudflareContext } from '../_shared/middleware';

// Mock external services
vi.mock('@/services/optimizer/performanceGapAnalyzer', () => ({
  analyzePerformanceGaps: vi.fn(),
}));
vi.mock('@/services/optimizer/retentionAwareScheduler', () => ({
  scheduleReviews: vi.fn(),
}));
vi.mock('@/services/optimizer/blueprintBalancedSelector', () => ({
  balanceBlueprintPriorities: vi.fn(),
}));
vi.mock('@/services/optimizer/pathGenerator', () => ({
  generateStudyPlan: vi.fn(),
}));
vi.mock('@/services/optimizer/confidenceScorer', () => ({
  computeConfidence: vi.fn(),
  fetchConfidenceData: vi.fn(),
}));
vi.mock('../_shared/cache', () => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  isKVAvailable: vi.fn(),
  getStudyPathCacheKey: vi.fn(),
  CACHE_CONFIG: {
    TTL: { STUDY_PATH: 3600 },
    PREFIX: { STUDY_PATH: 'study_path:' },
  },
}));
vi.mock('../_shared/cors', () => ({
  getCorsConfig: vi.fn(() => ({ allowedOrigins: ['*'] })),
  getCorsHeaders: vi.fn(() => ({})),
}));
vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((schema, handler, options) => async (context: any) => {
    // Simulate middleware: pass through auth and validated from context
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body = result.error != null
      ? JSON.stringify({ error: result.error })
      : JSON.stringify(result.data ?? result);
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
  }),
  withCors: vi.fn(() => () => new Response(null, { status: 204 })),
}));
vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
  safePrismaDisconnect: vi.fn(),
}));
vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: vi.fn().mockResolvedValue({ id: 'user-db-1' }),
}));

// Import mocked modules
import { analyzePerformanceGaps } from '@/services/optimizer/performanceGapAnalyzer';
import { scheduleReviews } from '@/services/optimizer/retentionAwareScheduler';
import { balanceBlueprintPriorities } from '@/services/optimizer/blueprintBalancedSelector';
import { generateStudyPlan } from '@/services/optimizer/pathGenerator';
import { computeConfidence, fetchConfidenceData } from '@/services/optimizer/confidenceScorer';
import { getFromCache, setInCache, isKVAvailable, getStudyPathCacheKey } from '../_shared/cache';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';

describe('Study Path Recommendation Endpoint', () => {
  const mockEnv = {
    DATABASE_URL: 'postgresql://test',
    CACHE: {} as any,
  };
  const mockAuth = {
    userId: 'user123',
  };
  const mockValidated = {
    dailyMinutesLimit: 60,
    targetRetention: 0.9,
  };
  const mockContext: CloudflareContext = {
    env: mockEnv,
    request: new Request('http://localhost/api/study-path/recommendation?dailyMinutesLimit=60&targetRetention=0.9'),
    // The authenticatedEndpoint adds auth and validated to the context
    // We'll pass them directly as properties (they are added by middleware)
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    (isKVAvailable as any).mockReturnValue(false);
    (resolveOrCreateUserRecord as any).mockResolvedValue({ id: 'user-db-1' });
    (getStudyPathCacheKey as any).mockReturnValue('cache-key');
    (analyzePerformanceGaps as any).mockResolvedValue([]);
    (scheduleReviews as any).mockResolvedValue([]);
    (balanceBlueprintPriorities as any).mockResolvedValue([]);
    (generateStudyPlan as any).mockResolvedValue({
      plan: {
        id: 'plan-123',
        userId: 'user-db-1',
        generatedAt: new Date(),
        sessions: [],
        totalEstimatedMinutes: 0,
        confidence: 0.8,
        metadata: {
          blueprintCoverage: {},
          projectedRetentionIncrease: 0,
          fatigueRisk: 'LOW',
        },
      },
      alternatives: [],
      rationale: 'Test rationale',
      canRegenerate: true,
    });
    (fetchConfidenceData as any).mockResolvedValue({
      reviewCounts: {},
      accuracyVariances: {},
      daysSinceLastReview: {},
    });
    (computeConfidence as any).mockResolvedValue({
      confidence: 0.9,
      perTopicConfidence: {},
      flags: [],
      recommendations: [],
    });
  });

  it('should return a study plan with 200 status', async () => {
    // Call the endpoint with a mock context that includes auth and validated
    // The authenticatedEndpoint expects context to have auth and validated properties.
    // We'll augment the mockContext with those.
    const contextWithAuth = {
      ...mockContext,
      auth: mockAuth,
      validated: mockValidated,
    };

    const response = await onRequestGet(contextWithAuth);
    expect(response.status).toBe(200);
    const body = await response.json();
    // Unified envelope: { success: true, data: { plan, alternatives, ... } }
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('plan');
    expect(body.data).toHaveProperty('alternatives');
    expect(body.data).toHaveProperty('rationale');
    expect(body.data).toHaveProperty('confidence');
    expect(body.data).toHaveProperty('cached', false);
    expect(body.data).toHaveProperty('generatedAt');
    expect(body.data.plan).toHaveProperty('id', 'plan-123');
    expect(resolveOrCreateUserRecord).toHaveBeenCalled();
    expect(generateStudyPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-db-1' })
    );
  });

  it('should return cached plan if available', async () => {
    (isKVAvailable as any).mockReturnValue(true);
    (getFromCache as any).mockResolvedValue({
      plan: {
        id: 'cached-plan',
        userId: 'user123',
        generatedAt: new Date('2026-01-01T00:00:00Z'),
        sessions: [],
        totalEstimatedMinutes: 30,
        confidence: 0.85,
        metadata: {},
      },
      alternatives: [],
      rationale: 'Cached rationale',
      confidence: 0.85,
      canRegenerate: true,
      cached: true,
      generatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const contextWithAuth = {
      ...mockContext,
      auth: mockAuth,
      validated: mockValidated,
    };
    const response = await onRequestGet(contextWithAuth);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.cached).toBe(true);
    expect(body.data.plan.id).toBe('cached-plan');
    // Should not have called the generator services
    expect(analyzePerformanceGaps).not.toHaveBeenCalled();
    expect(generateStudyPlan).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    (analyzePerformanceGaps as any).mockRejectedValue(new Error('DB error'));
    const contextWithAuth = {
      ...mockContext,
      auth: mockAuth,
      validated: mockValidated,
    };
    const response = await onRequestGet(contextWithAuth);
    expect(response.status).toBe(500);
    const body = await response.json();
    // Unified endpoint failure envelope: { success: false, error: { code, message } }
    expect(body.success).toBe(false);
    expect(body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Unable to generate study plan. Please try again.',
    });
  });
});

describe('Study Path Progress Endpoint', () => {
  const mockEnv = {
    DATABASE_URL: 'postgresql://test',
    CACHE: {} as any,
  };
  const mockAuth = {
    userId: 'clerk-user-123',
  };
  const mockValidated = {
    dailyMinutesLimit: 60,
    targetRetention: 0.9,
  };
  const mockContext: CloudflareContext = {
    env: mockEnv,
    request: new Request('http://localhost/api/study-path/progress?dailyMinutesLimit=60&targetRetention=0.9'),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (isKVAvailable as any).mockReturnValue(false);
    (resolveOrCreateUserRecord as any).mockResolvedValue({ id: 'user-db-1' });
    (getStudyPathCacheKey as any).mockReturnValue('cache-key');
    (analyzePerformanceGaps as any).mockResolvedValue([
      {
        taxonomyCode: 'Cardiovascular',
        subcategory: 'Valvular disease',
        currentAccuracy: 0.7,
        targetAccuracy: 0.85,
        gap: 0.15,
        reviewCount: 12,
        lastReviewedAt: new Date('2026-05-01T00:00:00Z'),
      },
    ]);
    (scheduleReviews as any).mockResolvedValue([
      {
        taxonomyCode: 'Cardiovascular',
        subcategory: 'Valvular disease',
        recommendedReviewDate: new Date('2026-05-03T00:00:00Z'),
        urgencyScore: 0.8,
        confidence: 'HIGH',
      },
    ]);
    (balanceBlueprintPriorities as any).mockResolvedValue([
      {
        taxonomyCode: 'Cardiovascular',
        subcategory: 'Valvular disease',
        priorityScore: 0.7,
        weightDeviation: 0.1,
      },
    ]);
    (generateStudyPlan as any).mockResolvedValue({
      plan: {
        id: 'progress-plan',
        userId: 'user-db-1',
        generatedAt: new Date('2026-05-02T12:00:00Z'),
        validUntil: new Date('2026-05-03T12:00:00Z'),
        sessions: [
          {
            id: 'session-1',
            date: new Date('2026-05-03T14:00:00Z'),
            topics: [
              {
                taxonomyCode: 'Cardiovascular',
                subcategory: 'Valvular disease',
                recommendedAction: 'REVIEW',
                estimatedMinutes: 30,
                urgencyScore: 0.8,
              },
            ],
          },
        ],
        totalEstimatedMinutes: 30,
        confidence: 0.8,
        metadata: {
          blueprintCoverage: { Cardiovascular: 1 },
          projectedRetentionIncrease: 0.1,
          fatigueRisk: 'LOW',
          gapsProcessed: 1,
          constraintsUsed: {},
        },
      },
      alternatives: [],
      rationale: 'Test rationale',
      canRegenerate: true,
    });
    (fetchConfidenceData as any).mockResolvedValue({
      reviewCounts: {},
      accuracyVariances: {},
      daysSinceLastReview: {},
    });
    (computeConfidence as any).mockResolvedValue({
      confidence: 0.9,
      perTopicConfidence: {},
      flags: [],
      recommendations: [],
    });
  });

  it('resolves the internal user and calls generateStudyPlan with prisma plus input', async () => {
    const response = await onProgressGet({
      ...mockContext,
      auth: mockAuth,
      validated: mockValidated,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.currentPlanId).toBe('progress-plan');
    expect(body.data.projections).toHaveLength(1);
    expect(resolveOrCreateUserRecord).toHaveBeenCalledWith(
      expect.anything(),
      'clerk-user-123',
      { id: true }
    );
    expect(analyzePerformanceGaps).toHaveBeenCalledWith(
      expect.anything(),
      'user-db-1',
      expect.any(Object)
    );
    expect(generateStudyPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-db-1' })
    );
  });

  it('normalizes cached plan dates from the unified envelope source', async () => {
    (isKVAvailable as any).mockReturnValue(true);
    (getFromCache as any).mockResolvedValue({
      plan: {
        id: 'cached-progress-plan',
        userId: 'user-db-1',
        generatedAt: '2026-05-02T12:00:00.000Z',
        validUntil: '2026-05-03T12:00:00.000Z',
        sessions: [
          {
            id: 'session-cached',
            date: '2026-05-03T14:00:00.000Z',
            topics: [
              {
                taxonomyCode: 'Pulmonary',
                recommendedAction: 'REVIEW',
                estimatedMinutes: 20,
                urgencyScore: 0.6,
              },
            ],
          },
        ],
        totalEstimatedMinutes: 20,
        confidence: 0.8,
        metadata: {
          blueprintCoverage: { Pulmonary: 1 },
          projectedRetentionIncrease: 0.05,
          fatigueRisk: 'LOW',
          gapsProcessed: 1,
          constraintsUsed: {},
        },
      },
    });

    const response = await onProgressGet({
      ...mockContext,
      auth: mockAuth,
      validated: mockValidated,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.currentPlanId).toBe('cached-progress-plan');
    expect(body.data.projections).toHaveLength(1);
    expect(generateStudyPlan).not.toHaveBeenCalled();
  });

  it('uses requested cached alternative plan when planId is provided', async () => {
    (isKVAvailable as any).mockReturnValue(true);
    (getFromCache as any).mockResolvedValue({
      plan: {
        id: 'cached-primary-plan',
        userId: 'user-db-1',
        generatedAt: '2026-05-02T12:00:00.000Z',
        validUntil: '2026-05-03T12:00:00.000Z',
        sessions: [],
        totalEstimatedMinutes: 0,
        confidence: 0.8,
        metadata: {
          blueprintCoverage: {},
          projectedRetentionIncrease: 0,
          fatigueRisk: 'LOW',
        },
      },
      alternatives: [
        {
          id: 'cached-alt-plan',
          userId: 'user-db-1',
          generatedAt: '2026-05-02T12:00:00.000Z',
          validUntil: '2026-05-03T12:00:00.000Z',
          sessions: [
            {
              id: 'session-alt',
              date: '2026-05-04T14:00:00.000Z',
              topics: [
                {
                  taxonomyCode: 'Renal',
                  recommendedAction: 'REVIEW',
                  estimatedMinutes: 25,
                  urgencyScore: 0.7,
                },
              ],
            },
          ],
          totalEstimatedMinutes: 25,
          confidence: 0.75,
          metadata: {
            blueprintCoverage: { Renal: 1 },
            projectedRetentionIncrease: 0.08,
            fatigueRisk: 'LOW',
            gapsProcessed: 1,
            constraintsUsed: {},
          },
        },
      ],
    });

    const response = await onProgressGet({
      ...mockContext,
      auth: mockAuth,
      validated: { ...mockValidated, planId: 'cached-alt-plan' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.currentPlanId).toBe('cached-alt-plan');
    expect(body.data.projections).toHaveLength(1);
    expect(generateStudyPlan).not.toHaveBeenCalled();
  });
});
