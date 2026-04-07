/**
 * Blueprint Coverage Service
 *
 * Audits a user's MAIN-session question attempt history against the 2025
 * PANCE/EOR blueprint to identify coverage gaps at system, task, and
 * system × task intersection levels.
 *
 * Only MAIN session attempts (isMainSession: true) count for readiness analytics.
 * Joined to Question via questionId to obtain taskType for task-level coverage.
 *
 * @module lib/services/blueprintCoverageService
 */

import type { PrismaClient } from '@prisma/client';
import {
  NCCPA_2025_BLUEPRINT,
  PANCE_TASK_CATEGORY_PERCENT,
  normalizeSystemName,
  BLUEPRINT_TO_ABBREVIATION,
} from '../constants/blueprint';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SystemCoverageRow {
  system: string;
  blueprintWeight: number;
  attemptCount: number;
  attemptShare: number;
  /** gap = blueprintWeight - attemptShare (positive = under-covered) */
  gap: number;
  /** Flagged when gap > 0.02 (>2 percentage points under blueprint weight) */
  isFlagged: boolean;
}

export interface TaskCoverageRow {
  task: string;
  blueprintWeight: number;
  attemptShare: number;
  /** gap = blueprintWeight - attemptShare */
  gap: number;
  isFlagged: boolean;
}

export interface CrossCoverageRow {
  system: string;
  task: string;
  attemptCount: number;
  /** Expected fraction of total attempts for this system × task cell */
  expectedShare: number;
  actualShare: number;
  /** gap = expectedShare - actualShare */
  gap: number;
}

export interface TopPriorityGap {
  system: string;
  task: string;
  gap: number;
}

export interface CoverageReport {
  /** Per-system attempt distribution vs PANCE blueprint weights */
  systemCoverage: SystemCoverageRow[];
  /** Per-task attempt distribution vs blueprint task weights */
  taskCoverage: TaskCoverageRow[];
  /**
   * System × task cross-coverage.
   * Only entries where gap > 0.02 are included to avoid noise.
   */
  crossCoverage: CrossCoverageRow[];
  /**
   * The single highest-gap system × task intersection — surfaces one
   * actionable high-yield recommendation for the dashboard.
   * Null when no cross-coverage data is available.
   */
  topPriorityGap: TopPriorityGap | null;
  totalMainAttempts: number;
  /** Systems whose gap > 0.02 */
  underCoveredSystems: string[];
  lastUpdated: Date;
}

// ─── Blueprint weights ────────────────────────────────────────────────────────

/** Canonical PANCE system weights (decimal, sum ≈ 1.0), excluding General */
const PANCE_SYSTEM_WEIGHTS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [name, w] of Object.entries(NCCPA_2025_BLUEPRINT)) {
    if (name !== 'General') out[name] = w;
  }
  return out;
})();

/** Family Medicine EOR blueprint weights (decimal) */
const FAMILY_MEDICINE_SYSTEM_WEIGHTS: Record<string, number> = {
  Cardiovascular: 0.15,
  Pulmonary: 0.12,
  Gastrointestinal: 0.11,
  HEENT: 0.08,
  Reproductive: 0.08,
  Musculoskeletal: 0.08,
  Neurological: 0.06,
  Dermatology: 0.05,
  Endocrine: 0.05,
  Psychiatry: 0.05,
  Genitourinary: 0.05,
  Hematology: 0.04,
  'Infectious Disease': 0.04,
  // Urgent Care (no single DB abbreviation — bucket into Emergency Medicine)
  'Emergency Medicine': 0.04,
};

/** PANCE task category weights (decimal) */
const PANCE_TASK_WEIGHTS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [task, pct] of Object.entries(PANCE_TASK_CATEGORY_PERCENT)) {
    out[task] = pct / 100;
  }
  return out;
})();

/** Family Medicine EOR task weights (PAEA distribution, decimal) */
const FAMILY_MEDICINE_TASK_WEIGHTS: Record<string, number> = {
  diagnosis: 0.20,
  history_physical: 0.18,
  clinical_intervention: 0.15,
  pharmaceutical: 0.15,
  health_maintenance: 0.12,
  diagnostic_lab: 0.10,
  basic_science: 0.06,
  professional_practice: 0.04,
};

// ─── Abbreviation → canonical name lookup ────────────────────────────────────

/** Invert BLUEPRINT_TO_ABBREVIATION: "CV" → "Cardiovascular", etc. */
const ABBREVIATION_TO_CANONICAL: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [canonical, abbr] of Object.entries(BLUEPRINT_TO_ABBREVIATION)) {
    out[abbr] = canonical;
  }
  return out;
})();

/**
 * Resolve a raw system string (abbreviation or full name) to its blueprint
 * canonical name (e.g. "CV" → "Cardiovascular", "PULM" → "Pulmonary").
 */
function resolveCanonical(rawSystem: string): string {
  if (ABBREVIATION_TO_CANONICAL[rawSystem]) return ABBREVIATION_TO_CANONICAL[rawSystem];
  return normalizeSystemName(rawSystem);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute a blueprint coverage report for a user.
 *
 * @param userId    Internal user UUID
 * @param rotation  'pance' for core PANCE blueprint, 'family_medicine' for FM EOR weights
 */
export async function getCoverageReport(
  prisma: PrismaClient,
  userId: string,
  rotation: 'pance' | 'family_medicine' = 'pance'
): Promise<CoverageReport> {
  const systemWeights =
    rotation === 'family_medicine' ? FAMILY_MEDICINE_SYSTEM_WEIGHTS : PANCE_SYSTEM_WEIGHTS;
  const taskWeights =
    rotation === 'family_medicine' ? FAMILY_MEDICINE_TASK_WEIGHTS : PANCE_TASK_WEIGHTS;

  // ── Query 1: aggregate MAIN-session attempts by system ────────────────────
  const systemAggregates = await prisma.questionAttempt.groupBy({
    by: ['system'],
    where: {
      userId,
      isMainSession: true,
      system: { not: null },
    },
    _count: { _all: true },
  });

  const totalMainAttempts = systemAggregates.reduce((s, r) => s + r._count._all, 0);

  // ── Query 2: task coverage — join through Question.taskType ───────────────
  const taskRows = await prisma.$queryRaw<Array<{ taskType: string; cnt: bigint }>>`
    SELECT q."taskType", COUNT(qa.id)::bigint AS cnt
    FROM "QuestionAttempt" qa
    JOIN "Question" q ON q.id = qa."questionId"
    WHERE qa."userId" = ${userId}
      AND qa."isMainSession" = true
      AND q."taskType" IS NOT NULL
    GROUP BY q."taskType"
  `.catch(() => [] as Array<{ taskType: string; cnt: bigint }>);

  const totalTaskAttempts = taskRows.reduce((s, r) => s + Number(r.cnt), 0);

  // ── Query 3: cross-coverage — system × task attempt counts ───────────────
  const crossRows = await prisma.$queryRaw<
    Array<{ system: string; taskType: string; cnt: bigint }>
  >`
    SELECT
      COALESCE(qa."systemNormalized", qa."system", 'Unknown') AS system,
      q."taskType",
      COUNT(qa.id)::bigint AS cnt
    FROM "QuestionAttempt" qa
    JOIN "Question" q ON q.id = qa."questionId"
    WHERE qa."userId" = ${userId}
      AND qa."isMainSession" = true
      AND q."taskType" IS NOT NULL
      AND qa."system" IS NOT NULL
    GROUP BY COALESCE(qa."systemNormalized", qa."system", 'Unknown'), q."taskType"
  `.catch(() => [] as Array<{ system: string; taskType: string; cnt: bigint }>);

  // ── Build system coverage rows (unchanged from Prompt 3) ─────────────────
  const attemptsBySystem: Record<string, number> = {};
  for (const row of systemAggregates) {
    if (!row.system) continue;
    const canonical = resolveCanonical(row.system);
    attemptsBySystem[canonical] = (attemptsBySystem[canonical] ?? 0) + row._count._all;
  }

  const systemCoverage: SystemCoverageRow[] = Object.entries(systemWeights).map(
    ([system, blueprintWeight]) => {
      const attemptCount = attemptsBySystem[system] ?? 0;
      const attemptShare = totalMainAttempts > 0 ? attemptCount / totalMainAttempts : 0;
      const gap = blueprintWeight - attemptShare;
      return {
        system,
        blueprintWeight,
        attemptCount,
        attemptShare: Math.round(attemptShare * 10000) / 10000,
        gap: Math.round(gap * 10000) / 10000,
        isFlagged: gap > 0.02,
      };
    }
  );
  systemCoverage.sort((a, b) => b.gap - a.gap);

  // ── Build task coverage rows ──────────────────────────────────────────────
  const attemptsByTask: Record<string, number> = {};
  for (const row of taskRows) {
    attemptsByTask[row.taskType] = (attemptsByTask[row.taskType] ?? 0) + Number(row.cnt);
  }

  const taskCoverage: TaskCoverageRow[] = Object.entries(taskWeights).map(
    ([task, blueprintWeight]) => {
      const attemptCount = attemptsByTask[task] ?? 0;
      const attemptShare = totalTaskAttempts > 0 ? attemptCount / totalTaskAttempts : 0;
      const gap = blueprintWeight - attemptShare;
      return {
        task,
        blueprintWeight,
        attemptShare: Math.round(attemptShare * 10000) / 10000,
        gap: Math.round(gap * 10000) / 10000,
        isFlagged: gap > 0.02,
      };
    }
  );
  taskCoverage.sort((a, b) => b.gap - a.gap);

  // ── Build cross-coverage rows ─────────────────────────────────────────────
  // Bucket cross-attempt counts by canonical system × task
  const crossMap: Record<string, Record<string, number>> = {};
  for (const row of crossRows) {
    const canonical = resolveCanonical(row.system);
    if (!crossMap[canonical]) crossMap[canonical] = {};
    crossMap[canonical][row.taskType] =
      (crossMap[canonical][row.taskType] ?? 0) + Number(row.cnt);
  }

  const crossCoverage: CrossCoverageRow[] = [];
  let topPriorityGap: TopPriorityGap | null = null;
  let maxCrossGap = -Infinity;

  for (const [system, sysWeight] of Object.entries(systemWeights)) {
    for (const [task, taskWeight] of Object.entries(taskWeights)) {
      const attemptCount = crossMap[system]?.[task] ?? 0;
      const expectedShare = sysWeight * taskWeight;
      const actualShare = totalMainAttempts > 0 ? attemptCount / totalMainAttempts : 0;
      const gap = expectedShare - actualShare;
      const roundedGap = Math.round(gap * 10000) / 10000;

      // Only include entries where gap > 0.02 (noise filter)
      if (roundedGap > 0.02) {
        crossCoverage.push({
          system,
          task,
          attemptCount,
          expectedShare: Math.round(expectedShare * 10000) / 10000,
          actualShare: Math.round(actualShare * 10000) / 10000,
          gap: roundedGap,
        });
      }

      // Track highest gap for topPriorityGap
      if (roundedGap > maxCrossGap) {
        maxCrossGap = roundedGap;
        topPriorityGap = { system, task, gap: roundedGap };
      }
    }
  }

  // Sort cross-coverage by gap descending
  crossCoverage.sort((a, b) => b.gap - a.gap);

  // If no gaps exceed 0.02, topPriorityGap should still be the highest — keep it.
  // But if there are no cross rows at all, set topPriorityGap to null.
  if (crossRows.length === 0 && totalMainAttempts === 0) {
    topPriorityGap = null;
  }

  const underCoveredSystems = systemCoverage.filter((r) => r.isFlagged).map((r) => r.system);

  return {
    systemCoverage,
    taskCoverage,
    crossCoverage,
    topPriorityGap,
    totalMainAttempts,
    underCoveredSystems,
    lastUpdated: new Date(),
  };
}
