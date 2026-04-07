import type { PrismaClient } from '@prisma/client';
import { generateVariant } from '@/lib/questionVariantGenerator';
import { TASK_TYPES } from '@/lib/taskTypes';

export class VariantQueueService {
  /**
   * @param prisma - Prisma client instance
   * @param apiKey - Gemini API key. Pass from Edge (context.env.GEMINI_API_KEY) or
   *                 Node (process.env.GEMINI_API_KEY). If omitted, generation falls
   *                 back to process.env (Node-only; will silently no-op on Edge).
   */
  constructor(
    private prisma: PrismaClient,
    private apiKey?: string,
  ) {}

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

    const first = existingVariants[0];
    if (first) {
      return first.id;
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
    const conditionName = originalQuestion.Condition?.name;

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
        // If user consistently confuses this condition with another, craft distractors
        // that specifically target the documented confusion pair.
        targetType = 'different_distractors';
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

    // When generating distractor-targeted variants, fetch all confusion pairs for
    // this condition so the generator can craft distractors around known misconceptions.
    let confusionPairs: Array<{ mistakenFor: string; count: number }> = [];
    if (targetType === 'different_distractors' && originalQuestion.conditionId) {
      const pairs = await this.prisma.confusionPair.findMany({
        where: { userId, realConditionId: originalQuestion.conditionId },
        orderBy: { count: 'desc' },
        take: 5,
      });
      confusionPairs = pairs
        .filter((p) => p.mistakenFor)
        .map((p) => ({ mistakenFor: p.mistakenFor, count: p.count }));
    }

    const newVariantData = await generateVariant(
      {
        originalQuestion: originalQuestion.question,
        originalOptions: options,
        originalAnswer: originalQuestion.correctAnswer,
        originalExplanation: originalQuestion.explanation,
        targetType,
        confusionPairs: confusionPairs.length > 0 ? confusionPairs : undefined,
      },
      this.apiKey,
    );

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
