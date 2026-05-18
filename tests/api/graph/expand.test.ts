import { describe, expect, it, vi, beforeEach } from 'vitest';
import { onRequestPost } from '@/functions/api/graph/expand';

const { mockGraphEdgeFindMany, mockSafePrismaDisconnect } = vi.hoisted(() => ({
  mockGraphEdgeFindMany: vi.fn(),
  mockSafePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    graphEdge: {
      findMany: mockGraphEdgeFindMany,
    },
  })),
  safePrismaDisconnect: mockSafePrismaDisconnect,
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema, handler) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body =
      result.error != null
        ? JSON.stringify({ error: result.error })
        : JSON.stringify(result.data ?? result);
    return new Response(body, {
      status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  }),
}));

vi.mock('../../../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../functions/api/_shared/kv-cache', () => ({
  getOrSet: vi.fn((_env, _key, fetchFn) => fetchFn()),
}));

function node(id: string, label: string) {
  return {
    id,
    label,
    nodeType: 'CONDITION',
    description: null,
    sourceType: 'fixture',
    sourceId: id,
    taxonomyCode: null,
    systemCodes: ['cardiovascular'],
    metadata: null,
  };
}

describe('POST /api/graph/expand', () => {
  const n1 = node('n1', 'Chest Pain');
  const n2 = node('n2', 'Acute Coronary Syndrome');
  const n3 = node('n3', 'Pulmonary Embolism');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expands both outgoing and incoming edges from the frontier', async () => {
    mockGraphEdgeFindMany
      .mockResolvedValueOnce([
        {
          id: 'e-out',
          sourceId: 'n1',
          targetId: 'n2',
          edgeType: 'DIFFERENTIAL',
          weight: 0.9,
          description: 'outgoing differential',
          evidenceCount: 2,
          source: n1,
          target: n2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'e-in',
          sourceId: 'n3',
          targetId: 'n1',
          edgeType: 'DIFFERENTIAL',
          weight: 0.8,
          description: 'incoming differential',
          evidenceCount: 1,
          source: n3,
          target: n1,
        },
      ]);

    const response = await onRequestPost({
      env: { DATABASE_URL: 'prisma://test' },
      auth: { userId: 'user-1' },
      validated: {
        nodeIds: ['n1'],
        depth: 1,
        edgeTypes: ['DIFFERENTIAL'],
        includeOriginalNodes: true,
      },
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.nodes.map((item: { id: string }) => item.id).sort()).toEqual(['n1', 'n2', 'n3']);
    expect(body.edges.map((item: { id: string }) => item.id).sort()).toEqual(['e-in', 'e-out']);
    expect(body.expandedNodeIds.sort()).toEqual(['n1', 'n2', 'n3']);
    expect(mockGraphEdgeFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ sourceId: { in: ['n1'] } }),
      })
    );
    expect(mockGraphEdgeFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ targetId: { in: ['n1'] } }),
      })
    );
    expect(mockSafePrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('can omit original nodes while preserving neighbor nodes and edges', async () => {
    mockGraphEdgeFindMany
      .mockResolvedValueOnce([
        {
          id: 'e-out',
          sourceId: 'n1',
          targetId: 'n2',
          edgeType: 'DIFFERENTIAL',
          weight: 0.9,
          description: null,
          evidenceCount: 1,
          source: n1,
          target: n2,
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await onRequestPost({
      env: { DATABASE_URL: 'prisma://test' },
      auth: { userId: 'user-1' },
      validated: {
        nodeIds: ['n1'],
        depth: 1,
        edgeTypes: undefined,
        includeOriginalNodes: false,
      },
    } as any);

    const body = await response.json();

    expect(body.nodes.map((item: { id: string }) => item.id)).toEqual(['n2']);
    expect(body.edges).toHaveLength(1);
  });
});
