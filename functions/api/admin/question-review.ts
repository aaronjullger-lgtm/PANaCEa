/**
 * Question Review API Endpoint
 * Admin workflow for validating PreGeneratedQuestions
 *
 * GET  /api/admin/question-review - List questions pending review
 * POST /api/admin/question-review - Update validation status
 *
 * Workflow: pending → approved | rejected | needs_revision
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { isAdmin, type UserRole } from '../_shared/rbac';

// Query schema for GET requests
const GetQuerySchema = z.object({
  query: z.object({
    validationStatus: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
    system: z.string().optional(),
    minQualityScore: z.string().optional(),
    maxFlagRate: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
    sortBy: z.enum(['qualityScore', 'flagRate', 'generatedAt', 'timesServed']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
});

// Validation schema for POST requests
const ValidationSchema = z.object({
  body: z.object({
    questionId: z.string(),
    validationStatus: z.enum(['approved', 'rejected', 'needs_revision']),
    validationNotes: z.string().optional(),
    qualityScore: z.number().min(0).max(100).optional(),
    conditionAccuracy: z.number().min(0).max(1).optional(),
    contentRelevance: z.number().min(0).max(1).optional(),
    distracorQuality: z.number().min(0).max(1).optional(),
  }),
});

export const onRequestOptions = withCors();

/**
 * GET - List questions for review
 */
export const onRequestGet = authenticatedEndpoint(GetQuerySchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/question-review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user is admin or content_creator
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    if (!user || (!isAdmin(user.role as UserRole) && user.role !== 'content_creator')) {
      logger.warn('Non-admin attempted to access question review', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    // Parse query parameters with defaults
    const validationStatus = validated.query?.validationStatus || 'pending';
    const system = validated.query?.system;
    const minQualityScore = validated.query?.minQualityScore ? parseFloat(validated.query.minQualityScore) : undefined;
    const maxFlagRate = validated.query?.maxFlagRate ? parseFloat(validated.query.maxFlagRate) : undefined;
    const limit = validated.query?.limit ? parseInt(validated.query.limit) : 50;
    const offset = validated.query?.offset ? parseInt(validated.query.offset) : 0;
    const sortBy = validated.query?.sortBy || 'generatedAt';
    const sortOrder = validated.query?.sortOrder || 'desc';

    // Build where clause
    const where: any = {
      validationStatus,
    };

    if (system) where.system = system;
    if (minQualityScore !== undefined) {
      where.qualityScore = { gte: minQualityScore };
    }
    if (maxFlagRate !== undefined) {
      where.flagRate = { lte: maxFlagRate };
    }

    // Query questions with condition details
    const [questions, totalCount] = await Promise.all([
      prisma.preGeneratedQuestion.findMany({
        where,
        select: {
          id: true,
          questionType: true,
          system: true,
          conditionId: true,
          difficulty: true,
          questionData: true,
          generatedAt: true,
          qualityScore: true,
          conditionAccuracy: true,
          contentRelevance: true,
          distracorQuality: true,
          validationStatus: true,
          validationNotes: true,
          validatedAt: true,
          validatedBy: true,
          timesServed: true,
          timesCorrect: true,
          timesIncorrect: true,
          flagCount: true,
          flagRate: true,
          Condition: {
            select: {
              id: true,
              name: true,
              system: true,
              panceYield: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.preGeneratedQuestion.count({ where }),
    ]);

    // Calculate pagination metadata
    const hasMore = totalCount > offset + limit;
    const pages = Math.ceil(totalCount / limit);

    logger.info('Questions retrieved for review', {
      userId: user.id,
      validationStatus,
      count: questions.length,
      total: totalCount,
    });

    return {
      data: {
        success: true,
        data: questions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore,
          pages,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching questions for review', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch questions for review');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * POST - Update question validation status
 */
export const onRequestPost = authenticatedEndpoint(ValidationSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/question-review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user is admin or content_creator
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true, name: true },
    });

    if (!user || (!isAdmin(user.role as UserRole) && user.role !== 'content_creator')) {
      logger.warn('Non-admin attempted to update question validation', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    const validation = validated.body;

    // Check if question exists
    const existingQuestion = await prisma.preGeneratedQuestion.findUnique({
      where: { id: validation.questionId },
      select: { id: true, validationStatus: true },
    });

    if (!existingQuestion) {
      logger.info('Question not found for validation', {
        questionId: validation.questionId,
        userId: user.id,
      });

      return {
        data: {
          success: false,
          error: 'Question not found',
        },
        status: 404,
      };
    }

    // Update validation status
    const updateData: any = {
      validationStatus: validation.validationStatus,
      validatedAt: new Date(),
      validatedBy: auth.userId,
    };

    if (validation.validationNotes) {
      updateData.validationNotes = validation.validationNotes;
    }
    if (validation.qualityScore !== undefined) {
      updateData.qualityScore = validation.qualityScore;
    }
    if (validation.conditionAccuracy !== undefined) {
      updateData.conditionAccuracy = validation.conditionAccuracy;
    }
    if (validation.contentRelevance !== undefined) {
      updateData.contentRelevance = validation.contentRelevance;
    }
    if (validation.distracorQuality !== undefined) {
      updateData.distracorQuality = validation.distracorQuality;
    }

    const updatedQuestion = await prisma.preGeneratedQuestion.update({
      where: { id: validation.questionId },
      data: updateData,
      select: {
        id: true,
        validationStatus: true,
        validatedAt: true,
        validatedBy: true,
        qualityScore: true,
        validationNotes: true,
      },
    });

    logger.info('Question validation updated', {
      questionId: validation.questionId,
      validationStatus: validation.validationStatus,
      userId: user.id,
    });

    return {
      data: {
        success: true,
        data: updatedQuestion,
        message: `Question ${validation.validationStatus}`,
      },
    };
  } catch (error) {
    logger.error('Error updating question validation', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });

    if (error instanceof z.ZodError) {
      return {
        data: {
          success: false,
          error: 'Invalid request data',
          details: error.issues,
        },
        status: 400,
      };
    }

    throw new Error('Failed to update question validation');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
