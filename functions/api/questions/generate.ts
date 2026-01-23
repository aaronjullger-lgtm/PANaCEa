/**
 * Question Generation Endpoint (SECURED)
 *
 * SECURITY FIXES APPLIED:
 * - Enforced authentication before any processing
 * - Implemented secure CORS with origin validation
 * - Added IP-based rate limiting fallback
 * - Replaced console.error with secure logging
 * - Added proper error handling with redacted logs
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { findSimilarCachedQuestion, cacheGeneratedQuestion } from '../_shared/semantic-cache';
import { loadConditionData } from '../_shared/condition-loader';
import { generateSingleQuestion } from '../_shared/question-generator';

const GenerateQuestionSchema = z.object({
  body: z.object({
    queryText: z.string().min(1),
    questionType: z.string().min(1),
    system: z.string().optional(),
    difficulty: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateQuestionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { queryText, questionType, system, difficulty } = validated.body;

    // Validate database configuration
    if (!env.DATABASE_URL) {
      logger.error('Database not configured');
      throw new Error('Service configuration error');
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Check cache first
    const cached = await findSimilarCachedQuestion(prisma, {
      queryText,
      questionType,
      system,
      difficulty,
    });

    if (cached) {
      logger.info('Returning cached question', {
        similarity: cached.similarity,
        userId: auth.userId,
      });

      return {
        data: {
          success: true,
          question: cached.question,
          cached: true,
          similarity: cached.similarity,
        },
      };
    }

    // Generate new question
    let newQuestion = null;

    try {
      const conditionData = await loadConditionData(prisma, queryText);

      // SECURITY FIX 3: Explicit null check before proceeding
      if (!conditionData) {
        logger.warn('Condition not found', { queryText, userId: auth.userId });

        // Return fallback question
        newQuestion = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: questionType,
          system: system || null,
          difficulty: difficulty || 'medium',
          text: `Unable to find condition: ${queryText}. Please verify the condition name.`,
          options:
            questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : undefined,
          correctAnswer: questionType === 'mcq' ? 'Option A' : undefined,
          explanation: 'Condition not found in database.',
          generatedAt: new Date().toISOString(),
          metadata: {
            originalQuery: queryText,
            cached: false,
            conditionNotFound: true,
          },
        };
      } else if (env.GEMINI_API_KEY) {
        const transformedCondition = {
          condition: conditionData.name,
          sections: {
            overview: conditionData.content.overview || '',
            etiology: conditionData.content.etiologyPathophysiology || '',
            clinicalPresentation: conditionData.content.clinicalPresentation || '',
            diagnostics: conditionData.content.diagnostics?.notes || '',
            treatment: (
              conditionData.content.treatment ||
              conditionData.content.management ||
              []
            ).join('\n'),
          },
        };

        const generatedQ = await generateSingleQuestion(
          env.GEMINI_API_KEY,
          transformedCondition,
          questionType
        );

        if (generatedQ) {
          newQuestion = {
            ...generatedQ,
            system: system || conditionData.system,
            difficulty: difficulty || 'medium',
            generatedAt: new Date().toISOString(),
            metadata: {
              originalQuery: queryText,
              cached: false,
            },
          };

          logger.info('Question generated successfully', { userId: auth.userId });
        }
      }
    } catch (generationError) {
      // SECURITY FIX 4: Use secure logging (no sensitive data exposure)
      logger.error('Question generation failed', {
        error: generationError instanceof Error ? generationError.message : String(generationError),
        queryText,
        questionType,
        userId: auth.userId,
      });
    }

    // Final fallback if generation failed
    if (!newQuestion) {
      logger.warn('Using fallback question', { userId: auth.userId });

      newQuestion = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: questionType,
        system: system || null,
        difficulty: difficulty || 'medium',
        text: `Unable to generate question for: ${queryText}. Please try again.`,
        options:
          questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : undefined,
        correctAnswer: questionType === 'mcq' ? 'Option A' : undefined,
        explanation: 'Question generation temporarily unavailable.',
        generatedAt: new Date().toISOString(),
        metadata: {
          originalQuery: queryText,
          cached: false,
          generationFailed: true,
        },
      };
    }

    // Cache the result
    await cacheGeneratedQuestion(
      prisma,
      {
        queryText,
        questionType,
        system,
        difficulty,
      },
      newQuestion
    );

    logger.info('Question generation completed', {
      userId: auth.userId,
      cached: false,
      questionId: newQuestion.id,
    });

    return {
      data: {
        success: true,
        question: newQuestion,
        cached: false,
      },
    };
  } catch (error) {
    // SECURITY FIX 6: Secure error logging
    logger.error('Unexpected error in question generation', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });

    throw new Error('An unexpected error occurred');
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
});
