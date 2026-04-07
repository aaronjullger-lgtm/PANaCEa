/**
 * Daily Study Allocator Service
 *
 * Recommends how much of today's study time should be MAIN (readiness) vs
 * TARGETED (retention/FSRS) and which systems/conditions to prioritize.
 *
 * Architecture:
 *   MAIN sessions    → readiness analytics only (no FSRS writes)
 *   TARGETED sessions → exclusive owner of FSRS scheduling state
 *   DRILL sessions    → correctness-only; not considered by this allocator
 *
 * Scoring pipeline:
 *   readinessPriority  ← blueprint coverage gap + accuracy gaps + calibration risk
 *   retentionPriority  ← FSRS due count + overdue count + low-stability clusters
 *   recommendedSplit   ← threshold comparison of the two priority scores
 *
 * Design constraints:
 *   - Purely read-only: no new schema, no writes
 *   - Edge-safe: receives PrismaClient, does not import edge-specific modules
 *   - Testable: all scoring logic is pure functions exported separately
 *
 * Sprint: Dual-Study Allocator — April 2026
 */

import type { PrismaClient } from '@prisma/client';
import { NCCPA_2025_BLUEPRINT } from '../constants/blueprint';
import { normalizeSystemName } from './rolling360Service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudySplit = 'main_heavy' | 'balanced' | 'targeted_heavy';

export interface DailyStudyAllocation {
  /** Number of MAIN-session questions recommended today */
  recommendedMainCount: number;
  /** Number of TARGETED-session questions recommended today */
  recommendedTargetedCount: number;
  /** Top 2–3 organ systems to prioritise in MAIN sessions */
  mainSystems: string[];
  /** Top conditions to drill in TARGETED sessions (FSRS-due / overdue first) */
  targetedConditions: string[];
  /** 0–100: how urgent MAIN readiness work is today */
  readinessPriority: number;
  /** 0–100: how urgent TARGETED retention work is today */
  retentionPriority: number;
  /** Overall recommended balance */
  recommendedSplit: StudySplit;
  /** Human-readable explanation of the recommendation */
  reasonSummary: string;
  generatedAt: Date;
}

// ─── Raw data bags (internal, exported for testing) ──────────────────────────

export interface SystemStats {
  system: string;
  blueprintWeight: number;     // 0–1 from NCCPA blueprint
  attemptFraction: number;     // fraction of all attempts in this system
  accuracy: number;            // 0–1 recent accuracy (last 60 days)
  calibrationRisk: number;     // 0–1: overconfident-miss rate from ReviewLog
}

export interface RetentionStats {
  dueCount: number;
  overdueCount: number;
  unstableCount: number;       // conditions with stability < STABILITY_THRESHOLD
  topDueConditions: string[];  // conditionIds, FSRS-ordered
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Days window for "recent" accuracy and calibration queries */
const RECENT_DAYS = 60;

/** FSRS stability below this is treated as "unstable" */
const STABILITY_THRESHOLD = 7.0; // days

/** A card is overdue if nextReviewAt < now minus this many hours */
const OVERDUE_GRACE_HOURS = 12;

/** Max conditions returned as targetedConditions */
const MAX_TARGETED_CONDITIONS = 8;

/** Max systems returned as mainSystems */
const MAX_MAIN_SYSTEMS = 3;

/** Threshold above which we call one side "heavy" */
const SPLIT_THRESHOLD = 15; // points on 0-100 scale

/** Recommended question counts per split */
const COUNTS: Record<StudySplit, { main: number; targeted: number }> = {
  main_heavy:     { main: 40, targeted: 15 },
  balanced:       { main: 30, targeted: 25 },
  targeted_heavy: { main: 20, targeted: 40 },
};

// ─── Pure scoring functions (exported for testing) ──────────────────────────

/**
 * Score readiness priority (0–100) from system-level stats.
 *
 * Components:
 *   1. Coverage gap (40 pts max): how far is actual attempt fraction below blueprint weight?
 *   2. Accuracy gap (35 pts max): how far below 70% threshold is per-system accuracy?
 *   3. Calibration risk (25 pts max): overconfident-miss rate across systems
 */
export function scoreReadinessPriority(systems: SystemStats[]): number {
  if (systems.length === 0) return 50; // default to moderate when no data

  let coverageGapScore = 0;
  let accuracyGapScore = 0;
  let calibrationScore = 0;

  for (const sys of systems) {
    const bpWeight = sys.blueprintWeight;

    // Coverage gap: positive when attempt fraction < blueprint weight
    const gap = Math.max(0, bpWeight - sys.attemptFraction);
    // Normalise: max plausible single-system gap is ~0.15 (Cardiovascular 11%)
    coverageGapScore += (gap / 0.15) * bpWeight; // blueprint-weighted

    // Accuracy gap below 70%
    const accGap = Math.max(0, 0.70 - sys.accuracy);
    accuracyGapScore += (accGap / 0.70) * bpWeight;

    // Calibration: overconfident misses (high-retrievability but wasCorrect=false)
    calibrationScore += sys.calibrationRisk * bpWeight;
  }

  const raw =
    Math.min(1, coverageGapScore) * 40 +
    Math.min(1, accuracyGapScore) * 35 +
    Math.min(1, calibrationScore) * 25;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Score retention priority (0–100) from FSRS due/overdue/stability data.
 *
 * Components:
 *   1. Due count pressure (40 pts max): fraction of "manageable daily load" that is due
 *   2. Overdue penalty (35 pts max): overdue items lose FSRS stability rapidly
 *   3. Unstable cluster risk (25 pts max): many low-stability conditions risk forgetting
 */
export function scoreRetentionPriority(stats: RetentionStats): number {
  // Reference: a "normal" daily load is 25 targeted items
  const DAILY_LOAD_REF = 25;

  const dueFraction = Math.min(1, stats.dueCount / DAILY_LOAD_REF);
  const overdueFraction = Math.min(1, stats.overdueCount / (DAILY_LOAD_REF * 0.5));
  const unstableFraction = Math.min(1, stats.unstableCount / 20); // 20 unstable = full pressure

  const raw =
    dueFraction * 40 +
    overdueFraction * 35 +
    unstableFraction * 25;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Decide the recommended split given the two priority scores.
 */
export function decideSplit(readinessPriority: number, retentionPriority: number): StudySplit {
  const diff = retentionPriority - readinessPriority;
  if (diff > SPLIT_THRESHOLD) return 'targeted_heavy';
  if (diff < -SPLIT_THRESHOLD) return 'main_heavy';
  return 'balanced';
}

/**
 * Rank systems for MAIN session focus.
 *
 * Composite score = 0.40 × coverageGap + 0.35 × accuracyGap + 0.25 × calibrationRisk
 * All weighted by blueprint importance.
 */
export function rankSystemsForMain(systems: SystemStats[]): string[] {
  return systems
    .map((sys) => {
      const coverageGap = Math.max(0, sys.blueprintWeight - sys.attemptFraction);
      const accuracyGap = Math.max(0, 0.70 - sys.accuracy);
      const score =
        (coverageGap / 0.15) * 0.40 * sys.blueprintWeight +
        (accuracyGap / 0.70) * 0.35 * sys.blueprintWeight +
        sys.calibrationRisk * 0.25 * sys.blueprintWeight;
      return { system: sys.system, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MAIN_SYSTEMS)
    .map((s) => s.system);
}

/**
 * Build a human-readable reason summary.
 */
export function buildReasonSummary(
  split: StudySplit,
  readinessPriority: number,
  retentionPriority: number,
  mainSystems: string[],
  dueCount: number,
  overdueCount: number
): string {
  const splitLabel = split === 'main_heavy'
    ? 'readiness-heavy'
    : split === 'targeted_heavy'
      ? 'retention-heavy'
      : 'balanced';

  const parts: string[] = [
    `Today's plan is ${splitLabel} (readiness ${readinessPriority}/100, retention ${retentionPriority}/100).`,
  ];

  if (mainSystems.length > 0) {
    parts.push(`Focus MAIN sessions on: ${mainSystems.join(', ')}.`);
  }

  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue FSRS card${overdueCount === 1 ? '' : 's'} need immediate review.`);
  } else if (dueCount > 0) {
    parts.push(`${dueCount} card${dueCount === 1 ? '' : 's'} due for TARGETED review today.`);
  }

  return parts.join(' ');
}

// ─── DB-integrated function ─────────────────────────────────────────────────

/**
 * Compute today's study allocation for a user.
 *
 * Reads from: QuestionAttempt, UserProgress (TARGETED context), ReviewLog.
 * Does not write anything — purely read-only / derived.
 *
 * @param prisma  PrismaClient instance (caller manages lifecycle)
 * @param userId  Clerk user ID
 */
export async function getDailyStudyAllocation(
  prisma: PrismaClient,
  userId: string
): Promise<DailyStudyAllocation> {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const overdueThreshold = new Date(now.getTime() - OVERDUE_GRACE_HOURS * 60 * 60 * 1000);

  // ── 1. Fetch recent QuestionAttempt counts by system ──────────────────────
  // We need total + correct per system. Since wasCorrect is Boolean and can't be
  // summed via Prisma groupBy, fetch total and correct separately.
  // Note: `prisma as any` is used because PrismaClient's generated model types
  // aren't available in lib/ (edge-safe). The actual models exist at runtime.
  const [attemptsBySystem, correctBySystem] = await Promise.all([
    (prisma as any).questionAttempt.groupBy({
      by: ['system'],
      where: { userId, createdAt: { gte: recentCutoff }, system: { not: null } },
      _count: { id: true },
    }),
    (prisma as any).questionAttempt.groupBy({
      by: ['system'],
      where: { userId, createdAt: { gte: recentCutoff }, system: { not: null }, wasCorrect: true },
      _count: { id: true },
    }),
  ]);

  // Build lookup maps keyed by normalised system name
  const totalBySystem = new Map<string, number>();
  const correctCountBySystem = new Map<string, number>();

  for (const row of attemptsBySystem) {
    const norm = normalizeSystemName(row.system as string);
    totalBySystem.set(norm, (totalBySystem.get(norm) ?? 0) + (row._count?.id ?? 0));
  }
  for (const row of correctBySystem) {
    const norm = normalizeSystemName(row.system as string);
    correctCountBySystem.set(norm, (correctCountBySystem.get(norm) ?? 0) + (row._count?.id ?? 0));
  }

  const totalAttempts = [...totalBySystem.values()].reduce((a, b) => a + b, 0);

  // ── 2. Fetch calibration risk: overconfident misses from ReviewLog ────────
  // "Overconfident miss" = high retrievability predicted but wasCorrect=false
  const [calibrationRows, totalReviewsBySystem] = await Promise.all([
    (prisma as any).reviewLog.findMany({
      where: {
        userId,
        reviewedAt: { gte: recentCutoff },
        retrievability: { gte: 0.70 },
        wasCorrect: false,
      },
      select: { system: true },
    }),
    (prisma as any).reviewLog.groupBy({
      by: ['system'],
      where: { userId, reviewedAt: { gte: recentCutoff }, system: { not: null } },
      _count: { id: true },
    }),
  ]);

  // Count overconfident misses per normalised system (skip null-system rows —
  // they can't be matched to any blueprint entry)
  const calibrationRiskMap = new Map<string, number>();
  for (const row of calibrationRows) {
    if (!row.system) continue;
    const norm = normalizeSystemName(row.system as string);
    calibrationRiskMap.set(norm, (calibrationRiskMap.get(norm) ?? 0) + 1);
  }

  const reviewCountMap = new Map<string, number>();
  for (const row of totalReviewsBySystem) {
    const norm = normalizeSystemName(row.system as string);
    reviewCountMap.set(norm, (reviewCountMap.get(norm) ?? 0) + (row._count?.id ?? 0));
  }

  // ── 3. Build SystemStats array from blueprint ─────────────────────────────
  const systemStats: SystemStats[] = Object.entries(NCCPA_2025_BLUEPRINT).map(
    ([system, blueprintWeight]) => {
      const attempts = totalBySystem.get(system) ?? 0;
      const correct = correctCountBySystem.get(system) ?? 0;

      const totalReviews = reviewCountMap.get(system) ?? 0;
      const overconfidentMisses = calibrationRiskMap.get(system) ?? 0;
      const calibrationRisk = totalReviews > 0
        ? Math.min(1, overconfidentMisses / Math.max(1, totalReviews))
        : 0;

      return {
        system,
        blueprintWeight,
        attemptFraction: totalAttempts > 0 ? attempts / totalAttempts : 0,
        accuracy: attempts > 0 ? correct / attempts : 0,
        calibrationRisk,
      };
    }
  );

  // ── 4. TARGETED FSRS stats from UserProgress (TARGETED context) ───────────
  const targetedProgress = await (prisma as any).userProgress.findMany({
    where: {
      userId,
      progressContext: 'TARGETED',
    },
    select: {
      conditionId: true,
      nextReviewAt: true,
      fsrsStability: true,
      system: true,
    },
  });

  const dueItems = targetedProgress.filter(
    (p: any) => p.nextReviewAt !== null && new Date(p.nextReviewAt) <= now
  );
  const overdueItems = targetedProgress.filter(
    (p: any) => p.nextReviewAt !== null && new Date(p.nextReviewAt) <= overdueThreshold
  );
  const unstableItems = targetedProgress.filter(
    (p: any) =>
      p.fsrsStability !== null &&
      (p.fsrsStability as number) < STABILITY_THRESHOLD
  );

  // Sort due items: overdue first, then by nextReviewAt ascending
  const sortedDue = [...dueItems].sort((a: any, b: any) => {
    const aDate = new Date(a.nextReviewAt).getTime();
    const bDate = new Date(b.nextReviewAt).getTime();
    return aDate - bDate;
  });

  // Prefer clinically adjacent conditions: group by system, round-robin interleave
  const topDueConditions = interleaveBySystem(
    sortedDue.map((p: any) => ({
      conditionId: p.conditionId as string,
      system: normalizeSystemName(p.system as string | null),
    })),
    MAX_TARGETED_CONDITIONS
  );

  const retentionStats: RetentionStats = {
    dueCount: dueItems.length,
    overdueCount: overdueItems.length,
    unstableCount: unstableItems.length,
    topDueConditions,
  };

  // ── 5. Score priorities and decide split ──────────────────────────────────
  const readinessPriority = scoreReadinessPriority(systemStats);
  const retentionPriority = scoreRetentionPriority(retentionStats);
  const recommendedSplit = decideSplit(readinessPriority, retentionPriority);
  const mainSystems = rankSystemsForMain(systemStats);
  const counts = COUNTS[recommendedSplit];

  const reasonSummary = buildReasonSummary(
    recommendedSplit,
    readinessPriority,
    retentionPriority,
    mainSystems,
    retentionStats.dueCount,
    retentionStats.overdueCount
  );

  return {
    recommendedMainCount: counts.main,
    recommendedTargetedCount: counts.targeted,
    mainSystems,
    targetedConditions: retentionStats.topDueConditions,
    readinessPriority,
    retentionPriority,
    recommendedSplit,
    reasonSummary,
    generatedAt: now,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Interleave conditions by system so the TARGETED session touches multiple
 * clinically adjacent clusters rather than hammering one system at a time.
 *
 * Algorithm: round-robin across system buckets until maxCount is reached.
 */
function interleaveBySystem(
  items: Array<{ conditionId: string; system: string }>,
  maxCount: number
): string[] {
  const buckets = new Map<string, string[]>();
  for (const item of items) {
    if (!buckets.has(item.system)) buckets.set(item.system, []);
    buckets.get(item.system)!.push(item.conditionId);
  }

  const result: string[] = [];
  const keys = [...buckets.keys()];
  let round = 0;

  while (result.length < maxCount) {
    let added = false;
    for (const key of keys) {
      const bucket = buckets.get(key)!;
      if (round < bucket.length) {
        result.push(bucket[round]);
        added = true;
        if (result.length >= maxCount) break;
      }
    }
    if (!added) break; // all buckets exhausted
    round++;
  }

  return result;
}
