/**
 * Blueprint Mapping Service
 *
 * Maps learning targets (conditionId + taskType) to exam blueprint cells
 * for PANCE, PANRE, and PEAE. Enables the Second Chance engine to
 * identify which blueprint areas are weak and prioritize reviews there.
 *
 * Blueprint hierarchy:
 *   ExamType → System (CV, PULM, ...) → TaskCategory (diagnosis, pharmaceutical, ...)
 *   Each cell can have multiple conditions.
 *
 * Research:
 *   - NCCPA Content Blueprint (2025): defines system × task weights
 *   - Bloom's Taxonomy mapping: question order (1st/2nd/3rd) maps to cognitive load
 *
 * @module lib/services/blueprintMappingService
 */

import type { PrismaClient } from '@prisma/client';
import type { TaskType } from '@/lib/taskTypes';
import {
  NCCPA_2025_BLUEPRINT,
  PANCE_TASK_CATEGORY_PERCENT,
  BLUEPRINT_TO_ABBREVIATION,
  normalizeSystemName,
} from '@/lib/constants/blueprint';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ExamType = 'PANCE' | 'PANRE' | 'PEAE';

export interface ExamBlueprint {
  examType: ExamType;
  /** System weights (canonical names → decimal, sum ≈ 1.0) */
  systemWeights: Record<string, number>;
  /** Task category weights (task → decimal, sum ≈ 1.0) */
  taskWeights: Record<string, number>;
  /** Total expected questions on the exam */
  totalQuestions: number;
}

export interface BlueprintCell {
  system: string;
  systemAbbreviation: string;
  taskCategory: string;
  conditionId: string;
  /** Combined weight = system weight × task weight */
  cellWeight: number;
}

export interface WeakBlueprintCell extends BlueprintCell {
  /** Current stability for this learning target */
  stability: number;
  /** Number of lapses */
  lapses: number;
  /** Whether the cell is overdue for review */
  isOverdue: boolean;
  /** Priority score: higher = more urgent to review */
  priorityScore: number;
}

// ─── Blueprint Constants ───────────────────────────────────────────────────

/**
 * Internal taskType → PANCE taskCategory mapping.
 * Some internal types map to multiple PANCE categories;
 * we pick the primary one for scheduling purposes.
 */
const TASK_TYPE_TO_PANCE_CATEGORY: Record<string, string> = {
  diagnosis: 'diagnosis',
  treatment: 'pharmaceutical',        // Primary: pharmaceutical therapeutics
  mechanism: 'basic_science',
  workup: 'diagnostic_lab',
  prevention: 'health_maintenance',
  prognosis: 'diagnosis',             // Prognosis is part of diagnostic reasoning
  complication: 'clinical_intervention',
  clinical_pearl: 'diagnosis',        // Maps to strongest associated task
};

/**
 * Secondary mapping: some task types contribute to multiple categories.
 * Used for analytics, not scheduling.
 */
const TASK_TYPE_SECONDARY_CATEGORIES: Record<string, string[]> = {
  treatment: ['clinical_intervention'],  // Treatment spans pharma + clinical intervention
  diagnosis: ['history_physical'],       // Diagnosis involves H&P
  workup: ['history_physical'],          // Workup includes physical exam findings
};

// Normalize PANCE task weights to decimals
const PANCE_TASK_WEIGHT_DECIMAL: Record<string, number> = (() => {
  const total = Object.values(PANCE_TASK_CATEGORY_PERCENT).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [key, pct] of Object.entries(PANCE_TASK_CATEGORY_PERCENT)) {
    out[key] = pct / total;
  }
  return out;
})();

/**
 * PANCE Blueprint — The primary certification exam.
 * 300 questions, 5 blocks of 60, 60 minutes per block.
 */
export const PANCE_BLUEPRINT: ExamBlueprint = {
  examType: 'PANCE',
  systemWeights: { ...NCCPA_2025_BLUEPRINT },
  taskWeights: { ...PANCE_TASK_WEIGHT_DECIMAL },
  totalQuestions: 300,
};

/**
 * PANRE Blueprint — Recertification exam.
 * PANRE-LA is longitudinal (quarterly question sets), same content weights.
 * Slightly less emphasis on basic science, more on clinical intervention.
 */
export const PANRE_BLUEPRINT: ExamBlueprint = {
  examType: 'PANRE',
  systemWeights: { ...NCCPA_2025_BLUEPRINT },
  taskWeights: {
    ...PANCE_TASK_WEIGHT_DECIMAL,
    basic_science: (PANCE_TASK_WEIGHT_DECIMAL['basic_science'] ?? 0.08) * 0.7, // Reduced
    clinical_intervention: (PANCE_TASK_WEIGHT_DECIMAL['clinical_intervention'] ?? 0.16) * 1.15, // Increased
  },
  totalQuestions: 240,
};

/**
 * PEAE Blueprint — Pilot Alternative Exam (newer format).
 * Uses the same content areas but with a competency-based focus.
 * Task weights are slightly adjusted toward clinical application.
 */
export const PEAE_BLUEPRINT: ExamBlueprint = {
  examType: 'PEAE',
  systemWeights: { ...NCCPA_2025_BLUEPRINT },
  taskWeights: {
    ...PANCE_TASK_WEIGHT_DECIMAL,
    diagnosis: (PANCE_TASK_WEIGHT_DECIMAL['diagnosis'] ?? 0.18) * 1.1,
    pharmaceutical: (PANCE_TASK_WEIGHT_DECIMAL['pharmaceutical'] ?? 0.15) * 1.1,
    basic_science: (PANCE_TASK_WEIGHT_DECIMAL['basic_science'] ?? 0.08) * 0.5,
  },
  totalQuestions: 300,
};

const BLUEPRINTS: Record<ExamType, ExamBlueprint> = {
  PANCE: PANCE_BLUEPRINT,
  PANRE: PANRE_BLUEPRINT,
  PEAE: PEAE_BLUEPRINT,
};

// ─── Mapping Functions ─────────────────────────────────────────────────────

/**
 * Get the blueprint for a given exam type.
 */
export function getBlueprint(examType: ExamType): ExamBlueprint {
  return BLUEPRINTS[examType];
}

/**
 * Map a learning target (conditionId + taskType) to a blueprint cell.
 * Requires the condition's system to be known.
 */
export function mapLearningTargetToBlueprint(
  conditionSystem: string,
  taskType: TaskType | string,
  examType: ExamType = 'PANCE'
): BlueprintCell {
  const blueprint = getBlueprint(examType);
  const system = normalizeSystemName(conditionSystem);
  const systemAbbr = BLUEPRINT_TO_ABBREVIATION[system] ?? conditionSystem;
  const taskCategory = TASK_TYPE_TO_PANCE_CATEGORY[taskType] ?? 'diagnosis';

  const systemWeight = blueprint.systemWeights[system] ?? 0.02;
  const taskWeight = blueprint.taskWeights[taskCategory] ?? 0.08;
  const cellWeight = systemWeight * taskWeight;

  return {
    system,
    systemAbbreviation: systemAbbr,
    taskCategory,
    conditionId: '', // Filled by caller
    cellWeight,
  };
}

/**
 * Get the combined blueprint weight for a learning target.
 * Higher weight = more important on the exam = should be prioritized.
 */
export function getLearningTargetWeight(
  conditionSystem: string,
  taskType: TaskType | string,
  examType: ExamType = 'PANCE'
): number {
  const cell = mapLearningTargetToBlueprint(conditionSystem, taskType, examType);
  return cell.cellWeight;
}

/**
 * Get the weakest blueprint cells for a student, sorted by priority.
 *
 * Priority is calculated as:
 *   blueprintWeight × (1 / stability) × overdueFactor × lapsePenalty
 *
 * This means high-weight cells with low stability and overdue reviews
 * bubble to the top.
 */
export async function getWeakBlueprintCells(
  prisma: PrismaClient,
  userId: string,
  examType: ExamType = 'PANCE',
  limit: number = 20
): Promise<WeakBlueprintCell[]> {
  const now = new Date();

  // Fetch all UserTopicProgress entries for this user
  const topicProgress = await prisma.userTopicProgress.findMany({
    where: { userId },
    select: {
      conditionId: true,
      taskType: true,
      stability: true,
      difficulty: true,
      lapses: true,
      reps: true,
      nextReviewDate: true,
      lastReviewDate: true,
    },
  });

  if (topicProgress.length === 0) return [];

  // Get condition → system mapping
  const conditionIds = [...new Set(topicProgress.map(tp => tp.conditionId))];
  const conditions = await prisma.condition.findMany({
    where: { id: { in: conditionIds } },
    select: { id: true, system: true },
  });
  const conditionSystemMap = new Map(conditions.map(c => [c.id, c.system]));

  // Score each learning target
  const cells: WeakBlueprintCell[] = [];

  for (const tp of topicProgress) {
    const conditionSystem = conditionSystemMap.get(tp.conditionId);
    if (!conditionSystem) continue;

    const cell = mapLearningTargetToBlueprint(conditionSystem, tp.taskType, examType);
    const stability = tp.stability ?? 1.0;
    const lapses = tp.lapses ?? 0;
    const isOverdue = tp.nextReviewDate ? tp.nextReviewDate <= now : false;

    // Priority formula:
    // Higher blueprint weight × lower stability × overdue bonus × lapse penalty
    const stabilityFactor = 1 / Math.max(0.5, stability);
    const overdueFactor = isOverdue ? 1.5 : 1.0;
    const lapseFactor = 1 + (lapses * 0.15); // Each lapse adds 15% priority
    const priorityScore = cell.cellWeight * stabilityFactor * overdueFactor * lapseFactor;

    cells.push({
      ...cell,
      conditionId: tp.conditionId,
      stability,
      lapses,
      isOverdue,
      priorityScore,
    });
  }

  // Sort by priority (highest first) and return top N
  cells.sort((a, b) => b.priorityScore - a.priorityScore);
  return cells.slice(0, limit);
}

/**
 * Get blueprint coverage summary for a student.
 * Returns the percentage of blueprint cells that have been studied,
 * grouped by system and task category.
 */
export async function getBlueprintCoverage(
  prisma: PrismaClient,
  userId: string,
  examType: ExamType = 'PANCE'
): Promise<{
  systemCoverage: Record<string, { studied: number; total: number; avgStability: number }>;
  taskCoverage: Record<string, { studied: number; total: number; avgStability: number }>;
  overallCoverage: number;
}> {
  // Get all conditions in the system
  const allConditions = await prisma.condition.findMany({
    select: { id: true, system: true },
  });

  // Get user's studied topics
  const userTopics = await prisma.userTopicProgress.findMany({
    where: { userId },
    select: { conditionId: true, taskType: true, stability: true },
  });

  const studiedSet = new Set(userTopics.map(ut => `${ut.conditionId}::${ut.taskType}`));
  const stabilityMap = new Map(userTopics.map(ut => [`${ut.conditionId}::${ut.taskType}`, ut.stability ?? 0]));

  // Calculate per-system coverage
  const systemCoverage: Record<string, { studied: number; total: number; avgStability: number }> = {};
  const taskCoverage: Record<string, { studied: number; total: number; avgStability: number }> = {};

  const blueprint = getBlueprint(examType);
  const taskTypes = Object.keys(TASK_TYPE_TO_PANCE_CATEGORY);

  for (const condition of allConditions) {
    const system = normalizeSystemName(condition.system ?? 'General');
    if (!blueprint.systemWeights[system]) continue;

    if (!systemCoverage[system]) {
      systemCoverage[system] = { studied: 0, total: 0, avgStability: 0 };
    }

    for (const tt of taskTypes) {
      const key = `${condition.id}::${tt}`;
      const taskCat = TASK_TYPE_TO_PANCE_CATEGORY[tt] ?? 'diagnosis';

      if (!taskCoverage[taskCat]) {
        taskCoverage[taskCat] = { studied: 0, total: 0, avgStability: 0 };
      }

      systemCoverage[system]!.total++;
      taskCoverage[taskCat]!.total++;

      if (studiedSet.has(key)) {
        systemCoverage[system]!.studied++;
        taskCoverage[taskCat]!.studied++;
        systemCoverage[system]!.avgStability += stabilityMap.get(key) ?? 0;
        taskCoverage[taskCat]!.avgStability += stabilityMap.get(key) ?? 0;
      }
    }
  }

  // Normalize avgStability
  for (const sys of Object.values(systemCoverage)) {
    sys.avgStability = sys.studied > 0 ? sys.avgStability / sys.studied : 0;
  }
  for (const task of Object.values(taskCoverage)) {
    task.avgStability = task.studied > 0 ? task.avgStability / task.studied : 0;
  }

  const totalStudied = userTopics.length;
  const totalPossible = allConditions.length * taskTypes.length;
  const overallCoverage = totalPossible > 0 ? totalStudied / totalPossible : 0;

  return { systemCoverage, taskCoverage, overallCoverage };
}

/**
 * Get the PANCE task category for an internal task type.
 */
export function getTaskCategory(taskType: string): string {
  return TASK_TYPE_TO_PANCE_CATEGORY[taskType] ?? 'diagnosis';
}

/**
 * Get secondary categories for analytics purposes.
 */
export function getSecondaryCategories(taskType: string): string[] {
  return TASK_TYPE_SECONDARY_CATEGORIES[taskType] ?? [];
}
