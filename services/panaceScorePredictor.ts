/**
 * PANCE Score Predictor - Sprint 2
 *
 * Predicts PANCE exam scores using weighted system performance
 * calibrated against actual PANCE domain weights.
 */

// PANCE Domain Weights (actual exam blueprint)
const PANCE_DOMAIN_WEIGHTS: Record<string, number> = {
  Cardiovascular: 0.16,
  Pulmonary: 0.12,
  Gastrointestinal: 0.1,
  Musculoskeletal: 0.1,
  EENT: 0.09,
  Reproductive: 0.08,
  Neurological: 0.08,
  Psychiatry: 0.06,
  Dermatology: 0.05,
  Endocrine: 0.05,
  Renal: 0.05,
  Hematology: 0.03,
  'Infectious Disease': 0.03,
};

export interface SystemPerformance {
  system: string;
  accuracy: number;
  questionsAttempted: number;
  trend: 'improving' | 'stable' | 'declining';
  lastPracticed: Date | null;
  masteryLevel: number;
}

export interface ScorePrediction {
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  probabilityOfPassing: number;
  keyStrengths: string[];
  keyRisks: string[];
  recommendedFocusAreas: string[];
  estimatedStudyHoursToPass: number;
}

const PASSING_SCORE = 350;
const MIN_SCORE = 200;
const MAX_SCORE = 800;

function mapSystemToDomain(system: string): string {
  const map: Record<string, string> = {
    cardiovascular: 'Cardiovascular',
    cardiac: 'Cardiovascular',
    pulmonary: 'Pulmonary',
    respiratory: 'Pulmonary',
    gastrointestinal: 'Gastrointestinal',
    gi: 'Gastrointestinal',
    musculoskeletal: 'Musculoskeletal',
    orthopedic: 'Musculoskeletal',
    eent: 'EENT',
    ent: 'EENT',
    eyes: 'EENT',
    reproductive: 'Reproductive',
    obgyn: 'Reproductive',
    neurological: 'Neurological',
    neuro: 'Neurological',
    psychiatry: 'Psychiatry',
    behavioral: 'Psychiatry',
    dermatology: 'Dermatology',
    skin: 'Dermatology',
    endocrine: 'Endocrine',
    renal: 'Renal',
    hematology: 'Hematology',
    infectious: 'Infectious Disease',
  };
  return map[system.toLowerCase()] || 'Other';
}

export function predictPANCEScore(
  systemPerformance: SystemPerformance[],
  totalQuestions: number,
  errorPatterns?: { type: string; frequency: number }[]
): ScorePrediction {
  // Calculate domain scores
  const domainStats: Record<string, { accuracy: number; questions: number }> = {};

  for (const sys of systemPerformance) {
    const domain = mapSystemToDomain(sys.system);
    if (!domainStats[domain]) {
      domainStats[domain] = { accuracy: 0, questions: 0 };
    }
    domainStats[domain].accuracy += sys.accuracy * sys.questionsAttempted;
    domainStats[domain].questions += sys.questionsAttempted;
  }

  // Calculate weighted score
  let rawScore = 0;
  for (const [domain, weight] of Object.entries(PANCE_DOMAIN_WEIGHTS)) {
    const stats = domainStats[domain];
    const accuracy = stats && stats.questions > 0 ? stats.accuracy / stats.questions : 0.5;
    rawScore += (MIN_SCORE + accuracy * (MAX_SCORE - MIN_SCORE)) * weight;
  }

  // Apply adjustments
  const volumeAdj = Math.min(1, 0.7 + (0.3 * Math.log10(totalQuestions + 1)) / 3);
  let trendAdj = 1.0;
  for (const sys of systemPerformance) {
    const weight = PANCE_DOMAIN_WEIGHTS[mapSystemToDomain(sys.system)] || 0.05;
    if (sys.trend === 'improving') trendAdj += 0.02 * weight * 10;
    else if (sys.trend === 'declining') trendAdj -= 0.03 * weight * 10;
  }
  trendAdj = Math.max(0.85, Math.min(1.15, trendAdj));

  // Error penalty
  let errorPenalty = 0;
  if (errorPatterns) {
    for (const p of errorPatterns) {
      if (p.type === 'knowledge_gap') errorPenalty += p.frequency * 15;
      else if (p.type === 'interference') errorPenalty += p.frequency * 10;
      else errorPenalty += p.frequency * 5;
    }
  }

  const predictedScore = Math.round(
    Math.max(
      MIN_SCORE,
      Math.min(MAX_SCORE, rawScore * volumeAdj * trendAdj - Math.min(100, errorPenalty))
    )
  );

  // Confidence interval
  const uncertainty = 80 * Math.max(0.5, 1 - Math.log10(totalQuestions + 1) / 4);
  const confidence = {
    low: Math.max(MIN_SCORE, Math.round(predictedScore - uncertainty)),
    high: Math.min(MAX_SCORE, Math.round(predictedScore + uncertainty)),
  };

  // Pass probability
  let probabilityOfPassing: number;
  if (confidence.low >= PASSING_SCORE) probabilityOfPassing = 98;
  else if (confidence.high < PASSING_SCORE) probabilityOfPassing = 5;
  else {
    const zScore = (predictedScore - PASSING_SCORE) / (uncertainty / 3);
    probabilityOfPassing = Math.round(100 / (1 + Math.exp(-zScore)));
  }

  // Identify strengths and risks
  const strengths: string[] = [];
  const risks: string[] = [];
  for (const sys of systemPerformance) {
    if (sys.accuracy >= 0.8 && sys.questionsAttempted >= 20) {
      strengths.push(`Strong ${sys.system} (${Math.round(sys.accuracy * 100)}%)`);
    }
    if (sys.accuracy < 0.6) {
      risks.push(`Weak ${sys.system} (${Math.round(sys.accuracy * 100)}%)`);
    }
    if (sys.trend === 'declining') {
      risks.push(`${sys.system} declining`);
    }
  }

  // Focus areas
  const focusAreas = systemPerformance
    .filter((s) => s.accuracy < 0.7)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5)
    .map((s) => s.system);

  // Study hours estimate
  const pointsNeeded = Math.max(0, PASSING_SCORE - predictedScore);
  const estimatedStudyHoursToPass = Math.ceil(pointsNeeded * 0.5);

  return {
    predictedScore,
    confidenceInterval: confidence,
    probabilityOfPassing,
    keyStrengths: strengths.slice(0, 5),
    keyRisks: risks.slice(0, 5),
    recommendedFocusAreas: focusAreas,
    estimatedStudyHoursToPass,
  };
}
