import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '@/functions/api/graph/confidence';

// Mock dependencies
vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    $disconnect: vi.fn(),
  })),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((schema, handler) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body = result.error != null
      ? JSON.stringify({ error: result.error })
      : JSON.stringify(result.data ?? result);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    return new Response(body, { status, headers });
  }),
  withCors: vi.fn(() => (request: Request) => new Response(null, { status: 204 })),
}));

vi.mock('../../../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../services/domain/scoringEngine', () => ({
  computeConfidenceForNodes: vi.fn(),
}));

describe('POST /api/graph/confidence', () => {
  let mockScoringEngine: any;
  const mockPrisma = {
    $disconnect: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import mocked modules
    const scoringEngineModule = await import('../../../services/domain/scoringEngine');
    mockScoringEngine = scoringEngineModule;
    // Setup default mock implementation
    mockScoringEngine.computeConfidenceForNodes.mockResolvedValue({});
  });

  it('should return confidence scores for valid nodeIds', async () => {
    // Mock computeConfidenceForNodes to return specific scores
    mockScoringEngine.computeConfidenceForNodes.mockResolvedValue({
      'node1': 0.75,
      'node2': 0.42,
    });

    const mockContext = {
      env: { DATABASE_URL: 'test' },
      validated: {
        nodeIds: ['node1', 'node2'],
        includeDetails: false,
      },
      auth: { userId: 'user123' },
    };

    // Call the endpoint (wrapped by mocked authenticatedEndpoint)
    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      scores: {
        'node1': 0.75,
        'node2': 0.42,
      },
    });
    // Verify computeConfidenceForNodes was called with correct arguments
    expect(mockScoringEngine.computeConfidenceForNodes).toHaveBeenCalledWith(
      expect.anything(), // prisma client
      'user123',
      ['node1', 'node2']
    );
  });

  it('should handle empty nodeIds array', async () => {
    mockScoringEngine.computeConfidenceForNodes.mockResolvedValue({});
    const mockContext = {
      env: { DATABASE_URL: 'test' },
      validated: {
        nodeIds: [],
        includeDetails: false,
      },
      auth: { userId: 'user123' },
    };

    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ scores: {} });
    expect(mockScoringEngine.computeConfidenceForNodes).toHaveBeenCalledWith(
      expect.anything(),
      'user123',
      []
    );
  });

  it('should return 500 if scoring engine throws', async () => {
    mockScoringEngine.computeConfidenceForNodes.mockRejectedValue(new Error('DB error'));
    const mockContext = {
      env: { DATABASE_URL: 'test' },
      validated: {
        nodeIds: ['node1'],
        includeDetails: false,
      },
      auth: { userId: 'user123' },
    };

    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});