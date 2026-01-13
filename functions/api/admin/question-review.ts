/**
 * Question Review API Endpoint
 * Admin workflow for validating PreGeneratedQuestions
 * 
 * GET  /api/admin/question-review - List questions pending review
 * POST /api/admin/question-review - Update validation status
 * 
 * Workflow: pending → approved | rejected | needs_revision
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest, handleCorsOptions, isAdmin } from '../_shared/auth';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

// Query schema for GET requests
const GetQuerySchema = z.object({
  validationStatus: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  system: z.string().optional(),
  minQualityScore: z.coerce.number().min(0).max(100).optional(),
  maxFlagRate: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['qualityScore', 'flagRate', 'generatedAt', 'timesServed']).default('generatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Validation schema for POST requests
const ValidationSchema = z.object({
  questionId: z.string(),
  validationStatus: z.enum(['approved', 'rejected', 'needs_revision']),
  validationNotes: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  conditionAccuracy: z.number().min(0).max(1).optional(),
  contentRelevance: z.number().min(0).max(1).optional(),
  distracorQuality: z.number().min(0).max(1).optional(),
});

export const onRequestOptions = handleCorsOptions;

/**
 * GET - List questions for review
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // Authenticate and check admin access
    const auth = await authenticateRequest(request, env.CLERK_SECRET_KEY);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true }
    });

    if (!user || (user.role !== 'admin' && user.role !== 'content_creator')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const params = GetQuerySchema.parse({
      validationStatus: url.searchParams.get('validationStatus') || 'pending',
      system: url.searchParams.get('system') || undefined,
      minQualityScore: url.searchParams.get('minQualityScore') || undefined,
      maxFlagRate: url.searchParams.get('maxFlagRate') || undefined,
      limit: url.searchParams.get('limit') || 50,
      offset: url.searchParams.get('offset') || 0,
      sortBy: url.searchParams.get('sortBy') || 'generatedAt',
      sortOrder: url.searchParams.get('sortOrder') || 'desc',
    });

    // Build where clause
    const where: any = {
      validationStatus: params.validationStatus || 'pending'
    };
    
    if (params.system) where.system = params.system;
    if (params.minQualityScore !== undefined) {
      where.qualityScore = { gte: params.minQualityScore };
    }
    if (params.maxFlagRate !== undefined) {
      where.flagRate = { lte: params.maxFlagRate };
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
              panceYield: true
            }
          }
        },
        orderBy: { [params.sortBy]: params.sortOrder },
        take: params.limit,
        skip: params.offset,
      }),
      prisma.preGeneratedQuestion.count({ where })
    ]);

    // Calculate pagination metadata
    const hasMore = totalCount > params.offset + params.limit;
    const pages = Math.ceil(totalCount / params.limit);

    return new Response(JSON.stringify({
      success: true,
      data: questions,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore,
        pages
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error fetching questions for review:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * POST - Update question validation status
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // Authenticate and check admin access
    const auth = await authenticateRequest(request, env.CLERK_SECRET_KEY);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true, name: true }
    });

    if (!user || (user.role !== 'admin' && user.role !== 'content_creator')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ValidationSchema.parse(body);

    // Check if question exists
    const existingQuestion = await prisma.preGeneratedQuestion.findUnique({
      where: { id: validation.questionId },
      select: { id: true, validationStatus: true }
    });

    if (!existingQuestion) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Question not found'
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
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
        validationNotes: true
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: updatedQuestion,
      message: `Question ${validation.validationStatus}`
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error updating question validation:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } finally {
    await prisma.$disconnect();
  }
};
