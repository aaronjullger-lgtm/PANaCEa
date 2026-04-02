/**
 * Cold-Start Calibration Service
 *
 * Detects first-time users and provides a structured baseline assessment
 * before adaptive FSRS scheduling kicks in. Without a baseline, new users
 * get inappropriate difficulty (usually too hard), leading to frustration
 * and early dropout.
 *
 * The calibration phase:
 *   1. Serves a curated mix of easy/medium/hard questions across core systems
 *   2. Measures baseline latency, accuracy, and confidence alignment
 *   3. Computes an initial difficulty mix via difficultyCalibrator
 *   4. Seeds initial FSRS parameters so the first real session is well-tuned
 *
 * Research: Wilson et al. (2019) — optimal learning at ~85% accuracy.
 * Cold-start ensures we find each student's 85% zone from the start.
 *
 * Sprint 2B — April 2026
 * @module lib/services/coldStartCalibrationService
 */

import type { PrismaClient } from '@prisma/client';
import { calibrateDifficulty, type DifficultyMix } from './difficultyCalibrator';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum total attempts before a user is considered "calibrated" */
export const CALIBRATION_THRESHOLD = 30;

/** Questions per difficulty tier in the calibration set */
export const CALIBRATION_SET_SIZE = { easy: 10, medium: 12, hard: 8 };
/** Total calibration questions */
export const TOTAL_CALIBRATION_QUESTIONS =
  CALIBRATION_SET_SIZE.easy + CALIBRATION_SET_SIZE.medium + CALIBRATION_SET_SIZE.hard;

/** Systems to sample from during calibration (core PA systems) */
const CALIBRATION_SYSTEMS = [
  'Cardiovascular', 'Pulmonary', 'Gastrointestinal',
  'Musculoskeletal', 'Neurological', 'Endocrine',
  'Reproductive', 'Renal', 'Hematology',
  'Dermatology', 'EENT', 'Psychiatry',
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColdStartStatus {
  isCalibrated: boolean;
  totalAttempts: number;
  remaining: number;
  progress: number; // 0-1
  /** If calibrated, the computed baseline */
  baseline?: CalibrationBaseline;
}

export interface CalibrationBaseline {
  accuracy: number;
  medianResponseTimeMs: number;
  difficultyMix: DifficultyMix;
  zone: 'too_easy' | 'optimal' | 'too_hard' | 'insufficient_data';
  systemAccuracies: Record<string, { correct: number; total: number; accuracy: number }>;
  weakSystems: string[];
  strongSystems: string[];
}
export interface CalibrationQuestion {
  id: string;
  question: string;
  vignette: string | null;
  options: string[];
  correctAnswer: string;
  system: string;
  difficulty: string;
  tier: 'easy' | 'medium' | 'hard';
}

// ─── Cold-Start Detection ────────────────────────────────────────────────────

/**
 * Check if a user needs cold-start calibration.
 * A user is considered calibrated once they have >= CALIBRATION_THRESHOLD attempts.
 *
 * Pure DB read — safe and fast.
 */
export async function getColdStartStatus(
  prisma: PrismaClient,
  userId: string
): Promise<ColdStartStatus> {
  const totalAttempts = await prisma.questionAttempt.count({
    where: { userId },
  });

  const isCalibrated = totalAttempts >= CALIBRATION_THRESHOLD;
  const remaining = Math.max(0, CALIBRATION_THRESHOLD - totalAttempts);
  const progress = Math.min(1, totalAttempts / CALIBRATION_THRESHOLD);
  if (!isCalibrated) {
    return { isCalibrated, totalAttempts, remaining, progress };
  }

  // Compute baseline from existing attempts
  const baseline = await computeBaseline(prisma, userId);
  return { isCalibrated, totalAttempts, remaining, progress, baseline };
}

// ─── Baseline Computation ────────────────────────────────────────────────────

/**
 * Compute the calibration baseline from a user's first N attempts.
 * Used both after cold-start completes and on-demand for any user.
 */
export async function computeBaseline(
  prisma: PrismaClient,
  userId: string
): Promise<CalibrationBaseline> {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: CALIBRATION_THRESHOLD * 2, // Sample more for robustness
    select: {
      wasCorrect: true,
      timeSpentMs: true,
      system: true,
      systemNormalized: true,
    },
  });
  // Overall accuracy
  const correctCount = attempts.filter(a => a.wasCorrect).length;
  const accuracy = attempts.length > 0 ? correctCount / attempts.length : 0;

  // Median response time
  const times = attempts
    .map(a => a.timeSpentMs)
    .filter((t): t is number => t != null && t > 0)
    .sort((a, b) => a - b);
  const medianResponseTimeMs = times.length > 0
    ? times[Math.floor(times.length / 2)]!
    : 30000; // default 30s

  // Per-system accuracy
  const systemAccuracies: CalibrationBaseline['systemAccuracies'] = {};
  for (const a of attempts) {
    const sys = a.systemNormalized ?? a.system ?? 'Unknown';
    if (!systemAccuracies[sys]) {
      systemAccuracies[sys] = { correct: 0, total: 0, accuracy: 0 };
    }
    systemAccuracies[sys].total++;
    if (a.wasCorrect) systemAccuracies[sys].correct++;
  }
  for (const sys of Object.keys(systemAccuracies)) {
    const s = systemAccuracies[sys]!;
    s.accuracy = s.total > 0 ? s.correct / s.total : 0;
  }
  // Identify weak/strong systems (>= 3 attempts required for classification)
  const weakSystems: string[] = [];
  const strongSystems: string[] = [];
  for (const [sys, stats] of Object.entries(systemAccuracies)) {
    if (stats.total < 3) continue;
    if (stats.accuracy < 0.60) weakSystems.push(sys);
    else if (stats.accuracy >= 0.85) strongSystems.push(sys);
  }

  // Use difficultyCalibrator for the mix
  const attemptRecords = attempts.map(a => ({
    wasCorrect: a.wasCorrect,
    difficulty: null, // We don't have difficulty on attempts easily; let calibrator use accuracy only
  }));
  const calibration = calibrateDifficulty(attemptRecords);

  return {
    accuracy,
    medianResponseTimeMs,
    difficultyMix: calibration.mix,
    zone: calibration.zone,
    systemAccuracies,
    weakSystems,
    strongSystems,
  };
}
// ─── Calibration Session Generator ───────────────────────────────────────────

/**
 * Generate a calibration session for a cold-start user.
 * Serves a balanced mix across difficulty tiers and systems.
 *
 * Unlike adaptive sessions, calibration sessions:
 *   - Ignore FSRS state (no due reviews — user has none)
 *   - Sample evenly across systems (no blueprint weighting)
 *   - Use a fixed easy/medium/hard ratio for baseline measurement
 */
export async function generateCalibrationSession(
  prisma: PrismaClient,
  userId: string,
  size?: number
): Promise<CalibrationQuestion[]> {
  const sessionSize = size ?? TOTAL_CALIBRATION_QUESTIONS;
  const easyCount = Math.round(sessionSize * (CALIBRATION_SET_SIZE.easy / TOTAL_CALIBRATION_QUESTIONS));
  const hardCount = Math.round(sessionSize * (CALIBRATION_SET_SIZE.hard / TOTAL_CALIBRATION_QUESTIONS));
  const mediumCount = sessionSize - easyCount - hardCount;

  // Get questions the user has already seen
  const seen = await prisma.questionAttempt.findMany({
    where: { userId },
    select: { questionId: true },
    distinct: ['questionId'],
  });
  const seenIds = new Set(seen.map(s => s.questionId).filter(Boolean));
  // Fetch candidates per difficulty tier
  const fetchTier = async (
    difficulty: string,
    count: number,
    tier: 'easy' | 'medium' | 'hard'
  ): Promise<CalibrationQuestion[]> => {
    const candidates = await prisma.question.findMany({
      where: {
        difficulty,
        system: { in: CALIBRATION_SYSTEMS },
      },
      select: {
        id: true,
        question: true,
        vignette: true,
        options: true,
        correctAnswer: true,
        system: true,
        difficulty: true,
      },
      take: count * 4, // Fetch extra to filter seen + spread across systems
    });

    // Filter out seen questions
    const unseen = candidates.filter(q => !seenIds.has(q.id));
    const pool = unseen.length >= count ? unseen : candidates;
    // Spread across systems (round-robin)
    const bySystem = new Map<string, typeof pool>();
    for (const q of pool) {
      const sys = q.system ?? 'Unknown';
      const arr = bySystem.get(sys) ?? [];
      arr.push(q);
      bySystem.set(sys, arr);
    }

    const selected: CalibrationQuestion[] = [];
    const iterators = Array.from(bySystem.entries()).map(([, qs]) => ({ items: qs, idx: 0 }));

    // Shuffle system order
    for (let i = iterators.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [iterators[i], iterators[j]] = [iterators[j]!, iterators[i]!];
    }

    while (selected.length < count) {
      let added = false;
      for (const iter of iterators) {
        if (selected.length >= count) break;
        if (iter.idx < iter.items.length) {
          const raw = iter.items[iter.idx]!;
          const opts = normalizeOptions(raw.options);
          selected.push({
            id: raw.id,
            question: raw.question,
            vignette: raw.vignette,
            options: opts,
            correctAnswer: raw.correctAnswer,
            system: raw.system ?? 'Unknown',
            difficulty: raw.difficulty ?? difficulty,
            tier,
          });
          iter.idx++;
          added = true;
        }
      }
      if (!added) break;
    }

    return selected;
  };
  const [easy, medium, hard] = await Promise.all([
    fetchTier('easy', easyCount, 'easy'),
    fetchTier('medium', mediumCount, 'medium'),
    fetchTier('hard', hardCount, 'hard'),
  ]);

  // Interleave: easy-medium-hard-medium pattern for gradual warm-up
  const result: CalibrationQuestion[] = [];
  const tiers = [easy, medium, hard];
  const idxs = [0, 0, 0];
  // Pattern: 0=easy, 1=medium, 2=hard — cycle with medium bias
  const pattern = [0, 1, 2, 1]; // easy, medium, hard, medium

  let patternIdx = 0;
  const totalTarget = easy.length + medium.length + hard.length;

  while (result.length < totalTarget) {
    const tierIdx = pattern[patternIdx % pattern.length]!;
    const tier = tiers[tierIdx]!;
    if (idxs[tierIdx]! < tier.length) {
      result.push(tier[idxs[tierIdx]!]!);
      idxs[tierIdx]!++;
    }
    patternIdx++;
    // Safety: if we've cycled through pattern 3x without adding, break
    if (patternIdx > totalTarget * 4) break;
  }

  // Append any remaining from each tier
  for (let t = 0; t < 3; t++) {
    while (idxs[t]! < tiers[t]!.length) {
      result.push(tiers[t]![idxs[t]!]!);
      idxs[t]!++;
    }
  }

  return result;
}
// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, string>);
  return [];
}
