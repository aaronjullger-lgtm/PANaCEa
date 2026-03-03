/**
 * Blueprint Compliance Service
 *
 * Analyzes NCCPA blueprint compliance across MedicalContent and other taxonomies.
 * Computes distribution deviations and generates recommendations for rebalancing.
 */

import { createEdgePrismaClient } from '../../functions/api/_shared/prisma-edge';
import {
  NCCPA_2025_BLUEPRINT,
  NCCPA_2025_BLUEPRINT_PERCENT,
  normalizeSystemName,
  getAllSystems,
  getSystemWeight,
} from '@/lib/constants/blueprint';

export interface CorrectiveAction {
  /** System name */
  system: string;
  /** Action type */
  action: 'generate_questions' | 'generate_content' | 'archive';
  /** Target taxonomy */
  target: 'medical' | 'questions';
  /** Number of items to generate/archive */
  quantity: number;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Human-readable reason */
  reason: string;
}

export interface SystemCompliance {
  /** Canonical system name (e.g., "Cardiovascular") */
  system: string;
  /** Target percentage (0-100) */
  targetPercent: number;
  /** Target weight (0-1) */
  targetWeight: number;
  /** Number of content items in this system */
  count: number;
  /** Total content items across all systems */
  totalCount: number;
  /** Actual percentage (0-100) */
  actualPercent: number;
  /** Deviation (actual - target) percentage points */
  deviation: number;
  /** Absolute deviation percentage points */
  absoluteDeviation: number;
  /** Compliance status */
  status: 'met' | 'under' | 'over';
  /** Recommended action */
  recommendation?: string;
}

export interface ComplianceSummary {
  /** Overall compliance score (0-100) */
  complianceScore: number;
  /** Number of systems meeting target within tolerance */
  systemsMet: number;
  /** Number of systems under target */
  systemsUnder: number;
  /** Number of systems over target */
  systemsOver: number;
  /** Total content items analyzed */
  totalContentItems: number;
  /** Date of analysis */
  analyzedAt: string;
  /** List of system-level compliance details */
  systems: SystemCompliance[];
  /** Top deviations needing attention */
  topDeviations: SystemCompliance[];
  /** General recommendations */
  recommendations: string[];
}

/**
 * Tolerance for deviation (percentage points) before flagging as under/over.
 */
const DEVIATION_TOLERANCE = 0.5; // 0.5%

/**
 * Fetch active NCCPA blueprint weights from database, fallback to static constants.
 */
async function getBlueprintWeights(
  prisma: ReturnType<typeof createEdgePrismaClient>
): Promise<Record<string, number>> {
  try {
    const config = await prisma.nCCPABlueprintConfig.findFirst({
      where: { isActive: true },
      orderBy: { effectiveDate: 'desc' },
    });
    if (config?.weights && typeof config.weights === 'object') {
      return config.weights as Record<string, number>;
    }
  } catch (error) {
    console.warn('Failed to fetch NCCPA blueprint config, using static constants', error);
  }
  return NCCPA_2025_BLUEPRINT;
}

/**
 * Compute compliance analysis for MedicalContent.
 */
export async function analyzeMedicalContentCompliance(
  databaseUrl?: string
): Promise<ComplianceSummary> {
  const prisma = createEdgePrismaClient(databaseUrl || process.env.DATABASE_URL!);
  try {
    // Step 1: Get raw counts per system from MedicalContent
    const rawCounts = await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: true,
      where: {
        // Only include published content? Might want all.
        status: { in: ['published', 'approved'] },
      },
    });

    // Step 2: Normalize system names and aggregate
    const systemMap = new Map<string, number>();
    let total = 0;
    for (const row of rawCounts) {
      const canonical = normalizeSystemName(row.system);
      const current = systemMap.get(canonical) || 0;
      systemMap.set(canonical, current + row._count);
      total += row._count;
    }

    // Ensure all canonical systems are present (zero counts)
    const allSystems = getAllSystems();
    allSystems.forEach((sys) => {
      if (!systemMap.has(sys)) systemMap.set(sys, 0);
    });

    // Step 3: Get target weights
    const weights = await getBlueprintWeights(prisma);
    const targetPercentages = Object.fromEntries(
      Object.entries(weights).map(([sys, weight]) => [sys, weight * 100])
    );

    // Step 4: Build compliance details
    const systems: SystemCompliance[] = [];
    for (const [system, count] of systemMap.entries()) {
      const targetWeight = weights[system] ?? 0;
      const targetPercent = targetWeight * 100;
      const actualPercent = total > 0 ? (count / total) * 100 : 0;
      const deviation = actualPercent - targetPercent;
      const absoluteDeviation = Math.abs(deviation);
      let status: 'met' | 'under' | 'over' = 'met';
      if (deviation < -DEVIATION_TOLERANCE) status = 'under';
      else if (deviation > DEVIATION_TOLERANCE) status = 'over';

      let recommendation = '';
      if (status === 'under') {
        recommendation = `Increase ${system} content by approximately ${Math.round(
          (targetWeight * total - count) / targetWeight
        )} items`;
      } else if (status === 'over') {
        recommendation = `Reduce focus on ${system} content generation`;
      } else {
        recommendation = 'Target met';
      }

      systems.push({
        system,
        targetPercent,
        targetWeight,
        count,
        totalCount: total,
        actualPercent,
        deviation,
        absoluteDeviation,
        status,
        recommendation,
      });
    }

    // Sort by absolute deviation descending
    systems.sort((a, b) => b.absoluteDeviation - a.absoluteDeviation);
    const topDeviations = systems.slice(0, 5);

    // Calculate compliance score (inverse of total absolute deviation, scaled)
    const maxPossibleDeviation = 100; // worst case
    const totalAbsoluteDeviation = systems.reduce((sum, sys) => sum + sys.absoluteDeviation, 0);
    const complianceScore = Math.max(0, 100 - (totalAbsoluteDeviation / maxPossibleDeviation) * 100);

    const systemsMet = systems.filter((s) => s.status === 'met').length;
    const systemsUnder = systems.filter((s) => s.status === 'under').length;
    const systemsOver = systems.filter((s) => s.status === 'over').length;

    // Generate overall recommendations
    const recommendations: string[] = [];
    if (systemsUnder > 0) {
      recommendations.push(
        `${systemsUnder} systems are under target. Consider generating additional content for those systems.`
      );
    }
    if (systemsOver > 0) {
      recommendations.push(
        `${systemsOver} systems are over target. Focus on underrepresented systems.`
      );
    }
    if (systemsMet === systems.length) {
      recommendations.push('Blueprint compliance is excellent across all systems.');
    }

    return {
      complianceScore,
      systemsMet,
      systemsUnder,
      systemsOver,
      totalContentItems: total,
      analyzedAt: new Date().toISOString(),
      systems,
      topDeviations,
      recommendations,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate corrective actions based on compliance analysis.
 */
export function generateCorrectiveActions(
  summary: ComplianceSummary,
  targetTaxonomy: 'medical' | 'questions'
): CorrectiveAction[] {
  const actions: CorrectiveAction[] = [];

  for (const system of summary.systems) {
    if (system.status === 'under') {
      // Compute missing items to reach target
      const targetCount = Math.ceil(system.targetWeight * summary.totalContentItems);
      const missing = Math.max(0, targetCount - system.count);
      if (missing <= 0) continue;

      // Decide batch size (minimum 1, maximum 20 per action)
      const batchSize = Math.min(Math.max(missing, 1), 20);
      const priority: 'high' | 'medium' | 'low' = system.absoluteDeviation > 5 ? 'high' : system.absoluteDeviation > 2 ? 'medium' : 'low';

      actions.push({
        system: system.system,
        action: targetTaxonomy === 'medical' ? 'generate_content' : 'generate_questions',
        target: targetTaxonomy,
        quantity: batchSize,
        priority,
        reason: `System is under‑represented by ${system.absoluteDeviation.toFixed(1)}% (${system.count} items vs target ${targetCount}).`,
      });
    } else if (system.status === 'over') {
      // For over‑represented systems, consider archiving low‑quality items
      const excess = Math.max(0, system.count - Math.ceil(system.targetWeight * summary.totalContentItems));
      if (excess <= 0) continue;

      // Archive a small number (1‑3) of items
      const archiveCount = Math.min(excess, 3);
      const priority: 'high' | 'medium' | 'low' = system.absoluteDeviation > 5 ? 'high' : 'medium';

      actions.push({
        system: system.system,
        action: 'archive',
        target: targetTaxonomy,
        quantity: archiveCount,
        priority,
        reason: `System is over‑represented by ${system.absoluteDeviation.toFixed(1)}% (${system.count} items vs target ${Math.ceil(system.targetWeight * summary.totalContentItems)}). Consider archiving low‑quality items.`,
      });
    }
  }

  // Sort by priority (high first) then deviation
  actions.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    // Tie‑break by absolute deviation (higher deviation first)
    const aDev = summary.systems.find(s => s.system === a.system)?.absoluteDeviation || 0;
    const bDev = summary.systems.find(s => s.system === b.system)?.absoluteDeviation || 0;
    return bDev - aDev;
  });

  return actions;
}

/**
 * Compute missing items per system to reach target distribution.
 */
export function computeMissingItems(
  summary: ComplianceSummary
): Array<{ system: string; missing: number; targetCount: number; currentCount: number }> {
  return summary.systems
    .filter(sys => sys.status === 'under')
    .map(sys => {
      const targetCount = Math.ceil(sys.targetWeight * summary.totalContentItems);
      const missing = Math.max(0, targetCount - sys.count);
      return { system: sys.system, missing, targetCount, currentCount: sys.count };
    })
    .filter(item => item.missing > 0)
    .sort((a, b) => b.missing - a.missing);
}

/**
 * Get compliance analysis for other taxonomies (e.g., Questions, PreGeneratedQuestions).
 * Similar structure but different source tables.
 */
export async function analyzeQuestionPoolCompliance(
  databaseUrl?: string
): Promise<ComplianceSummary> {
  const prisma = createEdgePrismaClient(databaseUrl || process.env.DATABASE_URL!);
  try {
    // Count questions by system (using Question table)
    const rawCounts = await prisma.question.groupBy({
      by: ['system'],
      _count: true,
      where: {
        status: { in: ['active', 'published'] },
      },
    });

    // Normalize and aggregate as above
    const systemMap = new Map<string, number>();
    let total = 0;
    for (const row of rawCounts) {
      const canonical = normalizeSystemName(row.system);
      const current = systemMap.get(canonical) || 0;
      systemMap.set(canonical, current + row._count);
      total += row._count;
    }

    const allSystems = getAllSystems();
    allSystems.forEach((sys) => {
      if (!systemMap.has(sys)) systemMap.set(sys, 0);
    });

    const weights = await getBlueprintWeights(prisma);
    const targetPercentages = Object.fromEntries(
      Object.entries(weights).map(([sys, weight]) => [sys, weight * 100])
    );

    const systems: SystemCompliance[] = [];
    for (const [system, count] of systemMap.entries()) {
      const targetWeight = weights[system] ?? 0;
      const targetPercent = targetWeight * 100;
      const actualPercent = total > 0 ? (count / total) * 100 : 0;
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
        totalCount: total,
        actualPercent,
        deviation,
        absoluteDeviation,
        status,
        recommendation: status === 'under' ? 'Add more questions' : status === 'over' ? 'Sufficient questions' : 'Target met',
      });
    }

    systems.sort((a, b) => b.absoluteDeviation - a.absoluteDeviation);
    const topDeviations = systems.slice(0, 5);

    const totalAbsoluteDeviation = systems.reduce((sum, sys) => sum + sys.absoluteDeviation, 0);
    const complianceScore = Math.max(0, 100 - (totalAbsoluteDeviation / 100) * 100);

    const systemsMet = systems.filter((s) => s.status === 'met').length;
    const systemsUnder = systems.filter((s) => s.status === 'under').length;
    const systemsOver = systems.filter((s) => s.status === 'over').length;

    const recommendations: string[] = [];
    if (systemsUnder > 0) {
      recommendations.push(`Generate more questions for ${systemsUnder} under‑represented systems.`);
    }
    if (systemsOver > 0) {
      recommendations.push(`Consider diversifying question pool away from over‑represented systems.`);
    }

    return {
      complianceScore,
      systemsMet,
      systemsUnder,
      systemsOver,
      totalContentItems: total,
      analyzedAt: new Date().toISOString(),
      systems,
      topDeviations,
      recommendations,
    };
  } finally {
    await prisma.$disconnect();
  }
}