/**
 * Recognition Risk Detector
 *
 * Detects when a student is likely recognizing a specific question rather
 * than demonstrating genuine knowledge transfer. Recognition manifests as:
 *   1. Seeing the exact same question multiple times in recent reviews
 *   2. Suspiciously fast response time relative to question complexity
 *   3. High accuracy on a specific question but low accuracy on the same
 *      condition+taskType with different phrasing
 *
 * When recognition risk is high, the Second Chance engine forces a variant
 * to test whether the student can transfer knowledge to novel presentations.
 *
 * Research:
 *   - Kornell & Bjork (2008): "Learning concepts and categories" — recognition
 *     vs. transfer distinction
 *   - Roediger & Karpicke (2006): Testing effect requires retrieval, not recognition
 *
 * @module lib/services/recognitionRiskDetector
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecognitionRiskResult {
  /** 0 = no risk, 1 = certain recognition */
  riskScore: number;
  /** Which signals contributed to the score */
  signals: RecognitionSignal[];
  /** Whether a variant should be forced */
  shouldForceVariant: boolean;
  /** Human-readable summary for logging */
  summary: string;
}

export interface RecognitionSignal {
  type: 'repeat_exposure' | 'fast_response' | 'accuracy_divergence' | 'high_reps_low_stability';
  weight: number;
  detail: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Number of recent reviews to check for repeat exposure */
const RECENT_REVIEW_WINDOW = 3;

/** Risk threshold above which we force a variant */
const FORCE_VARIANT_THRESHOLD = 0.6;

/** If a student answers faster than this ratio of their median, it's suspicious */
const FAST_RESPONSE_RATIO = 0.4;

/** Weight of each signal in the composite risk score */
const SIGNAL_WEIGHTS = {
  repeat_exposure: 0.40,
  fast_response: 0.25,
  accuracy_divergence: 0.20,
  high_reps_low_stability: 0.15,
} as const;

/** Minimum reps on a Card to consider accuracy divergence meaningful */
const MIN_CARD_REPS_FOR_DIVERGENCE = 3;

/** Stability threshold — if topic stability is below this, the student hasn't truly learned */
const LOW_TOPIC_STABILITY_THRESHOLD = 5.0; // days

// ─── Core Detection ────────────────────────────────────────────────────────

/**
 * Detect recognition risk for a specific question being considered for review.
 *
 * @param prisma - Database client
 * @param userId - Student ID
 * @param questionId - Question being evaluated
 * @param conditionId - Condition this question belongs to
 * @param taskType - Task type (diagnosis, treatment, etc.)
 * @returns Recognition risk assessment
 */
export async function detectRecognitionRisk(
  prisma: PrismaClient,
  userId: string,
  questionId: string,
  conditionId: string,
  taskType: string
): Promise<RecognitionRiskResult> {
  const signals: RecognitionSignal[] = [];

  // Run all checks in parallel
  const [repeatSignal, fastResponseSignal, divergenceSignal, repsStabilitySignal] =
    await Promise.all([
      checkRepeatExposure(prisma, userId, questionId),
      checkFastResponse(prisma, userId, questionId),
      checkAccuracyDivergence(prisma, userId, questionId, conditionId, taskType),
      checkHighRepsLowStability(prisma, userId, conditionId, taskType),
    ]);

  if (repeatSignal) signals.push(repeatSignal);
  if (fastResponseSignal) signals.push(fastResponseSignal);
  if (divergenceSignal) signals.push(divergenceSignal);
  if (repsStabilitySignal) signals.push(repsStabilitySignal);

  // Calculate composite risk score (weighted sum, capped at 1.0)
  let riskScore = 0;
  for (const signal of signals) {
    riskScore += signal.weight;
  }
  riskScore = Math.min(1.0, riskScore);

  const shouldForceVariant = riskScore >= FORCE_VARIANT_THRESHOLD;

  const summary = signals.length === 0
    ? 'No recognition risk detected'
    : `Risk ${(riskScore * 100).toFixed(0)}%: ${signals.map(s => s.type).join(', ')}`;

  return { riskScore, signals, shouldForceVariant, summary };
}

/**
 * Lightweight risk check that only queries Card reps — for bulk filtering.
 * Returns true if the card has been reviewed frequently (potential recognition).
 */
export async function quickRecognitionCheck(
  prisma: PrismaClient,
  userId: string,
  questionId: string
): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { userId_questionId_progressContext: { userId, questionId, progressContext: 'READINESS' } },
    select: { reps: true },
  });
  return (card?.reps ?? 0) >= RECENT_REVIEW_WINDOW;
}

// ─── Signal Detectors ──────────────────────────────────────────────────────

/**
 * Signal 1: Has the student seen this exact question in their last N reviews?
 */
async function checkRepeatExposure(
  prisma: PrismaClient,
  userId: string,
  questionId: string
): Promise<RecognitionSignal | null> {
  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      questionId,
    },
    orderBy: { createdAt: 'desc' },
    take: RECENT_REVIEW_WINDOW + 1,
    select: { createdAt: true },
  });

  if (recentReviews.length < 2) return null;

  // More recent exposures = higher risk
  const exposureCount = recentReviews.length;
  const scaledWeight = SIGNAL_WEIGHTS.repeat_exposure *
    Math.min(1.0, exposureCount / (RECENT_REVIEW_WINDOW + 1));

  return {
    type: 'repeat_exposure',
    weight: scaledWeight,
    detail: `Question seen ${exposureCount} times in recent reviews`,
  };
}

/**
 * Signal 2: Was the student's response time suspiciously fast?
 * Fast RT on a repeatedly-seen question suggests pattern matching, not retrieval.
 */
async function checkFastResponse(
  prisma: PrismaClient,
  userId: string,
  questionId: string
): Promise<RecognitionSignal | null> {
  // Get the student's last response time for this question
  const lastAttempt = await prisma.questionAttempt.findFirst({
    where: { userId, questionId },
    orderBy: { createdAt: 'desc' },
    select: { timeSpentMs: true },
  });

  if (!lastAttempt?.timeSpentMs) return null;

  // Get the student's median response time across all recent attempts
  const recentAttempts = await prisma.questionAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { timeSpentMs: true },
  });

  const validTimes = recentAttempts
    .map(a => a.timeSpentMs)
    .filter((t): t is number => t != null && t > 0)
    .sort((a, b) => a - b);

  if (validTimes.length < 10) return null;

  const medianTime = validTimes[Math.floor(validTimes.length / 2)]!;
  const ratio = lastAttempt.timeSpentMs / medianTime;

  if (ratio > FAST_RESPONSE_RATIO) return null;

  return {
    type: 'fast_response',
    weight: SIGNAL_WEIGHTS.fast_response * (1 - ratio / FAST_RESPONSE_RATIO),
    detail: `Response time ${Math.round(ratio * 100)}% of median (${lastAttempt.timeSpentMs}ms vs ${medianTime}ms median)`,
  };
}

/**
 * Signal 3: Student is accurate on this specific question but struggles
 * with the same condition+taskType when presented differently.
 */
async function checkAccuracyDivergence(
  prisma: PrismaClient,
  userId: string,
  questionId: string,
  conditionId: string,
  taskType: string
): Promise<RecognitionSignal | null> {
  // Get accuracy on this specific question
  const cardAttempts = await prisma.questionAttempt.findMany({
    where: { userId, questionId },
    select: { isCorrect: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  if (cardAttempts.length < MIN_CARD_REPS_FOR_DIVERGENCE) return null;

  const cardAccuracy = cardAttempts.filter(a => a.isCorrect).length / cardAttempts.length;

  // Get topic-level stability (proxy for true understanding)
  const topicProgress = await prisma.userTopicProgress.findUnique({
    where: {
      userId_conditionId_taskType_progressContext: { userId, conditionId, taskType, progressContext: 'READINESS' },
    },
    select: { stability: true, difficulty: true },
  });

  if (!topicProgress) return null;

  // High card accuracy + low topic stability = recognition risk
  // The topic stability reflects how well they do across variants
  const stabilityNormalized = Math.min(1.0, (topicProgress.stability ?? 0) / 30);
  const divergence = cardAccuracy - stabilityNormalized;

  if (divergence < 0.3) return null; // Not enough divergence

  return {
    type: 'accuracy_divergence',
    weight: SIGNAL_WEIGHTS.accuracy_divergence * Math.min(1.0, divergence / 0.5),
    detail: `Card accuracy ${(cardAccuracy * 100).toFixed(0)}% but topic stability only ${(topicProgress.stability ?? 0).toFixed(1)} days`,
  };
}

/**
 * Signal 4: High reps on card-level but low stability on topic-level.
 * Indicates the student has reviewed the exact card many times without
 * building durable knowledge of the underlying concept.
 */
async function checkHighRepsLowStability(
  prisma: PrismaClient,
  userId: string,
  conditionId: string,
  taskType: string
): Promise<RecognitionSignal | null> {
  const topicProgress = await prisma.userTopicProgress.findUnique({
    where: {
      userId_conditionId_taskType_progressContext: { userId, conditionId, taskType, progressContext: 'READINESS' },
    },
    select: { stability: true, reps: true, lapses: true },
  });

  if (!topicProgress) return null;

  const reps = topicProgress.reps ?? 0;
  const stability = topicProgress.stability ?? 0;
  const lapses = topicProgress.lapses ?? 0;

  // Many reviews + low stability + some lapses = pattern matching not learning
  if (reps < 4 || stability > LOW_TOPIC_STABILITY_THRESHOLD) return null;

  // More lapses relative to reps = stronger signal
  const lapseRatio = reps > 0 ? lapses / reps : 0;
  const riskIntensity = Math.min(1.0, lapseRatio * 2);

  if (riskIntensity < 0.2) return null;

  return {
    type: 'high_reps_low_stability',
    weight: SIGNAL_WEIGHTS.high_reps_low_stability * riskIntensity,
    detail: `${reps} reps but stability only ${stability.toFixed(1)}d with ${lapses} lapses`,
  };
}
