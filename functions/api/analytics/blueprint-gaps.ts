/**
 * Blueprint Gap Analysis API
 * GET /api/analytics/blueprint-gaps
 *
 * Compares user's study distribution across NCCPA organ systems against
 * the official 2025 PANCE Blueprint weights. Returns per-system stats
 * including attempt count, accuracy, and gap magnitude (delta between
 * actual % and target %).
 *
 * Used by the BlueprintGapHeatmap dashboard widget.
 *
 * @see lib/constants/blueprint.ts for NCCPA weights
 * @see components/dashboard/BlueprintGapHeatmap.tsx
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { z } from 'zod';
import { NCCPA_2025_BLUEPRINT, normalizeSystemName } from '../../../lib/constants/blueprint';

/**
 * NCCPA 2025 Blueprint target weights, excluding the "General" fallback
 * category. Drives both the normalization allow-list and the output rows.
 *
 * Re-derived from canonical {@link NCCPA_2025_BLUEPRINT} so the dashboard
 * heatmap and any other blueprint consumer stay in lock-step. This makes
 * NCCPA weight drift a single-file change, not a whack-a-mole bug.
 */
const NCCPA_TARGET: Record<string, number> = Object.fromEntries(
  Object.entries(NCCPA_2025_BLUEPRINT).filter(([name]) => name !== 'General')
);

/**
 * Normalize a raw DB system string to a canonical blueprint name, using the
 * single source of truth in lib/constants/blueprint.ts. Returns null if the
 * value does not map to a real blueprint system (e.g. "General" fallback or
 * an unknown tag) so the caller can skip it cleanly.
 */
function normalizeSystem(raw: string | null): string | null {
  if (!raw) return null;
  const canonical = normalizeSystemName(raw.trim());
  if (!canonical || !(canonical in NCCPA_TARGET)) return null;
  return canonical;
}

const querySchema = z.object({}).optional().default({});

export interface BlueprintGapSystem {
  system: string;
  targetPercent: number;
  actualPercent: number;
  gapPercent: number; // negative = under-studied, positive = over-studied
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0-100
}

export interface BlueprintGapsResponse {
  systems: BlueprintGapSystem[];
  totalAttempts: number;
  coverageScore: number; // 0-100, how well-aligned with blueprint
}

export const onRequestOptions = withCors();

/**
 * GET: Returns per-system gap analysis vs NCCPA Blueprint
 */
export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Resolve Clerk id to internal User.id — QuestionAttempt/PerformanceRecord use the internal id.
      const userId = await resolveUserId(prisma, context.auth.userId);
      if (!userId) {
        return {
          data: {
            systems: [],
            totalAttempts: 0,
            coverageScore: 0,
            meta: { status: 'user_not_synced' },
          },
          status: 404,
        };
      }

      // Load the rows directly and aggregate in JS to stay aligned with the
      // current Prisma type surface.
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          userId,
          systemNormalized: { not: null },
        },
        select: {
          systemNormalized: true,
          wasCorrect: true,
        },
      });

      // Normalize and aggregate by canonical system name
      const systemAgg: Record<string, { total: number; correct: number }> = {};
      let totalAttempts = 0;

      for (const row of attempts) {
        const canonical = normalizeSystem(row.systemNormalized);
        if (!canonical || !(canonical in NCCPA_TARGET)) continue;

        if (!systemAgg[canonical]) {
          systemAgg[canonical] = { total: 0, correct: 0 };
        }
        systemAgg[canonical].total += 1;
        systemAgg[canonical].correct += row.wasCorrect ? 1 : 0;
        totalAttempts += 1;
      }

      // Also try PerformanceRecord as fallback (has 'system' field)
      if (totalAttempts === 0) {
        const perfRecords = await prisma.performanceRecord.findMany({
          where: {
            userId,
            system: { not: null },
          },
          select: {
            system: true,
            isCorrect: true,
          },
        });

        for (const row of perfRecords) {
          const canonical = normalizeSystem(row.system);
          if (!canonical || !(canonical in NCCPA_TARGET)) continue;

          if (!systemAgg[canonical]) {
            systemAgg[canonical] = { total: 0, correct: 0 };
          }
          systemAgg[canonical].total += 1;
          systemAgg[canonical].correct += row.isCorrect ? 1 : 0;
          totalAttempts += 1;
        }
      }

      // Build per-system gap analysis
      const systems: BlueprintGapSystem[] = Object.entries(NCCPA_TARGET).map(
        ([system, targetWeight]) => {
          const agg = systemAgg[system] ?? { total: 0, correct: 0 };
          const actualPercent = totalAttempts > 0
            ? (agg.total / totalAttempts) * 100
            : 0;
          const targetPercent = targetWeight * 100;

          return {
            system,
            targetPercent,
            actualPercent: Math.round(actualPercent * 10) / 10,
            gapPercent: Math.round((actualPercent - targetPercent) * 10) / 10,
            totalAttempts: agg.total,
            correctAttempts: agg.correct,
            accuracy: agg.total > 0
              ? Math.round((agg.correct / agg.total) * 100)
              : 0,
          };
        }
      );

      // Sort by gap (most under-studied first)
      systems.sort((a, b) => a.gapPercent - b.gapPercent);

      // Coverage score: 100 - average absolute gap (clamped 0-100)
      const avgAbsGap =
        systems.reduce((sum, s) => sum + Math.abs(s.gapPercent), 0) /
        systems.length;
      const coverageScore = Math.max(0, Math.min(100, Math.round(100 - avgAbsGap * 2)));

      return {
        status: 200,
        data: {
          systems,
          totalAttempts,
          coverageScore,
        } satisfies BlueprintGapsResponse,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
