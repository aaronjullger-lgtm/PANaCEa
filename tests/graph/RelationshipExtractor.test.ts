import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GraphEdgeType } from '@prisma/client';
import { RelationshipExtractor } from '@/services/graph/RelationshipExtractor';

// Mock prisma — use vi.hoisted() to avoid hoisting issues
const {
  mockConditionFindMany,
  mockMedicalContentFindMany,
  mockGraphEdgeUpsert,
  mockTransaction,
} = vi.hoisted(() => ({
  mockConditionFindMany: vi.fn().mockImplementation(() => Promise.resolve([])),
  mockMedicalContentFindMany: vi.fn(),
  mockGraphEdgeUpsert: vi.fn(),
  mockTransaction: vi.fn((ops: any[]) => Promise.all(ops.map((op: any) => op()))),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    medicalContent: { findMany: mockMedicalContentFindMany },
    condition: { findMany: mockConditionFindMany },
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
  });

  // TODO: Test with actual condition name extraction
  // This would require mocking a medical NER service or lookup
});