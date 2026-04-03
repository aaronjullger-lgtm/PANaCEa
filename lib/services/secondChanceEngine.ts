/**
 * Second Chance Engine
 *
 * The central orchestrator for subdomain-level review scheduling.
 * Instead of scheduling reviews at the condition level ("AFib is due"),
 * this engine identifies the *weakest subdomain* within a condition
 * (e.g., "AFib → diagnosis is weak") and selects a variant question
 * targeting that specific weakness.
 *
 * Key behaviors:
 *   1. Resolves the weakest learning target (conditionId + taskType) for review
 *   2. Selects variant questions to prevent recognition-based answering
 *   3. Integrates blueprint weighting so high-exam-weight topics get priority
 *   4. Falls back safely to condition-level scheduling when data is insufficient
 *
 * This engine does NOT modify FSRS — it sits on top, choosing WHAT to review.
 * The FSRS pipeline in drillReviewService.ts handles HOW the review is scored.
 *
 * Research:
 *   - Kornell & Bjork (2008): Varied practice > repeated practice for transfer
 *   - Roediger & Karpicke (2006): Testing effect requires genuine retrieval
 *   - Bjork & Bjork (2011): Desirable difficulties enhance long-term learning
 *
 * @module lib/services/secondChanceEngine
 */

import type { PrismaClient } from '@prisma/client';
import type { TaskType } from '@/lib/taskTypes';
import { inferTaskType, TASK_TYPES } from '@/lib/taskTypes';
import { detectRecognitionRisk, quickRecognitionCheck } from './recognitionRiskDetector';
import {
  getLearningTargetWeight,
  type ExamType,
} from './blueprintMappingService';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LearningTarget {
  conditionId: string;
  taskType: TaskType | string;
  /** Condition's body system (CV, PULM, etc.) */
  system: string;
  /** FSRS stability in days */
  stability: number;
  /** FSRS difficulty 0-10 */
  difficulty: number;
  /** Number of lapses (incorrect recalls) */
  lapses: number;
  /** Whether this target is overdue for review */
  isOverdue: boolean;
  /** Combined blueprint × urgency priority score */
  priorityScore: number;
}

export interface SecondChanceSelection {
  /** The question to show */
  questionId: string;
  /** The learning target this question addresses */
  learningTarget: LearningTarget;
  /** Whether this is a variant (different from what the student last saw) */
  isVariant: boolean;
  /** Whether this was triggered by recognition risk detection */
  isSecondChance: boolean;
  /** Recognition risk score (0-1) for the original question */
  recognitionRisk: number;
  /** Variant selection method used */
  selectionMethod: VariantSelectionMethod;
}

export type VariantSelectionMethod =
  | 'unused_variant'        // QuestionVariant the student hasn't seen
  | 'different_question'    // Different PreGeneratedQuestion, same condition+taskType
  | 'cross_task_fallback'   // Same condition, different taskType
  | 'canonical_fallback';   // Original question (no variant available)

export interface ResolvedWeakSubdomain {
  conditionId: string;
  weakestTaskType: TaskType | string;
  allSubdomains: SubdomainSummary[];
}

export interface SubdomainSummary {
  taskType: string;
  stability: number;
  difficulty: number;
  lapses: number;
  isOverdue: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Maximum variants to check for recognition risk per session generation */
const MAX_RECOGNITION_CHECKS_PER_SESSION = 30;

/** When no UserTopicProgress exists, default to this taskType */
const DEFAULT_TASK_TYPE = TASK_TYPES.DIAGNOSIS;

// ─── Core Engine Functions ─────────────────────────────────────────────────

/**
 * Resolve the weakest subdomain (taskType) within a condition.
 *
 * Looks at all UserTopicProgress entries for (userId, conditionId, *)
 * and finds which taskType has the lowest stability / highest lapses.
 *
 * @returns The weakest subdomain, or null if no topic progress exists
 */
export async function resolveLearningTarget(
  prisma: PrismaClient,
  userId: string,
  conditionId: string
): Promise<ResolvedWeakSubdomain | null> {
  const topicEntries = await prisma.userTopicProgress.findMany({
    where: { userId, conditionId },
    select: {
      taskType: true,
      stability: true,
      difficulty: true,
      lapses: true,
      nextReviewDate: true,
    },
  });

  if (topicEntries.length === 0) return null;

  const now = new Date();
  const subdomains: SubdomainSummary[] = topicEntries.map(e => ({
    taskType: e.taskType,
    stability: e.stability ?? 1.0,
    difficulty: e.difficulty ?? 5.0,
    lapses: e.lapses ?? 0,
    isOverdue: e.nextReviewDate ? e.nextReviewDate <= now : false,
  }));

  // Score each subdomain: lower stability + more lapses + overdue = weaker
  let weakest = subdomains[0]!;
  let worstScore = Infinity;

  for (const sub of subdomains) {
    // Lower score = weaker = should be reviewed first
    const score = sub.stability / (1 + sub.lapses * 0.5) / (sub.isOverdue ? 2 : 1);
    if (score < worstScore) {
      worstScore = score;
      weakest = sub;
    }
  }

  return {
    conditionId,
    weakestTaskType: weakest.taskType as TaskType,
    allSubdomains: subdomains,
  };
}

/**
 * Select a question for a Second Chance review.
 *
 * Priority order:
 *   1. Existing unused QuestionVariant matching the target taskType
 *   2. Different PreGeneratedQuestion for the same condition + taskType
 *   3. Same condition, different taskType (cross-task fallback)
 *   4. Canonical question (fallback when no variant exists)
 *
 * @param prisma - Database client
 * @param userId - Student ID
 * @param conditionId - Condition to review
 * @param taskType - Target task type (the weak subdomain)
 * @param excludeQuestionIds - Questions to avoid (already in this session)
 * @returns Selected question and metadata, or null if nothing available
 */
export async function selectSecondChanceQuestion(
  prisma: PrismaClient,
  userId: string,
  conditionId: string,
  taskType: TaskType | string,
  excludeQuestionIds: Set<string> = new Set()
): Promise<SecondChanceSelection | null> {
  // Get the user's variant history for this condition
  const topicProgress = await prisma.userTopicProgress.findUnique({
    where: {
      userId_conditionId_taskType: { userId, conditionId, taskType },
    },
    select: { variantsUsed: true, stability: true, difficulty: true, lapses: true, nextReviewDate: true },
  });

  const variantsUsed = new Set<string>(topicProgress?.variantsUsed ?? []);
  const now = new Date();

  // Build the learning target metadata
  const condition = await prisma.condition.findUnique({
    where: { id: conditionId },
    select: { system: true },
  });

  const learningTarget: LearningTarget = {
    conditionId,
    taskType,
    system: condition?.system ?? 'General',
    stability: topicProgress?.stability ?? 1.0,
    difficulty: topicProgress?.difficulty ?? 5.0,
    lapses: topicProgress?.lapses ?? 0,
    isOverdue: topicProgress?.nextReviewDate ? topicProgress.nextReviewDate <= now : false,
    priorityScore: 0, // Will be set by caller
  };

  // ── Strategy 1: Unused QuestionVariant matching taskType ──
  const unusedVariant = await prisma.questionVariant.findFirst({
    where: {
      baseQuestion: { conditionId },
      taskType,
      NOT: { usedByUsers: { has: userId } },
      id: { notIn: [...excludeQuestionIds] },
    },
    select: { id: true, baseQuestionId: true },
  });

  if (unusedVariant) {
    // Check recognition risk on the base question
    const risk = await detectRecognitionRisk(
      prisma, userId, unusedVariant.baseQuestionId, conditionId, taskType
    );

    return {
      questionId: unusedVariant.id,
      learningTarget,
      isVariant: true,
      isSecondChance: risk.shouldForceVariant,
      recognitionRisk: risk.riskScore,
      selectionMethod: 'unused_variant',
    };
  }

  // ── Strategy 2: Different question for the same condition + taskType ──
  // Find questions the student hasn't seen recently
  const candidateQuestions = await prisma.question.findMany({
    where: {
      conditionId,
      id: { notIn: [...excludeQuestionIds, ...variantsUsed] },
    },
    select: {
      id: true,
      question: true,
      vignette: true,
    },
    take: 10,
  });

  // Filter to those matching the target taskType by inference
  const taskMatchedQuestions = candidateQuestions.filter(q => {
    const text = q.question || q.vignette || '';
    const inferred = inferTaskType(text);
    return inferred === taskType;
  });

  const firstTaskMatch = taskMatchedQuestions[0];
  if (firstTaskMatch) {
    const risk = await detectRecognitionRisk(
      prisma, userId, firstTaskMatch.id, conditionId, taskType
    );

    return {
      questionId: firstTaskMatch.id,
      learningTarget,
      isVariant: true,
      isSecondChance: risk.shouldForceVariant,
      recognitionRisk: risk.riskScore,
      selectionMethod: 'different_question',
    };
  }

  // ── Strategy 3: Same condition, any taskType (cross-task fallback) ──
  const anyQuestion = candidateQuestions[0];
  if (anyQuestion) {
    return {
      questionId: anyQuestion.id,
      learningTarget,
      isVariant: true,
      isSecondChance: false,
      recognitionRisk: 0,
      selectionMethod: 'cross_task_fallback',
    };
  }

  // ── Strategy 4: Canonical question (last resort) ──
  const canonicalQuestion = await prisma.question.findFirst({
    where: { conditionId },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (canonicalQuestion) {
    return {
      questionId: canonicalQuestion.id,
      learningTarget,
      isVariant: false,
      isSecondChance: false,
      recognitionRisk: 0,
      selectionMethod: 'canonical_fallback',
    };
  }

  return null; // No question exists for this condition at all
}

/**
 * Map a question to its learning target (conditionId + taskType).
 * Used by the review pipeline to know which UserTopicProgress to update.
 */
export function mapQuestionToLearningTarget(
  questionData: {
    conditionId: string | null;
    stem?: string;
    question?: string;
    text?: string;
    taskType?: string;
    taskCategory?: string;
  }
): { conditionId: string; taskType: TaskType | string } | null {
  if (!questionData.conditionId) return null;

  // If the question has an explicit taskType, use it
  if (questionData.taskType) {
    return { conditionId: questionData.conditionId, taskType: questionData.taskType };
  }

  // If it has a taskCategory (from the PANCE taxonomy), reverse-map it
  if (questionData.taskCategory) {
    const reverseMap: Record<string, string> = {
      diagnosis: 'diagnosis',
      pharmaceutical: 'treatment',
      basic_science: 'mechanism',
      diagnostic_lab: 'workup',
      health_maintenance: 'prevention',
      clinical_intervention: 'complication',
      history_physical: 'diagnosis',
      professional_practice: 'clinical_pearl',
    };
    return {
      conditionId: questionData.conditionId,
      taskType: reverseMap[questionData.taskCategory] ?? DEFAULT_TASK_TYPE,
    };
  }

  // Infer from question text
  const text = questionData.stem || questionData.question || questionData.text || '';
  const inferred = text ? inferTaskType(text) : DEFAULT_TASK_TYPE;

  return { conditionId: questionData.conditionId, taskType: inferred };
}

/**
 * Fetch due reviews at the subdomain (learning target) level.
 *
 * This is the key upgrade over fetchDueReviews in conceptQuestionSelector,
 * which only looks at UserProgress (condition-level). This function queries
 * UserTopicProgress to find specific subdomain-level due reviews.
 *
 * @param prisma - Database client
 * @param userId - Student ID
 * @param limit - Maximum targets to return
 * @param examType - Exam type for blueprint weighting
 * @param scopeFilter - Optional system/condition filter
 * @returns Learning targets sorted by priority
 */
export async function fetchSubdomainDueReviews(
  prisma: PrismaClient,
  userId: string,
  limit: number = 50,
  examType: ExamType = 'PANCE',
  scopeFilter?: { system?: string; conditionId?: string }
): Promise<LearningTarget[]> {
  const now = new Date();

  // Build query filter
  const where: any = {
    userId,
    nextReviewDate: { lte: now },
  };

  if (scopeFilter?.conditionId) {
    where.conditionId = scopeFilter.conditionId;
  }

  // Fetch due topic progress entries
  const dueTopics = await prisma.userTopicProgress.findMany({
    where,
    select: {
      conditionId: true,
      taskType: true,
      stability: true,
      difficulty: true,
      lapses: true,
      nextReviewDate: true,
    },
    orderBy: { nextReviewDate: 'asc' },
    take: limit * 2, // Overfetch to allow filtering
  });

  if (dueTopics.length === 0) return [];

  // Get condition → system mapping
  const conditionIds = [...new Set(dueTopics.map(t => t.conditionId))];
  const conditions = await prisma.condition.findMany({
    where: { id: { in: conditionIds } },
    select: { id: true, system: true },
  });
  const systemMap = new Map(conditions.map(c => [c.id, c.system ?? 'General']));

  // Filter by system if scoped
  const filtered = scopeFilter?.system
    ? dueTopics.filter(t => systemMap.get(t.conditionId) === scopeFilter.system)
    : dueTopics;

  // Score and sort
  const targets: LearningTarget[] = filtered.map(t => {
    const system = systemMap.get(t.conditionId) ?? 'General';
    const stability = t.stability ?? 1.0;
    const lapses = t.lapses ?? 0;
    const isOverdue = t.nextReviewDate ? t.nextReviewDate <= now : false;

    // Priority = blueprint weight × urgency
    const blueprintWeight = getLearningTargetWeight(system, t.taskType, examType);
    const stabilityFactor = 1 / Math.max(0.5, stability);
    const overdueFactor = isOverdue ? 1.5 : 1.0;
    const lapseFactor = 1 + lapses * 0.15;
    const priorityScore = blueprintWeight * stabilityFactor * overdueFactor * lapseFactor;

    return {
      conditionId: t.conditionId,
      taskType: t.taskType,
      system,
      stability,
      difficulty: t.difficulty ?? 5.0,
      lapses,
      isOverdue,
      priorityScore,
    };
  });

  targets.sort((a, b) => b.priorityScore - a.priorityScore);
  return targets.slice(0, limit);
}

/**
 * Build a full Second Chance review session.
 *
 * For each due learning target, selects the best question (preferring variants)
 * and checks for recognition risk. Returns an ordered list of question selections.
 *
 * @param prisma - Database client
 * @param userId - Student ID
 * @param count - Number of review questions to generate
 * @param examType - Exam type for blueprint weighting
 * @param scopeFilter - Optional scope filter
 * @returns Array of question selections with metadata
 */
export async function buildSecondChanceReviewSet(
  prisma: PrismaClient,
  userId: string,
  count: number,
  examType: ExamType = 'PANCE',
  scopeFilter?: { system?: string; conditionId?: string }
): Promise<SecondChanceSelection[]> {
  // Step 1: Get due learning targets
  const dueTargets = await fetchSubdomainDueReviews(
    prisma, userId, count * 2, examType, scopeFilter
  );

  if (dueTargets.length === 0) return [];

  // Step 2: For each target, select a question
  const selections: SecondChanceSelection[] = [];
  const usedQuestionIds = new Set<string>();
  let recognitionChecks = 0;

  for (const target of dueTargets) {
    if (selections.length >= count) break;

    const selection = await selectSecondChanceQuestion(
      prisma,
      userId,
      target.conditionId,
      target.taskType,
      usedQuestionIds
    );

    if (!selection) continue;

    // Update priority score from the due target
    selection.learningTarget.priorityScore = target.priorityScore;

    usedQuestionIds.add(selection.questionId);
    selections.push(selection);
    recognitionChecks++;
  }

  return selections;
}
