import { prisma } from './prisma-edge';

/**
 * Exam Blueprint Coverage Service
 * Analyzes and tracks exam blueprint coverage (PANCE/PANRE)
 * Identifies content gaps and biases content selection toward underrepresented systems
 */

export interface BlueprintSystemCoverage {
  system: string;
  targetPercent: number;
  actualPercent: number;
  totalQuestions: number;
  approvedQuestions: number;
  gap: number; // (target - actual) * 100
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface BlueprintAnalysis {
  examType: string;
  totalQuestions: number;
  totalApproved: number;
  systemCoverage: BlueprintSystemCoverage[];
  gapsByPriority: Record<'critical' | 'high' | 'medium' | 'low', number>;
}

/**
 * Get blueprint targets for an exam type
 */
export async function getBlueprintTargets(
  examType: string
): Promise<Map<string, number>> {
  const targets = await prisma.examBlueprintSystem.findMany({
    where: { examType },
  });

  const map = new Map<string, number>();
  targets.forEach((t) => map.set(t.system, t.targetPercent));
  return map;
}

/**
 * Analyze blueprint coverage for an exam
 */
export async function analyzeBlueprintCoverage(
  examType: string
): Promise<BlueprintAnalysis> {
  const targets = await getBlueprintTargets(examType);

  // Get all approved active questions by system
  const questionsBySystem = await prisma.question.groupBy({
    by: ['system'],
    where: {
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    },
    _count: {
      id: true,
    },
  });

  // Calculate totals
  const totalApproved = questionsBySystem.reduce(
    (sum, q) => sum + q._count.id,
    0
  );

  // Get all active questions (for percentage calculation)
  const totalQuestions = await prisma.question.count({
    where: {
      lifecycleStatus: 'ACTIVE',
    },
  });

  // Build coverage analysis
  const systemCoverage: BlueprintSystemCoverage[] = [];
  const gapsByPriority: Record<'critical' | 'high' | 'medium' | 'low', number> =
    {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

  for (const [system, targetPercent] of targets.entries()) {
    const systemQuestions =
      questionsBySystem.find((q) => q.system === system)?._count.id || 0;
    const actualPercent =
      totalApproved > 0 ? systemQuestions / totalApproved : 0;
    const gap = (targetPercent - actualPercent) * 100;

    let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (gap > 15) priority = 'critical';
    else if (gap > 10) priority = 'high';
    else if (gap > 5) priority = 'medium';

    gapsByPriority[priority]++;

    systemCoverage.push({
      system,
      targetPercent: targetPercent * 100, // Convert to percentage
      actualPercent: actualPercent * 100,
      totalQuestions: systemQuestions,
      approvedQuestions: systemQuestions, // Could filter further by approval status
      gap,
      priority,
    });
  }

  // Sort by gap (largest gaps first)
  systemCoverage.sort((a, b) => b.gap - a.gap);

  return {
    examType,
    totalQuestions,
    totalApproved,
    systemCoverage,
    gapsByPriority,
  };
}

/**
 * Get systems with critical content gaps
 * Useful for content generation prioritization
 */
export async function getCriticalGapSystems(
  examType: string,
  gapThreshold: number = 10
): Promise<BlueprintSystemCoverage[]> {
  const analysis = await analyzeBlueprintCoverage(examType);
  return analysis.systemCoverage.filter((s) => s.gap > gapThreshold);
}

/**
 * Get high-coverage systems
 * These could donate questions to lower-coverage systems
 */
export async function getHighCoverageSystems(
  examType: string,
  overageThreshold: number = 5
): Promise<BlueprintSystemCoverage[]> {
  const analysis = await analyzeBlueprintCoverage(examType);
  return analysis.systemCoverage.filter((s) => s.gap < -overageThreshold);
}

/**
 * Get systems ordered by coverage need (for biasing question selection)
 * Returns array sorted by gap (largest gap first)
 */
export async function getSystemsByCoverageNeed(
  examType: string
): Promise<string[]> {
  const analysis = await analyzeBlueprintCoverage(examType);
  return analysis.systemCoverage.map((s) => s.system);
}

/**
 * Get blueprint-aware system weights for question selection
 * Systems with bigger gaps get higher weights
 */
export async function getSystemWeightsForSelection(
  examType: string
): Promise<Map<string, number>> {
  const analysis = await analyzeBlueprintCoverage(examType);

  // Calculate weights: gap-based (larger gap = higher weight)
  const totalGap = analysis.systemCoverage.reduce((sum, s) => sum + s.gap, 0);

  const weights = new Map<string, number>();
  analysis.systemCoverage.forEach((s) => {
    // Normalize gap to 0-1, add baseline to prevent zero weight
    const normalizedGap = Math.max(0, s.gap) / Math.max(totalGap, 1);
    const weight = 1 + normalizedGap * 2; // Range: 1-3x
    weights.set(s.system, weight);
  });

  return weights;
}

/**
 * Create or update blueprint targets
 * Used in admin workflows to configure exam blueprints
 */
export async function setSystemTarget(
  examType: string,
  system: string,
  targetPercent: number
): Promise<void> {
  await prisma.examBlueprintSystem.upsert({
    where: { examType_system: { examType, system } },
    create: {
      examType,
      system,
      targetPercent,
    },
    update: {
      targetPercent,
    },
  });
}

/**
 * Bulk set blueprint targets from a configuration object
 */
export async function setBlueprintTargets(
  examType: string,
  targets: Record<string, number>
): Promise<void> {
  for (const [system, targetPercent] of Object.entries(targets)) {
    await setSystemTarget(examType, system, targetPercent);
  }
}

/**
 * Get available exam types
 */
export async function getAvailableExamTypes(): Promise<string[]> {
  const results = await prisma.examBlueprintSystem.groupBy({
    by: ['examType'],
    distinct: ['examType'],
  });

  return results.map((r) => r.examType);
}
