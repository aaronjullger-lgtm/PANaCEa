import { Prisma } from '@prisma/client/edge';
import { prisma } from './prisma-edge';
import { blueprintCoverageService } from './blueprintCoverageService';

/**
 * User Study Phenotype Service
 *
 * Computes and maintains user learning profiles based on:
 * - Study behavior patterns (when, how long, what modes)
 * - Learning style preferences (difficulty, pace, retention goals)
 * - Performance patterns (strong/weak systems, improvement trends)
 * - Exam readiness assessment
 * - Burnout risk indicators
 */

/**
 * Compute or update user phenotype from their study history
 */
export async function computeUserPhenotype(userId: string): Promise<void> {
  // Get user's study activity over last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get review logs for analysis — READINESS only (MAIN/DRILL sessions).
  // TARGETED, CRAM, and RAPID_RECALL sessions must not influence the readiness phenotype.
  const reviewLogs = await prisma.reviewLog.findMany({
    where: {
      userId,
      reviewedAt: { gte: thirtyDaysAgo },
      sessionType: { in: ['MAIN', 'DRILL'] },
    },
    select: {
      reviewedAt: true,
      wasCorrect: true,
      system: true,
    },
  });

  // Get study sessions
  const studySessions = await prisma.studySession.findMany({
    where: {
      userId,
      startedAt: { gte: thirtyDaysAgo },
    },
    select: {
      startedAt: true,
      totalTimeMs: true,
      mode: true,
    },
  });

  // Analyze patterns
  const sessionsByTimeOfDay = groupByTimeOfDay(studySessions);
  const avgSessionLength = studySessions.length > 0
    ? Math.round(studySessions.reduce((sum, s) => sum + ((s.totalTimeMs || 0) / 1000), 0) / studySessions.length / 60)
    : 45;

  const preferredTimeOfDay = getPreferredTimeOfDay(sessionsByTimeOfDay);
  const preferredModes = getPreferredModes(studySessions);

  // Calculate performance by system
  const accuracyBySystem = calculateAccuracyBySystem(reviewLogs);
  const strongSystems = Object.entries(accuracyBySystem)
    .filter(([, acc]) => acc > 0.8)
    .map(([sys]) => sys);
  const weakSystems = Object.entries(accuracyBySystem)
    .filter(([, acc]) => acc < 0.6)
    .map(([sys]) => sys);

  // Get recent trend (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLogs = reviewLogs.filter(r => r.reviewedAt >= sevenDaysAgo);
  const improvingAreas = identifyImprovingAreas(recentLogs, accuracyBySystem);

  // Calculate engagement and burnout indicators
  const engagementScore = calculateEngagementScore(studySessions);
  const consistencyScore = calculateConsistencyScore(studySessions);
  const burnoutRisk = calculateBurnoutRisk(studySessions, reviewLogs);

  // Get exam-related info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { examDate: true },
  });

  const daysToExam = user?.examDate ? calculateDaysToExam(user.examDate) : null;

  // Get exam readiness from blueprint coverage if exam is specified
  let estimatedReadiness = 0.5;
  let criticalGapsForExam: string[] = [];
  if (daysToExam && daysToExam > 0) {
    try {
      const coverage = await blueprintCoverageService.analyzeBlueprintCoverage('PANCE');
      const criticalGaps = await blueprintCoverageService.getCriticalGapSystems('PANCE', 10);
      estimatedReadiness = Math.min(1.0, (strongSystems.length / Object.keys(accuracyBySystem).length) || 0.5);
      criticalGapsForExam = criticalGaps.map(g => g.system);
    } catch (error) {
      console.warn('[phenotypeService] Could not compute exam readiness:', error);
    }
  }

  // Update or create phenotype
  await prisma.userStudyPhenotype.upsert({
    where: { userId },
    create: {
      userId,
      preferredSessionLength: avgSessionLength,
      preferredTimeOfDay,
      averageDailyLoad: Math.round(reviewLogs.length / 30),
      preferredModeSequence: preferredModes,
      strongSystems,
      weakSystems,
      improvingAreas,
      daysToExam: daysToExam || null,
      estimatedReadiness,
      criticalGapsForExam,
      engagementScore,
      consistencyScore,
      burnoutRisk,
      lastComputedAt: new Date(),
    },
    update: {
      preferredSessionLength: avgSessionLength,
      preferredTimeOfDay,
      averageDailyLoad: Math.round(reviewLogs.length / 30),
      preferredModeSequence: preferredModes,
      strongSystems,
      weakSystems,
      improvingAreas,
      daysToExam: daysToExam || null,
      estimatedReadiness,
      criticalGapsForExam,
      engagementScore,
      consistencyScore,
      burnoutRisk,
      lastComputedAt: new Date(),
    },
  });
}

/**
 * Generate personalized daily study plan for a user
 */
export async function generateDailyPlan(userId: string, forDate: Date): Promise<{ id: string; status: string }> {
  // Get user's phenotype
  const phenotype = await prisma.userStudyPhenotype.findUnique({
    where: { userId },
  });

  if (!phenotype) {
    await computeUserPhenotype(userId);
    return generateDailyPlan(userId, forDate);
  }

  // Check if plan already exists
  const existingPlan = await prisma.dailyStudyPlan.findUnique({
    where: {
      userId_planDate: {
        userId,
        planDate: forDate,
      },
    },
  });

  if (existingPlan && existingPlan.status !== 'pending') {
    return { id: existingPlan.id, status: existingPlan.status };
  }

  // Build recommended sessions based on phenotype
  const recommendedSessions = buildRecommendedSessions(phenotype, forDate);
  const recommendedSessionsJson = recommendedSessions as unknown as Prisma.InputJsonValue;

  // Create or update plan
  const plan = await prisma.dailyStudyPlan.upsert({
    where: {
      userId_planDate: {
        userId,
        planDate: forDate,
      },
    },
    create: {
      userId,
      planDate: forDate,
      recommendedSessions: recommendedSessionsJson,
      recommendedModes: phenotype.preferredModeSequence,
      targetQuestionsCount: phenotype.averageDailyLoad,
      targetSystemFocus: phenotype.weakSystems.slice(0, 3),
      estimatedTimeMinutes: phenotype.preferredSessionLength,
      status: 'pending',
    },
    update: {
      recommendedSessions: recommendedSessionsJson,
      recommendedModes: phenotype.preferredModeSequence,
      targetQuestionsCount: phenotype.averageDailyLoad,
      targetSystemFocus: phenotype.weakSystems.slice(0, 3),
      estimatedTimeMinutes: phenotype.preferredSessionLength,
      status: 'pending',
      updatedAt: new Date(),
    },
  });

  return { id: plan.id, status: plan.status };
}

/**
 * Get suggested mode sequence for user
 */
export async function suggestModeSequence(userId: string): Promise<string[]> {
  const phenotype = await prisma.userStudyPhenotype.findUnique({
    where: { userId },
  });

  if (!phenotype) {
    return ['quiz', 'drills', 'grand_rounds'];
  }

  return phenotype.preferredModeSequence;
}

/**
 * Assess burnout risk indicators
 */
export async function assessBurnoutRisk(userId: string): Promise<{ risk: number; indicators: string[] }> {
  const phenotype = await prisma.userStudyPhenotype.findUnique({
    where: { userId },
  });

  if (!phenotype) {
    return { risk: 0, indicators: [] };
  }

  const indicators: string[] = [];

  if (phenotype.burnoutRisk > 0.7) {
    indicators.push('High daily load');
  }
  if (phenotype.consistencyScore < 0.4) {
    indicators.push('Inconsistent study pattern');
  }
  if (phenotype.weakSystems.length > 5) {
    indicators.push('Many struggling areas');
  }
  if (phenotype.engagementScore < 0.4) {
    indicators.push('Low engagement');
  }

  return { risk: phenotype.burnoutRisk, indicators };
}

/**
 * Get exam readiness by system
 */
export async function getExamReadinessBySystem(
  userId: string,
  examType: string = 'PANCE'
): Promise<{ system: string; readiness: number }[]> {
  const phenotype = await prisma.userStudyPhenotype.findUnique({
    where: { userId },
  });

  if (!phenotype) {
    return [];
  }

  // Get all systems
  const systems = await prisma.condition.findMany({
    distinct: ['system'],
    select: { system: true },
    where: { status: 'published' },
  });

  // Calculate readiness per system based on accuracy and blueprint coverage
  const systemReadiness = await Promise.all(
    systems.map(async (s) => {
      const isStrong = phenotype.strongSystems.includes(s.system);
      const isWeak = phenotype.weakSystems.includes(s.system);
      const isCriticalGap = phenotype.criticalGapsForExam.includes(s.system);

      let readiness = 0.5;
      if (isStrong) readiness = 0.85;
      else if (isWeak) readiness = 0.35;
      else if (isCriticalGap) readiness = 0.4;

      return { system: s.system, readiness };
    })
  );

  return systemReadiness.sort((a, b) => a.readiness - b.readiness);
}

// ============================================
// Helper functions
// ============================================

interface TimeOfDayGroup {
  morning: number;
  afternoon: number;
  evening: number;
}

function groupByTimeOfDay(sessions: Array<{ startedAt: Date }>): TimeOfDayGroup {
  const groups: TimeOfDayGroup = { morning: 0, afternoon: 0, evening: 0 };

  sessions.forEach(s => {
    const hour = s.startedAt.getHours();
    if (hour < 12) groups.morning++;
    else if (hour < 17) groups.afternoon++;
    else groups.evening++;
  });

  return groups;
}

function getPreferredTimeOfDay(groups: TimeOfDayGroup): string {
  if (groups.morning >= groups.afternoon && groups.morning >= groups.evening) return 'morning';
  if (groups.afternoon >= groups.evening) return 'afternoon';
  return 'evening';
}

function getPreferredModes(
  sessions: Array<{ mode: string | null }>
): string[] {
  const modeCounts: Record<string, number> = {};
  sessions.forEach(s => {
    if (s.mode) modeCounts[s.mode] = (modeCounts[s.mode] || 0) + 1;
  });

  return Object.entries(modeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([mode]) => mode);
}

function calculateAccuracyBySystem(
  logs: Array<{ wasCorrect: boolean; system: string | null }>
): Record<string, number> {
  const bySystem: Record<string, { correct: number; total: number }> = {};

  logs.forEach(log => {
    if (!log.system) return;
    const sys = log.system;
    if (!bySystem[sys]) bySystem[sys] = { correct: 0, total: 0 };
    bySystem[sys].total++;
    if (log.wasCorrect) bySystem[sys].correct++;
  });

  const accuracy: Record<string, number> = {};
  Object.entries(bySystem).forEach(([sys, { correct, total }]) => {
    accuracy[sys] = total > 0 ? correct / total : 0;
  });

  return accuracy;
}

function identifyImprovingAreas(
  recentLogs: Array<{ wasCorrect: boolean; system: string | null }>,
  allTimeAccuracy: Record<string, number>
): string[] {
  const recentAccuracy = calculateAccuracyBySystem(recentLogs);

  return Object.entries(recentAccuracy)
    .filter(([sys, recent]) => recent > (allTimeAccuracy[sys] || 0) + 0.1)
    .map(([sys]) => sys);
}

function calculateEngagementScore(sessions: Array<{ startedAt: Date }>): number {
  if (sessions.length === 0) return 0;

  // Consistency over time
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const daysActive = new Set(sessions.map(s => s.startedAt.toDateString())).size;
  const consistency = Math.min(daysActive / 30, 1);

  // Streak tracking would go here (future enhancement)
  return consistency;
}

function calculateConsistencyScore(sessions: Array<{ startedAt: Date; totalTimeMs?: number }>): number {
  if (sessions.length < 3) return 0.5;

  const durations = sessions.map(s => (s.totalTimeMs || 0) / 1000).filter(d => d > 0);
  if (durations.length === 0) return 0.5;

  const mean = durations.reduce((a, b) => a + b) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  // Lower variation = higher consistency
  return Math.max(0, 1 - Math.min(coefficientOfVariation, 1));
}

function calculateBurnoutRisk(
  sessions: Array<{ startedAt: Date; totalTimeMs?: number }>,
  reviewLogs: Array<{ wasCorrect: boolean; reviewedAt: Date; system: string | null }>
): number {
  let risk = 0;

  // High daily load indicator
  if (sessions.length > 50) risk += 0.3;
  else if (sessions.length > 30) risk += 0.15;

  // Declining accuracy trend
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCorrect = reviewLogs.filter(r => r.wasCorrect && r.reviewedAt >= sevenDaysAgo).length;
  const recentTotal = reviewLogs.filter(r => r.reviewedAt >= sevenDaysAgo).length;
  if (recentTotal > 0) {
    const recentAccuracy = recentCorrect / recentTotal;
    if (recentAccuracy < 0.5) risk += 0.4;
    else if (recentAccuracy < 0.6) risk += 0.2;
  }

  // Irregular session pattern (would benefit from streak tracking)
  return Math.min(risk, 1);
}

function calculateDaysToExam(examDate: Date): number {
  const today = new Date();
  const diff = examDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface RecommendedSession {
  mode: string;
  count: number;
  systemFilter?: string[];
  reason: string;
}

function buildRecommendedSessions(
  phenotype: { weakSystems: string[]; averageDailyLoad: number; preferredModeSequence: string[] },
  forDate: Date
): RecommendedSession[] {
  const sessions: RecommendedSession[] = [];
  const totalQuestions = phenotype.averageDailyLoad;

  // Allocate questions to modes
  const modeCount = Math.max(1, phenotype.preferredModeSequence.length);
  const questionsPerMode = Math.floor(totalQuestions / modeCount);

  phenotype.preferredModeSequence.slice(0, 3).forEach((mode, idx) => {
    const isFinal = idx === phenotype.preferredModeSequence.length - 1;
    const count = isFinal ? totalQuestions - questionsPerMode * idx : questionsPerMode;

    sessions.push({
      mode,
      count: Math.max(5, count),
      systemFilter: idx === 0 ? phenotype.weakSystems.slice(0, 2) : undefined,
      reason: idx === 0 ? 'weak-areas' : idx === 1 ? 'review' : 'practice',
    });
  });

  return sessions;
}
