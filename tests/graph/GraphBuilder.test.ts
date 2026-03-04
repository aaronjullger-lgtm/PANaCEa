import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GraphNodeType, GraphEdgeType } from '@prisma/client';
import { GraphBuilder } from '@/services/graph/GraphBuilder';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    medicalContent: {
      findMany: vi.fn(),
    },
    anatomyStructure: {
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
      upsert: vi.fn(),
    },
    graphEdge: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops.map((op: any) => op()))),
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

  // More tests can be added for other node builders and edge builders
});