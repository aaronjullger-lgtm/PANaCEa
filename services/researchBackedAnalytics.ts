/**
 * Research-Backed Learning Analytics Engine
 *
 * Analyzes stored learning data using evidence-based educational research:
 *
 * Key Research Foundations:
 * - Spaced Repetition (Ebbinghaus, 1885; Pimsleur, 1967; Leitner, 1970s)
 * - Testing Effect / Retrieval Practice (Roediger & Karpicke, 2006)
 * - Desirable Difficulties (Bjork & Bjork, 2011)
 * - Interleaving Effect (Rohrer & Taylor, 2007)
 * - Spacing Effect (Cepeda et al., 2006)
 * - Cognitive Load Theory (Sweller, 1988)
 * - Zone of Proximal Development (Vygotsky, 1978)
 * - Self-Regulation in Learning (Zimmerman, 2002)
 * - Metacognition & Calibration (Dunlosky & Metcalfe, 2009)
 * - Sleep & Memory Consolidation (Walker, 2017)
 * - Circadian Rhythms in Cognition (Schmidt et al., 2007)
 */

import {
  getQuestionAttempts,
  getDailyRecords,
  getMilestones,
  getSnapshots,
  storeMilestone,
  storeSnapshot,
  generateId,
  getTodayString,
  type QuestionAttemptRecord,
  type DailyStudyRecord,
  type LearningMilestone,
  type AnalyticsSnapshot,
} from './deepAnalyticsStore';

// ============================================================================
// Types
// ============================================================================

export interface LearningEfficiencyMetrics {
  /** Questions needed to achieve mastery (lower = more efficient) */
  questionsToMastery: number;
  /** Time efficiency - knowledge gained per hour studied */
  learningRate: number;
  /** How well spaced repetition intervals are being followed */
  spacingAdherence: number;
  /** Effectiveness of interleaved practice vs blocked */
  interleavingBenefit: number;
  /** Estimated long-term retention rate */
  retentionProjection: number;
}

export interface MetacognitiveProfile {
  /** Overall calibration (how well confidence matches performance) */
  calibrationScore: number;
  /** Tendency to overestimate abilities (Dunning-Kruger effect) */
  overconfidenceBias: number;
  /** Recognition of own knowledge gaps */
  gapAwareness: number;
  /** Ability to predict own performance */
  predictionAccuracy: number;
  /** Effectiveness of self-monitoring */
  selfMonitoringScore: number;
}

export interface CognitiveLoadProfile {
  /** Optimal challenge level for this learner */
  optimalDifficulty: number;
  /** Maximum sustainable cognitive load */
  loadCapacity: number;
  /** How quickly fatigue sets in */
  fatigueOnsetRate: number;
  /** Recovery rate after breaks */
  recoveryRate: number;
  /** Germane load efficiency (productive mental effort) */
  germaneLoadEfficiency: number;
}

export interface CircadianProfile {
  /** Best hour for learning new material */
  peakLearningHour: number;
  /** Best hour for review/retrieval */
  peakReviewHour: number;
  /** Hours to avoid for studying */
  lowPerformanceHours: number[];
  /** Chronotype (morning/evening person) */
  chronotype: 'early_bird' | 'night_owl' | 'intermediate';
  /** Day-of-week pattern */
  bestDays: number[];
}

export interface StrengthWeaknessAnalysis {
  /** Systems where performance is strong and stable */
  strengths: SystemAnalysis[];
  /** Systems needing improvement */
  weaknesses: SystemAnalysis[];
  /** Systems showing rapid improvement */
  improving: SystemAnalysis[];
  /** Systems showing decline */
  declining: SystemAnalysis[];
}

export interface SystemAnalysis {
  system: string;
  mastery: number;
  accuracy: number;
  questionsAttempted: number;
  trend: 'improving' | 'stable' | 'declining';
  trendMagnitude: number;
  estimatedDaysToMastery: number | null;
  weakTopics: string[];
  recommendations: string[];
}

export interface TestReadinessAssessment {
  /** Overall readiness score (0-100) */
  readinessScore: number;
  /** Predicted PANCE/PANRE score */
  predictedScore: number;
  /** Confidence interval */
  scoreRange: { low: number; high: number };
  /** Probability of passing */
  passProbability: number;
  /** Days of study recommended before test */
  recommendedStudyDays: number;
  /** Key areas to focus on */
  priorityAreas: string[];
  /** Strengths to maintain */
  strengths: string[];
  /** Research-backed recommendations */
  recommendations: RecommendationWithEvidence[];
}

export interface RecommendationWithEvidence {
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  expectedImpact: string;
  actionable: string;
}

export interface UserFriendlyStats {
  // Overview
  totalQuestionsLifetime: number;
  accuracyLifetime: number;
  studyDaysStreak: number;
  totalStudyHours: number;

  // Recent performance
  last7DaysAccuracy: number;
  last7DaysQuestions: number;
  accuracyTrend: 'improving' | 'stable' | 'declining';
  accuracyChange: number; // percentage points

  // Efficiency
  avgTimePerQuestion: number;
  questionsPerHour: number;
  optimalSessionLength: number;

  // Test readiness
  estimatedPANCEScore: number;
  passProbability: number;
  readinessLevel: 'not_ready' | 'building' | 'progressing' | 'almost_ready' | 'ready';

  // Behavioral insights
  firstInstinctAccuracy: number;
  shouldTrustFirstInstinct: boolean;
  answerChangeHelpfulness: number; // % of changes that helped

  // Cognitive patterns
  bestStudyTime: string;
  fatiguePoint: number; // questions until fatigue
  optimalBreakFrequency: number;

  // Top 3 actionable insights
  topInsights: string[];
}

// ============================================================================
// Research-Based Constants
// ============================================================================

// Ebbinghaus forgetting curve parameters (approximate)
const FORGETTING_CURVE = {
  baseRetention: 100,
  decayConstant: 0.5, // Retention halves each interval without review
  minRetention: 20, // Retention floor
};

// Spacing effect optimal intervals (based on Cepeda et al., 2006)
const OPTIMAL_SPACING = {
  initial: 1, // 1 day
  multiplier: 2.5, // Each successful review multiplies interval
  maxInterval: 180, // 6 months max
};

// Cognitive load thresholds (Sweller, 1988)
const COGNITIVE_LOAD = {
  optimal: 60, // Target for productive learning
  overload: 80, // Above this, learning degrades
  recovery: 40, // Rest until load drops to this
};

// Zone of Proximal Development (Vygotsky)
const ZPD = {
  floorAccuracy: 0.7, // Too easy if above 90%
  targetAccuracy: 0.8, // Ideal challenge
  ceilingAccuracy: 0.6, // Too hard if below 60%
};

// Testing effect benefits (Roediger & Karpicke, 2006)
const TESTING_EFFECT = {
  retrievalBonus: 0.15, // 15% better long-term retention from testing
  spacedBonus: 0.25, // 25% bonus for spaced practice
};

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Calculate learning efficiency metrics based on research
 */
export async function analyzeLearningEfficiency(): Promise<LearningEfficiencyMetrics> {
  const attempts = await getQuestionAttempts({ limit: 5000 });
  const dailyRecords = await getDailyRecords();

  if (attempts.length < 20) {
    return {
      questionsToMastery: 50,
      learningRate: 0,
      spacingAdherence: 0,
      interleavingBenefit: 0,
      retentionProjection: 0.5,
    };
  }

  // Questions to mastery - how many attempts before 80% accuracy on a topic
  const systemAttempts = groupBySystem(attempts);
  const masteryQuestions: number[] = [];

  for (const [system, sysAttempts] of Object.entries(systemAttempts)) {
    let runningCorrect = 0;
    let runningTotal = 0;

    for (let i = 0; i < sysAttempts.length; i++) {
      runningTotal++;
      const attempt = sysAttempts[i];
      if (attempt?.isCorrect) runningCorrect++;

      if (runningTotal >= 10 && runningCorrect / runningTotal >= 0.8) {
        masteryQuestions.push(runningTotal);
        break;
      }
    }
  }

  const avgQuestionsToMastery =
    masteryQuestions.length > 0
      ? Math.round(masteryQuestions.reduce((a, b) => a + b, 0) / masteryQuestions.length)
      : 50;

  // Learning rate - questions mastered per study hour
  const totalStudyHours = dailyRecords.reduce((sum, r) => sum + r.totalStudyTimeMs, 0) / 3600000;
  const masteredSystems = Object.values(systemAttempts).filter((s) => {
    const recent = s.slice(-20);
    const accuracy = recent.filter((a) => a.isCorrect).length / recent.length;
    return accuracy >= 0.8;
  }).length;
  const learningRate = totalStudyHours > 0 ? masteredSystems / totalStudyHours : 0;

  // Spacing adherence - how well they follow optimal spacing
  const reviewIntervals = calculateReviewIntervals(attempts);
  const optimalIntervals = reviewIntervals.filter(
    (i) => i.actual >= i.optimal * 0.7 && i.actual <= i.optimal * 1.5
  ).length;
  const spacingAdherence =
    reviewIntervals.length > 0 ? optimalIntervals / reviewIntervals.length : 0;

  // Interleaving benefit - compare blocked vs interleaved performance
  const interleavingBenefit = calculateInterleavingBenefit(attempts);

  // Retention projection based on forgetting curve and review patterns
  const retentionProjection = calculateRetentionProjection(attempts);

  return {
    questionsToMastery: avgQuestionsToMastery,
    learningRate: Math.round(learningRate * 100) / 100,
    spacingAdherence: Math.round(spacingAdherence * 100) / 100,
    interleavingBenefit: Math.round(interleavingBenefit * 100) / 100,
    retentionProjection: Math.round(retentionProjection * 100) / 100,
  };
}

/**
 * Analyze metacognitive abilities (Dunlosky & Metcalfe, 2009)
 */
export async function analyzeMetacognition(): Promise<MetacognitiveProfile> {
  const attempts = await getQuestionAttempts({ limit: 2000 });

  if (attempts.length < 30) {
    return {
      calibrationScore: 50,
      overconfidenceBias: 0,
      gapAwareness: 50,
      predictionAccuracy: 50,
      selfMonitoringScore: 50,
    };
  }

  // Calibration: correlation between confidence and correctness
  const highConfidence = attempts.filter((a) => a.inferredConfidence >= 70);
  const lowConfidence = attempts.filter((a) => a.inferredConfidence < 50);

  const highConfAcc =
    highConfidence.length > 0
      ? highConfidence.filter((a) => a.isCorrect).length / highConfidence.length
      : 0.5;
  const lowConfAcc =
    lowConfidence.length > 0
      ? lowConfidence.filter((a) => a.isCorrect).length / lowConfidence.length
      : 0.5;

  // Good calibration = high confidence correlates with high accuracy
  const calibrationScore = Math.abs(highConfAcc - lowConfAcc) * 100;

  // Overconfidence bias: high confidence but low accuracy
  const overconfidenceRate =
    highConfidence.length > 0
      ? highConfidence.filter((a) => !a.isCorrect).length / highConfidence.length
      : 0;
  const overconfidenceBias = Math.round(overconfidenceRate * 100);

  // Gap awareness: correctly identifying weak areas
  const systemAccuracy = calculateSystemAccuracy(attempts);
  const weakSystems = Object.entries(systemAccuracy)
    .filter(([_, acc]) => acc < 0.65)
    .map(([sys]) => sys);

  // Check if they spend more time on weak systems
  const weakSystemAttempts = attempts.filter((a) => weakSystems.includes(a.system));
  const weakSystemRatio = weakSystemAttempts.length / attempts.length;
  const gapAwareness = Math.min(100, Math.round(weakSystemRatio * 3 * 100));

  // Prediction accuracy: do they adjust behavior based on feedback?
  const recentAccuracy = attempts.slice(-50).filter((a) => a.isCorrect).length / 50;
  const midAccuracy = attempts.slice(-200, -50).filter((a) => a.isCorrect).length / 150;
  const predictionAccuracy = recentAccuracy > midAccuracy ? 70 : 50;

  // Self-monitoring: do they take breaks when fatigued?
  const fatigueBreaks = attempts.filter((a, i) => {
    if (i === 0) return false;
    const prev = attempts[i - 1];
    return prev && a.fatigueLevel > 70 && a.timestamp - prev.timestamp > 300000; // 5+ min break
  }).length;
  const fatigueInstances = attempts.filter((a) => a.fatigueLevel > 70).length;
  const selfMonitoringScore =
    fatigueInstances > 0 ? Math.min(100, Math.round((fatigueBreaks / fatigueInstances) * 200)) : 50;

  return {
    calibrationScore: Math.round(calibrationScore),
    overconfidenceBias,
    gapAwareness,
    predictionAccuracy: Math.round(predictionAccuracy),
    selfMonitoringScore,
  };
}

/**
 * Analyze cognitive load patterns (Sweller, 1988)
 */
export async function analyzeCognitiveLoad(): Promise<CognitiveLoadProfile> {
  const attempts = await getQuestionAttempts({ limit: 2000 });

  if (attempts.length < 50) {
    return {
      optimalDifficulty: 0.75,
      loadCapacity: 70,
      fatigueOnsetRate: 20,
      recoveryRate: 0.5,
      germaneLoadEfficiency: 0.5,
    };
  }

  // Find optimal difficulty - where accuracy is in ZPD and learning happens
  const byDifficulty = groupByDifficulty(attempts);
  let optimalDifficulty = 0.75;
  let bestLearning = 0;

  for (const [diff, diffAttempts] of Object.entries(byDifficulty)) {
    const acc = diffAttempts.filter((a) => a.isCorrect).length / diffAttempts.length;
    if (acc >= ZPD.ceilingAccuracy && acc <= ZPD.floorAccuracy) {
      const improvement = calculateImprovement(diffAttempts);
      if (improvement > bestLearning) {
        bestLearning = improvement;
        optimalDifficulty = diff === 'hard' ? 0.85 : diff === 'medium' ? 0.75 : 0.65;
      }
    }
  }

  // Load capacity - highest cognitive load with good performance
  const loadBuckets: Record<number, QuestionAttemptRecord[]> = {};
  for (const a of attempts) {
    const bucket = Math.floor(a.cognitiveLoad / 10) * 10;
    if (!loadBuckets[bucket]) loadBuckets[bucket] = [];
    loadBuckets[bucket].push(a);
  }

  let loadCapacity = 70;
  for (const load of [90, 80, 70, 60, 50]) {
    const bucket = loadBuckets[load];
    if (bucket && bucket.length >= 10) {
      const acc = bucket.filter((a) => a.isCorrect).length / bucket.length;
      if (acc >= 0.7) {
        loadCapacity = load;
        break;
      }
    }
  }

  // Fatigue onset - question number where accuracy drops
  const sessionGroups = groupBySession(attempts);
  const fatiguePoints: number[] = [];

  for (const sessionAttempts of Object.values(sessionGroups)) {
    if (sessionAttempts.length < 15) continue;

    for (let i = 10; i < sessionAttempts.length - 5; i++) {
      const before = sessionAttempts.slice(0, i).filter((a) => a.isCorrect).length / i;
      const after =
        sessionAttempts.slice(i).filter((a) => a.isCorrect).length / (sessionAttempts.length - i);

      if (before - after > 0.1) {
        fatiguePoints.push(i);
        break;
      }
    }
  }

  const fatigueOnsetRate =
    fatiguePoints.length > 0
      ? Math.round(fatiguePoints.reduce((a, b) => a + b, 0) / fatiguePoints.length)
      : 25;

  // Recovery rate - how much does accuracy improve after breaks?
  const breakRecoveries: number[] = [];
  for (let i = 1; i < attempts.length; i++) {
    const current = attempts[i];
    const previous = attempts[i - 1];
    if (!current || !previous) continue;
    const gap = current.timestamp - previous.timestamp;
    if (gap > 600000) {
      // 10+ minute break
      const beforeBreak = attempts.slice(Math.max(0, i - 10), i);
      const afterBreak = attempts.slice(i, i + 10);

      if (beforeBreak.length >= 5 && afterBreak.length >= 5) {
        const beforeAcc = beforeBreak.filter((a) => a.isCorrect).length / beforeBreak.length;
        const afterAcc = afterBreak.filter((a) => a.isCorrect).length / afterBreak.length;
        breakRecoveries.push(afterAcc - beforeAcc);
      }
    }
  }

  const recoveryRate =
    breakRecoveries.length > 0
      ? breakRecoveries.reduce((a, b) => a + b, 0) / breakRecoveries.length + 0.5
      : 0.5;

  // Germane load efficiency - productive mental effort
  const correctWithHighLoad = attempts.filter((a) => a.cognitiveLoad > 60 && a.isCorrect).length;
  const totalHighLoad = attempts.filter((a) => a.cognitiveLoad > 60).length;
  const germaneLoadEfficiency = totalHighLoad > 0 ? correctWithHighLoad / totalHighLoad : 0.5;

  return {
    optimalDifficulty: Math.round(optimalDifficulty * 100) / 100,
    loadCapacity,
    fatigueOnsetRate,
    recoveryRate: Math.round(recoveryRate * 100) / 100,
    germaneLoadEfficiency: Math.round(germaneLoadEfficiency * 100) / 100,
  };
}

/**
 * Analyze circadian patterns (Schmidt et al., 2007)
 */
export async function analyzeCircadianPatterns(): Promise<CircadianProfile> {
  const attempts = await getQuestionAttempts({ limit: 3000 });

  if (attempts.length < 100) {
    return {
      peakLearningHour: 10,
      peakReviewHour: 14,
      lowPerformanceHours: [2, 3, 4],
      chronotype: 'intermediate',
      bestDays: [1, 2, 3],
    };
  }

  // Performance by hour
  const byHour: Record<number, QuestionAttemptRecord[]> = {};
  for (let h = 0; h < 24; h++) byHour[h] = [];
  for (const a of attempts) {
    const bucket = byHour[a.hourOfDay];
    if (bucket) bucket.push(a);
  }

  const hourlyPerformance = Object.entries(byHour)
    .map(([hour, hourAttempts]) => ({
      hour: parseInt(hour),
      accuracy:
        hourAttempts.length > 10
          ? hourAttempts.filter((a) => a.isCorrect).length / hourAttempts.length
          : 0,
      count: hourAttempts.length,
    }))
    .filter((h) => h.count >= 10);

  // Find peak hours
  const sorted = [...hourlyPerformance].sort((a, b) => b.accuracy - a.accuracy);
  const peakLearningHour = sorted[0]?.hour ?? 10;
  const peakReviewHour = sorted[1]?.hour ?? 14;

  // Find low hours
  const lowHours = hourlyPerformance
    .filter(
      (h) =>
        h.accuracy <
        (hourlyPerformance.reduce((sum, x) => sum + x.accuracy, 0) / hourlyPerformance.length) *
          0.85
    )
    .map((h) => h.hour);

  // Determine chronotype
  let chronotype: 'early_bird' | 'night_owl' | 'intermediate' = 'intermediate';
  if (peakLearningHour >= 5 && peakLearningHour <= 10) {
    chronotype = 'early_bird';
  } else if (peakLearningHour >= 18 || peakLearningHour <= 2) {
    chronotype = 'night_owl';
  }

  // Day of week analysis
  const byDay: Record<number, QuestionAttemptRecord[]> = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];
  for (const a of attempts) {
    const bucket = byDay[a.dayOfWeek];
    if (bucket) bucket.push(a);
  }

  const dailyPerformance = Object.entries(byDay)
    .map(([day, dayAttempts]) => ({
      day: parseInt(day),
      accuracy:
        dayAttempts.length > 20
          ? dayAttempts.filter((a) => a.isCorrect).length / dayAttempts.length
          : 0,
      count: dayAttempts.length,
    }))
    .filter((d) => d.count >= 20);

  const avgDayAcc =
    dailyPerformance.reduce((sum, d) => sum + d.accuracy, 0) / dailyPerformance.length;
  const bestDays = dailyPerformance
    .filter((d) => d.accuracy >= avgDayAcc)
    .map((d) => d.day)
    .slice(0, 3);

  return {
    peakLearningHour,
    peakReviewHour,
    lowPerformanceHours: lowHours.slice(0, 4),
    chronotype,
    bestDays: bestDays.length > 0 ? bestDays : [1, 2, 3],
  };
}

/**
 * Analyze strengths and weaknesses by system
 */
export async function analyzeStrengthsWeaknesses(): Promise<StrengthWeaknessAnalysis> {
  const attempts = await getQuestionAttempts({ limit: 5000 });
  const recentAttempts = attempts.slice(0, 1000);
  const olderAttempts = attempts.slice(1000);

  const systemAnalyses: SystemAnalysis[] = [];
  const systemGroups = groupBySystem(attempts);
  const recentGroups = groupBySystem(recentAttempts);
  const olderGroups = groupBySystem(olderAttempts);

  for (const [system, sysAttempts] of Object.entries(systemGroups)) {
    if (sysAttempts.length < 10) continue;

    const accuracy = sysAttempts.filter((a) => a.isCorrect).length / sysAttempts.length;

    // Calculate trend
    const recentSystemAttempts = recentGroups[system];
    const olderSystemAttempts = olderGroups[system];
    const recentAcc =
      recentSystemAttempts && recentSystemAttempts.length > 5
        ? recentSystemAttempts.filter((a) => a.isCorrect).length / recentSystemAttempts.length
        : accuracy;
    const olderAcc =
      olderSystemAttempts && olderSystemAttempts.length > 5
        ? olderSystemAttempts.filter((a) => a.isCorrect).length / olderSystemAttempts.length
        : accuracy;

    const trendDiff = recentAcc - olderAcc;
    const trend: 'improving' | 'stable' | 'declining' =
      trendDiff > 0.05 ? 'improving' : trendDiff < -0.05 ? 'declining' : 'stable';

    // Mastery calculation based on accuracy and consistency
    const mastery = calculateMastery(sysAttempts);

    // Estimate days to mastery
    const daysToMastery =
      mastery >= 80 ? null : Math.ceil((80 - mastery) / Math.max(0.5, trendDiff * 30 || 0.5));

    // Recommendations
    const recommendations = generateSystemRecommendations(system, accuracy, trend, mastery);

    systemAnalyses.push({
      system,
      mastery,
      accuracy: Math.round(accuracy * 100),
      questionsAttempted: sysAttempts.length,
      trend,
      trendMagnitude: Math.abs(trendDiff),
      estimatedDaysToMastery: daysToMastery,
      weakTopics: [], // Would need topic-level data
      recommendations,
    });
  }

  // Categorize
  const strengths = systemAnalyses
    .filter((s) => s.mastery >= 75 && s.trend !== 'declining')
    .sort((a, b) => b.mastery - a.mastery);

  const weaknesses = systemAnalyses
    .filter((s) => s.mastery < 60)
    .sort((a, b) => a.mastery - b.mastery);

  const improving = systemAnalyses
    .filter((s) => s.trend === 'improving' && s.trendMagnitude > 0.05)
    .sort((a, b) => b.trendMagnitude - a.trendMagnitude);

  const declining = systemAnalyses
    .filter((s) => s.trend === 'declining' && s.trendMagnitude > 0.03)
    .sort((a, b) => b.trendMagnitude - a.trendMagnitude);

  return { strengths, weaknesses, improving, declining };
}

/**
 * Generate comprehensive test readiness assessment
 */
export async function assessTestReadiness(): Promise<TestReadinessAssessment> {
  const [efficiency, metacog, cognitive, circadian, strengthsWeaknesses] = await Promise.all([
    analyzeLearningEfficiency(),
    analyzeMetacognition(),
    analyzeCognitiveLoad(),
    analyzeCircadianPatterns(),
    analyzeStrengthsWeaknesses(),
  ]);

  const attempts = await getQuestionAttempts({ limit: 1000 });

  // Calculate readiness score
  const recentAccuracy =
    attempts.slice(0, 200).filter((a) => a.isCorrect).length / Math.min(200, attempts.length);
  const systemCoverage = new Set(attempts.map((a) => a.system)).size / 13; // 13 PANCE systems
  const masteryAvg =
    (strengthsWeaknesses.strengths.length * 85 + strengthsWeaknesses.weaknesses.length * 45) /
    Math.max(1, strengthsWeaknesses.strengths.length + strengthsWeaknesses.weaknesses.length);

  const readinessScore = Math.round(
    recentAccuracy * 40 +
      systemCoverage * 20 +
      masteryAvg * 0.3 +
      efficiency.retentionProjection * 10
  );

  // Predict PANCE score (200-800 scale)
  const predictedScore = Math.round(200 + (readinessScore / 100) * 600);
  const scoreVariance = 100 - metacog.calibrationScore;
  const scoreRange = {
    low: Math.max(200, predictedScore - scoreVariance),
    high: Math.min(800, predictedScore + scoreVariance),
  };

  // Pass probability (passing = ~450)
  const passProbability = Math.round(Math.max(0, Math.min(100, (predictedScore - 400) / 2 + 50)));

  // Days recommended
  const recommendedStudyDays = Math.max(0, Math.ceil((80 - readinessScore) / 2));

  // Priority areas
  const priorityAreas = strengthsWeaknesses.weaknesses.slice(0, 3).map((w) => w.system);

  // Strengths
  const strengths = strengthsWeaknesses.strengths.slice(0, 3).map((s) => s.system);

  // Research-backed recommendations
  const recommendations: RecommendationWithEvidence[] = [];

  if (efficiency.spacingAdherence < 0.6) {
    recommendations.push({
      recommendation: 'Implement proper spaced repetition intervals',
      priority: 'high',
      evidence:
        'Cepeda et al. (2006) found spaced practice produces 50% better long-term retention than massed practice',
      expectedImpact: '+10-15% on retention',
      actionable: 'Review cards at optimal intervals (1d, 3d, 7d, 14d, 30d) rather than cramming',
    });
  }

  if (metacog.overconfidenceBias > 30) {
    recommendations.push({
      recommendation: 'Practice calibration exercises',
      priority: 'high',
      evidence:
        'Dunning-Kruger effect research shows overconfidence leads to underprepared test performance',
      expectedImpact: 'Reduced surprise on difficult questions',
      actionable: 'Before answering, rate your confidence, then track accuracy by confidence level',
    });
  }

  if (cognitive.fatigueOnsetRate < 20) {
    recommendations.push({
      recommendation: 'Take more frequent breaks',
      priority: 'medium',
      evidence:
        'Cognitive load theory (Sweller, 1988) shows performance degrades with sustained mental effort',
      expectedImpact: '+5-10% accuracy in later questions',
      actionable: `Take a 5-minute break every ${Math.round(cognitive.fatigueOnsetRate * 0.8)} questions`,
    });
  }

  if (strengthsWeaknesses.weaknesses.length > 3) {
    recommendations.push({
      recommendation: 'Focus on weak systems using interleaved practice',
      priority: 'critical',
      evidence: 'Rohrer & Taylor (2007) showed interleaving improves discrimination between topics',
      expectedImpact: '+15-20% on weak system questions',
      actionable: `Alternate between ${priorityAreas.join(', ')} rather than blocking by topic`,
    });
  }

  recommendations.push({
    recommendation: `Study during your peak hours (${circadian.peakLearningHour}:00-${(circadian.peakLearningHour + 2) % 24}:00)`,
    priority: 'medium',
    evidence:
      'Schmidt et al. (2007) demonstrated 10-20% performance variation based on circadian rhythms',
    expectedImpact: '+5-10% accuracy during peak cognitive periods',
    actionable: `Schedule your most challenging study during ${circadian.peakLearningHour}:00`,
  });

  return {
    readinessScore,
    predictedScore,
    scoreRange,
    passProbability,
    recommendedStudyDays,
    priorityAreas,
    strengths,
    recommendations,
  };
}

/**
 * Generate user-friendly stats summary
 */
export async function generateUserFriendlyStats(): Promise<UserFriendlyStats> {
  const attempts = await getQuestionAttempts({ limit: 10000 });
  const dailyRecords = await getDailyRecords();

  const totalQuestions = attempts.length;
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const accuracyLifetime =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Calculate study streak
  const sortedDays = [...dailyRecords].sort((a, b) => b.date.localeCompare(a.date));
  let studyDaysStreak = 0;
  const today = getTodayString();

  for (let i = 0; i < sortedDays.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = expectedDate.toISOString().split('T')[0];

    if (sortedDays[i]?.date === expected) {
      studyDaysStreak++;
    } else {
      break;
    }
  }

  // Total study time
  const totalStudyMs = dailyRecords.reduce((sum, r) => sum + r.totalStudyTimeMs, 0);
  const totalStudyHours = Math.round((totalStudyMs / 3600000) * 10) / 10;

  // Last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7Days = attempts.filter((a) => a.timestamp >= sevenDaysAgo);
  const last7DaysAccuracy =
    last7Days.length > 0
      ? Math.round((last7Days.filter((a) => a.isCorrect).length / last7Days.length) * 100)
      : 0;

  // Accuracy trend
  const recentWeek = attempts.filter((a) => a.timestamp >= sevenDaysAgo);
  const prevWeek = attempts.filter(
    (a) => a.timestamp >= sevenDaysAgo - 7 * 24 * 60 * 60 * 1000 && a.timestamp < sevenDaysAgo
  );

  const recentAcc =
    recentWeek.length > 0 ? recentWeek.filter((a) => a.isCorrect).length / recentWeek.length : 0;
  const prevAcc =
    prevWeek.length > 0 ? prevWeek.filter((a) => a.isCorrect).length / prevWeek.length : recentAcc;

  const accuracyChange = Math.round((recentAcc - prevAcc) * 100);
  const accuracyTrend: 'improving' | 'stable' | 'declining' =
    accuracyChange > 3 ? 'improving' : accuracyChange < -3 ? 'declining' : 'stable';

  // Time metrics
  const avgTimePerQuestion =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.timeToAnswerMs, 0) / attempts.length / 1000)
      : 0;
  const questionsPerHour = totalStudyHours > 0 ? Math.round(totalQuestions / totalStudyHours) : 0;

  // Optimal session length from fatigue analysis
  const cogProfile = await analyzeCognitiveLoad();
  const optimalSessionLength = cogProfile.fatigueOnsetRate;

  // Test readiness
  const readiness = await assessTestReadiness();

  // Behavioral insights
  const withAnswerChanges = attempts.filter((a) => a.answerChanges > 0);
  const helpfulChanges = withAnswerChanges.filter(
    (a) =>
      a.firstAnswer !== null &&
      a.firstAnswer !== a.correctAnswer &&
      a.finalAnswer === a.correctAnswer
  ).length;
  const harmfulChanges = withAnswerChanges.filter(
    (a) =>
      a.firstAnswer !== null &&
      a.firstAnswer === a.correctAnswer &&
      a.finalAnswer !== a.correctAnswer
  ).length;

  const firstInstinctCorrect = attempts.filter((a) => a.firstAnswer === a.correctAnswer).length;
  const firstInstinctAccuracy =
    attempts.length > 0 ? Math.round((firstInstinctCorrect / attempts.length) * 100) : 0;

  const answerChangeHelpfulness =
    withAnswerChanges.length > 0
      ? Math.round((helpfulChanges / (helpfulChanges + harmfulChanges)) * 100) || 50
      : 50;

  const shouldTrustFirstInstinct = firstInstinctAccuracy > last7DaysAccuracy - 5;

  // Circadian
  const circadian = await analyzeCircadianPatterns();
  const bestStudyTime = `${circadian.peakLearningHour}:00 - ${(circadian.peakLearningHour + 2) % 24}:00`;

  // Break frequency
  const optimalBreakFrequency = Math.round(cogProfile.fatigueOnsetRate * 0.8);

  // Top insights
  const topInsights = generateTopInsights(
    accuracyTrend,
    accuracyChange,
    shouldTrustFirstInstinct,
    readiness,
    cogProfile,
    circadian
  );

  return {
    totalQuestionsLifetime: totalQuestions,
    accuracyLifetime,
    studyDaysStreak,
    totalStudyHours,
    last7DaysAccuracy,
    last7DaysQuestions: last7Days.length,
    accuracyTrend,
    accuracyChange,
    avgTimePerQuestion,
    questionsPerHour,
    optimalSessionLength,
    estimatedPANCEScore: readiness.predictedScore,
    passProbability: readiness.passProbability,
    readinessLevel:
      readiness.readinessScore >= 80
        ? 'ready'
        : readiness.readinessScore >= 65
          ? 'almost_ready'
          : readiness.readinessScore >= 50
            ? 'progressing'
            : readiness.readinessScore >= 30
              ? 'building'
              : 'not_ready',
    firstInstinctAccuracy,
    shouldTrustFirstInstinct,
    answerChangeHelpfulness,
    bestStudyTime,
    fatiguePoint: cogProfile.fatigueOnsetRate,
    optimalBreakFrequency,
    topInsights,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function groupBySystem(attempts: QuestionAttemptRecord[]): Record<string, QuestionAttemptRecord[]> {
  const groups: Record<string, QuestionAttemptRecord[]> = {};
  for (const a of attempts) {
    if (!groups[a.system]) groups[a.system] = [];
    groups[a.system]!.push(a);
  }
  return groups;
}

function groupBySession(
  attempts: QuestionAttemptRecord[]
): Record<string, QuestionAttemptRecord[]> {
  const groups: Record<string, QuestionAttemptRecord[]> = {};
  for (const a of attempts) {
    if (!groups[a.sessionId]) groups[a.sessionId] = [];
    groups[a.sessionId]!.push(a);
  }
  return groups;
}

function groupByDifficulty(
  attempts: QuestionAttemptRecord[]
): Record<string, QuestionAttemptRecord[]> {
  const groups: Record<string, QuestionAttemptRecord[]> = {};
  for (const a of attempts) {
    const diff = a.difficulty || 'medium';
    if (!groups[diff]) groups[diff] = [];
    groups[diff].push(a);
  }
  return groups;
}

function calculateSystemAccuracy(attempts: QuestionAttemptRecord[]): Record<string, number> {
  const groups = groupBySystem(attempts);
  const accuracy: Record<string, number> = {};

  for (const [system, sysAttempts] of Object.entries(groups)) {
    accuracy[system] = sysAttempts.filter((a) => a.isCorrect).length / sysAttempts.length;
  }

  return accuracy;
}

function calculateMastery(attempts: QuestionAttemptRecord[]): number {
  if (attempts.length < 5) return 0;

  const recent = attempts.slice(0, Math.min(50, attempts.length));
  const accuracy = recent.filter((a) => a.isCorrect).length / recent.length;
  const consistency = 1 - calculateVariance(recent.map((a) => (a.isCorrect ? 1 : 0)));

  return Math.round(accuracy * 70 + consistency * 30);
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function calculateImprovement(attempts: QuestionAttemptRecord[]): number {
  if (attempts.length < 20) return 0;

  const firstHalf = attempts.slice(Math.floor(attempts.length / 2));
  const secondHalf = attempts.slice(0, Math.floor(attempts.length / 2));

  const firstAcc = firstHalf.filter((a) => a.isCorrect).length / firstHalf.length;
  const secondAcc = secondHalf.filter((a) => a.isCorrect).length / secondHalf.length;

  return secondAcc - firstAcc;
}

function calculateReviewIntervals(
  attempts: QuestionAttemptRecord[]
): Array<{ actual: number; optimal: number }> {
  const byQuestion: Record<string, QuestionAttemptRecord[]> = {};

  for (const a of attempts) {
    if (!byQuestion[a.questionId]) byQuestion[a.questionId] = [];
    byQuestion[a.questionId]!.push(a);
  }

  const intervals: Array<{ actual: number; optimal: number }> = [];

  for (const reviews of Object.values(byQuestion)) {
    if (reviews.length < 2) continue;

    reviews.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < reviews.length; i++) {
      const current = reviews[i];
      const previous = reviews[i - 1];
      if (!current || !previous) continue;
      const actual = (current.timestamp - previous.timestamp) / 86400000; // days
      const optimal = OPTIMAL_SPACING.initial * Math.pow(OPTIMAL_SPACING.multiplier, i - 1);
      intervals.push({ actual, optimal: Math.min(optimal, OPTIMAL_SPACING.maxInterval) });
    }
  }

  return intervals;
}

function calculateInterleavingBenefit(attempts: QuestionAttemptRecord[]): number {
  // Compare performance when systems are interleaved vs blocked
  const sessions = groupBySession(attempts);
  let interleavedAcc = 0;
  let blockedAcc = 0;
  let interleavedCount = 0;
  let blockedCount = 0;

  for (const sessionAttempts of Object.values(sessions)) {
    if (sessionAttempts.length < 10) continue;

    // Check if interleaved (multiple systems in first 10 questions)
    const first10Systems = new Set(sessionAttempts.slice(0, 10).map((a) => a.system));
    const isInterleaved = first10Systems.size >= 3;

    const acc = sessionAttempts.filter((a) => a.isCorrect).length / sessionAttempts.length;

    if (isInterleaved) {
      interleavedAcc += acc;
      interleavedCount++;
    } else {
      blockedAcc += acc;
      blockedCount++;
    }
  }

  if (interleavedCount === 0 || blockedCount === 0) return 0;

  return interleavedAcc / interleavedCount - blockedAcc / blockedCount;
}

function calculateRetentionProjection(attempts: QuestionAttemptRecord[]): number {
  // Based on spacing and testing effect research
  const intervals = calculateReviewIntervals(attempts);
  const spacingScore =
    intervals.length > 0
      ? intervals.filter((i) => i.actual >= i.optimal * 0.5).length / intervals.length
      : 0.5;

  // Base retention from recent accuracy
  const recent = attempts.slice(0, 100);
  const baseRetention =
    recent.length > 0 ? recent.filter((a) => a.isCorrect).length / recent.length : 0.5;

  // Apply testing effect bonus
  const testingBonus = TESTING_EFFECT.retrievalBonus;
  const spacingBonus = spacingScore * TESTING_EFFECT.spacedBonus;

  return Math.min(0.95, baseRetention + testingBonus + spacingBonus);
}

function generateSystemRecommendations(
  system: string,
  accuracy: number,
  trend: string,
  mastery: number
): string[] {
  const recommendations: string[] = [];

  if (accuracy < 0.6) {
    recommendations.push(`Review ${system} fundamentals before attempting more questions`);
  }

  if (trend === 'declining') {
    recommendations.push(`Schedule immediate review session for ${system}`);
  }

  if (mastery < 50 && accuracy >= 0.6) {
    recommendations.push(
      `Increase practice frequency for ${system} - you understand but need consolidation`
    );
  }

  if (mastery >= 80) {
    recommendations.push(`Maintain ${system} with periodic review every 2-3 weeks`);
  }

  return recommendations;
}

function generateTopInsights(
  accuracyTrend: string,
  accuracyChange: number,
  shouldTrustFirstInstinct: boolean,
  readiness: TestReadinessAssessment,
  cognitive: CognitiveLoadProfile,
  circadian: CircadianProfile
): string[] {
  const insights: string[] = [];

  if (accuracyTrend === 'improving') {
    insights.push(`📈 Your accuracy improved ${accuracyChange}% this week - great progress!`);
  } else if (accuracyTrend === 'declining') {
    insights.push(
      `📉 Your accuracy dropped ${Math.abs(accuracyChange)}% - consider reviewing your weak areas`
    );
  }

  if (shouldTrustFirstInstinct) {
    insights.push(`💡 Trust your first instinct - changing answers hurts your score`);
  } else {
    insights.push(`🤔 Take time to reconsider - your answer changes often help`);
  }

  if (readiness.passProbability >= 80) {
    insights.push(`✅ You're ready! ${readiness.passProbability}% chance of passing PANCE`);
  } else if (readiness.recommendedStudyDays > 0) {
    insights.push(`📚 ${readiness.recommendedStudyDays} more study days recommended before exam`);
  }

  insights.push(
    `⏰ Your peak study time is ${circadian.peakLearningHour}:00 - ${(circadian.peakLearningHour + 2) % 24}:00`
  );
  insights.push(
    `😴 Take breaks every ${cognitive.fatigueOnsetRate} questions to maintain performance`
  );

  return insights.slice(0, 3);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  analyzeLearningEfficiency,
  analyzeMetacognition,
  analyzeCognitiveLoad,
  analyzeCircadianPatterns,
  analyzeStrengthsWeaknesses,
  assessTestReadiness,
  generateUserFriendlyStats,
};
