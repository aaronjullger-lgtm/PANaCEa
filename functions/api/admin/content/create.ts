/**
 * API: Create new medical content
 * POST /api/admin/content/create
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../../_shared/auth';
import { canEditContent, type UserRole } from '../../_shared/rbac';
import { createDraft } from '../../../../lib/services/cms/contentService';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { id: true, role: true }
    });

    if (!user || !canEditContent(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const { conditionId, system, subcategory, condition, content, description } = body;

    // Validate required fields
    if (!conditionId || !system || !subcategory || !condition) {
      return createErrorResponse('Missing required fields', 400);
    }

    // Check if conditionId already exists
    const existing = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (existing) {
      return createErrorResponse('Content with this conditionId already exists', 409);
    }

    // Get client IP and user agent for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const newContent = await createDraft(
      prisma as any,
      {
        conditionId,
        system,
        subcategory,
        condition,
        content: content || {},
      },
      {
        userId: user.id,
        userRole: user.role as UserRole,
        ipAddress,
        userAgent,
        description: description || 'Created new content',
      }
    );

    return createSuccessResponse(newContent, 201);
  } catch (error: any) {
    console.error('Error creating content:', error);
    return createErrorResponse(error.message || 'Failed to create content', 500);
  } finally {
    await prisma.$disconnect();
  }
}
