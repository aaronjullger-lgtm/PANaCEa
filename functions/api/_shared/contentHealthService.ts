import { prisma } from './prisma-edge';

/**
 * Content Health Service
 * Computes and manages question quality scores based on:
 * - Miss rates across user ability levels
 * - FSRS difficulty vs observed performance (contradiction = low quality)
 * - QA approval status
 */

interface QuestionHealthMetrics {
  questionId: string;
  totalAttempts: number;
  totalCorrect: number;
  missRate: number;
  fsrsAvgDifficulty: number;
  fsrsAvgRetrievability: number;
  qaStatus: string;
  lifecycleStatus: string;
}

interface ContentHealthScore {
  questionId: string;
  score: number; // 0-1
  issueFlags: string[];
}

const HEALTH_SCORE_THRESHOLDS = {
  CRITICAL: 0.3, // Flag for removal or review
  LOW: 0.5, // Consider for demotion from high-stakes modes
  MEDIUM: 0.7,
  HIGH: 0.85,
};

/**
 * Compute health score for a single question
 * Returns a score from 0 (worst) to 1 (best)
 */
export async function computeQuestionHealthScore(
  questionId: string
): Promise<ContentHealthScore> {
  const metrics = await gatherQuestionMetrics(questionId);
  if (!metrics) {
    return { questionId, score: 1.0, issueFlags: [] };
  }

  const issueFlags: string[] = [];
  let score = 1.0;

  // Factor 1: Miss rate (30% of score)
  // Higher miss rate = lower score
  const missRateFactor = 1 - Math.min(metrics.missRate, 1.0);
  const missRateComponent = missRateFactor * 0.3;
  score -= (1 - missRateComponent) * 0.3;

  if (metrics.missRate > 0.5) {
    issueFlags.push('HIGH_MISS_RATE');
  }

  // Factor 2: FSRS difficulty vs performance mismatch (30% of score)
  // If question is marked as high difficulty but low performance, or vice versa, flag it
  const performanceMetric = metrics.totalCorrect / (metrics.totalAttempts || 1);
  const fsrsDifficultyFactor = Math.abs(
    metrics.fsrsAvgDifficulty - (1 - performanceMetric)
  );
  const difficultyComponent = Math.max(0, 1 - fsrsDifficultyFactor);
  score -= (1 - difficultyComponent) * 0.3;

  if (fsrsDifficultyFactor > 0.4) {
    issueFlags.push('DIFFICULTY_MISMATCH');
  }

  // Factor 3: QA Status weight (25% of score)
  // APPROVED questions score higher
  let qaComponent = 0.5; // Default for UNREVIEWED
  if (metrics.qaStatus === 'APPROVED') {
    qaComponent = 1.0;
  } else if (metrics.qaStatus === 'PENDING_FIX') {
    qaComponent = 0.2;
    issueFlags.push('PENDING_FIX');
  }
  score -= (1 - qaComponent) * 0.25;

  // Factor 4: Lifecycle status (15% of score)
  let lifecycleComponent = 1.0;
  if (metrics.lifecycleStatus !== 'ACTIVE') {
    lifecycleComponent = 0.5;
  }
  score -= (1 - lifecycleComponent) * 0.15;

  // Normalize to 0-1 range
  const finalScore = Math.max(0, Math.min(1, score));

  return {
    questionId,
    score: finalScore,
    issueFlags,
  };
}

/**
 * Compute health scores for all questions
 * Used by the nightly job
 */
export async function computeAllQuestionHealthScores(): Promise<
  Array<{ questionId: string; score: number }>
> {
  const questions = await prisma.question.findMany({
    select: { id: true },
    where: {
      lifecycleStatus: { in: ['ACTIVE', 'DEPRECATED'] },
    },
  });

  const results = [];

  for (const q of questions) {
    const healthScore = await computeQuestionHealthScore(q.id);
    results.push({
      questionId: q.id,
      score: healthScore.score,
    });
  }

  return results;
}

/**
 * Update question health scores in the database
 */
export async function persistHealthScores(
  scores: Array<{ questionId: string; score: number }>
): Promise<void> {
  for (const { questionId, score } of scores) {
    await prisma.question.update({
      where: { id: questionId },
      data: {
        contentHealthScore: score,
        lastHealthScoredAt: new Date(),
      },
    });
  }
}

/**
 * Get questions with health scores below a threshold
 * Useful for admin review and automated demotions
 */
export async function getQuestionsBelowHealthThreshold(
  threshold: number = HEALTH_SCORE_THRESHOLDS.LOW
): Promise<
  Array<{
    questionId: string;
    score: number;
    system: string;
    condition: string | null;
    issueFlags: string[];
  }>
> {
  const questions = await prisma.question.findMany({
    where: {
      contentHealthScore: { lt: threshold },
      lifecycleStatus: 'ACTIVE',
    },
    select: {
      id: true,
      contentHealthScore: true,
      system: true,
      Condition: { select: { name: true } },
    },
    orderBy: {
      contentHealthScore: 'asc',
    },
  });

  const results = [];
  for (const q of questions) {
    const health = await computeQuestionHealthScore(q.id);
    results.push({
      questionId: q.id,
      score: q.contentHealthScore || 0,
      system: q.system,
      condition: q.Condition?.name || null,
      issueFlags: health.issueFlags,
    });
  }

  return results;
}

/**
 * Get systems with low average health scores
 */
export async function getSystemHealthSummary(): Promise<
  Array<{
    system: string;
    averageHealthScore: number;
    activeQuestionCount: number;
    lowHealthCount: number;
  }>
> {
  const systems = await prisma.question.groupBy({
    by: ['system'],
    where: {
      lifecycleStatus: 'ACTIVE',
    },
    _avg: {
      contentHealthScore: true,
    },
    _count: {
      id: true,
    },
  });

  const results = [];

  for (const sys of systems) {
    const lowHealthCount = await prisma.question.count({
      where: {
        system: sys.system,
        contentHealthScore: {
          lt: HEALTH_SCORE_THRESHOLDS.LOW,
        },
        lifecycleStatus: 'ACTIVE',
      },
    });

    results.push({
      system: sys.system,
      averageHealthScore: sys._avg.contentHealthScore || 1.0,
      activeQuestionCount: sys._count.id,
      lowHealthCount,
    });
  }

  return results.sort(
    (a, b) => a.averageHealthScore - b.averageHealthScore
  );
}

/**
 * Automatically demote questions with critical health scores from high-stakes modes
 * This should be run after health scores are computed
 */
export async function autoDemoteUnhealthyQuestions(): Promise<number> {
  const criticalQuestions = await prisma.question.findMany({
    where: {
      contentHealthScore: {
        lt: HEALTH_SCORE_THRESHOLDS.CRITICAL,
      },
      lifecycleStatus: 'ACTIVE',
      qaStatus: { not: 'APPROVED' },
    },
    select: { id: true },
  });

  if (criticalQuestions.length === 0) {
    return 0;
  }

  // Update their QA status to PENDING_FIX so they won't appear in exam simulator
  await prisma.question.updateMany({
    where: {
      id: { in: criticalQuestions.map((q) => q.id) },
    },
    data: {
      qaStatus: 'PENDING_FIX',
    },
  });

  return criticalQuestions.length;
}

/**
 * Internal: Gather metrics for a single question from review logs
 */
async function gatherQuestionMetrics(
  questionId: string
): Promise<QuestionHealthMetrics | null> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      qaStatus: true,
      lifecycleStatus: true,
      ReviewLog: {
        select: {
          wasCorrect: true,
          difficulty: true,
          retrievability: true,
        },
      },
    },
  });

  if (!question || question.ReviewLog.length === 0) {
    return null;
  }

  const totalAttempts = question.ReviewLog.length;
  const totalCorrect = question.ReviewLog.filter((r) => r.wasCorrect).length;
  const missRate = 1 - totalCorrect / totalAttempts;

  const fsrsAvgDifficulty =
    question.ReviewLog.reduce((sum, r) => sum + (r.difficulty || 0), 0) /
    totalAttempts;

  const fsrsAvgRetrievability =
    question.ReviewLog.reduce(
      (sum, r) => sum + (r.retrievability !== null ? r.retrievability : 0),
      0
    ) / totalAttempts;

  return {
    questionId: question.id,
    totalAttempts,
    totalCorrect,
    missRate,
    fsrsAvgDifficulty,
    fsrsAvgRetrievability,
    qaStatus: question.qaStatus,
    lifecycleStatus: question.lifecycleStatus,
  };
}

export const HEALTH_SCORE_CONFIG = {
  THRESHOLDS: HEALTH_SCORE_THRESHOLDS,
  WEIGHT_MISS_RATE: 0.3,
  WEIGHT_FSRS_MISMATCH: 0.3,
  WEIGHT_QA_STATUS: 0.25,
  WEIGHT_LIFECYCLE: 0.15,
};
