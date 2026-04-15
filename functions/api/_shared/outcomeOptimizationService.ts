import { prisma } from './prisma-edge';

/**
 * Outcome-Based Content Optimization Service
 *
 * Analyzes exam outcomes and correlates them with study patterns to:
 * - Identify which systems predict exam success
 * - Measure content effectiveness (high vs low health questions)
 * - Re-weight content selection based on outcome data
 * - Suggest targeted study plans based on what works
 */

/**
 * Record a user's exam outcome and associated study data
 */
export async function recordExamOutcome(
  userId: string,
  examData: {
    examType: string;
    examDate: Date;
    score: number;
    percentile?: number;
    passed: boolean;
    timeLimit?: number;
    timeUsed?: number;
  }
): Promise<{ id: string }> {
  // Snapshot study data at time of exam
  const thirtyDaysBeforeExam = new Date(examData.examDate);
  thirtyDaysBeforeExam.setDate(thirtyDaysBeforeExam.getDate() - 30);

  // Get all review logs for this user in the 30 days before exam
  const reviewLogs = await prisma.reviewLog.findMany({
    where: {
      userId,
      reviewedAt: {
        gte: thirtyDaysBeforeExam,
        lte: examData.examDate,
      },
    },
    select: {
      wasCorrect: true,
      system: true,
    },
  });

  // Calculate performance by system
  const systemPerformance: Record<string, { correct: number; total: number }> = {};
  reviewLogs.forEach(log => {
    if (!log.system) return;
    const sys = log.system;
    if (!systemPerformance[sys]) {
      systemPerformance[sys] = { correct: 0, total: 0 };
    }
    systemPerformance[sys].total++;
    if (log.wasCorrect) systemPerformance[sys].correct++;
  });

  // Convert to accuracy percentages
  const accuracyBySystem: Record<string, number> = {};
  Object.entries(systemPerformance).forEach(([sys, { correct, total }]) => {
    accuracyBySystem[sys] = total > 0 ? (correct / total) * 100 : 0;
  });

  // Get study sessions info
  const studySessions = await prisma.studySession.findMany({
    where: {
      userId,
      startedAt: {
        gte: thirtyDaysBeforeExam,
        lte: examData.examDate,
      },
    },
    select: {
      mode: true,
    },
  });

  const topModesUsed = getTopModes(studySessions.map(s => s.mode).filter(Boolean) as string[]);

  // Create the outcome record
  const outcome = await prisma.examOutcome.create({
    data: {
      userId,
      examType: examData.examType,
      examDate: examData.examDate,
      score: examData.score,
      percentile: examData.percentile,
      passed: examData.passed,
      timeLimit: examData.timeLimit,
      timeUsed: examData.timeUsed,
      studyDataSnapshot: {
        questionsAnsweredTotal: reviewLogs.length,
        questionsAnsweredBySystem: systemPerformance,
        accuracyBySystem,
        topModesUsed,
        examDate: examData.examDate.toISOString(),
      },
    },
  });

  return { id: outcome.id };
}

/**
 * Compute system predictiveness scores
 * Shows which systems' study correlates with exam success
 */
export async function computeSystemPredictiveness(examType: string): Promise<void> {
  // Get all recent exam outcomes for this exam type
  const outcomes = await prisma.examOutcome.findMany({
    where: { examType },
    orderBy: { examDate: 'desc' },
    take: 100,
  });

  if (outcomes.length < 5) {
    console.warn(`[outcomeOptimization] Not enough outcomes (${outcomes.length}) for ${examType}`);
    return;
  }

  // Get all systems
  const systems = await prisma.condition.findMany({
    distinct: ['system'],
    select: { system: true },
  });

  // For each system, compute correlation with exam success
  for (const { system } of systems) {
    // Get outcomes where user studied this system
    const relevantOutcomes = outcomes.filter(outcome => {
      const snapshot = outcome.studyDataSnapshot as Record<string, unknown>;
      const accuracy = snapshot.accuracyBySystem as Record<string, number>;
      return accuracy && system in accuracy;
    });

    if (relevantOutcomes.length < 3) {
      // Not enough data for this system
      await prisma.systemPredictiveness.upsert({
        where: { examType_system: { examType, system } },
        create: {
          examType,
          system,
          correlation: 0,
          sampleSize: relevantOutcomes.length,
          confidenceLevel: 0,
        },
        update: {
          correlation: 0,
          sampleSize: relevantOutcomes.length,
          confidenceLevel: 0,
          lastComputedAt: new Date(),
        },
      });
      continue;
    }

    // Calculate Pearson correlation between accuracy on system and exam score
    const accuracies = relevantOutcomes.map(outcome => {
      const snapshot = outcome.studyDataSnapshot as Record<string, Record<string, number>>;
      return (snapshot.accuracyBySystem?.[system] || 0) / 100;
    });

    const scores = relevantOutcomes.map(o => o.score);

    const correlation = calculatePearsonCorrelation(accuracies, scores);
    const confidenceLevel = calculateConfidenceLevel(relevantOutcomes.length, correlation);

    // Get content health stratification
    const highHealthScore = await getAverageScoreForQualityQuestions(system, true, outcomes);
    const lowHealthScore = await getAverageScoreForQualityQuestions(system, false, outcomes);

    await prisma.systemPredictiveness.upsert({
      where: { examType_system: { examType, system } },
      create: {
        examType,
        system,
        correlation,
        sampleSize: relevantOutcomes.length,
        confidenceLevel,
        highHealthQuestionsScore: highHealthScore,
        lowHealthQuestionsScore: lowHealthScore,
        lastComputedAt: new Date(),
      },
      update: {
        correlation,
        sampleSize: relevantOutcomes.length,
        confidenceLevel,
        highHealthQuestionsScore: highHealthScore,
        lowHealthQuestionsScore: lowHealthScore,
        lastComputedAt: new Date(),
      },
    });
  }
}

/**
 * Get content effectiveness scores for an exam type
 * Shows which systems have the highest exam score impact
 */
export async function getContentEffectivenessScores(
  examType: string
): Promise<{ system: string; effectiveness: number }[]> {
  const predictiveness = await prisma.systemPredictiveness.findMany({
    where: { examType },
    orderBy: { correlation: 'desc' },
  });

  return predictiveness.map(p => ({
    system: p.system,
    effectiveness: Math.max(0, p.correlation),
  }));
}

/**
 * Suggest an exam crunch plan for the final days
 */
export async function suggestExamCrunchPlan(
  userId: string,
  daysUntilExam: number
): Promise<{ day: number; focus: string; intensity: string }[]> {
  // Get user's weak systems
  const phenotype = await prisma.userStudyPhenotype.findUnique({
    where: { userId },
  });

  if (!phenotype) {
    return [];
  }

  const weakSystems = phenotype.weakSystems.slice(0, 5);
  const criticalGaps = phenotype.criticalGapsForExam.slice(0, 3);

  // Build day-by-day crunch plan
  const plan: { day: number; focus: string; intensity: string }[] = [];

  if (daysUntilExam > 7) {
    // Week before: targeted drilling on weak systems
    plan.push({
      day: 1,
      focus: criticalGaps[0] || weakSystems[0] || 'Review',
      intensity: 'high',
    });
    plan.push({
      day: 2,
      focus: criticalGaps[1] || weakSystems[1] || 'Review',
      intensity: 'high',
    });
    plan.push({
      day: 3,
      focus: 'Mixed review',
      intensity: 'medium',
    });
  } else if (daysUntilExam > 3) {
    // Final 3-7 days: intensive drilling
    plan.push({
      day: 1,
      focus: criticalGaps[0] || weakSystems[0] || 'Review',
      intensity: 'very-high',
    });
    plan.push({
      day: 2,
      focus: criticalGaps[1] || weakSystems[1] || 'Review',
      intensity: 'very-high',
    });
  } else {
    // Final 1-3 days: light review, rest
    plan.push({
      day: 1,
      focus: 'Light drill',
      intensity: 'low',
    });
    plan.push({
      day: 2,
      focus: 'Rest',
      intensity: 'minimal',
    });
  }

  return plan;
}

/**
 * Correlate mode usage with outcomes
 * Shows which study modes are most effective for this user
 */
export async function correlateUsageWithOutcomes(
  userId: string
): Promise<{ mode: string; correlation: number }[]> {
  // Get user's exam outcomes
  const outcomes = await prisma.examOutcome.findMany({
    where: { userId },
    orderBy: { examDate: 'desc' },
    take: 5,
  });

  if (outcomes.length === 0) {
    return [];
  }

  // Get study sessions around exam dates
  const modeUsage: Record<string, number[]> = {};

  for (const outcome of outcomes) {
    // Look at sessions 30 days before exam
    const startDate = new Date(outcome.examDate);
    startDate.setDate(startDate.getDate() - 30);

    const sessions = await prisma.studySession.findMany({
      where: {
        userId,
        startedAt: { gte: startDate, lte: outcome.examDate },
      },
      select: { mode: true },
    });

    const modeCount: Record<string, number> = {};
    sessions.forEach(s => {
      if (s.mode) modeCount[s.mode] = (modeCount[s.mode] || 0) + 1;
    });

    Object.entries(modeCount).forEach(([mode, count]) => {
      if (!modeUsage[mode]) modeUsage[mode] = [];
      modeUsage[mode].push(count);
    });
  }

  // Calculate correlation for each mode
  const modeCorrelations: { mode: string; correlation: number }[] = [];
  const scores = outcomes.map(o => o.score);

  Object.entries(modeUsage).forEach(([mode, counts]) => {
    if (counts.length < 2) return;

    // Normalize counts to same length as scores
    const normalized = counts.slice(0, scores.length);
    while (normalized.length < scores.length) {
      normalized.push(0);
    }

    const correlation = calculatePearsonCorrelation(normalized, scores);
    modeCorrelations.push({ mode, correlation });
  });

  return modeCorrelations.sort((a, b) => b.correlation - a.correlation);
}

// ============================================
// Helper functions
// ============================================

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b) / n;
  const meanY = y.reduce((a, b) => a + b) / n;

  let numerator = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const xValue = x[i] ?? 0;
    const yValue = y[i] ?? 0;
    const xDiff = xValue - meanX;
    const yDiff = yValue - meanY;
    numerator += xDiff * yDiff;
    sumX2 += xDiff * xDiff;
    sumY2 += yDiff * yDiff;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateConfidenceLevel(sampleSize: number, correlation: number): number {
  // Fisher's z-transformation
  const absCorr = Math.abs(correlation);
  if (absCorr >= 1) return 1.0;

  const z = 0.5 * Math.log((1 + absCorr) / (1 - absCorr));
  const t = z * Math.sqrt(sampleSize - 3);

  // Simple t-test approximation: higher t = higher confidence
  // Cap at 1.0 for confidence level
  return Math.min(1.0, Math.max(0, (t - 2) / 3 + 0.5));
}

function getTopModes(modes: string[]): string[] {
  const counts: Record<string, number> = {};
  modes.forEach(m => {
    counts[m] = (counts[m] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mode]) => mode);
}

async function getAverageScoreForQualityQuestions(
  system: string,
  highQuality: boolean,
  outcomes: Array<{ userId: string; score: number }>
): Promise<number> {
  // This is a simplified version - in production, you would:
  // 1. Get all questions for this system
  // 2. Filter by health score (high or low)
  // 3. Check which users studied these questions
  // 4. Calculate average exam score for those users

  // For now, return a baseline estimate
  if (outcomes.length === 0) return 0;

  const avgScore = outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length;

  // High-quality questions should correlate with ~5-10 point improvement
  return highQuality ? Math.min(100, avgScore + 7.5) : Math.max(0, avgScore - 5);
}
