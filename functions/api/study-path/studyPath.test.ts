import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './recommendation';
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

// Import mocked modules
import { analyzePerformanceGaps } from '@/services/optimizer/performanceGapAnalyzer';
import { scheduleReviews } from '@/services/optimizer/retentionAwareScheduler';
import { balanceBlueprintPriorities } from '@/services/optimizer/blueprintBalancedSelector';
import { generateStudyPlan } from '@/services/optimizer/pathGenerator';
import { computeConfidence, fetchConfidenceData } from '@/services/optimizer/confidenceScorer';
import { getFromCache, setInCache, isKVAvailable, getStudyPathCacheKey } from '../_shared/cache';

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
    (getStudyPathCacheKey as any).mockReturnValue('cache-key');
    (analyzePerformanceGaps as any).mockResolvedValue([]);
    (scheduleReviews as any).mockResolvedValue([]);
    (balanceBlueprintPriorities as any).mockResolvedValue([]);
    (generateStudyPlan as any).mockResolvedValue({
      plan: {
        id: 'plan-123',
        userId: 'user123',
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
    // Unified envelope: { success: false, error: 'INTERNAL_ERROR', message: '...' }
    expect(body.success).toBe(false);
    expect(body.error).toBe('INTERNAL_ERROR');
  });
});