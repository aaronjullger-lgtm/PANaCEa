/**
 * Question Generation Endpoint (SECURED)
 *
 * SECURITY FIXES APPLIED:
 * - Enforced authentication before any processing
 * - Implemented secure CORS with origin validation
 * - Added IP-based rate limiting fallback
 * - Replaced console.error with secure logging
 * - Added proper error handling with redacted logs
 * - Early environment validation (fail-fast)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { findSimilarCachedQuestion, cacheGeneratedQuestion } from '../_shared/semantic-cache';
import { loadConditionData } from '../_shared/condition-loader';
import { generateSingleQuestion } from '../_shared/question-generator';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';

/**
 * Extract clinical pearls from a question's rationale using regex patterns
 * Adapted from services/questionService.ts
 */
function extractPearlsFromRationale(rationale: string): string[] {
  const pearls: string[] = [];

  // Pattern 1: "Key Takeaway:" or "Clinical Pearl:" followed by content
  const keyTakeawayPattern =
    /(?:Key Takeaway|Clinical Pearl|Remember|Important|High-Yield Fact):\s*(.+?)(?:\n\n|$)/gi;
  let match;
  while ((match = keyTakeawayPattern.exec(rationale)) !== null) {
    const pearl = match[1]?.trim();
    if (pearl && pearl.length > 10 && pearl.length < 500) {
      pearls.push(pearl);
    }
  }

  // Pattern 2: Bullet points that look like pearls (start with • or - and are concise)
  const bulletPattern = /^[•-]\s*(.{10,300})$/gm;
  while ((match = bulletPattern.exec(rationale)) !== null) {
    const pearl = match[1]?.trim();
    // Filter for high-quality pearls (avoid generic statements)
    if (pearl && pearl.length > 20 && !pearl.toLowerCase().startsWith('the correct answer')) {
      pearls.push(pearl);
    }
  }

  // Pattern 3: Sentences with clinical keywords that indicate high-yield info
  const clinicalKeywords = [
    'classic presentation',
    'gold standard',
    'first-line',
    'diagnostic criteria',
    'pathognomonic',
  ];
  const sentences = rationale.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    if (clinicalKeywords.some((kw) => normalized.includes(kw))) {
      const pearl = sentence.trim();
      if (pearl.length > 20 && pearl.length < 300) {
        pearls.push(pearl);
      }
    }
  }

  // Deduplicate and limit to top 5 pearls
  return Array.from(new Set(pearls)).slice(0, 5);
}

/**
 * Save extracted pearls to MedicalContent table
 */
async function savePearlsToMedicalContent(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  conditionId: string,
  pearls: string[]
): Promise<void> {
  if (pearls.length === 0) return;

  try {
    // Fetch existing content
    const medicalContent = await prisma.medicalContent.findUnique({
      where: { id: conditionId },
      select: { content: true },
    });

    if (!medicalContent) {
      // If medical content not found, we cannot save pearls
      console.warn(`Medical content not found for conditionId: ${conditionId}`);
      return;
    }

    // Merge new pearls with existing ones (deduplicate)
    const content = medicalContent.content as Record<string, any>;
    const existingPearls = Array.isArray(content?.pearls) ? content.pearls : [];
    const allPearls = [...existingPearls, ...pearls];

    // Deduplicate pearls (case-insensitive comparison)
    const uniquePearls = allPearls.filter(
      (pearl, index, self) =>
        index === self.findIndex((p) => p.toLowerCase().trim() === pearl.toLowerCase().trim())
    );

    // Limit to 50 pearls per condition to prevent bloat
    const limitedPearls = uniquePearls.slice(0, 50);

    // Update MedicalContent with new pearls
    await prisma.medicalContent.update({
      where: { id: conditionId },
      data: {
        content: {
          ...content,
          pearls: limitedPearls,
        },
      },
    });

    console.log(`[Pearl Harvester] Saved ${pearls.length} pearls for ${conditionId}`);
  } catch (error) {
    console.error('[Pearl Harvester] Failed to save pearls:', error);
  }
}

/**
 * Find a suitable staging question that matches the query criteria.
 * Returns a staging question if found, otherwise null.
 */
async function findSuitableStagingQuestion(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  system: string | undefined,
  difficulty: string | undefined,
  conditionName?: string
): Promise<any | null> {
  try {
    const where: any = {
      status: 'graded', // Only consider questions that have passed adequacy check
    };
    if (system) {
      where.system = system;
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }
    // Optional: filter by tags containing condition name (if provided)
    // Since tags is a JSON array, we need to use Prisma's array_contains syntax
    // For simplicity, we'll ignore tags filter for now.

    const stagingQuestion = await prisma.stagingQuestion.findFirst({
      where,
      orderBy: { createdAt: 'asc' }, // Oldest first
    });

    if (stagingQuestion) {
      console.log('[Staging Lake] Found suitable staging question', {
        stagingId: stagingQuestion.id,
        system: stagingQuestion.system,
        difficulty: stagingQuestion.difficulty,
      });
      return stagingQuestion;
    }
  } catch (error) {
    // Log but don't fail; staging lookup is optional
    console.warn('[Staging Lake] Failed to query staging lake', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

const GenerateQuestionSchema = z.object({
  queryText: z.string().min(1),
  questionType: z.string().min(1),
  system: z.string().optional(),
  difficulty: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateQuestionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  // Validate required environment variables early (fail-fast)
  try {
    validateFunctionEnv(env, 'FULL_STACK');
  } catch (error) {
    if (error instanceof MissingEnvError) {
      logger.error('Missing environment variables', { missing: error.missingVars });
      return error.toResponse();
    }
    throw error;
  }

  try {
    const { queryText, questionType, system, difficulty } = validated;

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
      } else {
        // Try to find a suitable staging question before generating new one
        const stagingQuestion = await findSuitableStagingQuestion(
          prisma,
          system || conditionData.system,
          difficulty,
          conditionData.name
        );
        if (stagingQuestion) {
          // Convert staging question to the same shape as generated question
          newQuestion = {
            id: stagingQuestion.id,
            type: questionType,
            system: stagingQuestion.system,
            difficulty: stagingQuestion.difficulty,
            text: stagingQuestion.question,
            vignette: stagingQuestion.vignette,
            options: stagingQuestion.options,
            correctAnswer: stagingQuestion.correctAnswer,
            explanation: stagingQuestion.explanation,
            generatedAt: stagingQuestion.createdAt.toISOString(),
            metadata: {
              originalQuery: queryText,
              cached: false,
              fromStaging: true,
              stagingStatus: stagingQuestion.status,
            },
          };
          logger.info('Returning staging question', {
            stagingId: stagingQuestion.id,
            userId: auth.userId
          });
          // Skip AI generation, proceed to caching
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

          const textbookContext = await getTextbookContext(prisma, {
            system: system || conditionData.system,
            queryText,
          });

          const generatedQ = await generateSingleQuestion(
            env.GEMINI_API_KEY,
            transformedCondition,
            questionType,
            textbookContext
          );

          if (generatedQ) {
            const hasTextbookContext = Boolean(textbookContext);
            newQuestion = {
              ...generatedQ,
              system: system || conditionData.system,
              difficulty: difficulty || 'medium',
              generatedAt: new Date().toISOString(),
              metadata: {
                originalQuery: queryText,
                cached: false,
                contentSource: hasTextbookContext ? 'openstax' : undefined,
                contentSourceTitle: hasTextbookContext ? textbookContext?.title : undefined,
              },
            };

            // Extract and save clinical pearls from rationale
            try {
              if (generatedQ.explanation?.rationale) {
                const pearls = extractPearlsFromRationale(generatedQ.explanation.rationale);
                if (pearls.length > 0) {
                  await savePearlsToMedicalContent(prisma, conditionData.id, pearls);
                  logger.debug('Clinical pearls extracted and saved', {
                    pearlCount: pearls.length,
                    conditionId: conditionData.id,
                    userId: auth.userId,
                  });
                }
              }
            } catch (pearlError) {
              // Log but don't fail question generation
              logger.warn('Failed to extract/save clinical pearls', {
                error: pearlError instanceof Error ? pearlError.message : String(pearlError),
                conditionId: conditionData.id,
                userId: auth.userId,
              });
            }

            logger.info('Question generated successfully', { userId: auth.userId });
          }
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

async function getTextbookContext(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  options: { system?: string; queryText?: string }
): Promise<{ title: string; excerpts: string[] } | null> {
  const { system, queryText } = options;

  const where: {
    source?: string;
    systemCodes?: { has: string };
    OR?: { text?: { contains: string; mode: 'insensitive' } }[];
  } = {
    source: 'OpenStax',
  };

  if (system) {
    where.systemCodes = { has: system };
  }

  if (queryText) {
    where.OR = [{ text: { contains: queryText, mode: 'insensitive' } }];
  }

  const chunks = await prisma.textbookChunk.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: {
      text: true,
      bookTitle: true,
      chapter: true,
      section: true,
    },
  });

  if (chunks.length === 0) return null;

  const title = chunks[0]?.bookTitle || 'OpenStax Textbook';
  const excerpts = chunks.map((chunk) => {
    const headingParts = [chunk.chapter, chunk.section].filter(Boolean);
    const heading = headingParts.length > 0 ? `(${headingParts.join(' - ')}) ` : '';
    return `${heading}${chunk.text}`;
  });

  return { title, excerpts };
}
