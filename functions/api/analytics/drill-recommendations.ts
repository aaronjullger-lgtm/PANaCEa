/**
 * API: GET /api/analytics/drill-recommendations
 *
 * Assembles a WeaknessProfile from existing DB signals (system accuracy,
 * confusion pairs, calibration, answer switching, speed, blueprint gaps)
 * and runs the deterministic DrillRecommendationEngine to return 3-5
 * personalized drill suggestions.
 *
 * Single-call endpoint — no client-side multi-fetch needed.
 *
 * @see lib/services/drillRecommendationEngine.ts
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const DEFAULT_DAYS = 60;
const MAX_ATTEMPTS = 3000;

/** NCCPA 2025 Blueprint target weights */
const NCCPA_TARGET: Record<string, number> = {
  Cardiovascular: 0.11,
  Pulmonary: 0.09,
  Gastrointestinal: 0.09,
  Musculoskeletal: 0.09,
  HEENT: 0.08,
  Reproductive: 0.08,
  Neurological: 0.07,
  Psychiatry: 0.07,
  Endocrine: 0.06,
  Dermatology: 0.05,
  Genitourinary: 0.05,
  Hematology: 0.04,
  'Infectious Disease': 0.04,
  Nephrology: 0.04,
  'Emergency Medicine': 0.02,
};

/** Normalize DB system strings to canonical NCCPA names */
const SYSTEM_ALIASES: Record<string, string> = {
  cv: 'Cardiovascular', cardiovascular: 'Cardiovascular', cardiology: 'Cardiovascular',
  pulm: 'Pulmonary', pulmonary: 'Pulmonary', respiratory: 'Pulmonary',
  gi: 'Gastrointestinal', gastrointestinal: 'Gastrointestinal', 'gastrointestinal/nutrition': 'Gastrointestinal',
  msk: 'Musculoskeletal', musculoskeletal: 'Musculoskeletal', orthopedic: 'Musculoskeletal',
  heent: 'HEENT', eent: 'HEENT',
  repro: 'Reproductive', reproductive: 'Reproductive', 'ob/gyn': 'Reproductive',
  neuro: 'Neurological', neurological: 'Neurological', neurology: 'Neurological',
  psych: 'Psychiatry', psychiatry: 'Psychiatry', 'psychiatry/behavioral': 'Psychiatry',
  endo: 'Endocrine', endocrine: 'Endocrine', endocrinology: 'Endocrine',
  derm: 'Dermatology', dermatology: 'Dermatology',
  gu: 'Genitourinary', genitourinary: 'Genitourinary',
  heme: 'Hematology', hematology: 'Hematology',
  id: 'Infectious Disease', 'infectious disease': 'Infectious Disease',
  renal: 'Nephrology', nephrology: 'Nephrology',
  emergency: 'Emergency Medicine', 'emergency medicine': 'Emergency Medicine',
  pharmacology: 'Pharmacology', pharm: 'Pharmacology',
};

function normalizeSystem(raw: string | null): string | null {
  if (!raw) return null;
  return SYSTEM_ALIASES[raw.toLowerCase().trim()] ?? null;
}

function getConfidence(row: {
  implicitConfidence: number | null;
  telemetryJson: unknown;
}): number | null {
  if (row.implicitConfidence != null && !Number.isNaN(row.implicitConfidence)) {
    return row.implicitConfidence;
  }
  const json = row.telemetryJson as { server_computed?: { implicit_confidence?: number } } | null;
  const fromJson = json?.server_computed?.implicit_confidence;
  if (typeof fromJson === 'number' && !Number.isNaN(fromJson)) return fromJson;
  return null;
}

// ── Inline engine (avoids edge function import issues with lib/) ──────────

interface DrillRecommendation {
  drillType: string;
  label: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  focusSystem?: string;
  focusConditions?: string[];
  priority: number;
}

interface WeaknessProfile {
  systemAccuracy: Record<string, { accuracy: number; attempts: number }>;
  confusionPairs: Array<{ realCondition: string; mistakenFor: string; count: number; system?: string }>;
  calibration: { overconfidentMisses: number; totalAttempts: number };
  answerSwitching: { switchRate: number; harmfulSwitchRate: number };
  speed: { avgRtMs: number; fastQuartileAccuracy: number; slowQuartileAccuracy: number };
  blueprintGaps: Array<{ system: string; gapPercent: number }>;
}

const DRILL_LABELS: Record<string, string> = {
  ddx_compare: 'DDx Compare',
  system_drill: 'System Drill',
  rapid_recall: 'Rapid Recall',
  condition_drill: 'Condition Drill',
  first_line_treatment: 'First-Line Treatment',
  pharmacology: 'Pharmacology',
};

function generateDrillRecommendations(profile: WeaknessProfile, max = 5): DrillRecommendation[] {
  const recs: DrillRecommendation[] = [];

  // 1. Confusion-pair drills
  if (profile.confusionPairs.length > 0) {
    const topPair = profile.confusionPairs[0]!;
    recs.push({
      drillType: 'ddx_compare',
      label: DRILL_LABELS['ddx_compare']!,
      reason: `You've confused "${topPair.realCondition}" with "${topPair.mistakenFor}" ${topPair.count} times. Contrastive drilling builds discrimination.`,
      impact: topPair.count >= 5 ? 'high' : 'medium',
      focusConditions: [topPair.realCondition, topPair.mistakenFor],
      focusSystem: topPair.system,
      priority: 90 + Math.min(topPair.count, 10),
    });
  }

  // 2. Weakest system
  const systemEntries = Object.entries(profile.systemAccuracy)
    .filter(([, s]) => s.attempts >= 10)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy);

  if (systemEntries.length > 0) {
    const [weakSystem, weakStats] = systemEntries[0]!;
    const accPct = Math.round(weakStats.accuracy * 100);
    recs.push({
      drillType: 'system_drill',
      label: DRILL_LABELS['system_drill']!,
      reason: `${weakSystem} is your weakest system at ${accPct}% accuracy (${weakStats.attempts} questions). Focused drilling closes this gap.`,
      impact: weakStats.accuracy < 0.6 ? 'high' : 'medium',
      focusSystem: weakSystem,
      priority: 85 - weakStats.accuracy * 20,
    });
  }

  // 3. Blueprint gap
  const topGap = profile.blueprintGaps
    .filter(g => g.gapPercent > 3)
    .sort((a, b) => b.gapPercent - a.gapPercent)[0];

  if (topGap) {
    recs.push({
      drillType: 'system_drill',
      label: `${topGap.system} Coverage`,
      reason: `${topGap.system} is ${topGap.gapPercent.toFixed(0)}% under your PANCE blueprint target. More questions here reduces exam risk.`,
      impact: topGap.gapPercent > 8 ? 'high' : 'medium',
      focusSystem: topGap.system,
      priority: 80 + topGap.gapPercent,
    });
  }

  // 4. Overconfidence
  if (profile.calibration.totalAttempts >= 30) {
    const overconfRate = profile.calibration.overconfidentMisses / profile.calibration.totalAttempts;
    if (overconfRate > 0.10) {
      recs.push({
        drillType: 'rapid_recall',
        label: DRILL_LABELS['rapid_recall']!,
        reason: `${Math.round(overconfRate * 100)}% of your answers are high-confidence misses. Rapid recall under time pressure exposes weak spots.`,
        impact: overconfRate > 0.15 ? 'high' : 'medium',
        priority: 70 + overconfRate * 100,
      });
    }
  }

  // 5. Speed-rushing
  if (profile.speed.fastQuartileAccuracy < profile.speed.slowQuartileAccuracy - 0.15) {
    recs.push({
      drillType: 'condition_drill',
      label: 'Deliberate Practice',
      reason: `Your fast answers are ${Math.round((profile.speed.slowQuartileAccuracy - profile.speed.fastQuartileAccuracy) * 100)}% less accurate than deliberate ones. Slow, focused condition drills build pattern recognition.`,
      impact: 'medium',
      priority: 60,
    });
  }

  // 6. Answer-switching
  if (profile.answerSwitching.switchRate > 0.15 && profile.answerSwitching.harmfulSwitchRate > 0.5) {
    recs.push({
      drillType: 'first_line_treatment',
      label: DRILL_LABELS['first_line_treatment']!,
      reason: `You change answers on ${Math.round(profile.answerSwitching.switchRate * 100)}% of questions and most switches hurt. First-line drills build decisive recall.`,
      impact: 'medium',
      priority: 55,
    });
  }

  // 7. Pharmacology
  const pharmAccuracy = profile.systemAccuracy['Pharmacology']?.accuracy;
  if (pharmAccuracy !== undefined && pharmAccuracy < 0.7) {
    recs.push({
      drillType: 'pharmacology',
      label: DRILL_LABELS['pharmacology']!,
      reason: `Pharmacology accuracy is ${Math.round(pharmAccuracy * 100)}%. Pharm is heavily tested on PANCE — steady practice here compounds.`,
      impact: pharmAccuracy < 0.55 ? 'high' : 'medium',
      priority: 50,
    });
  }

  // Deduplicate by drillType:focusSystem
  const seen = new Set<string>();
  return recs
    .sort((a, b) => b.priority - a.priority)
    .filter(r => {
      const key = `${r.drillType}:${r.focusSystem ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

// ── Endpoint ──────────────────────────────────────────────────────────────

export const onRequestGet = authenticatedEndpoint(
  z.object({
    days: z.coerce.number().min(1).max(365).optional().default(DEFAULT_DAYS),
    max: z.coerce.number().min(1).max(10).optional().default(5),
  }).optional().default({ days: DEFAULT_DAYS, max: 5 }),
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const days = context.validated?.days ?? DEFAULT_DAYS;
    const max = context.validated?.max ?? 5;

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, data: { error: 'User not found' } };
      }

      const since = new Date();
      since.setDate(since.getDate() - days);

      // ── Fetch all signals in parallel ──

      const [attempts, confusionAttempts] = await Promise.all([
        // All question attempts for system accuracy, calibration, speed, switches
        prisma.questionAttempt.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: since },
          },
          select: {
            wasCorrect: true,
            system: true,
            systemNormalized: true,
            implicitConfidence: true,
            telemetryJson: true,
            responseTimeMs: true,
            conditionId: true,
            selectedConditionId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_ATTEMPTS,
        }),
        // Wrong answers for confusion pairs
        prisma.questionAttempt.findMany({
          where: {
            userId: user.id,
            wasCorrect: false,
            conditionId: { not: null },
            selectedConditionId: { not: null },
            createdAt: { gte: since },
          },
          select: {
            conditionId: true,
            selectedConditionId: true,
            system: true,
          },
          take: 2000,
        }),
      ]);

      // ── 1. System Accuracy ──

      const systemAgg: Record<string, { correct: number; total: number }> = {};
      for (const a of attempts) {
        const sys = normalizeSystem(a.systemNormalized ?? a.system);
        if (!sys) continue;
        if (!systemAgg[sys]) systemAgg[sys] = { correct: 0, total: 0 };
        systemAgg[sys].total += 1;
        if (a.wasCorrect) systemAgg[sys].correct += 1;
      }

      const systemAccuracy: Record<string, { accuracy: number; attempts: number }> = {};
      for (const [sys, agg] of Object.entries(systemAgg)) {
        systemAccuracy[sys] = {
          accuracy: agg.total > 0 ? agg.correct / agg.total : 0,
          attempts: agg.total,
        };
      }

      // ── 2. Confusion Pairs ──

      const pairCounts = new Map<string, { real: string; mistaken: string; system?: string; count: number }>();
      for (const a of confusionAttempts) {
        if (!a.conditionId || !a.selectedConditionId) continue;
        const key = `${a.conditionId}|${a.selectedConditionId}`;
        const existing = pairCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          pairCounts.set(key, {
            real: a.conditionId,
            mistaken: a.selectedConditionId,
            system: a.system ?? undefined,
            count: 1,
          });
        }
      }

      const confusionPairs = Array.from(pairCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(p => ({
          realCondition: p.real,
          mistakenFor: p.mistaken,
          count: p.count,
          system: p.system,
        }));

      // ── 3. Calibration ──

      let overconfidentMisses = 0;
      for (const a of attempts) {
        const conf = getConfidence(a);
        if (conf !== null && conf >= 0.7 && !a.wasCorrect) {
          overconfidentMisses += 1;
        }
      }

      // ── 4. Answer Switching (from telemetryJson) ──

      let totalSwitches = 0;
      let harmfulSwitches = 0;
      for (const a of attempts) {
        const json = a.telemetryJson as { answer_switches?: number; first_instinct_correct?: boolean } | null;
        const switches = json?.answer_switches ?? 0;
        if (switches > 0) {
          totalSwitches += 1;
          // Harmful = had a switch AND first instinct was correct but final was wrong
          if (json?.first_instinct_correct === true && !a.wasCorrect) {
            harmfulSwitches += 1;
          }
        }
      }

      const switchRate = attempts.length > 0 ? totalSwitches / attempts.length : 0;
      const harmfulSwitchRate = totalSwitches > 0 ? harmfulSwitches / totalSwitches : 0;

      // ── 5. Speed quartiles ──

      const rts = attempts
        .filter(a => a.responseTimeMs != null && a.responseTimeMs > 0)
        .map(a => ({ rt: a.responseTimeMs!, correct: a.wasCorrect }))
        .sort((a, b) => a.rt - b.rt);

      let avgRtMs = 0;
      let fastQuartileAccuracy = 0;
      let slowQuartileAccuracy = 0;

      if (rts.length >= 8) {
        avgRtMs = rts.reduce((s, r) => s + r.rt, 0) / rts.length;
        const q1 = Math.floor(rts.length * 0.25);
        const q4Start = Math.floor(rts.length * 0.75);

        const fast = rts.slice(0, q1);
        const slow = rts.slice(q4Start);

        fastQuartileAccuracy = fast.length > 0
          ? fast.filter(r => r.correct).length / fast.length
          : 0;
        slowQuartileAccuracy = slow.length > 0
          ? slow.filter(r => r.correct).length / slow.length
          : 0;
      }

      // ── 6. Blueprint Gaps ──

      let totalAttempts = 0;
      const systemCounts: Record<string, number> = {};
      for (const a of attempts) {
        const sys = normalizeSystem(a.systemNormalized ?? a.system);
        if (!sys || !(sys in NCCPA_TARGET)) continue;
        systemCounts[sys] = (systemCounts[sys] || 0) + 1;
        totalAttempts += 1;
      }

      const blueprintGaps: Array<{ system: string; gapPercent: number }> = [];
      for (const [system, targetWeight] of Object.entries(NCCPA_TARGET)) {
        const actual = totalAttempts > 0 ? ((systemCounts[system] || 0) / totalAttempts) * 100 : 0;
        const target = targetWeight * 100;
        const gap = target - actual; // positive = under-studied
        if (gap > 0) {
          blueprintGaps.push({ system, gapPercent: Math.round(gap * 10) / 10 });
        }
      }

      // ── Build profile & generate recommendations ──

      const profile: WeaknessProfile = {
        systemAccuracy,
        confusionPairs,
        calibration: { overconfidentMisses, totalAttempts: attempts.length },
        answerSwitching: { switchRate, harmfulSwitchRate },
        speed: { avgRtMs, fastQuartileAccuracy, slowQuartileAccuracy },
        blueprintGaps,
      };

      const recommendations = generateDrillRecommendations(profile, max);

      return {
        status: 200,
        data: {
          recommendations,
          profile: {
            totalAttempts: attempts.length,
            days,
            weakestSystem: systemEntries.length > 0 ? systemEntries[0]![0] : null,
            topConfusionPair: confusionPairs.length > 0
              ? { real: confusionPairs[0]!.realCondition, mistaken: confusionPairs[0]!.mistakenFor }
              : null,
          },
        },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isDbUnavailable = /connect|ECONNREFUSED|timeout|P1001|P1017/i.test(errMsg);
      return {
        status: isDbUnavailable ? 503 : 500,
        data: {
          error: isDbUnavailable ? 'Recommendations unavailable' : 'Failed to load recommendations',
          message: isDbUnavailable
            ? 'Database is temporarily unavailable. Please try again.'
            : errMsg,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
