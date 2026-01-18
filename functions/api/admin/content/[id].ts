/**
 * API: Get, Update, or Delete specific medical content
 * GET    /api/admin/content/[id] - Get content by ID
 * PUT    /api/admin/content/[id] - Update content
 * DELETE /api/admin/content/[id] - Delete content
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import { canViewCMS, canEditContent, isAdmin, type UserRole } from '../../_shared/rbac';
import { updateContent } from '../../../../lib/services/cms/contentService';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateRequest, AdminContentUpdateSchema } from '../../_shared/schemas';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id: string };
}) {
  const { request, env, params } = context;

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
      select: { id: true, role: true },
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    const content = await prisma.medicalContent.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10, // Last 10 versions
        },
      },
    });

    if (!content) {
      return createErrorResponse('Content not found', 404);
    }

    return createSuccessResponse(content);
  } catch (error: any) {
    console.error('Error fetching content:', error);
    return createErrorResponse('Failed to fetch content', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
  params: { id: string };
}) {
  const { request, env, params } = context;

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
      select: { id: true, role: true },
    });

    if (!user || !canEditContent(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), AdminContentUpdateSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { content: contentData, description } = (validation as { success: true; data: any }).data;

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const updated = await updateContent(
      prisma as any,
      params.id,
      { content: contentData },
      {
        userId: user.id,
        userRole: user.role as UserRole,
        ipAddress,
        userAgent,
        description: description || 'Content updated',
      }
    );

    return createSuccessResponse(updated);
  } catch (error: any) {
    console.error('Error updating content:', error);
    return createErrorResponse(error.message || 'Failed to update content', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
  params: { id: string };
}) {
  const { request, env, params } = context;

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
      select: { id: true, role: true },
    });

    if (!user || !isAdmin(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Only admins can delete content', 403);
    }

    // Soft delete by archiving
    const updated = await prisma.medicalContent.update({
      where: { id: params.id },
      data: {
        status: 'archived',
        updatedBy: user.id,
      },
    });

    return createSuccessResponse({ success: true, content: updated });
  } catch (error: any) {
    console.error('Error deleting content:', error);
    return createErrorResponse('Failed to delete content', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}