/**
 * Preview Service for System Mapping Enrichment Assistant.
 * Computes before/after blueprint coverage impact of mapping changes.
 */

import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../../../functions/api/_shared/prisma-edge';
import {
  NCCPA_2025_BLUEPRINT,
  normalizeSystemName,
  getAllSystems,
} from '@/lib/constants/blueprint';

export interface MappingChange {
  taxonomyCode: string;
  systemCode: string;
  previousSystemCode?: string;
  taxonomyName?: string;
  systemName?: string;
}

export interface TaxonomyMappingCompliance {
  system: string;
  targetPercent: number;
  targetWeight: number;
  count: number;
  totalCount: number;
  actualPercent: number;
  deviation: number;
  absoluteDeviation: number;
  status: 'met' | 'under' | 'over';
}

export interface TaxonomyComplianceSummary {
  complianceScore: number;
  systemsMet: number;
  systemsUnder: number;
  systemsOver: number;
  totalMappedTaxonomies: number;
  analyzedAt: string;
  systems: TaxonomyMappingCompliance[];
  topDeviations: TaxonomyMappingCompliance[];
  recommendations: string[];
}

export interface PreviewResult {
  before: TaxonomyComplianceSummary;
  after: TaxonomyComplianceSummary;
  changes: MappingChange[];
  medicalContentCompliance?: any; // optional, could include medical content compliance
  questionPoolCompliance?: any;
}

/**
 * Compute current taxonomy mapping distribution.
 * Returns map from system code to count of mapped taxonomy nodes.
 */
async function getCurrentTaxonomyMappingDistribution(prisma: ReturnType<typeof createEdgePrismaClient>) {
  // Fetch all active taxonomy nodes
  const taxonomies = await prisma.medicalTaxonomy.findMany({
    where: { isActive: true },
    select: { code: true, name: true, weight: true },
  });

  // Fetch all system mappings (group by taxonomyCode, pick the most recent? we'll assume each taxonomy has at most one mapping)
  const mappings = await prisma.systemMapping.findMany({
    select: { taxonomyCode: true, canonicalName: true, blueprintTags: true },
    distinct: ['taxonomyCode'],
  });

  // Group by taxonomyCode, pick first system (should be unique)
  const mappingByTaxonomy = new Map<string, string>();
  for (const mapping of mappings) {
    const mappedSystem = resolveKnownSystem(
      ...(Array.isArray(mapping.blueprintTags) ? mapping.blueprintTags : []),
      mapping.canonicalName
    );
    if (!mappedSystem) continue;
    if (!mappingByTaxonomy.has(mapping.taxonomyCode)) {
      mappingByTaxonomy.set(mapping.taxonomyCode, mappedSystem);
    }
  }

  // Count taxonomy nodes per system
  const systemCounts = new Map<string, number>();
  let totalMapped = 0;
  for (const tax of taxonomies) {
    const system = mappingByTaxonomy.get(tax.code);
    if (system) {
      systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
      totalMapped++;
    }
  }

  return { systemCounts, totalMapped, taxonomiesCount: taxonomies.length };
}

function resolveKnownSystem(...candidates: Array<string | null | undefined>): string | null {
  const validSystems = new Set(getAllSystems());
  for (const candidate of candidates) {
    if (!candidate || candidate.trim().length === 0) continue;
    const normalized = normalizeSystemName(candidate.trim());
    if (validSystems.has(normalized)) {
      return normalized;
    }
  }
  return null;
}

function requireDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('simulateMappingImpact requires an injected DATABASE_URL');
  }
  return databaseUrl;
}

/**
 * Compute taxonomy compliance summary based on system counts.
 */
function computeTaxonomyComplianceSummary(
  systemCounts: Map<string, number>,
  totalMapped: number,
  totalTaxonomies: number,
  weights: Record<string, number>
): TaxonomyComplianceSummary {
  const DEVIATION_TOLERANCE = 0.5; // percentage points

  const systems: TaxonomyMappingCompliance[] = [];
  const allSystems = getAllSystems();

  for (const system of allSystems) {
    const count = systemCounts.get(system) || 0;
    const targetWeight = weights[system] ?? 0;
    const targetPercent = targetWeight * 100;
    const actualPercent = totalMapped > 0 ? (count / totalMapped) * 100 : 0;
    const deviation = actualPercent - targetPercent;
    const absoluteDeviation = Math.abs(deviation);
    let status: 'met' | 'under' | 'over' = 'met';
    if (deviation < -DEVIATION_TOLERANCE) status = 'under';
    else if (deviation > DEVIATION_TOLERANCE) status = 'over';

    systems.push({
      system,
      targetPercent,
      targetWeight,
      count,
      totalCount: totalMapped,
      actualPercent,
      deviation,
      absoluteDeviation,
      status,
    });
  }

  // Sort by absolute deviation descending
  systems.sort((a, b) => b.absoluteDeviation - a.absoluteDeviation);
  const topDeviations = systems.slice(0, 5);

  // Compliance score (inverse of total absolute deviation)
  const totalAbsoluteDeviation = systems.reduce((sum, sys) => sum + sys.absoluteDeviation, 0);
  const complianceScore = Math.max(0, 100 - (totalAbsoluteDeviation / 100) * 100);

  const systemsMet = systems.filter((s) => s.status === 'met').length;
  const systemsUnder = systems.filter((s) => s.status === 'under').length;
  const systemsOver = systems.filter((s) => s.status === 'over').length;

  const recommendations: string[] = [];
  if (systemsUnder > 0) {
    recommendations.push(`${systemsUnder} systems are under‑represented in taxonomy mappings. Consider adding more mappings for those systems.`);
  }
  if (systemsOver > 0) {
    recommendations.push(`${systemsOver} systems are over‑represented. Ensure mappings are balanced.`);
  }
  if (systemsMet === systems.length) {
    recommendations.push('Taxonomy mapping distribution meets blueprint targets.');
  }

  return {
    complianceScore,
    systemsMet,
    systemsUnder,
    systemsOver,
    totalMappedTaxonomies: totalMapped,
    analyzedAt: new Date().toISOString(),
    systems,
    topDeviations,
    recommendations,
  };
}

/**
 * Simulate mapping changes and compute before/after taxonomy compliance.
 */
export async function simulateMappingImpact(
  changes: MappingChange[],
  databaseUrl: string
): Promise<PreviewResult> {
  const prisma = createEdgePrismaClient(requireDatabaseUrl(databaseUrl));
  try {
    // 1. Get current distribution
    const { systemCounts: beforeCounts, totalMapped: beforeTotal, taxonomiesCount } =
      await getCurrentTaxonomyMappingDistribution(prisma);

    // 2. Get blueprint weights
    let weights: Record<string, number>;
    try {
      const config = await prisma.nCCPABlueprintConfig.findFirst({
        where: { isActive: true },
        orderBy: { effectiveDate: 'desc' },
      });
      if (config?.weights && typeof config.weights === 'object') {
        weights = config.weights as Record<string, number>;
      } else {
        weights = NCCPA_2025_BLUEPRINT;
      }
    } catch (error) {
      console.warn('Failed to fetch NCCPA blueprint config, using static constants', error);
      weights = NCCPA_2025_BLUEPRINT;
    }

    // 3. Compute before compliance
    const before = computeTaxonomyComplianceSummary(beforeCounts, beforeTotal, taxonomiesCount, weights);

    // 4. Apply changes to system counts (simulate)
    const afterCounts = new Map(beforeCounts);
    let mappedTotalDelta = 0;
    for (const change of changes) {
      const prevSystem = resolveKnownSystem(change.previousSystemCode);
      const newSystem = resolveKnownSystem(change.systemCode);

      if (!newSystem) {
        throw new Error(`Unsupported system mapping target: ${change.systemCode}`);
      }

      if (prevSystem) {
        const prevCount = afterCounts.get(prevSystem) || 0;
        if (prevCount > 0) {
          afterCounts.set(prevSystem, prevCount - 1);
        }
      } else {
        mappedTotalDelta += 1;
      }
      const newCount = afterCounts.get(newSystem) || 0;
      afterCounts.set(newSystem, newCount + 1);
    }

    const afterTotal = beforeTotal + mappedTotalDelta;

    // 5. Compute after compliance
    const after = computeTaxonomyComplianceSummary(afterCounts, afterTotal, taxonomiesCount, weights);

    // 6. Optionally fetch medical content and question pool compliance (current state)
    // We'll call the existing services but they are async; we can run in parallel if needed.
    // For now, we'll skip to keep response fast.

    return {
      before,
      after,
      changes,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
