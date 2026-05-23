/**
 * Blueprint Gap Analyzer — Sprint 3
 *
 * Detects under-represented organ systems in the question pool relative to
 * NCCPA 2025 Blueprint weights. When a system's unused question count falls
 * below its proportional share by a significant margin, it triggers batch
 * generation via the existing batchGeneratorService.
 *
 * Integrated into the reservoir-maintenance cron (every 2h) as a new step.
 *
 * @module lib/services/reservoir/blueprintGapAnalyzer
 */

import {
  NCCPA_2025_BLUEPRINT_PERCENT,
  BLUEPRINT_TO_ABBREVIATION,
} from '../../constants/blueprint';

// ─── Thresholds ────────────────────────────────────────────────────────────

/** Minimum total unused pool size before gap analysis activates.
 *  Below this, ALL systems need generation — no point analyzing gaps. */
const MIN_POOL_FOR_GAP_ANALYSIS = 30;

/** A system is "gapped" if its share of unused questions is < this fraction
 *  of its expected blueprint share. E.g., 0.5 = less than half its fair share. */
const GAP_RATIO_THRESHOLD = 0.5;

/** Maximum questions to generate per system per cron cycle to avoid
 *  overwhelming the Gemini API. */
const MAX_GENERATE_PER_SYSTEM = 25;

/** If total unused pool is below this, trigger generation for ALL low systems
 *  regardless of gap analysis. */
const CRITICAL_POOL_THRESHOLD = 100;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BlueprintGapResult {
  system: string;        // Blueprint canonical name (e.g. "Cardiovascular")
  abbreviation: string;  // DB abbreviation (e.g. "CV")
  expectedPercent: number;
  actualPercent: number;
  unusedCount: number;
  deficit: number;       // How many questions short of fair share
  gapRatio: number;      // actualPercent / expectedPercent (< 1 = under)
}

export interface GapAnalysisReport {
  totalUnused: number;
  gappedSystems: BlueprintGapResult[];
  generationTriggered: boolean;
  generatedCounts: Record<string, number>;
  errors: string[];
}

type PrismaClientLike = {
  preGeneratedQuestion: any;
  [key: string]: any;
};

// ─── Analyzer ──────────────────────────────────────────────────────────────

/**
 * Analyze the question pool for blueprint distribution gaps.
 * Returns gaps sorted by severity (worst first).
 */
export async function analyzeBlueprintGaps(
  prisma: PrismaClientLike
): Promise<{ totalUnused: number; gaps: BlueprintGapResult[] }> {
  // Count unused questions per system abbreviation
  const systems = Object.entries(BLUEPRINT_TO_ABBREVIATION);
  const countsRaw = await Promise.all(
    systems.map(async ([canonical, abbrev]) => {
      const count = await prisma.preGeneratedQuestion.count({
        where: { system: abbrev, usedAt: null },
      });
      return { canonical, abbrev, count };
    })
  );

  const totalUnused = countsRaw.reduce((sum, s) => sum + s.count, 0);
  const totalWeight = Object.values(NCCPA_2025_BLUEPRINT_PERCENT).reduce((a, b) => a + b, 0);

  const gaps: BlueprintGapResult[] = [];

  for (const { canonical, abbrev, count } of countsRaw) {
    const expectedPercent = (NCCPA_2025_BLUEPRINT_PERCENT[canonical] || 0) / totalWeight * 100;
    const actualPercent = totalUnused > 0 ? (count / totalUnused) * 100 : 0;
    const gapRatio = expectedPercent > 0 ? actualPercent / expectedPercent : 1;

    // How many questions this system SHOULD have for proportional representation
    const expectedCount = Math.round((expectedPercent / 100) * totalUnused);
    const deficit = Math.max(0, expectedCount - count);

    if (gapRatio < GAP_RATIO_THRESHOLD || (totalUnused < CRITICAL_POOL_THRESHOLD && count < 10)) {
      gaps.push({
        system: canonical,
        abbreviation: abbrev,
        expectedPercent,
        actualPercent,
        unusedCount: count,
        deficit,
        gapRatio,
      });
    }
  }

  // Sort by gap severity (lowest ratio = worst gap)
  gaps.sort((a, b) => a.gapRatio - b.gapRatio);

  return { totalUnused, gaps };
}

/**
 * Run full gap analysis and trigger generation for under-represented systems.
 *
 * This is the main entry point called by the cron job.
 * It dynamically imports batchGeneratorService to avoid Edge bundling issues
 * (generation uses Node-only Gemini SDK).
 */
export async function analyzeAndTriggerGeneration(
  prisma: PrismaClientLike,
  env?: { GEMINI_API_KEY?: string }
): Promise<GapAnalysisReport> {
  const errors: string[] = [];
  const generatedCounts: Record<string, number> = {};

  const { totalUnused, gaps } = await analyzeBlueprintGaps(prisma);

  if (gaps.length === 0) {
    return {
      totalUnused,
      gappedSystems: [],
      generationTriggered: false,
      generatedCounts: {},
      errors: [],
    };
  }

  // Check if Gemini key is available
  const geminiKey = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {
      totalUnused,
      gappedSystems: gaps,
      generationTriggered: false,
      generatedCounts: {},
      errors: ['GEMINI_API_KEY not available — generation skipped'],
    };
  }

  // Trigger generation for each gapped system
  let generationTriggered = false;

  for (const gap of gaps) {
    const generateCount = Math.min(gap.deficit || MAX_GENERATE_PER_SYSTEM, MAX_GENERATE_PER_SYSTEM);
    if (generateCount <= 0) continue;

    try {
      // Dynamic import to avoid Edge bundling Gemini SDK at build time
      const { generateBatchForSystem } = await import(
        /* webpackIgnore: true */ '../../../services/ai/batchGeneratorService'
      );

      const result = await generateBatchForSystem(gap.abbreviation, generateCount);
      generatedCounts[gap.system] = result.promoted;
      generationTriggered = true;

      if (result.failed > 0 || result.pending > 0) {
        const detail = [
          result.failed > 0 ? `${result.failed} failed` : '',
          result.pending > 0 ? `${result.pending} pending` : '',
        ]
          .filter(Boolean)
          .join(', ');
        errors.push(`${gap.system}: ${detail}/${generateCount}`);
      }
    } catch (err: any) {
      errors.push(`${gap.system}: generation failed — ${err.message}`);
    }
  }

  return {
    totalUnused,
    gappedSystems: gaps,
    generationTriggered,
    generatedCounts,
    errors,
  };
}
