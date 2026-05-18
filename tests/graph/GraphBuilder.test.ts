import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GraphNodeType, GraphEdgeType } from '@prisma/client';
import { GraphBuilder } from '@/services/graph/GraphBuilder';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    medicalContent: {
      findMany: vi.fn(),
    },
    systemMapping: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    anatomyStructure: {
      findMany: vi.fn(),
    },
    condition: {
      findMany: vi.fn(),
    },
    drug: {
      findMany: vi.fn(),
    },
    procedure: {
      findMany: vi.fn(),
    },
    physicalExamFinding: {
      findMany: vi.fn(),
    },
    labTest: {
      findMany: vi.fn(),
    },
    imagingStudy: {
      findMany: vi.fn(),
    },
    vitalSignRange: {
      findMany: vi.fn(),
    },
    graphNode: {
      deleteMany: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
    graphEdge: {
      deleteMany: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
    // $transaction receives an array of promises (from upsert calls), not functions
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

import { prisma } from '@/lib/prisma';

describe('GraphBuilder', () => {
  let builder: GraphBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new GraphBuilder({ rebuild: false, batchSize: 10 });
  });

  describe('clearGraph', () => {
    it('should delete edges then nodes', async () => {
      await builder.clearGraph();
      expect(prisma.graphEdge.deleteMany).toHaveBeenCalledWith({});
      expect(prisma.graphNode.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe('buildConditionNodes', () => {
    it('should create nodes for each condition', async () => {
      const mockConditions = [
        {
          conditionId: 'cond1',
          condition: 'Hypertension',
          system: 'Cardiovascular',
          subcategory: 'Primary',
          canonicalName: 'Essential Hypertension',
          parent_category: 'Cardiovascular',
          parentId: null,
          pance_yield: 0.85,
        },
        {
          conditionId: 'cond2',
          condition: 'Diabetes Mellitus',
          system: 'Endocrine',
          subcategory: 'Type 2',
          canonicalName: 'Type 2 Diabetes',
          parent_category: 'Endocrine',
          parentId: null,
          pance_yield: 0.92,
        },
      ];
      (prisma.medicalContent.findMany as Mock).mockResolvedValue(mockConditions);
      (prisma.systemMapping.findMany as Mock).mockResolvedValue([]);
      (prisma.graphNode.upsert as Mock).mockResolvedValue({});

      await (builder as any).buildConditionNodes();

      expect(prisma.medicalContent.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          conditionId: true,
          condition: true,
          system: true,
          subcategory: true,
          canonicalName: true,
          parent_category: true,
          parentId: true,
          pance_yield: true,
        }),
        where: { status: { not: 'draft' } },
      });

      // Expect two upsert calls via transaction
      expect(prisma.$transaction).toHaveBeenCalled();
      // Since we mock $transaction to execute operations, we can inspect the mock calls
      // For simplicity, just assert that upsert was called
      expect(prisma.graphNode.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildSystemNodes', () => {
    it('should create nodes for NCCPA blueprint systems', async () => {
      (prisma.graphNode.upsert as Mock).mockResolvedValue({});
      await (builder as any).buildSystemNodes();

      // Should create nodes for at least 17 systems
      expect(prisma.graphNode.upsert).toHaveBeenCalledTimes(17);
    });
  });

  describe('buildCoOccurrenceEdges', () => {
    it('creates co-occurrence edges with the CO_OCCURRENCE edge type', async () => {
      (prisma.condition.findMany as Mock).mockResolvedValue([
        { id: 'cond1', system: 'Cardiovascular' },
        { id: 'cond2', system: 'Cardiovascular' },
      ]);
      (prisma.graphEdge.upsert as Mock).mockResolvedValue({});

      await (builder as any).buildCoOccurrenceEdges();

      expect(prisma.graphEdge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sourceId_targetId_edgeType: {
              sourceId: 'condition:cond1',
              targetId: 'condition:cond2',
              edgeType: GraphEdgeType.CO_OCCURRENCE,
            },
          },
          create: expect.objectContaining({
            edgeType: GraphEdgeType.CO_OCCURRENCE,
            description: 'Same organ system co-occurrence',
          }),
        })
      );
    });
  });
});
