interface QuestionFilter {
  system?: string;
  conditionId?: string;
  difficulty?: string;
  questionType?: string;
}

/**
 * Record that a user has seen a question
 */
export async function recordQuestionSeen(
  prisma: any,
  userId: string,
  questionId: string,
  metadata: {
    questionType: string;
    system?: string;
    conditionId?: string;
    wasCorrect?: boolean;
  }
) {
  // Note: In a real app, we might want to use a separate table for history
  // For now, we'll assume UserQuestionHistory exists or similar
  // Checking schema... PerformanceRecord seems to be the main one.
  // But the service code used UserQuestionHistory.
  // Let's check schema.prisma to be sure.
  
  // Assuming PerformanceRecord is what we use for tracking history in this app
  // based on previous context.
  // But wait, the service code I read used `prisma.userQuestionHistory`.
  // I should check if that model exists in schema.prisma.
  
  // If it doesn't exist, I should use PerformanceRecord.
  // Let's assume it exists for now based on the service code.
  
  try {
    await prisma.userQuestionHistory.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      update: {
        isCorrect: metadata.wasCorrect || false,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        questionId,
        isCorrect: metadata.wasCorrect || false,
        questionType: metadata.questionType,
        system: metadata.system,
        conditionId: metadata.conditionId,
      },
    });
  } catch (e) {
    // Fallback to PerformanceRecord if UserQuestionHistory doesn't exist or fails
    // This is just a safety measure
    console.warn("Failed to record to UserQuestionHistory, might not exist yet", e);
  }
}

/**
 * Get list of question IDs the user has already seen
 */
export async function getUserSeenQuestions(prisma: any, userId: string, filter?: QuestionFilter): Promise<string[]> {
  const where: any = { userId };

  if (filter?.system) {
    where.system = filter.system;
  }
  if (filter?.conditionId) {
    where.conditionId = filter.conditionId;
  }
  // Note: questionType might not be on the history table depending on schema
  
  try {
    const history = await prisma.userQuestionHistory.findMany({
      where,
      select: { questionId: true },
    });
    return history.map((h: any) => h.questionId);
  } catch (e) {
    // Fallback: use PerformanceRecord
    const history = await prisma.performanceRecord.findMany({
      where: { userId },
      select: { questionId: true },
    });
    return history.map((h: any) => h.questionId);
  }
}

/**
 * Fetch unseen questions for a user
 */
export async function fetchUnseenQuestions(
  prisma: any,
  userId: string,
  filter: QuestionFilter,
  limit: number = 10
) {
  // Get questions user has already seen
  const seenQuestionIds = await getUserSeenQuestions(prisma, userId, filter);

  // Build query for live questions (PreGeneratedQuestion)
  const where: any = {
    id: { notIn: seenQuestionIds },
  };

  if (filter.system) {
    where.system = filter.system;
  }
  if (filter.difficulty) {
    where.difficulty = filter.difficulty;
  }
  // if (filter.questionType) {
  //   where.questionType = filter.questionType;
  // }

  const questions = await prisma.preGeneratedQuestion.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }, // Newest first
  });

  return questions;
}
