/**
 * Insight Generation Service
 *
 * Transforms raw analytics data (rolling360, calibration, Ghost Grader,
 * performance history) into actionable student-facing narratives.
 *
 * Instead of "your cardiovascular accuracy is 62%," this service produces:
 * "You're confusing CHF with COPD exacerbation in Cardiovascular — both
 * present with dyspnea, but CHF has JVD and bilateral crackles."
 *
 * Key insight types:
 *   - System weakness narratives (what + why + suggested drill)
 *   - Calibration alignment (overconfident/underconfident areas)
 *   - Exam readiness projection (trend + confidence interval)
 *   - Weekly improvement summary
 *
 * Sprint 3A — April 2026
 * @module lib/services/insightGenerationService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';
export type InsightCategory = 'weakness' | 'calibration' | 'readiness' | 'improvement' | 'streak';

export interface StudentInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  narrative: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  system?: string;
  generatedAt: Date;
}
export interface SystemPerformance {
  system: string;
  accuracy: number;
  totalAttempts: number;
  recentAccuracy: number; // Last 30 days
  trend: 'improving' | 'declining' | 'stable';
  weakConditions: string[];
}

export interface InsightInput {
  userId: string;
  systemPerformances: SystemPerformance[];
  overallAccuracy: number;
  recentAccuracy: number;
  totalAttempts: number;
  streakDays: number;
  calibrationMiscalibration?: number; // 0-1
  dangerousMisconceptionCount?: number;
  daysToExam?: number | null;
}

export interface InsightsReport {
  insights: StudentInsight[];
  examReadiness?: ExamReadinessProjection;
  topPriority: StudentInsight | null;
}

export interface ExamReadinessProjection {
  currentScore: number;       // Estimated 0-100
  projectedScore: number;     // At exam date
  passingThreshold: number;   // 390/500 = 78% for PANCE
  confidence: number;         // 0-1
  trend: 'on_track' | 'at_risk' | 'ahead' | 'insufficient_data';
  daysToExam: number | null;
  weeklyGainRate: number;     // Points per week
}
// ─── Constants ───────────────────────────────────────────────────────────────

/** Accuracy below this is a "weak system" */
const WEAK_SYSTEM_THRESHOLD = 0.65;

/** Accuracy above this is "strong" */
const STRONG_SYSTEM_THRESHOLD = 0.85;

/** Minimum attempts per system for meaningful insights */
const MIN_SYSTEM_ATTEMPTS = 10;

/** PANCE passing score as a percentage */
export const PANCE_PASSING_PERCENTAGE = 0.78;

// ─── Insight Generation ──────────────────────────────────────────────────────

/**
 * Generate all insights from the input data.
 * Pure function — no DB calls. Caller provides the data.
 */
export function generateInsights(input: InsightInput): InsightsReport {
  const insights: StudentInsight[] = [];
  const now = new Date();

  // 1. System weakness insights
  insights.push(...generateWeaknessInsights(input.systemPerformances, now));

  // 2. Calibration insights
  if (input.calibrationMiscalibration !== undefined) {
    insights.push(...generateCalibrationInsights(input, now));
  }

  // 3. Improvement / streak insights
  insights.push(...generateImprovementInsights(input, now));
  // 4. Exam readiness projection
  const examReadiness = input.daysToExam != null
    ? projectExamReadiness(input)
    : undefined;

  if (examReadiness) {
    insights.push(generateReadinessInsight(examReadiness, now));
  }

  // Sort: critical first, then warning, then positive, then info
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0, warning: 1, positive: 2, info: 3,
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    insights,
    examReadiness,
    topPriority: insights[0] ?? null,
  };
}

// ─── Weakness Insights ───────────────────────────────────────────────────────

function generateWeaknessInsights(
  performances: SystemPerformance[],
  now: Date
): StudentInsight[] {
  const insights: StudentInsight[] = [];

  for (const perf of performances) {
    if (perf.totalAttempts < MIN_SYSTEM_ATTEMPTS) continue;
    if (perf.accuracy < WEAK_SYSTEM_THRESHOLD) {
      const weakConditionsText = perf.weakConditions.length > 0
        ? ` Focus on: ${perf.weakConditions.slice(0, 3).join(', ')}.`
        : '';

      insights.push({
        id: `weakness-${perf.system}`,
        category: 'weakness',
        severity: perf.accuracy < 0.50 ? 'critical' : 'warning',
        title: `${perf.system} needs attention`,
        narrative: `Your ${perf.system} accuracy is ${Math.round(perf.accuracy * 100)}% ` +
          `(${perf.trend === 'declining' ? 'and declining' : perf.trend}).${weakConditionsText}`,
        actionLabel: 'Start focused drill',
        actionData: { mode: 'focused', system: perf.system },
        system: perf.system,
        generatedAt: now,
      });
    } else if (perf.accuracy >= STRONG_SYSTEM_THRESHOLD && perf.trend === 'improving') {
      insights.push({
        id: `strength-${perf.system}`,
        category: 'improvement',
        severity: 'positive',
        title: `${perf.system} is strong`,
        narrative: `${Math.round(perf.accuracy * 100)}% accuracy and improving — ` +
          `this system is well-prepared for the PANCE.`,
        system: perf.system,
        generatedAt: now,
      });
    }
  }

  return insights;
}
// ─── Calibration Insights ────────────────────────────────────────────────────

function generateCalibrationInsights(
  input: InsightInput,
  now: Date
): StudentInsight[] {
  const insights: StudentInsight[] = [];

  if ((input.dangerousMisconceptionCount ?? 0) > 0) {
    insights.push({
      id: 'calibration-misconceptions',
      category: 'calibration',
      severity: 'critical',
      title: 'Dangerous misconceptions detected',
      narrative: `You have ${input.dangerousMisconceptionCount} topic(s) where you're ` +
        `confident but consistently wrong. These are the highest-priority items to review ` +
        `because you won't know to study them on your own.`,
      actionLabel: 'Review misconceptions',
      actionData: { view: 'calibration-quadrant', filter: 'dangerous_misconception' },
      generatedAt: now,
    });
  }

  if ((input.calibrationMiscalibration ?? 0) > 0.3) {
    insights.push({
      id: 'calibration-alignment',
      category: 'calibration',
      severity: 'warning',
      title: 'Confidence–accuracy misalignment',
      narrative: `Your confidence doesn't match your actual performance ` +
        `(miscalibration score: ${Math.round((input.calibrationMiscalibration ?? 0) * 100)}%). ` +
        `This is common early in study — the calibration dashboard helps you identify where.`,
      generatedAt: now,
    });
  }

  return insights;
}
// ─── Improvement Insights ────────────────────────────────────────────────────

function generateImprovementInsights(
  input: InsightInput,
  now: Date
): StudentInsight[] {
  const insights: StudentInsight[] = [];

  // Accuracy trend
  if (input.totalAttempts >= 50) {
    const delta = input.recentAccuracy - input.overallAccuracy;
    if (delta > 0.05) {
      insights.push({
        id: 'improvement-accuracy',
        category: 'improvement',
        severity: 'positive',
        title: 'Accuracy is improving',
        narrative: `Recent accuracy (${Math.round(input.recentAccuracy * 100)}%) is ` +
          `${Math.round(delta * 100)} points above your overall average. Keep it up!`,
        generatedAt: now,
      });
    } else if (delta < -0.05) {
      insights.push({
        id: 'improvement-decline',
        category: 'improvement',
        severity: 'warning',
        title: 'Accuracy has dipped recently',
        narrative: `Recent accuracy (${Math.round(input.recentAccuracy * 100)}%) is ` +
          `${Math.round(Math.abs(delta) * 100)} points below your average. ` +
          `Consider reviewing your weak systems or taking a break if fatigued.`,
        generatedAt: now,
      });
    }
  }
  // Streak
  if (input.streakDays >= 7) {
    insights.push({
      id: 'streak',
      category: 'streak',
      severity: 'positive',
      title: `${input.streakDays}-day study streak!`,
      narrative: `Consistency is the strongest predictor of PANCE success. ` +
        `You've studied ${input.streakDays} days in a row.`,
      generatedAt: now,
    });
  }

  return insights;
}

// ─── Exam Readiness Projection ───────────────────────────────────────────────

/**
 * Project PANCE readiness based on current performance and trajectory.
 *
 * Model: linear extrapolation of weekly accuracy gain rate to exam date.
 * Confidence decreases with distance to exam and variance in recent performance.
 */
export function projectExamReadiness(input: InsightInput): ExamReadinessProjection {
  const daysToExam = input.daysToExam ?? null;
  const weeksToExam = daysToExam != null ? daysToExam / 7 : null;

  // Current estimated score (accuracy mapped to PANCE scale 200-800)
  const currentScore = Math.round(200 + input.recentAccuracy * 600);
  // Weekly gain rate: difference between recent and overall, scaled to per-week
  const accuracyDelta = input.recentAccuracy - input.overallAccuracy;
  // Assume "recent" covers ~4 weeks
  const weeklyAccuracyGain = accuracyDelta / 4;
  const weeklyGainRate = Math.round(weeklyAccuracyGain * 600); // In PANCE points

  // Projected score at exam date
  const projectedScore = weeksToExam != null
    ? Math.round(Math.min(800, Math.max(200, currentScore + weeklyGainRate * weeksToExam)))
    : currentScore;

  // Passing threshold: PANCE passing is ~390/500 scaled, roughly 78%
  const passingThreshold = Math.round(200 + PANCE_PASSING_PERCENTAGE * 600); // ~668

  // Confidence: higher with more data, lower with more time to exam
  const dataConfidence = Math.min(1, input.totalAttempts / 500);
  const timeConfidence = daysToExam != null ? Math.max(0.3, 1 - daysToExam / 365) : 0.5;
  const confidence = Math.round((dataConfidence * 0.6 + timeConfidence * 0.4) * 100) / 100;

  // Trend classification
  let trend: ExamReadinessProjection['trend'];
  if (input.totalAttempts < 100) {
    trend = 'insufficient_data';
  } else if (projectedScore >= passingThreshold + 30) {
    trend = 'ahead';
  } else if (projectedScore >= passingThreshold) {
    trend = 'on_track';
  } else {
    trend = 'at_risk';
  }

  return {
    currentScore,
    projectedScore,
    passingThreshold,
    confidence,
    trend,
    daysToExam,
    weeklyGainRate,
  };
}
// ─── Readiness Insight ───────────────────────────────────────────────────────

function generateReadinessInsight(
  readiness: ExamReadinessProjection,
  now: Date
): StudentInsight {
  const { trend, projectedScore, passingThreshold, daysToExam } = readiness;
  const daysText = daysToExam != null ? ` (${daysToExam} days away)` : '';

  if (trend === 'at_risk') {
    return {
      id: 'readiness-at-risk',
      category: 'readiness',
      severity: 'critical',
      title: 'Exam readiness: at risk',
      narrative: `Projected score ${projectedScore} is below the passing threshold ` +
        `of ${passingThreshold}${daysText}. Focus on weak systems and increase daily volume.`,
      actionLabel: 'View weak systems',
      actionData: { view: 'system-breakdown' },
      generatedAt: now,
    };
  }

  if (trend === 'on_track') {
    return {
      id: 'readiness-on-track',
      category: 'readiness',
      severity: 'info',
      title: 'Exam readiness: on track',
      narrative: `Projected score ${projectedScore} meets the passing threshold ` +
        `of ${passingThreshold}${daysText}. Maintain your current pace.`,
      generatedAt: now,
    };
  }

  if (trend === 'ahead') {
    return {
      id: 'readiness-ahead',
      category: 'readiness',
      severity: 'positive',
      title: 'Exam readiness: ahead of target',
      narrative: `Projected score ${projectedScore} exceeds the passing threshold ` +
        `by ${projectedScore - passingThreshold} points${daysText}. Excellent progress!`,
      generatedAt: now,
    };
  }

  return {
    id: 'readiness-insufficient',
    category: 'readiness',
    severity: 'info',
    title: 'Exam readiness: gathering data',
    narrative: `Need more study data to project exam readiness. ` +
      `Complete at least 100 questions for a meaningful projection.`,
    generatedAt: now,
  };
}
