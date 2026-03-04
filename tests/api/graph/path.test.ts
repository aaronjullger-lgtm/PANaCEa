import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '@/functions/api/graph/path';

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

vi.mock('../../../services/domain/pathFinderService', () => ({
  pathFinder: {
    findShortestPathBFS: vi.fn(),
    findShortestPathDijkstra: vi.fn(),
  },
}));

describe('POST /api/graph/path', () => {
  let mockPathFinder: any;
  const mockPrisma = {
    $disconnect: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import mocked modules
    const pathFinderModule = await import('../../../services/domain/pathFinderService');
    mockPathFinder = pathFinderModule.pathFinder;
    const { createEdgePrismaClient } = await import('../../../functions/api/_shared/prisma-edge');
    (createEdgePrismaClient as any).mockReturnValue(mockPrisma);
  });

  it('should export onRequestPost function', () => {
    expect(typeof onRequestPost).toBe('function');
  });

  it('should call BFS algorithm and return path', async () => {
    const mockResult = {
      path: ['node1', 'node2'],
      edges: ['edge1'],
      totalWeight: 1,
      nodes: [
        { id: 'node1', label: 'A', nodeType: 'CONDITION' },
        { id: 'node2', label: 'B', nodeType: 'CONDITION' },
      ],
      edgesDetail: [{ id: 'edge1', edgeType: 'ASSOCIATED' }],
    };
    mockPathFinder.findShortestPathBFS.mockResolvedValue(mockResult);

    const mockContext = {
      env: { DATABASE_URL: 'prisma://accelerate.prisma-data.net/?api_key=test' },
      validated: {
        startNodeId: 'node1',
        endNodeId: 'node2',
        algorithm: 'bfs' as const,
        maxDepth: 10,
        maxVisits: 1000,
        edgeTypes: undefined,
        includeNodes: true,
        includeEdges: true,
      },
      auth: { userId: 'user123' },
    };

    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.path).toEqual(['node1', 'node2']);
    expect(data.algorithm).toBe('bfs');
    expect(mockPathFinder.findShortestPathBFS).toHaveBeenCalledWith(
      mockPrisma,
      'node1',
      'node2',
      10,
      undefined
    );
  });

  it('should call Dijkstra algorithm when specified', async () => {
    const mockResult = {
      path: ['node1', 'node3'],
      edges: ['edge2'],
      totalWeight: 5,
      nodes: [],
      edgesDetail: [],
    };
    mockPathFinder.findShortestPathDijkstra.mockResolvedValue(mockResult);

    const mockContext = {
      env: { DATABASE_URL: 'prisma://accelerate.prisma-data.net/?api_key=test' },
      validated: {
        startNodeId: 'node1',
        endNodeId: 'node3',
        algorithm: 'dijkstra' as const,
        maxDepth: 10,
        maxVisits: 1000,
        edgeTypes: ['ASSOCIATED'],
        includeNodes: false,
        includeEdges: false,
      },
      auth: { userId: 'user123' },
    };

    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.algorithm).toBe('dijkstra');
    expect(mockPathFinder.findShortestPathDijkstra).toHaveBeenCalledWith(
      mockPrisma,
      'node1',
      'node3',
      1000,
      ['ASSOCIATED']
    );
  });

  it('should return 404 when no path found', async () => {
    mockPathFinder.findShortestPathBFS.mockResolvedValue(null);

    const mockContext = {
      env: { DATABASE_URL: 'prisma://accelerate.prisma-data.net/?api_key=test' },
      validated: {
        startNodeId: 'node1',
        endNodeId: 'node2',
        algorithm: 'bfs' as const,
        maxDepth: 10,
        maxVisits: 1000,
        edgeTypes: undefined,
        includeNodes: true,
        includeEdges: true,
      },
      auth: { userId: 'user123' },
    };

    const response = await onRequestPost(mockContext as any);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('No path found');
  });

  it('should handle edge type filtering', async () => {
    mockPathFinder.findShortestPathBFS.mockResolvedValue({
      path: ['node1', 'node2'],
      edges: ['edge1'],
      totalWeight: 1,
      nodes: [],
      edgesDetail: [],
    });

    const mockContext = {
      env: { DATABASE_URL: 'prisma://accelerate.prisma-data.net/?api_key=test' },
      validated: {
        startNodeId: 'node1',
        endNodeId: 'node2',
        algorithm: 'bfs' as const,
        maxDepth: 10,
        maxVisits: 1000,
        edgeTypes: ['ASSOCIATED', 'CAUSES'],
        includeNodes: false,
        includeEdges: false,
      },
      auth: { userId: 'user123' },
    };

    await onRequestPost(mockContext as any);
    expect(mockPathFinder.findShortestPathBFS).toHaveBeenCalledWith(
      mockPrisma,
      'node1',
      'node2',
      10,
      ['ASSOCIATED', 'CAUSES']
    );
  });
});