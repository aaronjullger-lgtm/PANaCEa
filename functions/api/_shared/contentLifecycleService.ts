import { Prisma } from '@prisma/client/edge';
import { prisma } from './prisma-edge';

/**
 * Content Lifecycle Service
 * Manages question state machine transitions:
 * DRAFT → REVIEWED → ACTIVE → DEPRECATED → RETIRED
 *
 * Enforces valid transitions and side effects (e.g., migrating SRS state)
 */

type LifecycleStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'RETIRED';
type QAStatus = 'UNREVIEWED' | 'APPROVED' | 'PENDING_FIX' | 'REMOVED';

interface LifecycleTransition {
  fromStatus: LifecycleStatus;
  toStatus: LifecycleStatus;
  allowed: boolean;
  reason?: string;
}

/**
 * Valid state machine transitions
 */
const VALID_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT: ['REVIEWED', 'RETIRED'], // Draft can be reviewed or abandoned
  REVIEWED: ['ACTIVE', 'DEPRECATED', 'RETIRED'], // Reviewed can be activated, deprecated, or retired
  ACTIVE: ['DEPRECATED', 'RETIRED', 'REVIEWED'], // Active can be deprecated or reverted for review
  DEPRECATED: ['ACTIVE', 'RETIRED'], // Deprecated can be reactivated or retired
  RETIRED: [], // Retired is final
};

/**
 * Get valid next states for a question
 */
export function getValidNextStates(
  currentStatus: LifecycleStatus
): LifecycleStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a transition is allowed
 */
export function isValidTransition(
  fromStatus: LifecycleStatus,
  toStatus: LifecycleStatus
): LifecycleTransition {
  const allowed = VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;

  if (!allowed) {
    return {
      fromStatus,
      toStatus,
      allowed: false,
      reason: `Cannot transition from ${fromStatus} to ${toStatus}`,
    };
  }

  return { fromStatus, toStatus, allowed: true };
}

/**
 * Transition a question to a new lifecycle status
 * Handles side effects and validation
 */
export async function transitionQuestion(
  questionId: string,
  toStatus: LifecycleStatus,
  reason?: string
): Promise<{
  success: boolean;
  message: string;
  question?: { id: string; lifecycleStatus: string };
}> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, lifecycleStatus: true, conditionId: true },
  });

  if (!question) {
    return { success: false, message: 'Question not found' };
  }

  const fromStatus = question.lifecycleStatus as LifecycleStatus;
  const transition = isValidTransition(fromStatus, toStatus);

  if (!transition.allowed) {
    return { success: false, message: transition.reason || 'Invalid transition' };
  }

  // Handle transition side effects
  switch (toStatus) {
    case 'ACTIVE':
      // When activating, ensure QA status is compatible
      await prisma.question.update({
        where: { id: questionId },
        data: {
          lifecycleStatus: toStatus,
          qaStatus: 'APPROVED', // Can only activate if approved
        },
      });
      break;

    case 'DEPRECATED':
      // When deprecating, exclude from exam modes
      // Questions still available in practice until replaced
      await prisma.question.update({
        where: { id: questionId },
        data: {
          lifecycleStatus: toStatus,
          // Don't change QA status; questions can be reviewed later
        },
      });
      break;

    case 'RETIRED':
      // When retiring, ensure all references are cleaned up
      await prisma.question.update({
        where: { id: questionId },
        data: {
          lifecycleStatus: toStatus,
          qaStatus: 'REMOVED',
        },
      });

      // Migrate SRS state if a replacement question is referenced in the reason field
      // Format: "replaced:REPLACEMENT_QUESTION_ID"
      if (reason?.startsWith('replaced:') && question.conditionId) {
        const replacementId = reason.split(':')[1];
        if (replacementId) {
          const replacementQuestion = await prisma.question.findUnique({
            where: { id: replacementId },
            select: { conditionId: true },
          });

          const replacementConditionId = replacementQuestion?.conditionId;
          if (replacementConditionId) {
            // Copy UserProgress entries to the replacement condition.
            const progressRecords = await prisma.userProgress.findMany({
              where: { conditionId: question.conditionId },
            });

            for (const record of progressRecords) {
              const fsrsCardJson =
                record.fsrsCard === null
                  ? Prisma.JsonNull
                  : (record.fsrsCard as Prisma.InputJsonValue);
              const reviewHistoryJson = (record.reviewHistory ?? [])
                .filter((entry) => entry !== null)
                .map((entry) => entry as Prisma.InputJsonValue);

              await prisma.userProgress.upsert({
                where: {
                  userId_conditionId_progressContext: {
                    userId: record.userId,
                    conditionId: replacementConditionId,
                    progressContext: record.progressContext,
                  },
                },
                update: {
                  fsrsCard: fsrsCardJson,
                  fsrsStability: record.fsrsStability,
                  fsrsDifficulty: record.fsrsDifficulty,
                  fsrsState: record.fsrsState,
                  fsrsReps: record.fsrsReps,
                  reviewHistory: reviewHistoryJson,
                  totalAttempts: record.totalAttempts,
                  correctCount: record.correctCount,
                  accuracy: record.accuracy,
                  system: record.system,
                  lastReviewAt: record.lastReviewAt,
                  nextReviewAt: record.nextReviewAt,
                  updatedAt: new Date(),
                },
                create: {
                  id: crypto.randomUUID(),
                  userId: record.userId,
                  conditionId: replacementConditionId,
                  progressContext: record.progressContext,
                  fsrsCard: fsrsCardJson,
                  fsrsStability: record.fsrsStability,
                  fsrsDifficulty: record.fsrsDifficulty,
                  fsrsState: record.fsrsState,
                  fsrsReps: record.fsrsReps,
                  reviewHistory: reviewHistoryJson,
                  totalAttempts: record.totalAttempts,
                  correctCount: record.correctCount,
                  accuracy: record.accuracy,
                  system: record.system,
                  lastReviewAt: record.lastReviewAt,
                  nextReviewAt: record.nextReviewAt,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }
        }
      }
      break;

    default:
      await prisma.question.update({
        where: { id: questionId },
        data: { lifecycleStatus: toStatus },
      });
  }

  return {
    success: true,
    message: `Successfully transitioned from ${fromStatus} to ${toStatus}`,
    question: { id: questionId, lifecycleStatus: toStatus },
  };
}

/**
 * Automatically deprecate questions with critical health issues
 * This enforces the rule: high-stakes modes only include ACTIVE questions with APPROVED QA status
 */
export async function autoDeprecateUnhealthyQuestions(
  criticalScoreThreshold: number = 0.3
): Promise<number> {
  const unhealthy = await prisma.question.findMany({
    where: {
      contentHealthScore: { lt: criticalScoreThreshold },
      lifecycleStatus: 'ACTIVE',
    },
    select: { id: true },
  });

  let deprecated = 0;
  for (const q of unhealthy) {
    const result = await transitionQuestion(
      q.id,
      'DEPRECATED',
      'Auto-deprecated due to critical health score'
    );
    if (result.success) deprecated++;
  }

  return deprecated;
}

/**
 * Get questions ready for deprecation
 * (ACTIVE but failing QA reviews)
 */
export async function getDeprecationCandidates(): Promise<
  Array<{
    id: string;
    system: string;
    contentHealthScore: number | null;
    qaStatus: string;
    reason: string;
  }>
> {
  const candidates = await prisma.question.findMany({
    where: {
      lifecycleStatus: 'ACTIVE',
      OR: [
        { qaStatus: 'PENDING_FIX' },
        { contentHealthScore: { lt: 0.3 } },
      ],
    },
    select: {
      id: true,
      system: true,
      contentHealthScore: true,
      qaStatus: true,
    },
    orderBy: { contentHealthScore: 'asc' },
  });

  return candidates.map((q) => ({
    id: q.id,
    system: q.system,
    contentHealthScore: q.contentHealthScore,
    qaStatus: q.qaStatus,
    reason:
      q.qaStatus === 'PENDING_FIX'
        ? 'QA review pending'
        : 'Low content health score',
  }));
}

/**
 * Get questions in DRAFT status ready for review
 */
export async function getDraftQuestionsForReview(): Promise<
  Array<{
    id: string;
    system: string;
    question: string;
    createdAt: Date;
  }>
> {
  return prisma.question.findMany({
    where: { lifecycleStatus: 'DRAFT' },
    select: {
      id: true,
      system: true,
      question: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
}

/**
 * Approve a question (move from DRAFT to REVIEWED, mark as APPROVED)
 */
export async function approveQuestion(
  questionId: string
): Promise<{ success: boolean; message: string }> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { lifecycleStatus: true },
  });

  if (!question) {
    return { success: false, message: 'Question not found' };
  }

  // Only DRAFT or REVIEWED questions can be approved
  if (!['DRAFT', 'REVIEWED'].includes(question.lifecycleStatus)) {
    return {
      success: false,
      message: `Cannot approve a ${question.lifecycleStatus} question`,
    };
  }

  await prisma.question.update({
    where: { id: questionId },
    data: {
      lifecycleStatus: 'REVIEWED',
      qaStatus: 'APPROVED',
    },
  });

  return { success: true, message: 'Question approved and ready for activation' };
}

/**
 * Mark a question as needing review (set qaStatus to PENDING_FIX)
 */
export async function flagForReview(
  questionId: string,
  issues: string[]
): Promise<{ success: boolean; message: string }> {
  await prisma.question.update({
    where: { id: questionId },
    data: {
      qaStatus: 'PENDING_FIX',
      // Could store issues in a JSON field if added to schema
    },
  });

  return {
    success: true,
    message: `Question flagged for review. Issues: ${issues.join(', ')}`,
  };
}

/**
 * Export lifecycle configuration
 */
export const LIFECYCLE_CONFIG = {
  VALID_TRANSITIONS,
  STATUS_DEFINITIONS: {
    DRAFT: 'Initial creation, not yet reviewed',
    REVIEWED: 'Reviewed and ready for activation',
    ACTIVE: 'Published and in use for studying',
    DEPRECATED: 'No longer in use but retained for reference',
    RETIRED: 'Permanently removed from system',
  },
};
