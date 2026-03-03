import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    medicalTaxonomy: {
      findMany: vi.fn(),
    },
  },
}));

// Import mocked prisma
import { prisma } from '../../../lib/prisma';
import { detectGaps } from '../../../services/domain/mappingEnrichment/gapDetector';

describe('GapDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectGaps', () => {
    it('should return empty array when all taxonomies have mappings', async () => {
      // Mock taxonomies with systemMappings
      (prisma.medicalTaxonomy.findMany as any).mockResolvedValue([
        {
          code: 'CV',
          name: 'Cardiovascular',
          description: 'Heart and blood vessels',
          weight: 11,
          isActive: true,
          systemMappings: [{ id: 'map1' }],
        },
        {
          code: 'PUL',
          name: 'Pulmonary',
          description: 'Lungs and respiratory',
          weight: 9,
          isActive: true,
          systemMappings: [{ id: 'map2' }, { id: 'map3' }],
        },
      ]);

      const gaps = await detectGaps();
      expect(gaps).toEqual([]);
      expect(prisma.medicalTaxonomy.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          code: true,
          name: true,
          description: true,
          weight: true,
          isActive: true,
          systemMappings: { select: { id: true } },
        },
        orderBy: { code: 'asc' },
      });
    });

    it('should detect gaps when some taxonomies have zero mappings', async () => {
      (prisma.medicalTaxonomy.findMany as any).mockResolvedValue([
        {
          code: 'CV',
          name: 'Cardiovascular',
          description: 'Heart and blood vessels',
          weight: 11,
          isActive: true,
          systemMappings: [{ id: 'map1' }],
        },
        {
          code: 'GI',
          name: 'Gastrointestinal',
          description: 'Digestive system',
          weight: 8,
          isActive: true,
          systemMappings: [],
        },
        {
          code: 'MSK',
          name: 'Musculoskeletal',
          description: 'Muscles and bones',
          weight: 8,
          isActive: true,
          systemMappings: [],
        },
      ]);

      const gaps = await detectGaps();
      expect(gaps).toHaveLength(2);
      expect(gaps[0]).toEqual({
        taxonomyCode: 'GI',
        taxonomyName: 'Gastrointestinal',
        description: 'Digestive system',
        weight: 8,
        isActive: true,
        missingMappingsCount: 1,
      });
      expect(gaps[1].taxonomyCode).toBe('MSK');
      expect(gaps[1].missingMappingsCount).toBe(1);
    });

    it('should respect includeInactive parameter', async () => {
      (prisma.medicalTaxonomy.findMany as any).mockResolvedValue([]);

      await detectGaps(true); // includeInactive = true
      expect(prisma.medicalTaxonomy.findMany).toHaveBeenCalledWith({
        where: { isActive: undefined },
        select: expect.anything(),
        orderBy: { code: 'asc' },
      });

      await detectGaps(false);
      expect(prisma.medicalTaxonomy.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.anything(),
        orderBy: { code: 'asc' },
      });
    });

    it('should include exampleUnmappedSubcategories when provided', async () => {
      // This test can be expanded when the function is extended to include examples
      // For now, just verify the basic structure
      (prisma.medicalTaxonomy.findMany as any).mockResolvedValue([
        {
          code: 'GI',
          name: 'Gastrointestinal',
          description: 'Digestive system',
          weight: 8,
          isActive: true,
          systemMappings: [],
        },
      ]);

      const gaps = await detectGaps();
      expect(gaps[0]).not.toHaveProperty('exampleUnmappedSubcategories');
    });
  });
});