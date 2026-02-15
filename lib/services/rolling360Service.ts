/**
 * Rolling 360 Statistical Engine Service
 *
 * Manages the "Current Form" layer - user-facing statistics based on the last
 * 360 questions answered in Main Session mode only.
 *
 * Key Features:
 * - O(1) dashboard reads via UserRolling360Stats cache table
 * - O(1) updates via Rolling360Buffer circular buffer (360 slots per user)
 * - Atomic transactions to prevent "zombie states"
 * - PANCE blueprint adherence scoring
 * - Predicted PANCE score calculation (200-800 scale)
 *
 * @module rolling360Service
 */

import { PrismaClient, Prisma } from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of questions in rolling window (one full PANCE exam) */
export const ROLLING_WINDOW_SIZE = 360;

/** PANCE score range */
export const PANCE_SCORE_MIN = 200;
export const PANCE_SCORE_MAX = 800;
export const PANCE_PASSING_SCORE = 350;

/** Confidence thresholds */
export const CONFIDENCE_COLLECTING_THRESHOLD = 50; // <50 questions = "collecting"
export const CONFIDENCE_PROVISIONAL_THRESHOLD = 180; // 50-180 = "provisional"
// >=180 = "confident"

/** System name normalization map */
const SYSTEM_NORMALIZATION_MAP: Record<string, string> = {
  CV: 'Cardiovascular',
  CARDIO: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  MSK: 'Musculoskeletal',
  HEENT: 'HEENT',
  ENT: 'HEENT',
  REPRO: 'Reproductive',
  'OB/GYN': 'Reproductive',
  NEURO: 'Neurological',
  PSYCH: 'Psychiatry',
  ENDO: 'Endocrine',
  DERM: 'Dermatology',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  ID: 'Infectious Disease',
  RENAL: 'Renal',
  NEPHRO: 'Renal',
};

// =============================================================================
// TYPES
// =============================================================================

export interface SystemStats {
  total: number;
  correct: number;
  accuracy: number;
}

/**
 * Calibration Metrics for Cold Start (0-60 questions)
 * Unlocked progressively to gamify the onboarding experience
 */
export interface CalibrationMetrics {
  /** Avg response time in ms (unlocks at 10 questions) */
  avgResponseTimeMs: number | null;
  /** High Confidence + Correct alignment (unlocks at 30 questions) */
  confidenceAlignment: number | null;
  /** Most frequent error system (unlocks at 50 questions) */
  primaryErrorSystem: string | null;
  /** Secondary error system */
  secondaryErrorSystem: string | null;
  /** Current calibration step (1-4) */
  currentStep: number;
  /** Questions to next unlock */
  questionsToNextUnlock: number;
}

/** Calibration step thresholds */
export const CALIBRATION_STEP_THRESHOLDS = {
  BASELINE: 10, // Step 1 complete
  LATENCY: 30, // Step 2 complete - Latency Analysis unlocked
  METACOGNITION: 50, // Step 3 complete - Confidence Alignment unlocked
  ERROR_TYPOLOGY: 60, // Step 4 complete - Full prediction unlocked
};

export interface Rolling360Stats {
  totalInWindow: number;
  correctInWindow: number;
  accuracyPercent: number | null;
  systemStats: Record<string, SystemStats>;
  predictedScore: number | null;
  scoreConfidence: 'collecting' | 'provisional' | 'confident';
  passLikelihood: number | null;
  blueprintAdherence: number | null;
  isValidExamDistribution: boolean;
  weakestSystems: string[];
  strongestSystems: string[];
  windowStartTime: Date | null;
  windowEndTime: Date | null;
  /** Calibration metrics for cold start users (0-60 questions) */
  calibrationMetrics?: CalibrationMetrics;
}

export interface AttemptData {
  attemptId: string;
  userId: string;
  isCorrect: boolean;
  system: string;
  answeredAt: Date;
}

export interface BlueprintWeights {
  [system: string]: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalizes system names to standard PANCE blueprint format
 */
export function normalizeSystemName(system: string | null | undefined): string {
  if (!system) return 'Unknown';

  const upper = system.toUpperCase().trim();

  // Check direct mapping
  if (SYSTEM_NORMALIZATION_MAP[upper]) {
    return SYSTEM_NORMALIZATION_MAP[upper];
  }

  // Check if already normalized
  const normalizedValues = Object.values(SYSTEM_NORMALIZATION_MAP);
  const titleCase = system.charAt(0).toUpperCase() + system.slice(1).toLowerCase();
  if (normalizedValues.includes(titleCase)) {
    return titleCase;
  }

  // Return as-is with title case
  return titleCase;
}

/**
 * Calculates predicted PANCE score from accuracy percentage
 * Uses linear interpolation: 0% = 200, 100% = 800
 */
export function calculatePredictedScore(accuracy: number | null): number | null {
  if (accuracy === null || accuracy === undefined) return null;

  // Clamp accuracy to 0-100
  const clampedAccuracy = Math.max(0, Math.min(100, accuracy));

  // Linear interpolation
  const score = PANCE_SCORE_MIN + (clampedAccuracy / 100) * (PANCE_SCORE_MAX - PANCE_SCORE_MIN);

  return Math.round(score);
}

/**
 * Calculates pass likelihood based on predicted score
 * Uses sigmoid curve centered at passing score
 */
export function calculatePassLikelihood(predictedScore: number | null): number | null {
  if (predictedScore === null) return null;

  // Sigmoid function: 50% at passing score, asymptotes at 0% and 100%
  const k = 0.05; // Steepness
  const likelihood = 100 / (1 + Math.exp(-k * (predictedScore - PANCE_PASSING_SCORE)));

  return Math.round(likelihood * 100) / 100;
}

/**
 * Determines confidence level based on sample size
 */
export function determineScoreConfidence(
  sampleSize: number
): 'collecting' | 'provisional' | 'confident' {
  if (sampleSize < CONFIDENCE_COLLECTING_THRESHOLD) return 'collecting';
  if (sampleSize < CONFIDENCE_PROVISIONAL_THRESHOLD) return 'provisional';
  return 'confident';
}

/**
 * Calculates cosine similarity between two distributions
 * Used to measure blueprint adherence
 */
export function calculateCosineSimilarity(
  actual: Record<string, number>,
  expected: Record<string, number>
): number {
  const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);

  let dotProduct = 0;
  let actualMag = 0;
  let expectedMag = 0;

  for (const key of allKeys) {
    const a = actual[key] || 0;
    const e = expected[key] || 0;
    dotProduct += a * e;
    actualMag += a * a;
    expectedMag += e * e;
  }

  if (actualMag === 0 || expectedMag === 0) return 0;

  return dotProduct / (Math.sqrt(actualMag) * Math.sqrt(expectedMag));
}

/**
 * Identifies weakest and strongest systems based on accuracy
 */
export function identifyWeakestAndStrongest(
  systemStats: Record<string, SystemStats>,
  minAttempts: number = 5
): { weakest: string[]; strongest: string[] } {
  const systemsWithEnoughData = Object.entries(systemStats)
    .filter(([_, stats]) => stats.total >= minAttempts)
    .map(([system, stats]) => ({ system, accuracy: stats.accuracy }));

  if (systemsWithEnoughData.length === 0) {
    return { weakest: [], strongest: [] };
  }

  // Sort by accuracy
  systemsWithEnoughData.sort((a, b) => a.accuracy - b.accuracy);

  // Get bottom 3 and top 3
  const weakest = systemsWithEnoughData.slice(0, 3).map((s) => s.system);
  const strongest = systemsWithEnoughData
    .slice(-3)
    .reverse()
    .map((s) => s.system);

  return { weakest, strongest };
}

// =============================================================================
// CORE SERVICE CLASS
// =============================================================================

export class Rolling360Service {
  constructor(private prisma: PrismaClient) {}

  /**
   * Updates Rolling 360 stats when a Main Session question is answered.
   * Uses atomic transaction to prevent zombie states.
   *
   * Algorithm:
   * 1. Get current stats and buffer slot to overwrite
   * 2. Calculate delta (what we're removing, what we're adding)
   * 3. Update buffer slot with new attempt data
   * 4. Update aggregate stats
   * 5. Recalculate derived metrics (predicted score, weaknesses, etc.)
   */
  async updateRolling360OnSubmit(attemptData: AttemptData): Promise<Rolling360Stats> {
    const { attemptId, userId, isCorrect, system, answeredAt } = attemptData;
    const normalizedSystem = normalizeSystemName(system);

    // Use atomic transaction to prevent zombie states
    return await this.prisma.$transaction(
      async (tx) => {
        // Step 1: Get or create UserRolling360Stats
        let stats = await tx.userRolling360Stats.findUnique({
          where: { userId },
        });

        if (!stats) {
          stats = await tx.userRolling360Stats.create({
            data: {
              userId,
              systemStats: {},
              weakestSystems: [],
              strongestSystems: [],
            },
          });
        }

        // Step 2: Get current slot index and buffer slot
        const currentSlotIndex = stats.currentSlotIndex;
        const nextSlotIndex = (currentSlotIndex + 1) % ROLLING_WINDOW_SIZE;

        // Get existing buffer slot (may be empty or have old data)
        let bufferSlot = await tx.rolling360Buffer.findUnique({
          where: {
            userId_slotIndex: {
              userId,
              slotIndex: nextSlotIndex,
            },
          },
        });

        // Step 3: Calculate delta - what we're removing from aggregates
        const systemStats = (stats.systemStats as unknown as Record<string, SystemStats>) || {};
        let totalDelta = 1;
        let correctDelta = isCorrect ? 1 : 0;

        if (bufferSlot && bufferSlot.isCorrect !== null) {
          // We're overwriting an old entry - subtract its contribution
          totalDelta = 0; // Net zero for total (removing one, adding one)
          correctDelta = (isCorrect ? 1 : 0) - (bufferSlot.isCorrect ? 1 : 0);

          // Update system stats for old entry
          const oldSystem = bufferSlot.systemNormalized || 'Unknown';
          if (systemStats[oldSystem]) {
            systemStats[oldSystem].total -= 1;
            if (bufferSlot.isCorrect) {
              systemStats[oldSystem].correct -= 1;
            }
            // Clean up if system has no more entries
            if (systemStats[oldSystem].total <= 0) {
              delete systemStats[oldSystem];
            } else {
              systemStats[oldSystem].accuracy =
                (systemStats[oldSystem].correct / systemStats[oldSystem].total) * 100;
            }
          }
        }

        // Step 4: Update buffer slot with new attempt
        if (bufferSlot) {
          bufferSlot = await tx.rolling360Buffer.update({
            where: {
              userId_slotIndex: {
                userId,
                slotIndex: nextSlotIndex,
              },
            },
            data: {
              attemptId,
              isCorrect,
              systemNormalized: normalizedSystem,
              answeredAt,
              updatedAt: new Date(),
            },
          });
        } else {
          bufferSlot = await tx.rolling360Buffer.create({
            data: {
              userId,
              slotIndex: nextSlotIndex,
              attemptId,
              isCorrect,
              systemNormalized: normalizedSystem,
              answeredAt,
            },
          });
        }

        // Step 5: Update system stats for new entry
        if (!systemStats[normalizedSystem]) {
          systemStats[normalizedSystem] = { total: 0, correct: 0, accuracy: 0 };
        }
        systemStats[normalizedSystem].total += 1;
        if (isCorrect) {
          systemStats[normalizedSystem].correct += 1;
        }
        systemStats[normalizedSystem].accuracy =
          (systemStats[normalizedSystem].correct / systemStats[normalizedSystem].total) * 100;

        // Step 6: Calculate new aggregates
        const newTotal = Math.min(stats.totalInWindow + totalDelta, ROLLING_WINDOW_SIZE);
        const newCorrect = stats.correctInWindow + correctDelta;
        const newAccuracy = newTotal > 0 ? (newCorrect / newTotal) * 100 : null;

        // Step 7: Calculate derived metrics
        const predictedScore = calculatePredictedScore(newAccuracy);
        const scoreConfidence = determineScoreConfidence(newTotal);
        const passLikelihood = calculatePassLikelihood(predictedScore);

        // Step 8: Get active blueprint for adherence calculation
        const blueprint = await tx.nCCPABlueprintConfig.findFirst({
          where: { isActive: true },
        });

        let blueprintAdherence: number | null = null;
        let isValidExamDistribution = false;

        if (blueprint && newTotal >= CONFIDENCE_PROVISIONAL_THRESHOLD) {
          const blueprintWeights = blueprint.weights as BlueprintWeights;

          // Calculate actual distribution
          const actualDistribution: Record<string, number> = {};
          for (const [sys, sysStats] of Object.entries(systemStats)) {
            actualDistribution[sys] = sysStats.total / newTotal;
          }

          blueprintAdherence = calculateCosineSimilarity(actualDistribution, blueprintWeights);
          isValidExamDistribution = blueprintAdherence >= 0.85; // 85% similarity threshold
        }

        // Step 9: Identify weakest and strongest systems
        const { weakest, strongest } = identifyWeakestAndStrongest(systemStats);

        // Step 10: Get window start time from first filled slot
        const filledSlots = await tx.rolling360Buffer.findMany({
          where: {
            userId,
            isCorrect: { not: null },
          },
          orderBy: { answeredAt: 'asc' },
          take: 1,
        });
        const windowStartTime = filledSlots[0]?.answeredAt || null;

        // Step 11: Update UserRolling360Stats
        const updatedStats = await tx.userRolling360Stats.update({
          where: { userId },
          data: {
            totalInWindow: newTotal,
            correctInWindow: newCorrect,
            accuracyPercent: newAccuracy !== null ? new Prisma.Decimal(newAccuracy) : null,
            systemStats: systemStats as any,
            predictedScore,
            scoreConfidence,
            passLikelihood: passLikelihood !== null ? new Prisma.Decimal(passLikelihood) : null,
            blueprintAdherence:
              blueprintAdherence !== null ? new Prisma.Decimal(blueprintAdherence) : null,
            isValidExamDistribution,
            weakestSystems: weakest,
            strongestSystems: strongest,
            windowStartAttemptId: filledSlots[0]?.attemptId || null,
            windowEndAttemptId: attemptId,
            windowStartTime,
            windowEndTime: answeredAt,
            currentSlotIndex: nextSlotIndex,
            lastRecalculatedAt: new Date(),
            recalculationVersion: { increment: 1 },
          },
        });

        return {
          totalInWindow: newTotal,
          correctInWindow: newCorrect,
          accuracyPercent: newAccuracy,
          systemStats,
          predictedScore,
          scoreConfidence,
          passLikelihood,
          blueprintAdherence,
          isValidExamDistribution,
          weakestSystems: weakest,
          strongestSystems: strongest,
          windowStartTime,
          windowEndTime: answeredAt,
        };
      },
      {
        maxWait: 5000, // Maximum time to wait for transaction
        timeout: 10000, // Maximum time for transaction to complete
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // Strongest isolation
      }
    );
  }

  /**
   * Gets current Rolling 360 stats for dashboard display (O(1) read)
   * Includes calibration metrics for cold start users (<60 questions) unless skipCalibration is true.
   * Use skipCalibration in edge/Worker to avoid extra DB round-trips and stay under CPU limits.
   */
  async getRolling360Stats(
    userId: string,
    options?: { skipCalibration?: boolean }
  ): Promise<Rolling360Stats | null> {
    const stats = await this.prisma.userRolling360Stats.findUnique({
      where: { userId },
    });

    if (!stats) return null;

    const totalInWindow = stats.totalInWindow;
    const systemStats = (stats.systemStats as unknown as Record<string, SystemStats>) || {};
    const weakestSystems = stats.weakestSystems || [];

    // Calibration metrics require 2–3 extra queries; skip in Worker to avoid CPU timeout
    let calibrationMetrics: CalibrationMetrics | undefined;
    if (!options?.skipCalibration && totalInWindow < CALIBRATION_STEP_THRESHOLDS.ERROR_TYPOLOGY) {
      calibrationMetrics = await this.calculateCalibrationMetrics(
        userId,
        totalInWindow,
        systemStats,
        weakestSystems
      );
    }

    return {
      totalInWindow,
      correctInWindow: stats.correctInWindow,
      accuracyPercent: stats.accuracyPercent ? Number(stats.accuracyPercent) : null,
      systemStats,
      predictedScore: stats.predictedScore,
      scoreConfidence:
        (stats.scoreConfidence as 'collecting' | 'provisional' | 'confident') || 'collecting',
      passLikelihood: stats.passLikelihood ? Number(stats.passLikelihood) : null,
      blueprintAdherence: stats.blueprintAdherence ? Number(stats.blueprintAdherence) : null,
      isValidExamDistribution: stats.isValidExamDistribution,
      weakestSystems,
      strongestSystems: stats.strongestSystems || [],
      windowStartTime: stats.windowStartTime,
      windowEndTime: stats.windowEndTime,
      calibrationMetrics,
    };
  }

  /**
   * Calculates calibration metrics for cold start users (0-60 questions)
   * Each metric unlocks progressively as the user answers more questions.
   *
   * Step 1 (0-10): Baseline Establishment (no metrics)
   * Step 2 (10-30): Latency Analysis Unlocked (avg response time)
   * Step 3 (30-50): Metacognition Unlocked (confidence alignment)
   * Step 4 (50-60): Error Typology Unlocked (primary error system)
   */
  private async calculateCalibrationMetrics(
    userId: string,
    totalQuestions: number,
    systemStats: Record<string, SystemStats>,
    weakestSystems: string[]
  ): Promise<CalibrationMetrics> {
    // Determine current step and questions to next unlock
    let currentStep = 1;
    let questionsToNextUnlock = CALIBRATION_STEP_THRESHOLDS.BASELINE - totalQuestions;

    if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.METACOGNITION) {
      currentStep = 4;
      questionsToNextUnlock = CALIBRATION_STEP_THRESHOLDS.ERROR_TYPOLOGY - totalQuestions;
    } else if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.LATENCY) {
      currentStep = 3;
      questionsToNextUnlock = CALIBRATION_STEP_THRESHOLDS.METACOGNITION - totalQuestions;
    } else if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.BASELINE) {
      currentStep = 2;
      questionsToNextUnlock = CALIBRATION_STEP_THRESHOLDS.LATENCY - totalQuestions;
    }

    const metrics: CalibrationMetrics = {
      avgResponseTimeMs: null,
      confidenceAlignment: null,
      primaryErrorSystem: null,
      secondaryErrorSystem: null,
      currentStep,
      questionsToNextUnlock: Math.max(0, questionsToNextUnlock),
    };

    // Metric A: Average Response Time (unlocks at Step 2, 10+ questions)
    if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.BASELINE) {
      try {
        const avgTimeResult = await this.prisma.$queryRaw<[{ avg_time: number | null }]>`
          SELECT AVG(COALESCE("timeSpentMs", 0)) as avg_time
          FROM "QuestionAttempt"
          WHERE "userId" = ${userId}
            AND "mode" = 'main_session'
          ORDER BY "createdAt" DESC
          LIMIT 60
        `;
        metrics.avgResponseTimeMs = avgTimeResult[0]?.avg_time
          ? Math.round(avgTimeResult[0].avg_time)
          : null;
      } catch {
        // Fallback if query fails
        metrics.avgResponseTimeMs = null;
      }
    }

    // Metric B: Confidence Alignment (unlocks at Step 3, 30+ questions)
    // Calculated as: (High Confidence AND Correct) / (High Confidence Total)
    if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.LATENCY) {
      try {
        const confidenceResult = await this.prisma.$queryRaw<
          [
            {
              confident_total: number;
              confident_correct: number;
            },
          ]
        >`
          SELECT 
            COUNT(*) FILTER (WHERE "confidenceLevel" = 'high') as confident_total,
            COUNT(*) FILTER (WHERE "confidenceLevel" = 'high' AND "wasCorrect" = true) as confident_correct
          FROM "QuestionAttempt"
          WHERE "userId" = ${userId}
            AND "mode" = 'main_session'
          ORDER BY "createdAt" DESC
          LIMIT 60
        `;
        const confTotal = Number(confidenceResult[0]?.confident_total || 0);
        const confCorrect = Number(confidenceResult[0]?.confident_correct || 0);
        metrics.confidenceAlignment =
          confTotal > 0 ? Math.round((confCorrect / confTotal) * 100) / 100 : null;
      } catch {
        // Fallback: Simple High/Medium/Low string
        metrics.confidenceAlignment = null;
      }
    }

    // Metric C: Error Typology (unlocks at Step 4, 50+ questions)
    // Primary and secondary error systems based on incorrect answers by system
    if (totalQuestions >= CALIBRATION_STEP_THRESHOLDS.METACOGNITION) {
      // Sort systems by number of incorrect answers (most errors first)
      const systemsByErrors = Object.entries(systemStats)
        .map(([system, stats]) => ({
          system,
          errors: stats.total - stats.correct,
          accuracy: stats.accuracy,
        }))
        .filter((s) => s.errors > 0)
        .sort((a, b) => b.errors - a.errors);

      metrics.primaryErrorSystem = systemsByErrors[0]?.system || weakestSystems[0] || null;
      metrics.secondaryErrorSystem = systemsByErrors[1]?.system || weakestSystems[1] || null;
    }

    return metrics;
  }

  /**
   * Forces full recalculation of Rolling 360 stats from QuestionAttempt table.
   * Used for data recovery or initial backfill.
   */
  async forceRecalculate(userId: string): Promise<Rolling360Stats> {
    // Get last 360 Main Session attempts
    const attempts = await this.prisma.questionAttempt.findMany({
      where: {
        userId,
        isMainSession: true,
      },
      orderBy: { createdAt: 'desc' },
      take: ROLLING_WINDOW_SIZE,
      select: {
        id: true,
        wasCorrect: true,
        systemNormalized: true,
        system: true,
        createdAt: true,
      },
    });

    // Reverse to process oldest first
    attempts.reverse();

    // Use transaction for atomic rebuild
    return await this.prisma.$transaction(async (tx) => {
      // Clear existing buffer
      await tx.rolling360Buffer.deleteMany({
        where: { userId },
      });

      // Delete existing stats
      await tx.userRolling360Stats.deleteMany({
        where: { userId },
      });

      // Create fresh stats record
      await tx.userRolling360Stats.create({
        data: {
          userId,
          systemStats: {},
          weakestSystems: [],
          strongestSystems: [],
        },
      });

      // Rebuild by replaying each attempt
      let finalStats: Rolling360Stats | null = null;

      for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        if (attempt == null) continue;
        finalStats = await this.updateRolling360OnSubmitInTransaction(tx, {
          attemptId: attempt.id,
          userId,
          isCorrect: attempt.wasCorrect,
          system: attempt.systemNormalized || attempt.system || 'Unknown',
          answeredAt: attempt.createdAt,
        });
      }

      return (
        finalStats || {
          totalInWindow: 0,
          correctInWindow: 0,
          accuracyPercent: null,
          systemStats: {},
          predictedScore: null,
          scoreConfidence: 'collecting',
          passLikelihood: null,
          blueprintAdherence: null,
          isValidExamDistribution: false,
          weakestSystems: [],
          strongestSystems: [],
          windowStartTime: null,
          windowEndTime: null,
        }
      );
    });
  }

  /**
   * Internal method for updating stats within an existing transaction
   */
  private async updateRolling360OnSubmitInTransaction(
    tx: Prisma.TransactionClient,
    attemptData: AttemptData
  ): Promise<Rolling360Stats> {
    const { attemptId, userId, isCorrect, system, answeredAt } = attemptData;
    const normalizedSystem = normalizeSystemName(system);

    // Get current stats
    const stats = await tx.userRolling360Stats.findUnique({
      where: { userId },
    });

    if (!stats) {
      throw new Error('Stats record must exist before updating');
    }

    // Get current slot index
    const currentSlotIndex = stats.currentSlotIndex;
    const nextSlotIndex = (currentSlotIndex + 1) % ROLLING_WINDOW_SIZE;

    // Get existing buffer slot
    const bufferSlot = await tx.rolling360Buffer.findUnique({
      where: {
        userId_slotIndex: {
          userId,
          slotIndex: nextSlotIndex,
        },
      },
    });

    // Calculate delta
    const systemStats = (stats.systemStats as unknown as Record<string, SystemStats>) || {};
    let totalDelta = 1;
    let correctDelta = isCorrect ? 1 : 0;

    if (bufferSlot && bufferSlot.isCorrect !== null) {
      totalDelta = 0;
      correctDelta = (isCorrect ? 1 : 0) - (bufferSlot.isCorrect ? 1 : 0);

      const oldSystem = bufferSlot.systemNormalized || 'Unknown';
      if (systemStats[oldSystem]) {
        systemStats[oldSystem].total -= 1;
        if (bufferSlot.isCorrect) {
          systemStats[oldSystem].correct -= 1;
        }
        if (systemStats[oldSystem].total <= 0) {
          delete systemStats[oldSystem];
        } else {
          systemStats[oldSystem].accuracy =
            (systemStats[oldSystem].correct / systemStats[oldSystem].total) * 100;
        }
      }
    }

    // Update buffer slot
    if (bufferSlot) {
      await tx.rolling360Buffer.update({
        where: {
          userId_slotIndex: {
            userId,
            slotIndex: nextSlotIndex,
          },
        },
        data: {
          attemptId,
          isCorrect,
          systemNormalized: normalizedSystem,
          answeredAt,
          updatedAt: new Date(),
        },
      });
    } else {
      await tx.rolling360Buffer.create({
        data: {
          userId,
          slotIndex: nextSlotIndex,
          attemptId,
          isCorrect,
          systemNormalized: normalizedSystem,
          answeredAt,
        },
      });
    }

    // Update system stats
    if (!systemStats[normalizedSystem]) {
      systemStats[normalizedSystem] = { total: 0, correct: 0, accuracy: 0 };
    }
    systemStats[normalizedSystem].total += 1;
    if (isCorrect) {
      systemStats[normalizedSystem].correct += 1;
    }
    systemStats[normalizedSystem].accuracy =
      (systemStats[normalizedSystem].correct / systemStats[normalizedSystem].total) * 100;

    // Calculate aggregates
    const newTotal = Math.min(stats.totalInWindow + totalDelta, ROLLING_WINDOW_SIZE);
    const newCorrect = stats.correctInWindow + correctDelta;
    const newAccuracy = newTotal > 0 ? (newCorrect / newTotal) * 100 : null;
    const predictedScore = calculatePredictedScore(newAccuracy);
    const scoreConfidence = determineScoreConfidence(newTotal);
    const passLikelihood = calculatePassLikelihood(predictedScore);
    const { weakest, strongest } = identifyWeakestAndStrongest(systemStats);

    // Update stats record
    await tx.userRolling360Stats.update({
      where: { userId },
      data: {
        totalInWindow: newTotal,
        correctInWindow: newCorrect,
        accuracyPercent: newAccuracy !== null ? new Prisma.Decimal(newAccuracy) : null,
        systemStats: systemStats as any,
        predictedScore,
        scoreConfidence,
        passLikelihood: passLikelihood !== null ? new Prisma.Decimal(passLikelihood) : null,
        weakestSystems: weakest,
        strongestSystems: strongest,
        windowEndAttemptId: attemptId,
        windowEndTime: answeredAt,
        currentSlotIndex: nextSlotIndex,
        lastRecalculatedAt: new Date(),
        recalculationVersion: { increment: 1 },
      },
    });

    return {
      totalInWindow: newTotal,
      correctInWindow: newCorrect,
      accuracyPercent: newAccuracy,
      systemStats,
      predictedScore,
      scoreConfidence,
      passLikelihood,
      blueprintAdherence: null,
      isValidExamDistribution: false,
      weakestSystems: weakest,
      strongestSystems: strongest,
      windowStartTime: null,
      windowEndTime: answeredAt,
    };
  }

  /**
   * Gets topic weakness breakdown within the rolling 360 window
   */
  async getTopicWeaknesses(
    userId: string,
    minAttempts: number = 5
  ): Promise<
    {
      system: string;
      total: number;
      correct: number;
      accuracy: number;
      belowBlueprintBy: number | null;
    }[]
  > {
    const stats = await this.getRolling360Stats(userId);
    if (!stats) return [];

    const blueprint = await this.prisma.nCCPABlueprintConfig.findFirst({
      where: { isActive: true },
    });
    const blueprintWeights = (blueprint?.weights as BlueprintWeights) || {};

    return Object.entries(stats.systemStats)
      .filter(([_, s]) => s.total >= minAttempts)
      .map(([system, s]) => ({
        system,
        total: s.total,
        correct: s.correct,
        accuracy: s.accuracy,
        belowBlueprintBy: blueprintWeights[system]
          ? blueprintWeights[system] * 100 - s.accuracy
          : null,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let rolling360ServiceInstance: Rolling360Service | null = null;

export function getRolling360Service(prisma: PrismaClient): Rolling360Service {
  if (!rolling360ServiceInstance) {
    rolling360ServiceInstance = new Rolling360Service(prisma);
  }
  return rolling360ServiceInstance;
}

export default Rolling360Service;
