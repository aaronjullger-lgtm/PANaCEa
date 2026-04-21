/**
 * Question Review API Endpoint
 * Admin workflow for validating PreGeneratedQuestions
 *
 * GET  /api/admin/question-review - List questions pending review
 * POST /api/admin/question-review - Update validation status
 *
 * Workflow: pending → approved | rejected | needs_revision
 *
 * Phase 2 Enhancement: Added review queue stats and batch auto-approve
 * via query param ?action=stats or ?action=auto-approve
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';
import { autoApproveHighQuality, getReviewQueueStats } from '../../../lib/services/questionReviewGate';

// Query schema for GET requests
const GetQuerySchema = z.object({
  // Phase 2: action param for stats and batch operations
  // ?action=stats → returns review queue statistics
  // ?action=auto-approve → batch approve high-quality pending questions
  // ?action=auto-approve&dryRun=true → preview without applying
  action: z.enum(['stats', 'auto-approve']).optional(),
  dryRun: z.string().optional(),
  validationStatus: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  system: z.string().optional(),
  minQualityScore: z.string().optional(),
  maxFlagRate: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  sortBy: z.enum(['qualityScore', 'flagRate', 'generatedAt', 'timesServed']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
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

/**
 * GET - List questions for review
 */
export const onRequestGet = adminAuthenticatedEndpoint(
  GetQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/question-review');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // withAdminRole() in adminAuthenticatedEndpoint already verified admin access.
      const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;

      // Phase 2: Handle special actions (stats, auto-approve)
      if (validated.action === 'stats') {
        const stats = await getReviewQueueStats(prisma);
        logger.info('Review queue stats requested', { userId: adminUserId, stats });
        return { data: { success: true, data: stats } };
      }

      if (validated.action === 'auto-approve') {
        const dryRun = validated.dryRun === 'true';
        const result = await autoApproveHighQuality(prisma, { dryRun });
        logger.info('Auto-approve executed', { userId: adminUserId, dryRun, ...result });
        return {
          data: {
            success: true,
            data: result,
            message: dryRun
              ? `Would auto-approve ${result.approved} questions (${result.alreadyApproved} already approved)`
              : `Auto-approved ${result.approved} questions (${result.alreadyApproved} were already approved)`,
          },
        };
      }

      // Parse query parameters with defaults
      const validationStatus = validated.validationStatus || 'pending';
      const system = validated.system;
      const minQualityScore = validated.minQualityScore
        ? parseFloat(validated.minQualityScore)
        : undefined;
      const maxFlagRate = validated.maxFlagRate ? parseFloat(validated.maxFlagRate) : undefined;
      const limit = validated.limit ? parseInt(validated.limit) : 50;
      const offset = validated.offset ? parseInt(validated.offset) : 0;
      const sortBy = validated.sortBy || 'generatedAt';
      const sortOrder = validated.sortOrder || 'desc';

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
        userId: adminUserId,
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
  },
  { source: 'query' }
);

/**
 * POST - Update question validation status
 */
export const onRequestPost = adminAuthenticatedEndpoint(ValidationSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/question-review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // withAdminRole() in adminAuthenticatedEndpoint already verified admin access.
    const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;

    const validation = validated.body;

    // Check if question exists
    const existingQuestion = await prisma.preGeneratedQuestion.findUnique({
      where: { id: validation.questionId },
      select: { id: true, validationStatus: true },
    });

    if (!existingQuestion) {
      logger.info('Question not found for validation', {
        questionId: validation.questionId,
        userId: adminUserId,
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
      userId: adminUserId,
    });

    auditLog('admin_question_review', {
      userId: auth.userId,
      questionId: validation.questionId,
      validationStatus: validation.validationStatus,
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
