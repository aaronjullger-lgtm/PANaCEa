/**
 * Adaptive Learning Service
 *
 * "Virtual Attending" that analyzes user performance to recommend the optimal next study activity.
 * Uses Spaced Repetition (SRS) data and concept mastery to identify gaps.
 */

import { prisma } from '@/lib/prisma';

// Types
export interface TopicMastery {
  topic: string;
  masteryScore: number; // 0-100
  status: 'new' | 'learning' | 'review' | 'mastered';
  urgency: number; // 0-100 (higher = needs review now)
}

export interface RecommendationResult {
  recommendations: any[]; // specific type inferred from Prisma
  primaryAction: any | null;
}

/**
 * Calculate detailed user strength profile based on UserTopicProgress
 */
export async function getUserStrengthProfile(userId: string): Promise<TopicMastery[]> {
  // Fetch all topic progress for the user
  const progressItems = await prisma.userTopicProgress.findMany({
    where: { userId },
    orderBy: { nextReviewDate: 'asc' }, // Soonest review first
  });

  const profile: TopicMastery[] = progressItems.map((item) => {
    // Calculate mastery based on FSRS stability and difficulty
    // Stability ~ implies how long it sticks. High stability = High Mastery.
    // Difficulty reduces expected mastery.
    const normalizedStability = Math.min(item.stability / 30, 1); // Cap at 30 days for "100%"
    const normalizedDifficulty = (10 - item.difficulty) / 10; // Invert difficulty

    const masteryScore = (normalizedStability * 0.7 + normalizedDifficulty * 0.3) * 100;

    // Urgency calculation
    // If nextReviewDate is past, urgency is high.
    // If state is New (0) or Learning (1), urgency is moderate.
    let urgency = 0;
    const now = new Date();

    if (item.nextReviewDate && item.nextReviewDate < now) {
      // Overdue
      const daysOverdue = (now.getTime() - item.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24);
      urgency = 80 + Math.min(daysOverdue * 2, 20); // Max 100
    } else if (item.state <= 1) {
      urgency = 60; // Active learning phase
    } else {
      urgency = 10; // Maintenance
    }

    let status: TopicMastery['status'] = 'new';
    if (item.state === 1) status = 'learning';
    if (item.state === 2) status = 'review';
    if (item.state >= 3 || masteryScore > 90) status = 'mastered';

    return {
      topic: item.conditionId,
      masteryScore,
      status,
      urgency,
    };
  });

  // Sort by urgency descending
  return profile.sort((a, b) => b.urgency - a.urgency);
}

/**
 * Generate (or refresh) study recommendations for a user
 */
export async function generateRecommendations(userId: string): Promise<RecommendationResult> {
  // 1. Get Profile
  const profile = await getUserStrengthProfile(userId);

  // 2. Identify Needs
  const urgentItems = profile.filter((p) => p.urgency > 70);
  const newItems = profile.filter((p) => p.status === 'new');

  // 3. Clear old pending recommendations
  await prisma.studyRecommendation.updateMany({
    where: {
      userId,
      status: 'pending',
    },
    data: { status: 'dismissed' },
  });

  // 4. Create new recommendations
  const recommendationsToCreate = [];

  // Urgent Reviews (Spaced Repetition)
  if (urgentItems.length > 0) {
    recommendationsToCreate.push({
      userId,
      type: 'review',
      topic: 'Due Reviews',
      reason: `${urgentItems.length} topics are overdue for review`,
      priority: 'high',
      status: 'pending',
      data: { topicIds: urgentItems.map((i) => i.topic).slice(0, 20) },
    });
  }

  // Weak Areas (Low Mastery but not necessarily overdue)
  const weakAreas = profile.filter((p) => p.masteryScore < 50 && p.status !== 'new').slice(0, 3);
  for (const weak of weakAreas) {
    recommendationsToCreate.push({
      userId,
      type: 'drill_session',
      topic: weak.topic,
      reason: 'Low mastery score detected. Targeted drill recommended.',
      priority: 'medium',
      status: 'pending',
      data: { topicId: weak.topic },
    });
  }

  // New Content Exposure
  if (recommendationsToCreate.length < 3) {
    // Suggest a new topic if we don't have enough critical work
    // In a real app, we'd find a topic NOT in progress.
    // For now, we'll placeholder generic advice or just skip.
  }

  // Bulk create
  if (recommendationsToCreate.length > 0) {
    await prisma.studyRecommendation.createMany({
      data: recommendationsToCreate,
    });
  }

  // 5. Fetch and Return Fresh Recs
  const finalRecs = await prisma.studyRecommendation.findMany({
    where: { userId, status: 'pending' },
    orderBy: { priority: 'asc' }, // 'high' < 'medium' checks? No, strings. 'high' > 'medium'.
    // Actually typically we want priority desc, but string sort "high" < "medium" is wrong "h" vs "m".
    // Let's sort in JS.
  });

  const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
  finalRecs.sort((a, b) => (priorityMap[b.priority] ?? 0) - (priorityMap[a.priority] ?? 0));

  return {
    recommendations: finalRecs,
    primaryAction: finalRecs[0] || null,
  };
}

/**
 * Get the single best next action for the user ("Virtual Attending")
 */
export async function getNextBestAction(userId: string) {
  const { primaryAction } = await generateRecommendations(userId);
  return primaryAction;
}
