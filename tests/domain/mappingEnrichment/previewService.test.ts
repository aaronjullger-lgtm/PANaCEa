import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma Edge client factory
vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
}));

// Mock blueprint compliance service
vi.mock('../../../services/domain/blueprintComplianceService', () => ({
  analyzeMedicalContentCompliance: vi.fn(),
  analyzeQuestionPoolCompliance: vi.fn(),
}));

// Mock blueprint constants
vi.mock('@/lib/constants/blueprint', () => ({
  NCCPA_2025_BLUEPRINT: {},
  normalizeSystemName: vi.fn((system) => system),
  getAllSystems: vi.fn(() => ['CV', 'GI', 'MSK', 'PUL', 'HEME', 'END', 'REN', 'NEURO', 'PSY', 'DERM', 'ID', 'ONC', 'RHEUM', 'EM', 'SURG', 'OB', 'GYN', 'PEDS', 'GERI', 'PREV', 'ETH', 'LAW']),
}));

// Import after mocks
import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { analyzeMedicalContentCompliance, analyzeQuestionPoolCompliance } from '../../../services/domain/blueprintComplianceService';
import { simulateMappingImpact } from '../../../services/domain/mappingEnrichment/previewService';

describe('PreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('simulateMappingImpact', () => {
    it('should be a function', () => {
      expect(typeof simulateMappingImpact).toBe('function');
    });

    it('should return a PreviewResult with before/after summaries', async () => {
      // Mock the database queries
      const mockPrisma = {
        medicalTaxonomy: {
          findMany: vi.fn().mockResolvedValue([
            { code: 'CV', name: 'Cardiovascular', weight: 1.0 },
            { code: 'GI', name: 'Gastrointestinal', weight: 1.0 },
            { code: 'MSK', name: 'Musculoskeletal', weight: 1.0 },
          ]),
        },
        systemMapping: {
          findMany: vi.fn().mockResolvedValue([
            { taxonomyCode: 'CV', systemCode: 'CV' },
            { taxonomyCode: 'GI', systemCode: 'GI' },
            // MSK is unmapped
          ]),
        },
        $disconnect: vi.fn(),
      };
      (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

      // Mock compliance analysis functions
      (analyzeMedicalContentCompliance as any).mockResolvedValue({});
      (analyzeQuestionPoolCompliance as any).mockResolvedValue({});

      const changes = [
        { taxonomyCode: 'MSK', systemCode: 'MSK' },
      ];

      const result = await simulateMappingImpact(changes);

      // Verify structure
      expect(result).toHaveProperty('before');
      expect(result).toHaveProperty('after');
      expect(result).toHaveProperty('changes');
      expect(result.before).toHaveProperty('complianceScore');
      expect(result.before).toHaveProperty('systems');
      expect(result.after).toHaveProperty('complianceScore');
      expect(result.after).toHaveProperty('systems');

      // Ensure the mock was called
      expect(mockPrisma.medicalTaxonomy.findMany).toHaveBeenCalled();
      expect(mockPrisma.systemMapping.findMany).toHaveBeenCalled();
    });

    it('should handle empty changes', async () => {
      const mockPrisma = {
        medicalTaxonomy: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        systemMapping: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $disconnect: vi.fn(),
      };
      (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

      const changes: any[] = [];
      const result = await simulateMappingImpact(changes);

      expect(result.before.totalMappedTaxonomies).toBe(0);
      expect(result.after.totalMappedTaxonomies).toBe(0);
    });

    it('should compute deviation correctly', async () => {
      // This test can be expanded with more precise assertions
      // For now we just ensure the function doesn't crash
      const mockPrisma = {
        medicalTaxonomy: {
          findMany: vi.fn().mockResolvedValue([
            { code: 'CV', name: 'Cardiovascular', weight: 1.0 },
            { code: 'GI', name: 'Gastrointestinal', weight: 1.0 },
          ]),
        },
        systemMapping: {
          findMany: vi.fn().mockResolvedValue([
            { taxonomyCode: 'CV', systemCode: 'CV' },
          ]),
        },
        $disconnect: vi.fn(),
      };
      (createEdgePrismaClient as any).mockReturnValue(mockPrisma);

      const changes = [
        { taxonomyCode: 'GI', systemCode: 'GI' },
      ];

      const result = await simulateMappingImpact(changes);
      expect(result.before.systems).toBeInstanceOf(Array);
      expect(result.after.systems).toBeInstanceOf(Array);
    });
  });
});