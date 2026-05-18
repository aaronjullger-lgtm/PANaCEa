import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { pathFinder } from '@/services/domain/pathFinderService';
import type { EdgePrismaClient } from '@/functions/api/_shared/prisma-edge';

// Mock Prisma client
const createMockPrisma = () =>
  ({
    graphNode: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    graphEdge: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  }) as unknown as EdgePrismaClient;

describe('pathFinder', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
    // Default mocks
    (mockPrisma.graphEdge.findMany as Mock).mockResolvedValue([]);
    (mockPrisma.graphNode.count as Mock).mockResolvedValue(0);
  });

  describe('findShortestPathBFS', () => {
    it('should return null if start node does not exist', async () => {
      // The algorithm does not fetch the start node when start != end.
      // It will attempt to find edges from start node, which will be empty.
      // Default mock for graphEdge.findMany returns [].
      const result = await pathFinder.findShortestPathBFS(
        mockPrisma,
        'nonexistent',
        'target',
        10,
        []
      );

      expect(result).toBeNull();
      // No findUnique call expected because start != end
      expect(mockPrisma.graphNode.findUnique).not.toHaveBeenCalled();
    });

    it('should return trivial path if start equals end', async () => {
      const mockNode = {
        id: 'node1',
        nodeType: 'CONDITION',
        label: 'Hypertension',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond1',
        taxonomyCode: null,
        systemCodes: ['Cardiovascular'],
        metadata: {},
      };
      (mockPrisma.graphNode.findUnique as Mock).mockResolvedValue(mockNode);

      const result = await pathFinder.findShortestPathBFS(mockPrisma, 'node1', 'node1', 10, []);

      expect(result).toEqual({
        path: ['node1'],
        edges: [],
        totalWeight: 0,
        nodes: [
          {
            id: 'node1',
            nodeType: 'CONDITION',
            label: 'Hypertension',
            description: undefined,
            sourceType: 'MEDICAL_CONTENT',
            sourceId: 'cond1',
            taxonomyCode: undefined,
            systemCodes: ['Cardiovascular'],
            metadata: {},
          },
        ],
        edgesDetail: [],
      });
    });

    it('should find a shortest path of length 1', async () => {
      const startNode = {
        id: 'node1',
        nodeType: 'CONDITION',
        label: 'Hypertension',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond1',
        taxonomyCode: null,
        systemCodes: ['Cardiovascular'],
        metadata: {},
      };
      const endNode = {
        id: 'node2',
        nodeType: 'CONDITION',
        label: 'Diabetes',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond2',
        taxonomyCode: null,
        systemCodes: ['Endocrine'],
        metadata: {},
      };
      const edge = {
        id: 'edge1',
        sourceId: 'node1',
        targetId: 'node2',
        edgeType: 'RELATED',
        weight: 1.0,
        description: null,
        evidenceCount: 5,
      };

      (mockPrisma.graphNode.findUnique as Mock).mockImplementation((args: any) => {
        if (args.where.id === 'node1') return Promise.resolve(startNode);
        if (args.where.id === 'node2') return Promise.resolve(endNode);
        return Promise.resolve(null);
      });
      (mockPrisma.graphEdge.findMany as Mock).mockImplementation((args: any) => {
        if (args.where.sourceId === 'node1') {
          return Promise.resolve([{ id: 'edge1', targetId: 'node2', weight: 1.0 }]);
        }
        if (args.where.targetId === 'node1') {
          return Promise.resolve([]);
        }
        // For path reconstruction
        if (args.where.id?.in?.includes('edge1')) {
          return Promise.resolve([edge]);
        }
        return Promise.resolve([]);
      });
      (mockPrisma.graphNode.findMany as Mock).mockImplementation((args: any) => {
        const ids = args.where.id.in;
        const nodes = [startNode, endNode].filter((n) => ids.includes(n.id));
        return Promise.resolve(nodes);
      });

      const result = await pathFinder.findShortestPathBFS(mockPrisma, 'node1', 'node2', 10, []);

      expect(result).not.toBeNull();
      expect(result?.path).toEqual(['node1', 'node2']);
      expect(result?.edges).toEqual(['edge1']);
      expect(result?.totalWeight).toBe(1);
      expect(result?.nodes).toHaveLength(2);
      expect(result?.edgesDetail).toHaveLength(1);
    });

    it('sums the actual traversed edge weights for multi-hop BFS paths', async () => {
      const nodes = [
        {
          id: 'node1',
          nodeType: 'CONDITION',
          label: 'A',
          description: null,
          sourceType: 'MEDICAL_CONTENT',
          sourceId: 'cond1',
          taxonomyCode: null,
          systemCodes: ['Cardiovascular'],
          metadata: {},
        },
        {
          id: 'node2',
          nodeType: 'CONDITION',
          label: 'B',
          description: null,
          sourceType: 'MEDICAL_CONTENT',
          sourceId: 'cond2',
          taxonomyCode: null,
          systemCodes: ['Cardiovascular'],
          metadata: {},
        },
        {
          id: 'node3',
          nodeType: 'CONDITION',
          label: 'C',
          description: null,
          sourceType: 'MEDICAL_CONTENT',
          sourceId: 'cond3',
          taxonomyCode: null,
          systemCodes: ['Cardiovascular'],
          metadata: {},
        },
      ];
      const edge1 = {
        id: 'edge1',
        sourceId: 'node1',
        targetId: 'node2',
        edgeType: 'ASSOCIATED',
        weight: 2,
        description: null,
        evidenceCount: 1,
      };
      const edge2 = {
        id: 'edge2',
        sourceId: 'node2',
        targetId: 'node3',
        edgeType: 'ASSOCIATED',
        weight: 3,
        description: null,
        evidenceCount: 1,
      };

      (mockPrisma.graphEdge.findMany as Mock).mockImplementation((args: any) => {
        if (args.where.id?.in) {
          return Promise.resolve(
            [edge1, edge2].filter((edge) => args.where.id.in.includes(edge.id))
          );
        }
        if (args.where.sourceId === 'node1') {
          return Promise.resolve([{ id: 'edge1', targetId: 'node2', weight: 2 }]);
        }
        if (args.where.targetId === 'node1') {
          return Promise.resolve([]);
        }
        if (args.where.sourceId === 'node2') {
          return Promise.resolve([{ id: 'edge2', targetId: 'node3', weight: 3 }]);
        }
        if (args.where.targetId === 'node2') {
          return Promise.resolve([{ id: 'edge1', sourceId: 'node1', weight: 2 }]);
        }
        return Promise.resolve([]);
      });
      (mockPrisma.graphNode.findMany as Mock).mockImplementation((args: any) => {
        const ids = args.where.id.in;
        return Promise.resolve(nodes.filter((node) => ids.includes(node.id)));
      });

      const result = await pathFinder.findShortestPathBFS(mockPrisma, 'node1', 'node3', 10, []);

      expect(result?.path).toEqual(['node1', 'node2', 'node3']);
      expect(result?.edges).toEqual(['edge1', 'edge2']);
      expect(result?.totalWeight).toBe(5);
    });

    it('should respect edge type filter', async () => {
      const startNode = { id: 'node1' } as any;
      (mockPrisma.graphNode.findUnique as Mock).mockResolvedValue(startNode);
      (mockPrisma.graphEdge.findMany as Mock).mockResolvedValue([]);

      await pathFinder.findShortestPathBFS(mockPrisma, 'node1', 'node2', 10, ['RELATED']);

      // Expect edge type filter passed to findMany
      expect(mockPrisma.graphEdge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ edgeType: { in: ['RELATED'] } }),
        })
      );
    });

    it('should return null if max depth exceeded', async () => {
      const startNode = { id: 'node1' } as any;
      (mockPrisma.graphNode.findUnique as Mock).mockResolvedValue(startNode);
      // Simulate no edges
      (mockPrisma.graphEdge.findMany as Mock).mockResolvedValue([]);

      const result = await pathFinder.findShortestPathBFS(
        mockPrisma,
        'node1',
        'node2',
        0, // maxDepth zero means path length cannot exceed 1
        []
      );

      expect(result).toBeNull();
    });
  });

  describe('findShortestPathDijkstra', () => {
    it('should handle weighted edges correctly', async () => {
      const startNode = {
        id: 'node1',
        nodeType: 'CONDITION',
        label: 'A',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond1',
        taxonomyCode: null,
        systemCodes: ['Cardiovascular'],
        metadata: {},
      };
      const middleNode = {
        id: 'node2',
        nodeType: 'CONDITION',
        label: 'B',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond2',
        taxonomyCode: null,
        systemCodes: ['Cardiovascular'],
        metadata: {},
      };
      const endNode = {
        id: 'node3',
        nodeType: 'CONDITION',
        label: 'C',
        description: null,
        sourceType: 'MEDICAL_CONTENT',
        sourceId: 'cond3',
        taxonomyCode: null,
        systemCodes: ['Cardiovascular'],
        metadata: {},
      };
      const edge1 = { id: 'edge1', sourceId: 'node1', targetId: 'node2', weight: 5.0 };
      const edge2 = { id: 'edge2', sourceId: 'node2', targetId: 'node3', weight: 2.0 };
      const edge3 = { id: 'edge3', sourceId: 'node1', targetId: 'node3', weight: 10.0 };

      (mockPrisma.graphNode.findUnique as Mock).mockImplementation((args: any) => {
        if (args.where.id === 'node1') return Promise.resolve(startNode);
        if (args.where.id === 'node3') return Promise.resolve(endNode);
        return Promise.resolve(null);
      });
      (mockPrisma.graphEdge.findMany as Mock).mockImplementation((args: any) => {
        // neighbor queries
        if (args.where.sourceId === 'node1') {
          return Promise.resolve([edge1, edge3]);
        }
        if (args.where.sourceId === 'node2') {
          return Promise.resolve([edge2]);
        }
        // incoming edges
        if (args.where.targetId === 'node1') {
          return Promise.resolve([]);
        }
        if (args.where.targetId === 'node2') {
          return Promise.resolve([edge1]);
        }
        if (args.where.targetId === 'node3') {
          return Promise.resolve([edge2, edge3]);
        }
        // path reconstruction
        if (args.where.id?.in?.includes('edge1') || args.where.id?.in?.includes('edge2')) {
          return Promise.resolve([edge1, edge2]);
        }
        return Promise.resolve([]);
      });
      // For node retrieval in reconstructPath
      (mockPrisma.graphNode.findMany as Mock).mockImplementation((args: any) => {
        const ids = args.where.id.in;
        const nodes = [startNode, middleNode, endNode].filter((n) => ids.includes(n.id));
        return Promise.resolve(nodes);
      });

      const result = await pathFinder.findShortestPathDijkstra(
        mockPrisma,
        'node1',
        'node3',
        1000,
        []
      );

      // Dijkstra should pick node1->node2->node3 (weight 7) over node1->node3 (weight 10)
      expect(result?.path).toEqual(['node1', 'node2', 'node3']);
      expect(result?.totalWeight).toBe(7);
    });
  });

  describe('searchNodes', () => {
    it('should return nodes matching query', async () => {
      const mockNodes = [
        {
          id: 'node1',
          nodeType: 'CONDITION',
          label: 'Hypertension',
          description: 'High blood pressure',
          sourceType: 'MEDICAL_CONTENT',
          sourceId: 'cond1',
          taxonomyCode: 'ICD10:I10',
          systemCodes: ['Cardiovascular'],
          metadata: {},
        },
      ];
      (mockPrisma.graphNode.findMany as Mock).mockResolvedValue(mockNodes);
      (mockPrisma.graphNode.count as Mock).mockResolvedValue(1);

      const result = await pathFinder.searchNodes(mockPrisma, 'hypertension', 10, undefined);

      expect(result.nodes).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.query).toBe('hypertension');
      // Verify where clause includes OR with label and description
      expect(mockPrisma.graphNode.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { label: { contains: 'hypertension', mode: 'insensitive' } },
            { description: { contains: 'hypertension', mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { label: 'asc' },
      });
    });

    it('should filter by nodeTypes array if provided', async () => {
      (mockPrisma.graphNode.findMany as Mock).mockResolvedValue([]);
      (mockPrisma.graphNode.count as Mock).mockResolvedValue(0);

      await pathFinder.searchNodes(mockPrisma, 'test', 10, ['CONDITION', 'DRUG']);

      expect(mockPrisma.graphNode.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { label: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
          ],
          nodeType: { in: ['CONDITION', 'DRUG'] },
        },
        take: 10,
        orderBy: { label: 'asc' },
      });
    });
  });
});
