/**
 * User Timing Profile Service
 *
 * Computes a per-user speed factor from their QuestionAttempt response times.
 * Used to personalize par time in the FSRS implicit rating pipeline.
 *
 * Architecture:
 * - Aggregates recent attempts (last 60 days, max 200) into complexity tiers
 * - Computes median response time per tier
 * - Derives a single speed factor = population_par_median / user_median
 *   (speedFactor > 1.0 = faster than average, < 1.0 = slower)
 * - Cached in UserStatistics.timingProfile JSON, refreshed periodically
 *
 * Complexity tiers (based on word count of stem + options):
 * - short:  < 60 words
 * - medium: 60-150 words
 * - long:   150-300 words
 * - vignette: > 300 words (clinical vignettes)
 */

import type { PrismaClient } from '@prisma/client';

// ── Tier boundaries (word count) ──
const TIER_THRESHOLDS = {
  short: 60,
  medium: 150,
  long: 300,
} as const;

export type ComplexityTier = 'short' | 'medium' | 'long' | 'vignette';

export interface TierProfile {
  tier: ComplexityTier;
  medianMs: number;
  count: number;
}

export interface UserTimingProfile {
  /** Multiplicative factor for par time: parTime * speedFactor */
  speedFactor: number;
  /** Per-tier breakdown */
  tiers: TierProfile[];
  /** Total attempts used in computation */
  totalAttempts: number;
  /** When this profile was computed */
  computedAt: string;
}

/** Minimum attempts before we trust the profile */
const MIN_ATTEMPTS_FOR_PROFILE = 25;

/** How many recent attempts to use */
const MAX_ATTEMPTS = 200;

/** Days of history to consider */
const LOOKBACK_DAYS = 60;

/**
 * Population baseline median response times per tier (ms).
 * These are the "expected" times for an average PA student.
 * Derived from the calculateParTime formula's assumptions:
 * - 3 words/sec reading speed
 * - 8s decision buffer + 2s per option (4 options = 16s base)
 */
const POPULATION_BASELINE_MS: Record<ComplexityTier, number> = {
  short: 26000,   // ~30 words → 10s read + 16s decide
  medium: 51000,  // ~100 words → 33s read + 16s decide + 2s buffer
  long: 91000,    // ~225 words → 75s read + 16s decide
  vignette: 136000, // ~360 words → 120s read + 16s decide
};

/**
 * Classify question text into complexity tier by word count.
 */
export function classifyComplexityTier(questionText: string): ComplexityTier {
  const wordCount = questionText.trim().split(/\s+/).length;
  if (wordCount < TIER_THRESHOLDS.short) return 'short';
  if (wordCount < TIER_THRESHOLDS.medium) return 'medium';
  if (wordCount < TIER_THRESHOLDS.long) return 'long';
  return 'vignette';
}

/**
 * Compute median of a sorted numeric array.
 */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute the user's timing profile from recent attempts.
 *
 * Returns null if insufficient data (< MIN_ATTEMPTS_FOR_PROFILE).
 * The speedFactor is clamped to [0.5, 2.0] to prevent extreme adjustments.
 */
export async function computeUserTimingProfile(
  prisma: PrismaClient,
  userId: string
): Promise<UserTimingProfile | null> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);

  // Fetch recent main-session attempts with timing data
  const attempts = await (prisma as any).questionAttempt.findMany({
    where: {
      userId,
      isMainSession: true,
      createdAt: { gte: cutoff },
      timeSpentMs: { not: null, gt: 500 }, // Exclude rapid guesses
    },
    select: {
      timeSpentMs: true,
      questionId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ATTEMPTS,
  });

  if (attempts.length < MIN_ATTEMPTS_FOR_PROFILE) return null;

  // Fetch question text for complexity classification
  const questionIds = [...new Set(attempts.map((a: any) => a.questionId))];
  const questions = await (prisma as any).preGeneratedQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, questionData: true },
  });

  const questionTextMap = new Map<string, string>();
  for (const q of questions) {
    const data = q.questionData as Record<string, unknown> | null;
    if (!data) continue;
    const stem = (data.stem ?? data.question ?? data.vignette ?? data.text ?? '') as string;
    const choices = (data.choices ?? data.options ?? []) as Array<{ text?: string; label?: string } | string>;
    const choiceText = choices
      .map((c: any) => (typeof c === 'string' ? c : c?.text || c?.label || ''))
      .join(' ');
    questionTextMap.set(q.id, `${stem} ${choiceText}`.trim());
  }

  // Group attempt times by tier
  const tierTimes: Record<ComplexityTier, number[]> = {
    short: [],
    medium: [],
    long: [],
    vignette: [],
  };

  for (const attempt of attempts) {
    const text = questionTextMap.get(attempt.questionId);
    if (!text) continue;
    const tier = classifyComplexityTier(text);
    tierTimes[tier].push(attempt.timeSpentMs);
  }

  // Compute per-tier medians
  const tiers: TierProfile[] = [];
  let weightedRatioSum = 0;
  let weightSum = 0;

  for (const tier of ['short', 'medium', 'long', 'vignette'] as ComplexityTier[]) {
    const times = tierTimes[tier].sort((a, b) => a - b);
    if (times.length < 5) continue; // Need minimum per tier

    const med = median(times);
    tiers.push({ tier, medianMs: Math.round(med), count: times.length });

    // Weight by count — tiers with more data contribute more
    const ratio = POPULATION_BASELINE_MS[tier] / med;
    weightedRatioSum += ratio * times.length;
    weightSum += times.length;
  }

  if (weightSum === 0) return null;

  // speedFactor > 1.0 means user is faster than population baseline
  // speedFactor < 1.0 means user is slower
  // Clamped to [0.5, 2.0] to prevent extreme par time adjustments
  const rawFactor = weightedRatioSum / weightSum;
  const speedFactor = Math.max(0.5, Math.min(2.0, rawFactor));

  return {
    speedFactor: Math.round(speedFactor * 1000) / 1000, // 3 decimal places
    tiers,
    totalAttempts: attempts.length,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Get cached timing profile, recomputing if stale (> 24 hours).
 * Returns speedFactor of 1.0 (no adjustment) if no profile available.
 */
export async function getUserSpeedFactor(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  try {
    const stats = await (prisma as any).userStatistics.findUnique({
      where: { userId },
      select: { timingProfile: true },
    });

    const cached = stats?.timingProfile as UserTimingProfile | null;
    if (cached?.computedAt) {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return cached.speedFactor;
      }
    }

    // Recompute
    const profile = await computeUserTimingProfile(prisma, userId);
    if (!profile) return 1.0;

    // Cache (non-blocking)
    (prisma as any).userStatistics.upsert({
      where: { userId },
      update: { timingProfile: profile as any },
      create: {
        userId,
        totalQuestions: 0,
        correctAnswers: 0,
        systemStats: {},
        timingProfile: profile as any,
      },
    }).catch(() => { /* non-fatal */ });

    return profile.speedFactor;
  } catch {
    return 1.0; // Safe fallback
  }
}
