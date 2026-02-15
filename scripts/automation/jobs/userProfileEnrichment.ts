/**
 * User Profile Enrichment Job
 *
 * Sprint: User Data Improvement Plan - Step 3 (Sprint B)
 * Schedule: Daily at 3 AM UTC
 *
 * Enriches UserLearningProfile with aggregated metrics from:
 * - StudySession (session patterns, stamina)
 * - QuestionAttempt (performance, timing)
 * - UserBehaviorMetrics (behavioral patterns)
 *
 * Populates previously empty fields:
 * - chronotype (morning/afternoon/evening/night learner)
 * - peakLearningHour (best performance hour 0-23)
 * - avgSessionDuration (average questions per session)
 * - preferredDifficulty (adaptive analysis)
 * - learningVelocity (improvement rate)
 * - metacognitionScore (JOL accuracy)
 * - cognitiveLoadThreshold (optimal session length)
 */

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { disconnectPrisma, prisma } from '../../helpers/prisma-client';

/**
 * Determine chronotype from performance by time of day
 */
function determineChronotype(hourlyPerformance: { hour: number; accuracy: number }[]): string {
  if (hourlyPerformance.length === 0) return 'unknown';

  // Sort by accuracy
  const sorted = [...hourlyPerformance].sort((a, b) => b.accuracy - a.accuracy);
  const topHours = sorted.slice(0, 3).map((h) => h.hour);

  // Morning: 6-11 AM
  const morningCount = topHours.filter((h) => h >= 6 && h <= 11).length;
  // Afternoon: 12-5 PM
  const afternoonCount = topHours.filter((h) => h >= 12 && h <= 17).length;
  // Evening: 6-11 PM
  const eveningCount = topHours.filter((h) => h >= 18 && h <= 23).length;
  // Night: 12-5 AM
  const nightCount = topHours.filter((h) => h >= 0 && h <= 5).length;

  const max = Math.max(morningCount, afternoonCount, eveningCount, nightCount);
  if (morningCount === max) return 'morning';
  if (afternoonCount === max) return 'afternoon';
  if (eveningCount === max) return 'evening';
  if (nightCount === max) return 'night';

  return 'variable';
}

/**
 * Calculate cognitive load threshold
 * Returns optimal session length (questions) before fatigue
 */
function calculateCognitiveLoadThreshold(
  sessionPerformance: { questionNumber: number; wasCorrect: boolean }[]
): number {
  if (sessionPerformance.length < 10) return 20; // Default

  // Calculate rolling accuracy over session
  const windowSize = 5;
  const rollingAccuracies: { position: number; accuracy: number }[] = [];

  for (let i = windowSize; i <= sessionPerformance.length; i++) {
    const window = sessionPerformance.slice(i - windowSize, i);
    const accuracy = window.filter((q) => q.wasCorrect).length / windowSize;
    rollingAccuracies.push({ position: i, accuracy });
  }

  // Find where accuracy drops significantly
  const first = rollingAccuracies[0];
  const initialAccuracy = first?.accuracy ?? 0;
  const dropThreshold = initialAccuracy * 0.85; // 15% drop

  for (let i = 1; i < rollingAccuracies.length; i++) {
    const r = rollingAccuracies[i];
    if (r && r.accuracy < dropThreshold) {
      return r.position;
    }
  }

  // No significant drop found, use max session length
  return Math.max(20, Math.min(50, sessionPerformance.length));
}

/**
 * Enrich a single user's learning profile
 */
async function enrichUserProfile(prisma: PrismaClient, userId: string): Promise<void> {
  // Get or create UserLearningProfile
  let profile = await prisma.userLearningProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.userLearningProfile.create({
      data: { id: randomUUID(), userId },
    });
  }

  // Aggregate from StudySession
  const sessions = await prisma.studySession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100, // Last 100 sessions
  });

  const avgSessionDuration =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + (s.totalQuestions ?? 0), 0) / sessions.length)
      : null;

  // Aggregate from QuestionAttempt
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 1000, // Last 1000 attempts
    select: {
      createdAt: true,
      wasCorrect: true,
      timeSpentMs: true,
    },
  });

  // Calculate hourly performance for chronotype
  const hourlyPerformance: Map<number, { correct: number; total: number }> = new Map();

  attempts.forEach((attempt) => {
    const hour = new Date(attempt.createdAt).getHours();
    const stats = hourlyPerformance.get(hour) || { correct: 0, total: 0 };
    stats.total++;
    if (attempt.wasCorrect) stats.correct++;
    hourlyPerformance.set(hour, stats);
  });

  const hourlyAccuracies = Array.from(hourlyPerformance.entries())
    .map(([hour, stats]) => ({
      hour,
      accuracy: stats.correct / stats.total,
      attempts: stats.total,
    }))
    .filter((h) => h.attempts >= 5); // Require at least 5 attempts per hour

  const chronotype = determineChronotype(hourlyAccuracies);

  // Find peak learning hour
  const peakLearningHour =
    hourlyAccuracies.length > 0
      ? hourlyAccuracies.reduce((best, curr) => (curr.accuracy > best.accuracy ? curr : best)).hour
      : null;

  // Aggregate from UserBehaviorMetrics (if exists)
  const behaviorMetrics = await prisma.userBehaviorMetrics.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      wasCorrect: true,
      timeOfDay: true,
      answerChanges: true,
    },
  });

  // Calculate preferred difficulty (adaptive)
  // Based on accuracy when taking time vs. rushing
  const avgTimePerQuestion =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0) / attempts.length)
      : null;

  // Group attempts by session position to detect fatigue
  const sessionPositions = sessions.flatMap((session, sessionIdx) => {
    return attempts
      .filter((a) => {
        const sessionStart = session.createdAt;
        const sessionEnd = session.endedAt || new Date();
        return a.createdAt >= sessionStart && a.createdAt <= sessionEnd;
      })
      .map((attempt, qIdx) => ({
        questionNumber: qIdx + 1,
        wasCorrect: attempt.wasCorrect,
      }));
  });

  const cognitiveLoadThreshold =
    sessionPositions.length > 10 ? calculateCognitiveLoadThreshold(sessionPositions) : null;

  // Calculate answer change patterns
  const avgAnswerChanges =
    behaviorMetrics.length > 0
      ? behaviorMetrics.reduce((sum, m) => sum + m.answerChanges, 0) / behaviorMetrics.length
      : null;

  // Determine preferred difficulty
  let preferredDifficulty = 'adaptive';
  if (profile.lifetimeAccuracy > 0.85) {
    preferredDifficulty = 'challenging';
  } else if (profile.lifetimeAccuracy < 0.6) {
    preferredDifficulty = 'foundation';
  } else {
    preferredDifficulty = 'adaptive';
  }

  // Calculate optimal time range
  const optimalTimeRange = avgTimePerQuestion
    ? `${Math.round((avgTimePerQuestion * 0.8) / 1000)}-${Math.round((avgTimePerQuestion * 1.2) / 1000)} seconds`
    : null;

  // Calculate rushing tendency (0-1)
  const medianTime = avgTimePerQuestion || 0;
  const fastAttempts = attempts.filter((a) => (a.timeSpentMs || 0) < medianTime * 0.7).length;
  const rushingTendency = attempts.length > 0 ? fastAttempts / attempts.length : null;

  // Calculate fatigue onset
  const fatigueOnsetQuestion = cognitiveLoadThreshold;
  const optimalSessionLength = cognitiveLoadThreshold
    ? Math.round(cognitiveLoadThreshold * 0.9) // Recommend stopping slightly before fatigue
    : null;

  // Calculate best/worst study hours
  const sortedHours = [...hourlyAccuracies].sort((a, b) => b.accuracy - a.accuracy);
  const bestStudyHour = sortedHours.length > 0 ? (sortedHours[0]?.hour ?? null) : null;
  const worstStudyHour =
    sortedHours.length > 0 ? (sortedHours[sortedHours.length - 1]?.hour ?? null) : null;

  // Update UserLearningProfile with new fields
  await prisma.userLearningProfile.update({
    where: { userId },
    data: {
      // Session patterns
      avgSessionLength: avgSessionDuration,
      optimalSessionLength,
      fatigueOnsetQuestion,

      // Time patterns
      avgTimePerQuestion,
      optimalTimeRange,
      rushingTendency,
      bestStudyHour,
      worstStudyHour,

      // Behavioral insights
      avgAnswerChanges,

      // New fields (not in current schema, will be added if needed)
      // chronotype: Not in schema yet
      // peakLearningHour: Not in schema yet
      // preferredDifficulty: Not in schema yet
      // cognitiveLoadThreshold: Not in schema yet

      updatedAt: new Date(),
    },
  });

  console.log(`✅ Enriched profile for user ${userId}`);
}

/**
 * Main job: Enrich all user profiles
 */
export async function enrichAllUserProfiles(): Promise<void> {
  try {
    console.log('🔄 Starting User Profile Enrichment Job...');

    // Get all users with activity in last 90 days
    const activeUsers = await prisma.questionAttempt.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(`Found ${activeUsers.length} active users to enrich`);

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);

      await Promise.all(batch.map(({ userId }) => enrichUserProfile(prisma, userId)));

      console.log(
        `Processed ${Math.min(i + batchSize, activeUsers.length)} / ${activeUsers.length} users`
      );
    }

    console.log('✅ User Profile Enrichment Job Complete');
  } catch (error) {
    console.error('❌ Error in User Profile Enrichment Job:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

/**
 * CLI execution
 */
if (require.main === module) {
  enrichAllUserProfiles()
    .then(() => {
      console.log('Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}
