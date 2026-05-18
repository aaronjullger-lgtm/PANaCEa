import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GraphEdgeType } from '@prisma/client';
import { RelationshipExtractor } from '@/services/graph/RelationshipExtractor';

// Mock prisma — use vi.hoisted() to avoid hoisting issues
const {
  mockConditionFindMany,
  mockDrugFindMany,
  mockMedicalContentFindMany,
  mockGraphEdgeUpsert,
  mockTransaction,
} = vi.hoisted(() => ({
  mockConditionFindMany: vi.fn().mockImplementation(() => Promise.resolve([])),
  mockDrugFindMany: vi.fn().mockImplementation(() => Promise.resolve([])),
  mockMedicalContentFindMany: vi.fn(),
  mockGraphEdgeUpsert: vi.fn(),
  mockTransaction: vi.fn((ops: any[]) => Promise.all(ops)),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    medicalContent: { findMany: mockMedicalContentFindMany },
    condition: { findMany: mockConditionFindMany },
    drug: { findMany: mockDrugFindMany },
    graphEdge: { upsert: mockGraphEdgeUpsert },
    $transaction: mockTransaction,
  },
}));

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
      mockMedicalContentFindMany.mockResolvedValue(mockContents);
      mockConditionFindMany.mockResolvedValue([]);
      await extractor.extractAll();
      expect(mockMedicalContentFindMany).toHaveBeenCalledWith({
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
      expect(mockGraphEdgeUpsert).not.toHaveBeenCalled();
    });

    it('creates typed TREATS edges from treatment drug mentions', async () => {
      mockMedicalContentFindMany.mockResolvedValue([
        {
          id: '1',
          conditionId: 'cond1',
          condition: 'Hypertension',
          differentialDiagnosis: null,
          complications: null,
          treatment: 'Start lisinopril when clinically appropriate.',
          riskFactors: null,
          symptoms: null,
          buzzwords: [],
          relatedSystems: [],
        },
      ]);
      mockDrugFindMany.mockResolvedValue([
        {
          id: 'drug1',
          genericName: 'lisinopril',
          brandName: 'Zestril',
          displayName: 'Lisinopril',
          aliases: [],
        },
      ]);
      mockGraphEdgeUpsert.mockResolvedValue({});

      await extractor.extractAll();

      expect(mockGraphEdgeUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sourceId_targetId_edgeType: {
              sourceId: 'drug:drug1',
              targetId: 'condition:cond1',
              edgeType: GraphEdgeType.TREATS,
            },
          },
          create: expect.objectContaining({
            sourceId: 'drug:drug1',
            targetId: 'condition:cond1',
            edgeType: GraphEdgeType.TREATS,
            description: 'Lisinopril treats condition',
          }),
        })
      );
    });
  });

  // TODO: Test with actual condition name extraction
  // This would require mocking a medical NER service or lookup
});
