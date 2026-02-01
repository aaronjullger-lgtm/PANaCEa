import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { generateComparison } from '../../../services/core/comparisonGenerator';

const ComparisonSchema = z.object({
  query: z.object({
    correctId: z.string().min(1),
    selectedId: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

/**
 * GET /api/ddx/comparison
 * Generate or retrieve a comparison table between two conditions
 */
export const onRequestGet = authenticatedEndpoint(ComparisonSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/ddx/comparison');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { correctId, selectedId } = validated.query;

    if (!env.GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY not configured');
      return { status: 500, error: 'AI service not configured' };
    }

    // Fetch both conditions
    const [correctCondition, selectedCondition] = await Promise.all([
      prisma.medicalContent.findUnique({
        where: { id: correctId },
        select: {
          id: true,
          condition: true,
          system: true,
          content: true,
        },
      }),
      prisma.medicalContent.findUnique({
        where: { id: selectedId },
        select: {
          id: true,
          condition: true,
          system: true,
          content: true,
        },
      }),
    ]);

    if (!correctCondition || !selectedCondition) {
      return { status: 404, error: 'One or both conditions not found' };
    }

    // Check if comparison already exists in content.comparisons
    const existingContent = correctCondition.content as any;
    const existingComparisons = existingContent?.comparisons || {};
    const comparisonKey = `${selectedCondition.id}`;

    if (existingComparisons[comparisonKey]) {
      logger.info('Returning cached comparison', {
        correctId,
        selectedId,
      });
      return {
        data: {
          comparison: existingComparisons[comparisonKey],
          cached: true,
        },
      };
    }

    // Generate new comparison using Gemini
    logger.info('Generating new comparison via Gemini', {
      correctId,
      selectedId,
      correctCondition: correctCondition.condition,
      selectedCondition: selectedCondition.condition,
    });

    const comparison = await generateComparison({
      correctConditionId: correctCondition.id,
      selectedConditionId: selectedCondition.id,
      correctConditionName: correctCondition.condition,
      selectedConditionName: selectedCondition.condition,
      apiKey: env.GEMINI_API_KEY,
    });

    if (!comparison) {
      logger.error('Failed to generate comparison');
      return { status: 500, error: 'Failed to generate comparison' };
    }

    // Store comparison in both conditions' content.comparisons field
    try {
      await Promise.all([
        prisma.medicalContent.update({
          where: { id: correctCondition.id },
          data: {
            content: {
              ...(existingContent || {}),
              comparisons: {
                ...(existingContent?.comparisons || {}),
                [selectedCondition.id]: comparison,
              },
            },
          },
        }),
        prisma.medicalContent.update({
          where: { id: selectedCondition.id },
          data: {
            content: {
              ...((selectedCondition.content as any) || {}),
              comparisons: {
                ...((selectedCondition.content as any)?.comparisons || {}),
                [correctCondition.id]: comparison,
              },
            },
          },
        }),
      ]);

      logger.info('Comparison generated and cached successfully', {
        correctId,
        selectedId,
        featureCount: comparison.features.length,
      });
    } catch (updateError) {
      // Don't fail the request if caching fails
      logger.warn('Failed to cache comparison', {
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    return {
      data: {
        comparison,
        cached: false,
      },
    };
  } catch (error) {
    logger.error('Failed to generate/retrieve comparison', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to generate comparison' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
