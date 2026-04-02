import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GraphEdgeType } from '@prisma/client';
import { RelationshipExtractor } from '@/services/graph/RelationshipExtractor';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    medicalContent: {
      findMany: vi.fn(),
    },
    condition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    graphEdge: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops.map((op: any) => op()))),
  },
}));

import { prisma } from '@/lib/prisma';

describe('RelationshipExtractor', () => {
  let extractor: RelationshipExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new RelationshipExtractor();
  });

  describe('extractAll', () => {
    it('should process all medical content', async () => {
      const mockContents = [
        {
          id: '1',
          conditionId: 'cond1',
          condition: 'Hypertension',
          differentialDiagnosis: 'Secondary hypertension, Renal artery stenosis',
          complications: 'Heart failure, Stroke',
          treatment: null,
          riskFactors: 'Obesity, Smoking',
          symptoms: null,
          buzzwords: [],
          relatedSystems: [],
        },
      ];
      (prisma.medicalContent.findMany as Mock).mockResolvedValue(mockContents);
      // Mock extractConditionNames to return empty for simplicity
      // We'll need to mock the private method, but we can instead spy on prototype
      // For now, just ensure the method is called
      await extractor.extractAll();
      expect(prisma.medicalContent.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          conditionId: true,
          condition: true,
          differentialDiagnosis: true,
          complications: true,
          treatment: true,
          riskFactors: true,
          symptoms: true,
          buzzwords: true,
          relatedSystems: true,
        }),
        where: { status: { not: 'draft' } },
      });
      // Since extractConditionNames returns empty, no edges should be created
      expect(prisma.graphEdge.upsert).not.toHaveBeenCalled();
    });
  });

  // TODO: Test with actual condition name extraction
  // This would require mocking a medical NER service or lookup
});