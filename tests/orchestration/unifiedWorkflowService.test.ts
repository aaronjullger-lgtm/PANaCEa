import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variable
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

// Mock Prisma Edge Client
vi.mock('../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    stagingQuestion: {
      findFirst: vi.fn(),
    },
    $disconnect: vi.fn(),
  })),
}));

// Mock adaptiveFSRSService
vi.mock('../../services/ai/adaptiveFSRSService', () => ({
  calculateOptimalRetention: vi.fn(() => 0.88),
  fetchUserReviewHistory: vi.fn(() => []),
}));

// Mock questionService (pearl extraction)
vi.mock('../../services/questionService', () => ({
  extractPearlsFromRationale: vi.fn(() => ['Mock pearl 1', 'Mock pearl 2']),
}));

// Import the service after mocks
import { orchestrateUnifiedWorkflow } from '../../services/orchestration/unifiedWorkflowService';

describe('Unified Workflow Orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a successful result with default options', async () => {
    // Mock staging lake lookup to return null (no staging question)
    const mockPrisma = {
      stagingQuestion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn(),
    };
    const { createEdgePrismaClient } = await import('../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

    const result = await orchestrateUnifiedWorkflow({
      userId: 'test-user-123',
      queryText: 'Heart failure',
      system: 'Cardiovascular',
      difficulty: 'medium',
    });

    expect(result.success).toBe(true);
    expect(result.question).toBeDefined();
    expect(result.metadata.aiGenerationUsed).toBe(true);
    expect(result.metadata.stagingLakeUsed).toBe(false);
    expect(result.metadata.cmrrUsed).toBe(false); // CMRR is enabled but not used due to empty review history
    expect(result.metadata.pearlHarvestingUsed).toBe(true); // Pearl extraction enabled by default
    expect(result.fromStaging).toBe(false);
  });

  it('should use staging question when available', async () => {
    const mockStagingQuestion = {
      id: 'staging-123',
      system: 'Cardiovascular',
      difficulty: 'medium',
      question: 'What is the most common cause of heart failure?',
      vignette: 'A 65-year-old male presents with shortness of breath...',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: {
        rationale: 'Heart failure is commonly caused by...',
      },
      status: 'graded',
      createdAt: new Date('2026-02-19'),
    };

    const mockPrisma = {
      stagingQuestion: {
        findFirst: vi.fn().mockResolvedValue(mockStagingQuestion),
      },
      $disconnect: vi.fn(),
    };
    const { createEdgePrismaClient } = await import('../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

    const result = await orchestrateUnifiedWorkflow({
      userId: 'test-user-123',
      queryText: 'Heart failure',
      system: 'Cardiovascular',
      difficulty: 'medium',
      includeStagingLookup: true,
    });

    expect(result.success).toBe(true);
    expect(result.fromStaging).toBe(true);
    expect(result.stagingId).toBe('staging-123');
    expect(result.metadata.stagingLakeUsed).toBe(true);
    expect(result.metadata.aiGenerationUsed).toBe(false);
    expect(result.question.text).toBe(mockStagingQuestion.question);
  });

  it('should extract pearls when rationale exists', async () => {
    const mockPrisma = {
      stagingQuestion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn(),
    };
    const { createEdgePrismaClient } = await import('../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

    const { extractPearlsFromRationale } = await import('../../services/questionService');
    (extractPearlsFromRationale as any).mockReturnValue(['Pearl about heart failure']);

    const result = await orchestrateUnifiedWorkflow({
      userId: 'test-user-123',
      queryText: 'Heart failure',
      includePearlExtraction: true,
    });

    expect(result.extractedPearls).toEqual(['Pearl about heart failure']);
    expect(result.metadata.pearlHarvestingUsed).toBe(true);
  });

  it('should handle CMRR calculation when review history is available', async () => {
    const mockPrisma = {
      stagingQuestion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn(),
    };
    const { createEdgePrismaClient } = await import('../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

    const { fetchUserReviewHistory, calculateOptimalRetention } = await import('../../services/ai/adaptiveFSRSService');
    (fetchUserReviewHistory as any).mockResolvedValue([
      { rating: 3, elapsedDays: 1 },
      { rating: 4, elapsedDays: 2 },
    ]);
    (calculateOptimalRetention as any).mockReturnValue(0.85);

    const result = await orchestrateUnifiedWorkflow({
      userId: 'test-user-123',
      queryText: 'Heart failure',
      includeCMRR: true,
    });

    expect(result.optimalRetention).toBe(0.85);
    expect(result.metadata.cmrrUsed).toBe(true);
  });

  it('should gracefully handle errors in staging lookup', async () => {
    const mockPrisma = {
      stagingQuestion: {
        findFirst: vi.fn().mockRejectedValue(new Error('DB error')),
      },
      $disconnect: vi.fn(),
    };
    const { createEdgePrismaClient } = await import('../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

    const result = await orchestrateUnifiedWorkflow({
      userId: 'test-user-123',
      queryText: 'Heart failure',
      includeStagingLookup: true,
    });

    // Should still succeed because staging lookup errors are caught
    expect(result.success).toBe(true);
    expect(result.metadata.stagingLakeUsed).toBe(false);
    expect(result.metadata.aiGenerationUsed).toBe(true);
  });
});