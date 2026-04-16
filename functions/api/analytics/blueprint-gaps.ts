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

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { z } from 'zod';

/** NCCPA 2025 Blueprint target weights (sum ≈ 1.0) */
const NCCPA_TARGET: Record<string, number> = {
  Cardiovascular: 0.11,
  Pulmonary: 0.09,
  Gastrointestinal: 0.09,
  Musculoskeletal: 0.09,
  HEENT: 0.08,
  Reproductive: 0.08,
  Neurological: 0.07,
  Psychiatry: 0.07,
  Endocrine: 0.06,
  Dermatology: 0.05,
  Genitourinary: 0.05,
  Hematology: 0.04,
  'Infectious Disease': 0.04,
  Nephrology: 0.04,
  'Emergency Medicine': 0.02,
};

/**
 * Normalize raw system strings from the DB to canonical NCCPA names.
 * Handles abbreviations, case variations, and common aliases.
 */
const SYSTEM_ALIASES: Record<string, string> = {
  // Abbreviations used in BlueprintProgressBar and older data
  cv: 'Cardiovascular',
  cardiovascular: 'Cardiovascular',
  cardiology: 'Cardiovascular',
  pulm: 'Pulmonary',
  pulmonary: 'Pulmonary',
  respiratory: 'Pulmonary',
  gi: 'Gastrointestinal',
  gastrointestinal: 'Gastrointestinal',
  'gastrointestinal/nutrition': 'Gastrointestinal',
  msk: 'Musculoskeletal',
  musculoskeletal: 'Musculoskeletal',
  orthopedic: 'Musculoskeletal',
  orthopedics: 'Musculoskeletal',
  heent: 'HEENT',
  eent: 'HEENT',
  'head/neck/ent': 'HEENT',
  repro: 'Reproductive',
  reproductive: 'Reproductive',
  'ob/gyn': 'Reproductive',
  obgyn: 'Reproductive',
  neuro: 'Neurological',
  neurological: 'Neurological',
  neurologic: 'Neurological',
  neurology: 'Neurological',
  psych: 'Psychiatry',
  psychiatry: 'Psychiatry',
  'psychiatry/behavioral': 'Psychiatry',
  behavioral: 'Psychiatry',
  endo: 'Endocrine',
  endocrine: 'Endocrine',
  endocrinology: 'Endocrine',
  derm: 'Dermatology',
  dermatology: 'Dermatology',
  dermatologic: 'Dermatology',
  gu: 'Genitourinary',
  genitourinary: 'Genitourinary',
  heme: 'Hematology',
  hematology: 'Hematology',
  hematologic: 'Hematology',
  id: 'Infectious Disease',
  'infectious disease': 'Infectious Disease',
  'infectious diseases': 'Infectious Disease',
  renal: 'Nephrology',
  nephrology: 'Nephrology',
  emergency: 'Emergency Medicine',
  'emergency medicine': 'Emergency Medicine',
};

function normalizeSystem(raw: string | null): string | null {
  if (!raw) return null;
  return SYSTEM_ALIASES[raw.toLowerCase().trim()] ?? null;
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

/**
 * GET: Returns per-system gap analysis vs NCCPA Blueprint
 */
export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await resolveUserId(prisma, context.auth.userId);
      if (!userId) {
        return {
          status: 404,
          data: {
            systems: [],
            totalAttempts: 0,
            coverageScore: 0,
          } satisfies BlueprintGapsResponse,
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
