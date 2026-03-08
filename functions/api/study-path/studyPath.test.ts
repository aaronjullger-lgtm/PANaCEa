import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('../_shared/auth', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    userId: 'user123',
    sessionId: 'sess_123',
  }),
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
import { authenticateRequest } from '../_shared/auth';
const { onRequestGet } = await import('./recommendation');

describe('Study Path Recommendation Endpoint', () => {
  const mockEnv = {
    DATABASE_URL: 'postgresql://test',
    CLERK_SECRET_KEY: 'test-clerk-secret',
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
    (authenticateRequest as any).mockResolvedValue({
      userId: 'user123',
      sessionId: 'sess_123',
    });
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
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('alternatives');
    expect(body).toHaveProperty('rationale');
    expect(body).toHaveProperty('confidence');
    expect(body).toHaveProperty('cached', false);
    expect(body).toHaveProperty('generatedAt');
    expect(body.plan).toHaveProperty('id', 'plan-123');
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
    expect(body.cached).toBe(true);
    expect(body.plan.id).toBe('cached-plan');
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
    expect(body).toHaveProperty('error', 'Internal server error');
    expect(body).toHaveProperty('details');
  });
});