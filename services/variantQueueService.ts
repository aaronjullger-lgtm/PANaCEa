import type { PrismaClient } from '@prisma/client';
import { generateVariant } from '../lib/questionVariantGenerator';
import { TASK_TYPES } from '../lib/taskTypes';

export class VariantQueueService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Called when a user answers incorrectly.
   * Finds an unused variant or generates a new one, then schedules it.
   */
  async queueVariantForReview(userId: string, questionId: string, taskType: string) {
    // 1. Check if there are existing unused variants for this question/taskType
    const existingVariants = await this.prisma.questionVariant.findMany({
      where: {
        baseQuestionId: questionId,
        taskType: taskType,
        NOT: {
          usedByUsers: {
            has: userId,
          },
        },
      },
    });

    if (existingVariants.length > 0) {
      return existingVariants[0].id;
    }

    // 2. Fetch original question and condition info
    const originalQuestion = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { Condition: true }, // Fetch condition for analytics
    });

    if (!originalQuestion) return null;

    // 3. Determine Adaptive Strategy
    let targetType:
      | 'rephrased'
      | 'different_distractors'
      | 'different_scenario'
      | 'remediation'
      | 'decomposition' = 'rephrased';
    let conditionName = originalQuestion.Condition?.name;

    if (conditionName) {
      // Check for known confusions
      const confusion = await this.prisma.confusionPair.findFirst({
        where: {
          userId: userId,
          realCondition: conditionName,
          count: { gt: 1 }, // If confused more than once
        },
        orderBy: { count: 'desc' },
      });

      // Check for persistent weakness
      const weakness = await this.prisma.weaknessPattern.findFirst({
        where: {
          userId: userId,
          conditionId: originalQuestion.conditionId || undefined,
        },
        orderBy: { timestamp: 'desc' },
      });

      if (confusion) {
        // If user consistently confuses this, try to trick them with distractors or fix the specific confusion
        targetType = 'different_distractors';
        // Note: We could use 'remediation' if we knew the exact current wrong answer,
        // but checking historic confusion is safer for general queuing.
      } else if (weakness && weakness.consecutiveWrong >= 3) {
        // If very weak, break it down
        targetType = 'decomposition';
      } else if (weakness && weakness.consecutiveWrong >= 2) {
        // If struggling, change scenario to test transfer of learning
        targetType = 'different_scenario';
      }
    }

    // Parse options if JSON
    let options: string[] = [];
    if (typeof originalQuestion.options === 'string') {
      options = JSON.parse(originalQuestion.options);
    } else if (Array.isArray(originalQuestion.options)) {
      options = originalQuestion.options as string[];
    }

    const newVariantData = await generateVariant({
      originalQuestion: originalQuestion.question,
      originalOptions: options,
      originalAnswer: originalQuestion.correctAnswer,
      originalExplanation: originalQuestion.explanation,
      targetType: targetType,
    });

    if (!newVariantData) return null;

    // 4. Save the new variant
    const savedVariant = await this.prisma.questionVariant.create({
      data: {
        baseQuestionId: questionId,
        variantType: newVariantData.variantType,
        question: newVariantData.question,
        options: newVariantData.options,
        correctAnswer: newVariantData.correctAnswer,
        explanation: newVariantData.explanation,
        taskType: taskType,
        difficulty: originalQuestion.difficulty,
      },
    });

    return savedVariant.id;
  }

  /**
   * Retrieves the specific variant content
   */
  async getVariant(variantId: string) {
    return this.prisma.questionVariant.findUnique({
      where: { id: variantId },
    });
  }
}
