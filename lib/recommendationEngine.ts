export interface RecommendationContext {
  userId: string;
}

const EXAM_REMINDER_DAYS = 90;

// Accept prisma client as an argument for Edge compatibility
// (We use 'any' for the client type to avoid deep import issues with @prisma/client vs edge client)
export async function generateRecommendations(userId: string, prisma: any) {
  const recommendations: Array<{
    userId: string;
    type: string;
    topic: string;
    reason: string;
    priority: string;
    status: string;
    data?: Record<string, unknown>;
  }> = [];

  // 0. Baseline assessment weak systems (if user has completed baseline)
  const latestBaseline = await prisma.baselineAssessment.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    select: { weakestSystems: true },
  });
  if (latestBaseline?.weakestSystems && Array.isArray(latestBaseline.weakestSystems)) {
    const weakSystems = latestBaseline.weakestSystems.slice(0, 3) as string[];
    for (const system of weakSystems) {
      if (system && typeof system === 'string') {
        recommendations.push({
          userId,
          type: 'review',
          topic: `Review ${system}`,
          reason: 'Baseline weak area',
          priority: 'high',
          status: 'pending',
          data: { system },
        });
      }
    }
  }

  // 1. Analyze Weak Areas (UserTopicProgress)
  // Look for topics with low stability or in 'Relearning' state (3)
  const weakTopics = await prisma.userTopicProgress.findMany({
    where: {
      userId,
      OR: [
        { stability: { lt: 0.6 } }, // Low stability
        { state: 3 }, // Relearning
      ],
    },
    take: 3,
    orderBy: { stability: 'asc' },
  });

  for (const topic of weakTopics) {
    // Resolve condition name
    const content = await prisma.medicalContent.findUnique({
      where: { id: topic.conditionId },
      select: { condition: true },
    });

    const conditionName = content?.condition || 'Unknown Condition';

    recommendations.push({
      userId,
      type: 'review',
      topic: conditionName,
      reason: 'Low stability detected',
      priority: 'high',
      status: 'pending',
      data: { conditionId: topic.conditionId, taskType: topic.taskType },
    });
  }

  // 2. Analyze SRS Due Items
  const dueItems = await prisma.userTopicProgress.findMany({
    where: {
      userId,
      nextReviewDate: { lte: new Date() },
    },
    take: 5,
  });

  if (dueItems.length > 0) {
    recommendations.push({
      userId,
      type: 'drill_session',
      topic: 'Spaced Repetition Review',
      reason: `${dueItems.length} items due for review`,
      priority: 'medium',
      status: 'pending',
      data: { count: dueItems.length },
    });
  }

  // 2b. Exam date reminder (User.examDate)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { examDate: true },
  });
  if (user?.examDate) {
    const examDate = new Date(user.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining >= 0 && daysRemaining <= EXAM_REMINDER_DAYS) {
      recommendations.push({
        userId,
        type: 'exam_reminder',
        topic: daysRemaining <= 7 ? 'Exam soon' : 'Exam countdown',
        reason:
          daysRemaining <= 0
            ? 'Exam date passed — keep reviewing'
            : `PANCE in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — stick to your plan`,
        priority: daysRemaining <= 14 ? 'high' : 'medium',
        status: 'pending',
        data: { daysRemaining, examDate: user.examDate },
      });
    }
  }

  // 3. Save Recommendations to Database
  const existingRecs = await prisma.studyRecommendation.findMany({
    where: {
      userId,
      status: 'pending',
    },
  });

  const uniqueRecs = recommendations.filter(
    (newRec) =>
      !existingRecs.some(
        (existing: any) => existing.topic === newRec.topic && existing.type === newRec.type
      )
  );

  if (uniqueRecs.length > 0) {
    await prisma.studyRecommendation.createMany({
      data: uniqueRecs,
    });
  }

  return uniqueRecs;
}
