/**
 * GET /api/intelligence/pance-readiness
 *
 * Computes the PANCE Readiness Score — a blueprint-weighted composite
 * of coverage, accuracy, stability, retrievability, and consistency.
 *
 * Phase 1 heuristic (Tier 2, Feature 4). No ML model yet.
 *
 * Response includes per-system breakdown, critical/exam-ready systems,
 * estimated score range, and mandatory disclaimer.
 *
 * @see lib/services/panceReadinessService.ts — Pure computation
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, type AuthenticatedContext, type ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// ─── Inlined blueprint weights (Edge can't import from lib/) ─────

const BLUEPRINT: Record<string, number> = {
  Cardiovascular: 0.11, Pulmonary: 0.09, Gastrointestinal: 0.09,
  Musculoskeletal: 0.09, HEENT: 0.08, Reproductive: 0.08,
  Neurological: 0.07, Psychiatry: 0.07, Endocrine: 0.06,
  Dermatology: 0.05, Genitourinary: 0.05, Hematology: 0.04,
  'Infectious Disease': 0.04, Nephrology: 0.04,
  'Emergency Medicine': 0.02, General: 0.02,
};

const TARGET_ACCURACY = 0.75;
const MIN_ATTEMPTS = 10;
const MIN_COVERAGE_FRACTION = 0.50;
const MATURE_STABILITY_DAYS = 30;

const READINESS_DISCLAIMER =
  'This readiness indicator is based on your study patterns and is not a prediction of your PANCE score. ' +
  'Actual exam performance depends on many factors not captured here.';

// ─── Schema ──────────────────────────────────────────────────────

const ReadinessSchema = z.object({});

// ─── CORS ────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── Handler ─────────────────────────────────────────────────────

export const onRequestGet = authenticatedEndpoint(
  ReadinessSchema,
  async (context: AuthenticatedContext & ValidatedContext<unknown>) => {
    const userId = context.auth.userId;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      // Step 1: Fetch all needed data in parallel
      const [
        // Per-system attempt counts and accuracy
        systemAttempts,
        // Per-system recent attempts (last 14 days)
        recentAttempts,
        // Per-system FSRS state (stability, retrievability, difficulty)
        userProgress,
        // Available questions per system
        availableBySystem,
        // Session count data for consistency
        recentSessions,
      ] = await Promise.all([
        // All-time attempts by system
        prisma.questionAttempt.groupBy({
          by: ['system'],
          where: { userId },
          _count: { id: true },
          _avg: { isCorrect: false },
        }),
        // Recent attempts (last 14 days)
        prisma.questionAttempt.groupBy({
          by: ['system'],
          where: { userId, createdAt: { gte: fourteenDaysAgo } },
          _count: { id: true },
          _avg: { isCorrect: false },
        }),
        // FSRS state per system
        prisma.userProgress.groupBy({
          by: ['system'],
          where: { userId },
          _count: { questionId: true },
          _avg: { stability: true, difficulty: true, retrievability: true },
        }),
        // Total available questions per system
        prisma.preGeneratedQuestion.groupBy({
          by: ['system'],
          where: { status: 'active' },
          _count: { id: true },
        }),
        // Session analytics for consistency
        prisma.sessionAnalytics.findMany({
          where: {
            userId,
            startedAt: { gte: fourteenDaysAgo },
          },
          select: {
            startedAt: true,
            totalQuestions: true,
            totalTimeSeconds: true,
          },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

      // Step 2: Build lookup maps
      const attemptMap = new Map(systemAttempts.map(a => [a.system, a]));
      const recentMap = new Map(recentAttempts.map(a => [a.system, a]));
      const progressMap = new Map(userProgress.map(p => [p.system, p]));
      const availableMap = new Map(availableBySystem.map(a => [a.system, a._count.id]));

      // Step 3: Count recent lapses per system
      const recentLapses = await prisma.questionAttempt.groupBy({
        by: ['system'],
        where: {
          userId,
          createdAt: { gte: fourteenDaysAgo },
          isCorrect: false,
        },
        _count: { id: true },
      });
      const lapseMap = new Map(recentLapses.map(l => [l.system, l._count.id]));

      // Step 4: Compute per-system scores
      const systemBreakdown: Array<{
        system: string;
        blueprintWeight: number;
        coverageScore: number;
        accuracyScore: number;
        stabilityScore: number;
        retrievabilityScore: number;
        lapsePenalty: number;
        compositeScore: number;
        weightedContribution: number;
        readinessTier: string;
      }> = [];

      let weightedSum = 0;
      let totalWeight = 0;

      for (const [system, bpWeight] of Object.entries(BLUEPRINT)) {
        const attempts = attemptMap.get(system);
        const recent = recentMap.get(system);
        const progress = progressMap.get(system);
        const available = availableMap.get(system) ?? 0;
        const lapses = lapseMap.get(system) ?? 0;

        const totalAttempts = attempts?._count?.id ?? 0;
        const cardsReviewed = progress?._count?.questionId ?? 0;
        const meanStability = progress?._avg?.stability ?? 0;
        const meanR = progress?._avg?.retrievability ?? 0;
        const recentAcc = recent?._count?.id && recent._count.id >= 5
          ? (recent._avg as any)?.isCorrect ?? null
          : null;

        // Coverage
        const coverageRatio = available > 0
          ? Math.min(1, cardsReviewed / (available * MIN_COVERAGE_FRACTION))
          : 0;
        const coverageScore = coverageRatio * 100;

        // Accuracy
        let accuracyScore: number;
        const allTimeAcc = totalAttempts > 0
          ? ((attempts?._avg as any)?.isCorrect ?? 0)
          : 0;
        if (totalAttempts < MIN_ATTEMPTS) {
          accuracyScore = totalAttempts > 0 ? allTimeAcc * 100 * 0.8 : 0;
        } else if (recentAcc !== null) {
          accuracyScore = Math.min(100, (recentAcc / TARGET_ACCURACY) * 100);
        } else {
          accuracyScore = Math.min(100, (allTimeAcc / TARGET_ACCURACY) * 100);
        }

        // Stability: approximate mature card fraction
        const matureFraction = meanStability > 0
          ? Math.min(1, meanStability / MATURE_STABILITY_DAYS)
          : 0;
        const stabilityScore = matureFraction * 100;

        // Retrievability
        const retrievabilityScore = (meanR ?? 0) * 100;

        // Lapse penalty
        const lapseRate = totalAttempts > 0 ? lapses / Math.max(1, totalAttempts) : 0;
        const lapsePenalty = Math.min(20, lapseRate * 100);

        // Composite
        const compositeScore = Math.max(0,
          0.35 * accuracyScore +
          0.25 * stabilityScore +
          0.20 * coverageScore +
          0.20 * retrievabilityScore -
          lapsePenalty
        );

        const tier = compositeScore >= 80 ? 'exam_ready'
          : compositeScore >= 65 ? 'strong'
          : compositeScore >= 50 ? 'developing'
          : compositeScore >= 35 ? 'needs_work'
          : 'critical';

        const weighted = compositeScore * bpWeight;

        systemBreakdown.push({
          system,
          blueprintWeight: bpWeight,
          coverageScore: Math.round(coverageScore * 10) / 10,
          accuracyScore: Math.round(accuracyScore * 10) / 10,
          stabilityScore: Math.round(stabilityScore * 10) / 10,
          retrievabilityScore: Math.round(retrievabilityScore * 10) / 10,
          lapsePenalty: Math.round(lapsePenalty * 10) / 10,
          compositeScore: Math.round(compositeScore * 10) / 10,
          weightedContribution: Math.round(weighted * 10) / 10,
          readinessTier: tier,
        });

        weightedSum += weighted;
        totalWeight += bpWeight;
      }

      // Step 5: Consistency modifier
      const activeDays = new Set(
        recentSessions.map(s => s.startedAt.toISOString().slice(0, 10))
      ).size;

      const avgSessionMin = recentSessions.length > 0
        ? recentSessions.reduce((sum, s) => sum + (s.totalTimeSeconds ?? 0), 0)
            / recentSessions.length / 60
        : 0;

      let consistencyMod = 0;
      if (activeDays >= 10) consistencyMod += 5;
      else if (activeDays >= 7) consistencyMod += 3;
      else if (activeDays < 4) consistencyMod -= 5;
      if (avgSessionMin >= 20) consistencyMod += 2;
      consistencyMod = Math.max(-10, Math.min(10, consistencyMod));

      const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const overallScore = Math.max(0, Math.min(100, rawScore + consistencyMod));

      const readinessLevel = overallScore >= 80 ? 'exam_ready'
        : overallScore >= 65 ? 'strong'
        : overallScore >= 50 ? 'developing'
        : overallScore >= 35 ? 'needs_work'
        : 'critical';

      // Score range estimate (rough heuristic)
      const centerEstimate = 300 + (overallScore / 100) * 500;
      const scoreRange = {
        low: Math.max(300, Math.round(centerEstimate - 50)),
        high: Math.min(800, Math.round(centerEstimate + 50)),
      };

      return {
        data: {
          overallScore: Math.round(overallScore * 10) / 10,
          readinessLevel,
          systemBreakdown: systemBreakdown.sort((a, b) => b.blueprintWeight - a.blueprintWeight),
          consistencyModifier: consistencyMod,
          criticalSystems: systemBreakdown
            .filter(s => s.readinessTier === 'critical' || s.readinessTier === 'needs_work')
            .map(s => s.system),
          examReadySystems: systemBreakdown
            .filter(s => s.readinessTier === 'exam_ready')
            .map(s => s.system),
          estimatedScoreRange: scoreRange,
          disclaimer: READINESS_DISCLAIMER,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Readiness computation failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
