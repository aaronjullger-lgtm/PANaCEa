/**
 * Scoring Engine Service - Compute learner confidence scores for graph nodes
 * based on ReviewLog accuracy, UserProgress stability, and FSRS retrievability.
 *
 * @example
 * import { scoringEngine } from '@/services/domain/scoringEngine';
 * const scores = await scoringEngine.computeConfidenceForNodes(prisma, userId, nodeIds);
 */

import type { EdgePrismaClient } from '../../functions/api/_shared/prisma-edge';

export interface ConfidenceScore {
  nodeId: string;
  confidence: number; // 0–1
  accuracy?: number;  // rolling accuracy (0–1)
  stability?: number; // from UserProgress (optional)
  retrievability?: number; // from FSRS (optional)
  reviewCount: number;
  lastReviewedAt?: Date;
}

/**
 * Compute confidence scores for a set of graph nodes.
 * @param prisma EdgePrismaClient
 * @param userId User ID
 * @param nodeIds Array of GraphNode IDs
 * @returns Map from node ID to confidence score (0–1). Nodes without review data get a default score of 0.5.
 */
export async function computeConfidenceForNodes(
  prisma: EdgePrismaClient,
  userId: string,
  nodeIds: string[]
): Promise<Record<string, number>> {
  if (nodeIds.length === 0) return {};

  // Fetch nodes to map nodeId -> sourceId (medicalContentId)
  const nodes = await prisma.graphNode.findMany({
    where: { id: { in: nodeIds } },
    select: { id: true, sourceType: true, sourceId: true }
  });

  const medicalContentNodes = nodes.filter(n => n.sourceType === 'MedicalContent');
  const medicalContentIds = medicalContentNodes.map(n => n.sourceId);

  // Fetch rolling accuracy for each medical content
  const accuracies = await computeRollingAccuracies(prisma, userId, medicalContentIds);

  // Map back to node IDs
  const result: Record<string, number> = {};
  for (const node of nodes) {
    if (node.sourceType === 'MedicalContent' && accuracies[node.sourceId] !== undefined) {
      result[node.id] = accuracies[node.sourceId];
    } else {
      // Default confidence for nodes without review data
      result[node.id] = 0.5;
    }
  }
  return result;
}

/**
 * Compute rolling accuracy (average correctness) for each medical content
 * based on the last 30 reviews or last 30 days, whichever yields more data.
 * Only includes MAIN session type reviews.
 */
async function computeRollingAccuracies(
  prisma: EdgePrismaClient,
  userId: string,
  medicalContentIds: string[]
): Promise<Record<string, number>> {
  if (medicalContentIds.length === 0) return {};

  // For simplicity, we'll compute accuracy across all historical reviews (MAIN session only).
  // In future, we can limit to last 30 reviews or last 30 days.
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      medicalContentId: { in: medicalContentIds },
      sessionType: 'MAIN',
      wasCorrect: { not: null }
    },
    select: {
      medicalContentId: true,
      wasCorrect: true,
      reviewedAt: true
    },
    orderBy: { reviewedAt: 'desc' }
  });

  // Group by medicalContentId
  const grouped: Record<string, { correct: number; total: number }> = {};
  for (const review of reviews) {
    if (!grouped[review.medicalContentId]) {
      grouped[review.medicalContentId] = { correct: 0, total: 0 };
    }
    grouped[review.medicalContentId].total++;
    if (review.wasCorrect) grouped[review.medicalContentId].correct++;
  }

  const accuracies: Record<string, number> = {};
  for (const [contentId, stats] of Object.entries(grouped)) {
    accuracies[contentId] = stats.total > 0 ? stats.correct / stats.total : 0.5;
  }
  return accuracies;
}

/**
 * Fetch FSRS stability values for medical content IDs from UserProgress.
 */
async function fetchStabilities(
  prisma: EdgePrismaClient,
  userId: string,
  conditionIds: string[]
): Promise<Record<string, number>> {
  if (conditionIds.length === 0) return {};

  const progresses = await prisma.userProgress.findMany({
    where: {
      userId,
      conditionId: { in: conditionIds },
      fsrsStability: { not: null }
    },
    select: { conditionId: true, fsrsStability: true }
  });

  const stabilities: Record<string, number> = {};
  for (const prog of progresses) {
    if (prog.fsrsStability != null) {
      stabilities[prog.conditionId] = prog.fsrsStability;
    }
  }
  return stabilities;
}

/**
 * Compute detailed confidence score for a single node.
 */
export async function computeConfidenceForNode(
  prisma: EdgePrismaClient,
  userId: string,
  nodeId: string
): Promise<ConfidenceScore> {
  const node = await prisma.graphNode.findUnique({
    where: { id: nodeId },
    select: { id: true, sourceType: true, sourceId: true }
  });
  if (!node) {
    throw new Error(`GraphNode ${nodeId} not found`);
  }

  let accuracy = 0.5;
  let reviewCount = 0;
  let lastReviewedAt: Date | undefined;
  let stability: number | undefined;

  if (node.sourceType === 'MedicalContent') {
    const reviews = await prisma.reviewLog.findMany({
      where: {
        userId,
        medicalContentId: node.sourceId,
        sessionType: 'MAIN',
        wasCorrect: { not: null }
      },
      select: { wasCorrect: true, reviewedAt: true },
      orderBy: { reviewedAt: 'desc' }
    });
    reviewCount = reviews.length;
    if (reviewCount > 0) {
      const correct = reviews.filter(r => r.wasCorrect).length;
      accuracy = correct / reviewCount;
      lastReviewedAt = reviews[0]?.reviewedAt;
    }

    // Fetch stability from UserProgress
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_conditionId: {
          userId,
          conditionId: node.sourceId,
        },
      },
      select: { fsrsStability: true },
    });
    stability = progress?.fsrsStability ?? undefined;
  }

  // TODO: Incorporate FSRS retrievability
  const confidence = accuracy; // for now, confidence = accuracy

  return {
    nodeId: node.id,
    confidence,
    accuracy,
    stability,
    reviewCount,
    lastReviewedAt,
  };
}

/**
 * Batch version that returns full ConfidenceScore objects.
 */
export async function computeConfidenceScores(
  prisma: EdgePrismaClient,
  userId: string,
  nodeIds: string[]
): Promise<ConfidenceScore[]> {
  const scores: ConfidenceScore[] = [];
  for (const nodeId of nodeIds) {
    try {
      const score = await computeConfidenceForNode(prisma, userId, nodeId);
      scores.push(score);
    } catch (err) {
      // If node not found, skip
      console.warn(`Failed to compute confidence for node ${nodeId}:`, err);
    }
  }
  return scores;
}

export const scoringEngine = {
  computeConfidenceForNodes,
  computeConfidenceForNode,
  computeConfidenceScores,
};