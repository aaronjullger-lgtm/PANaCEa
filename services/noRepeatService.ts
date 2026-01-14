/**
 * No-Repeat Logic Service
 * 
 * Task 109: "Infinite" No-Repeat Logic
 * - Track every question a user has seen
 * - Fetch questions excluding user history
 * - Only trigger AI generation as fallback when no unseen questions exist
 */

import { prisma } from "../lib/prisma";
import { generateSingleQuestion } from "../lib/questionGenerator";
import { saveToStaging, runAdequacyCheck, promoteToLive } from "./stagingQuestionService";

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
  userId: string,
  questionId: string,
  metadata: {
    questionType: string;
    system?: string;
    conditionId?: string;
    wasCorrect?: boolean;
  }
) {
  const now = new Date();
  await prisma.userQuestionSeen.upsert({
    where: {
      userId_questionId_questionType: {
        userId,
        questionId,
        questionType: metadata.questionType,
      },
    },
    update: {
      lastSeenAt: now,
      timesShown: { increment: 1 },
      timesCorrect: metadata.wasCorrect ? { increment: 1 } : undefined,
      timesIncorrect: metadata.wasCorrect === false ? { increment: 1 } : undefined,
    },
    create: {
      userId,
      questionId,
      questionType: metadata.questionType,
      firstSeenAt: now,
      lastSeenAt: now,
      timesShown: 1,
      timesCorrect: metadata.wasCorrect ? 1 : 0,
      timesIncorrect: metadata.wasCorrect ? 0 : 1,
    },
  });
}

/**
 * Get list of question IDs the user has already seen
 */
export async function getUserSeenQuestions(userId: string, filter?: QuestionFilter): Promise<string[]> {
  const where: any = { userId };

  if (filter?.system) {
    where.system = filter.system;
  }
  if (filter?.conditionId) {
    where.conditionId = filter.conditionId;
  }
  if (filter?.questionType) {
    where.questionType = filter.questionType;
  }

  const history = await prisma.userQuestionSeen.findMany({
    where,
    select: { questionId: true },
  });

  return history.map((h) => h.questionId);
}

/**
 * Fetch unseen questions for a user
 * Returns questions from the live pool that the user hasn't seen yet
 */
export async function fetchUnseenQuestions(
  userId: string,
  filter: QuestionFilter,
  limit: number = 10
) {
  // Get questions user has already seen (with same filter criteria)
  const seenQuestionIds = await getUserSeenQuestions(userId, filter);

  // Build query for live questions
  const where: any = {
    usedAt: null, // Prefer unused questions first
  };

  if (filter.system) {
    where.system = filter.system;
  }
  if (filter.difficulty) {
    where.difficulty = filter.difficulty;
  }
  if (filter.questionType) {
    where.questionType = filter.questionType;
  }

  // Fetch questions excluding user's history
  const questions = await prisma.preGeneratedQuestion.findMany({
    where: {
      ...where,
      id: {
        notIn: seenQuestionIds,
      },
    },
    take: limit,
    orderBy: [
      { usedAt: "asc" }, // Prioritize never-used questions
      { generatedAt: "desc" }, // Then newer questions
    ],
  });

  return questions;
}

/**
 * Smart question fetching with fallback to AI generation
 * This is the main entry point for the no-repeat logic
 */
export async function getQuestionsWithNoRepeat(
  userId: string,
  filter: QuestionFilter,
  limit: number = 10
) {
  // Step 1: Try to fetch unseen questions from the live pool
  const unseenQuestions = await fetchUnseenQuestions(userId, filter, limit);

  // Step 2: If we got enough questions, return them
  if (unseenQuestions.length >= limit) {
    return {
      questions: unseenQuestions,
      source: "database",
      generated: 0,
    };
  }

  // Step 3: If we need more questions, check if we can relax the filter
  // Try fetching from used questions that user hasn't seen
  if (unseenQuestions.length === 0) {
    const seenQuestionIds = await getUserSeenQuestions(userId, filter);

    const where: any = {};
    if (filter.system) where.system = filter.system;
    if (filter.difficulty) where.difficulty = filter.difficulty;
    if (filter.questionType) where.questionType = filter.questionType;

    const additionalQuestions = await prisma.preGeneratedQuestion.findMany({
      where: {
        ...where,
        id: {
          notIn: seenQuestionIds,
        },
      },
      take: limit,
      orderBy: { generatedAt: "desc" },
    });

    if (additionalQuestions.length > 0) {
      return {
        questions: additionalQuestions,
        source: "database",
        generated: 0,
      };
    }
  }

  // Step 4: ONLY if the query returns 0 results, trigger AI generation
  // No unseen questions found - AI generation would be triggered in production

  // Note: In a production system, this would be an async job to avoid blocking the request
  // For now, we return what we have and indicate that generation is needed
  return {
    questions: unseenQuestions,
    source: "database_and_generation_needed",
    generated: 0,
    needsGeneration: true,
    generationNeeded: limit - unseenQuestions.length,
  };
}

/**
 * Generate new questions on-the-fly for a specific filter
 * This is the expensive/slow fallback operation
 */
export async function generateQuestionsForFilter(
  filter: QuestionFilter,
  count: number = 5
): Promise<any[]> {
  if (!filter.conditionId) {
    throw new Error("Cannot generate questions without conditionId");
  }

  const { loadConditionData } = await import("./conditionDataLoader");
  
  // Load condition data
  const conditionData = await loadConditionData(filter.conditionId);
  
  if (!conditionData) {
    throw new Error(`Condition data not found for: ${filter.conditionId}`);
  }

  const generatedQuestions = [];

  for (let i = 0; i < count; i++) {
    try {
      // Generate question using existing generator
      // Transform loaded data to match ConditionData interface
      const transformedCondition = {
        condition: conditionData.name,
        sections: {
          overview: conditionData.content.overview || '',
          etiology: conditionData.content.etiologyPathophysiology || '',
          clinicalPresentation: conditionData.content.clinicalPresentation || '',
          diagnostics: conditionData.content.diagnostics?.notes || '',
          treatment: (conditionData.content.treatment || conditionData.content.management || []).join('\n'),
        }
      };
      
      const question = await generateSingleQuestion(
        transformedCondition,
        (filter.questionType as any) || "mcq"
      );

      if (question) {
        // Save to staging
        const staged = await saveToStaging({
          ...question,
          system: filter.system || conditionData.system,
          difficulty: filter.difficulty || "medium",
        });

        // Run adequacy check
        const checkResult = await runAdequacyCheck(staged.id);

        // If passes, promote to live
        if (checkResult.isValid) {
          const liveQuestion = await promoteToLive(staged.id);
          generatedQuestions.push(liveQuestion);
        }
      }
    } catch (error) {
      console.error("Error generating question:", error);
    }
  }

  return generatedQuestions;
}

/**
 * Mark questions as used by a user
 */
export async function markQuestionsAsUsed(questionIds: string[], userId: string) {
  // Update the preGeneratedQuestion records
  await prisma.preGeneratedQuestion.updateMany({
    where: {
      id: {
        in: questionIds,
      },
    },
    data: {
      usedAt: new Date(),
      usedBy: userId,
    },
  });
}

/**
 * Get statistics about the golden repository
 */
export async function getRepositoryStats() {
  const [totalQuestions, unseenByAnyUser, systemBreakdown] = await Promise.all([
    prisma.preGeneratedQuestion.count(),
    prisma.preGeneratedQuestion.count({ where: { usedAt: null } }),
    prisma.preGeneratedQuestion.groupBy({
      by: ["system"],
      _count: true,
    }),
  ]);

  return {
    totalQuestions,
    unseenByAnyUser,
    systemBreakdown,
    message:
      totalQuestions > 0
        ? `Building asset value: ${totalQuestions} vetted questions in the Golden Repository`
        : "Start building your Golden Repository by generating questions",
  };
}

/**
 * Clean up old history entries (optional - for data management)
 * You might want to keep indefinitely or archive after a certain period
 */
export async function cleanupOldHistory(daysToKeep: number = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const deleted = await prisma.userQuestionSeen.deleteMany({
    where: {
      lastSeenAt: {
        lt: cutoffDate,
      },
    },
  });

  return { deletedCount: deleted.count };
}
