/**
 * Risk Assessment Engine - Sprint 2
 *
 * Comprehensive risk assessment for exam readiness.
 */

import type { SystemPerformance } from './panaceScorePredictor';

export interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactor[];
  systemsAtRisk: string[];
  timeToExamRisk: 'adequate' | 'tight' | 'insufficient';
  recommendedActions: RecommendedAction[];
}

interface RiskFactor {
  factor: string;
  severity: 'minor' | 'moderate' | 'severe';
  impact: number;
  mitigation: string;
}

interface RecommendedAction {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: number;
  timeRequired: string;
}

export function assessExamRisk(
  predictedScore: number,
  systemPerformance: SystemPerformance[],
  daysUntilExam: number,
  studyHoursPerDay: number,
  recentPatterns: { date: Date; hoursStudied: number; accuracy: number }[]
): RiskAssessment {
  const PASSING = 350;
  const riskFactors: RiskFactor[] = [];
  const systemsAtRisk: string[] = [];

  // 1. Score gap risk
  const scoreGap = PASSING - predictedScore;
  if (scoreGap > 0) {
    riskFactors.push({
      factor: `Predicted score ${scoreGap} points below passing`,
      severity: scoreGap > 100 ? 'severe' : scoreGap > 50 ? 'moderate' : 'minor',
      impact: scoreGap,
      mitigation: 'Increase focused study on weak areas',
    });
  }

  // 2. System coverage risk
  for (const sys of systemPerformance) {
    if (sys.questionsAttempted < 30) {
      systemsAtRisk.push(sys.system);
      riskFactors.push({
        factor: `Low practice in ${sys.system} (${sys.questionsAttempted} questions)`,
        severity: sys.questionsAttempted < 10 ? 'severe' : 'moderate',
        impact: 30 - sys.questionsAttempted,
        mitigation: `Complete ${30 - sys.questionsAttempted} more ${sys.system} questions`,
      });
    }
    if (sys.accuracy < 0.6) {
      if (!systemsAtRisk.includes(sys.system)) systemsAtRisk.push(sys.system);
      riskFactors.push({
        factor: `Low ${sys.system} accuracy (${Math.round(sys.accuracy * 100)}%)`,
        severity: sys.accuracy < 0.4 ? 'severe' : 'moderate',
        impact: Math.round((0.6 - sys.accuracy) * 100),
        mitigation: `Review ${sys.system} fundamentals`,
      });
    }
    if (sys.trend === 'declining') {
      riskFactors.push({
        factor: `Declining ${sys.system} performance`,
        severity: 'moderate',
        impact: 20,
        mitigation: `Investigate ${sys.system} knowledge gaps`,
      });
    }
  }

  // 3. Time risk
  const requiredHours = scoreGap > 0 ? scoreGap * 0.5 : 0;
  const availableHours = daysUntilExam * studyHoursPerDay;
  const timeRisk: RiskAssessment['timeToExamRisk'] =
    availableHours >= requiredHours * 1.5
      ? 'adequate'
      : availableHours >= requiredHours
        ? 'tight'
        : 'insufficient';

  if (timeRisk !== 'adequate') {
    riskFactors.push({
      factor: `${timeRisk === 'tight' ? 'Limited' : 'Insufficient'} time before exam`,
      severity: timeRisk === 'insufficient' ? 'severe' : 'moderate',
      impact: Math.round(((requiredHours - availableHours) / requiredHours) * 100),
      mitigation:
        timeRisk === 'insufficient'
          ? 'Consider postponing or intensive study'
          : 'Maximize study efficiency',
    });
  }

  // 4. Study pattern risk
  if (recentPatterns.length >= 7) {
    const studyDays = recentPatterns.filter((p) => p.hoursStudied > 0).length;
    const consistency = studyDays / recentPatterns.length;
    if (consistency < 0.5) {
      riskFactors.push({
        factor: `Inconsistent study (${Math.round(consistency * 100)}% of days)`,
        severity: consistency < 0.3 ? 'severe' : 'moderate',
        impact: Math.round((0.7 - consistency) * 50),
        mitigation: 'Establish daily study routine',
      });
    }
  }

  // Calculate overall risk score
  let riskScore = 0;
  for (const f of riskFactors) {
    const mult = f.severity === 'severe' ? 3 : f.severity === 'moderate' ? 2 : 1;
    riskScore += f.impact * mult * 0.1;
  }
  riskScore = Math.min(100, Math.round(riskScore));

  const overallRisk: RiskAssessment['overallRisk'] =
    riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';

  // Generate actions
  const recommendedActions: RecommendedAction[] = riskFactors
    .sort((a, b) => {
      const sev = { severe: 3, moderate: 2, minor: 1 };
      return sev[b.severity] - sev[a.severity] || b.impact - a.impact;
    })
    .slice(0, 5)
    .map((f) => ({
      priority: f.severity === 'severe' ? 'urgent' : f.severity === 'moderate' ? 'high' : 'medium',
      action: f.mitigation,
      expectedImpact: f.impact,
      timeRequired: f.impact <= 5 ? '1-2 days' : f.impact <= 15 ? '3-5 days' : '1-2 weeks',
    }));

  return {
    overallRisk,
    riskScore,
    riskFactors,
    systemsAtRisk,
    timeToExamRisk: timeRisk,
    recommendedActions,
  };
}
