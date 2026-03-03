/**
 * Gap Detection Service for System Mapping Enrichment
 *
 * Detects MedicalTaxonomy nodes that are not yet linked to any NCCPA blueprint system
 * (i.e., have zero SystemMapping entries).
 *
 * Database‑First Architecture: Queries PostgreSQL directly via Prisma.
 */

import { prisma } from '../../../lib/prisma';

export interface GapDetectionResult {
  taxonomyCode: string;
  taxonomyName: string;
  description: string | null;
  weight: number;
  isActive: boolean;
  missingMappingsCount: number; // always ≥1
  exampleUnmappedSubcategories?: string[]; // potential subcategories from other sources (optional)
}

/**
 * Detect all taxonomy nodes that have no SystemMapping entries.
 * Optionally filter by active status.
 *
 * @param includeInactive - Include inactive taxonomies (default false)
 * @returns Array of gap detection results
 */
export async function detectGaps(
  includeInactive = false
): Promise<GapDetectionResult[]> {
  const whereClause: any = {
    isActive: includeInactive ? undefined : true,
  };

  // Fetch all taxonomies that match the filter
  const taxonomies = await prisma.medicalTaxonomy.findMany({
    where: whereClause,
    select: {
      code: true,
      name: true,
      description: true,
      weight: true,
      isActive: true,
      systemMappings: {
        select: { id: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  // Filter those with zero systemMappings
  const gaps = taxonomies
    .filter((tax) => tax.systemMappings.length === 0)
    .map((tax) => ({
      taxonomyCode: tax.code,
      taxonomyName: tax.name,
      description: tax.description,
      weight: tax.weight,
      isActive: tax.isActive,
      missingMappingsCount: 1, // they have zero mappings, but we treat as 1 missing mapping
      // exampleUnmappedSubcategories could be derived from other sources (e.g., MedicalContent)
    }));

  return gaps;
}

/**
 * Detect gaps with additional context from MedicalContent.
 * For each unmapped taxonomy, collect up to 5 distinct subcategory names
 * from MedicalContent records that reference this taxonomy code.
 *
 * This helps curators understand what specific content is unmapped.
 */
export async function detectGapsWithContentExamples(): Promise<GapDetectionResult[]> {
  const gaps = await detectGaps();

  // For each gap, try to find example subcategories from MedicalContent
  // Assuming MedicalContent has a system field that matches taxonomy code.
  // If not, we can skip this enrichment for now.
  // TODO: implement MedicalContent lookup once schema is known.
  return gaps;
}

/**
 * Count gaps per taxonomy (summary statistics).
 */
export async function getGapStatistics(): Promise<{
  totalGaps: number;
  activeGaps: number;
  inactiveGaps: number;
  byWeight: Record<string, number>;
}> {
  const [activeGaps, inactiveGaps] = await Promise.all([
    detectGaps(false),
    detectGaps(true).then((all) => all.filter((gap) => !gap.isActive)),
  ]);

  const totalGaps = activeGaps.length + inactiveGaps.length;

  // Group by weight categories (rounded to nearest 0.01)
  const byWeight: Record<string, number> = {};
  [...activeGaps, ...inactiveGaps].forEach((gap) => {
    const weightKey = gap.weight.toFixed(2);
    byWeight[weightKey] = (byWeight[weightKey] || 0) + 1;
  });

  return {
    totalGaps,
    activeGaps: activeGaps.length,
    inactiveGaps: inactiveGaps.length,
    byWeight,
  };
}