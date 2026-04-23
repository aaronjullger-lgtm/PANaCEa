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
import { fitExGaussian, type ExGaussianParams } from '../confidence/exGaussianRT';

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
  // noUncheckedIndexedAccess: length > 0 means sorted[mid] is defined; guards are
  // belt-and-suspenders to satisfy TS strict indexing.
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return sorted.length % 2 === 0 ? (a + b) / 2 : b;
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
  } catch (err) {
    console.debug('[userTimingProfileService] speed factor lookup failed, using 1.0 fallback', err);
    return 1.0;
  }
}

/**
 * Per-user behavioral baseline for z-score normalization.
 * Rolling statistics from recent attempts, used to normalize confidence signals
 * against the student's own behavioral history rather than absolute thresholds.
 *
 * Research basis:
 * - Ratcliff & McKoon (2008): RT distributions are log-normal and individual-specific
 * - Van der Linden (2006): person-specific speed-accuracy tradeoff parameters improve models
 */
export interface UserBehavioralBaseline {
  rtBaseline: {
    medianMs: number;
    stdDevMs: number;
    p25Ms: number;
    p75Ms: number;
    n: number;
    /** Ex-Gaussian fit for RT distribution (Ratcliff, 1978) */
    exGaussian?: ExGaussianParams;
  };
  switchBaseline: {
    medianSwitches: number;
    p75Switches: number;
    n: number;
  };
  hesitationBaseline: {
    medianCommitmentGapMs: number;
    medianCursorEntropy: number;
    medianOscillations: number;
    n: number;
  };
  computedAt: string;
}

/** Minimum attempts before generating a behavioral baseline */
const MIN_ATTEMPTS_FOR_BASELINE = 25;

/** Max attempts to scan for baseline */
const BASELINE_MAX_ATTEMPTS = 200;

/** Days of history for baseline */
const BASELINE_LOOKBACK_DAYS = 60;

/**
 * Compute percentile stats for an array of numbers.
 */
function percentileStats(values: number[]): { median: number; p25: number; p75: number; stdDev: number } {
  if (values.length === 0) return { median: 0, p25: 0, p75: 0, stdDev: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? med;
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? med;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return { median: med, p25, p75, stdDev: Math.sqrt(variance) };
}

/**
 * Compute rolling behavioral baselines from a user's recent QuestionAttempts.
 * Extracts RT, switch count, and hesitation signals from telemetryJson.
 * Returns null if insufficient data.
 */
export async function computeBehavioralBaseline(
  prisma: PrismaClient,
  userId: string
): Promise<UserBehavioralBaseline | null> {
  const cutoff = new Date(Date.now() - BASELINE_LOOKBACK_DAYS * 86400000);

  const attempts = await (prisma as any).questionAttempt.findMany({
    where: {
      userId,
      isMainSession: true,
      createdAt: { gte: cutoff },
      telemetryJson: { not: null },
      durationMs: { gt: 500 },
    },
    select: {
      durationMs: true,
      telemetryJson: true,
    },
    orderBy: { createdAt: 'desc' },
    take: BASELINE_MAX_ATTEMPTS,
  });

  if (attempts.length < MIN_ATTEMPTS_FOR_BASELINE) return null;

  const rtValues: number[] = [];
  const switchValues: number[] = [];
  const gapValues: number[] = [];
  const entropyValues: number[] = [];
  const oscValues: number[] = [];

  for (const attempt of attempts) {
    const t = attempt.telemetryJson as Record<string, unknown> | null;
    if (!t) continue;

    // RT: use time_to_first_interaction_ms if available, else durationMs
    const firstClick = t.time_to_first_interaction_ms as number | null;
    const rt = firstClick ?? attempt.durationMs;
    if (typeof rt === 'number' && rt > 500) {
      rtValues.push(rt);
    }

    // Switches
    const switches = t.answer_changes as number | undefined;
    if (typeof switches === 'number') {
      switchValues.push(switches);
    }

    // Hesitation signals (from CRPL micro-kinetics)
    const serverComputed = t.server_computed as Record<string, unknown> | undefined;
    const gap = (t.selection_drift_ms as number | undefined) ??
                (serverComputed?.commitment_gap_ms as number | undefined);
    if (typeof gap === 'number') gapValues.push(gap);

    const entropy = t.cursor_entropy as number | undefined;
    if (typeof entropy === 'number') entropyValues.push(entropy);

    const osc = t.hover_oscillations as number | undefined;
    if (typeof osc === 'number') oscValues.push(osc);
  }

  const rtStats = percentileStats(rtValues);
  const switchStats = percentileStats(switchValues);

  // Fit ex-Gaussian distribution to RT values (Ratcliff, 1978; Luce, 1986)
  // Returns null if insufficient data — caller falls back to Gaussian z-score
  const exGaussianParams = fitExGaussian(rtValues);

  return {
    rtBaseline: {
      medianMs: Math.round(rtStats.median),
      stdDevMs: Math.round(rtStats.stdDev),
      p25Ms: Math.round(rtStats.p25),
      p75Ms: Math.round(rtStats.p75),
      n: rtValues.length,
      exGaussian: exGaussianParams ?? undefined,
    },
    switchBaseline: {
      medianSwitches: Math.round(switchStats.median * 100) / 100,
      p75Switches: Math.round(switchStats.p75 * 100) / 100,
      n: switchValues.length,
    },
    hesitationBaseline: {
      medianCommitmentGapMs: gapValues.length > 0 ? Math.round(percentileStats(gapValues).median) : 0,
      medianCursorEntropy: entropyValues.length > 0
        ? Math.round(percentileStats(entropyValues).median * 1000) / 1000
        : 0,
      medianOscillations: oscValues.length > 0
        ? Math.round(percentileStats(oscValues).median * 100) / 100
        : 0,
      n: Math.min(gapValues.length, entropyValues.length, oscValues.length),
    },
    computedAt: new Date().toISOString(),
  };
}

/**
 * Get cached behavioral baseline, recomputing if stale (> 24 hours).
 * Returns null if insufficient data — caller falls back to absolute thresholds.
 */
export async function getUserBehavioralBaseline(
  prisma: PrismaClient,
  userId: string
): Promise<UserBehavioralBaseline | null> {
  try {
    const stats = await (prisma as any).userStatistics.findUnique({
      where: { userId },
      select: { timingProfile: true },
    });

    // Check if behavioral baseline is cached inside timingProfile
    const cached = stats?.timingProfile as (UserTimingProfile & { behavioralBaseline?: UserBehavioralBaseline }) | null;
    if (cached?.behavioralBaseline?.computedAt) {
      const age = Date.now() - new Date(cached.behavioralBaseline.computedAt).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return cached.behavioralBaseline;
      }
    }

    // Recompute
    const baseline = await computeBehavioralBaseline(prisma, userId);
    if (!baseline) return null;

    // Cache alongside existing timingProfile (non-blocking)
    const existingProfile = cached ?? {};
    (prisma as any).userStatistics.upsert({
      where: { userId },
      update: { timingProfile: { ...existingProfile, behavioralBaseline: baseline } as any },
      create: {
        userId,
        totalQuestions: 0,
        correctAnswers: 0,
        systemStats: {},
        timingProfile: { behavioralBaseline: baseline } as any,
      },
    }).catch(() => { /* non-fatal */ });

    return baseline;
  } catch (err) {
    console.debug('[userTimingProfileService] behavioral baseline lookup failed', err);
    return null;
  }
}

// ─── Combined Fetch ────────────────────────────────────────────────────────────

export interface UserBehavioralContext {
  speedFactor: number;
  behavioralBaseline: UserBehavioralBaseline | null;
}

/**
 * Fetch BOTH the speed factor and behavioral baseline in a single DB query.
 *
 * `drillReviewService` previously called `getUserSpeedFactor` + `getUserBehavioralBaseline`
 * separately, generating two identical `userStatistics.findUnique` queries on every
 * `submitReview`. This function collapses them to one read, with independent stale checks
 * and lazy recompute for whichever half is expired.
 */
export async function getUserBehavioralContext(
  prisma: PrismaClient,
  userId: string
): Promise<UserBehavioralContext> {
  const STALE_MS = 24 * 60 * 60 * 1000;

  try {
    // ── Single DB read for the whole timing profile ──────────────────────────
    const stats = await (prisma as any).userStatistics.findUnique({
      where: { userId },
      select: { timingProfile: true },
    });

    type CachedProfile = UserTimingProfile & { behavioralBaseline?: UserBehavioralBaseline };
    const cached = stats?.timingProfile as CachedProfile | null;

    // ── Speed factor ─────────────────────────────────────────────────────────
    let speedFactor = 1.0;
    let needSpeedRecompute = true;
    if (cached?.computedAt) {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      if (age < STALE_MS) {
        speedFactor = cached.speedFactor;
        needSpeedRecompute = false;
      }
    }

    // ── Behavioral baseline ───────────────────────────────────────────────────
    let behavioralBaseline: UserBehavioralBaseline | null = null;
    let needBaselineRecompute = true;
    if (cached?.behavioralBaseline?.computedAt) {
      const age = Date.now() - new Date(cached.behavioralBaseline.computedAt).getTime();
      if (age < STALE_MS) {
        behavioralBaseline = cached.behavioralBaseline;
        needBaselineRecompute = false;
      }
    }

    // ── Lazy recompute only what's stale ─────────────────────────────────────
    if (needSpeedRecompute || needBaselineRecompute) {
      const [freshProfile, freshBaseline] = await Promise.all([
        needSpeedRecompute ? computeUserTimingProfile(prisma, userId) : null,
        needBaselineRecompute ? computeBehavioralBaseline(prisma, userId) : null,
      ]);

      if (freshProfile) speedFactor = freshProfile.speedFactor;
      if (freshBaseline) behavioralBaseline = freshBaseline;

      // Persist merged update (non-blocking)
      const merged: CachedProfile = {
        ...(freshProfile ?? cached ?? ({} as CachedProfile)),
        behavioralBaseline: freshBaseline ?? cached?.behavioralBaseline,
      };
      (prisma as any).userStatistics.upsert({
        where: { userId },
        update: { timingProfile: merged as any },
        create: {
          userId,
          totalQuestions: 0,
          correctAnswers: 0,
          systemStats: {},
          timingProfile: merged as any,
        },
      }).catch(() => { /* non-fatal */ });
    }

    return { speedFactor, behavioralBaseline };
  } catch (err) {
    console.debug('[userTimingProfileService] combined timing profile fetch failed', err);
    return { speedFactor: 1.0, behavioralBaseline: null };
  }
}
