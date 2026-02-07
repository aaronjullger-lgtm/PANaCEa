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
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
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

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { id: true, role: true },
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse(
        request,
        'Forbidden: Insufficient permissions',
        403,
        undefined,
        env
      );
    }

    const content = await prisma.medicalContent.findUnique({
      where: { id: params.id },
      include: {
        ContentVersion: {
          orderBy: { version: 'desc' },
          take: 10, // Last 10 versions
        },
      },
    });

    if (!content) {
      return createErrorResponse(request, 'Content not found', 404, undefined, env);
    }

    return createSuccessResponse(request, content, 200, 0, env);
  } catch (error: any) {
    console.error('Error fetching content:', error);
    return createErrorResponse(request, 'Failed to fetch content', 500, undefined, env);
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

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { id: true, role: true },
    });

    if (!user || !canEditContent(user.role as UserRole)) {
      return createErrorResponse(
        request,
        'Forbidden: Insufficient permissions',
        403,
        undefined,
        env
      );
    }

    // Validate input with Zod schema
    const validation = await validateRequest(
      request.clone() as Request<unknown, unknown>,
      AdminContentUpdateSchema
    );
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

    return createSuccessResponse(request, updated, 200, 0, env);
  } catch (error: any) {
    console.error('Error updating content:', error);
    return createErrorResponse(request, error.message || 'Failed to update content', 500, undefined, env);
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

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { id: true, role: true },
    });

    if (!user || !isAdmin(user.role as UserRole)) {
      return createErrorResponse(
        request,
        'Forbidden: Only admins can delete content',
        403,
        undefined,
        env
      );
    }

    // Soft delete by archiving
    const updated = await prisma.medicalContent.update({
      where: { id: params.id },
      data: {
        status: 'archived',
        updatedBy: user.id,
      },
    });

    return createSuccessResponse(request, { success: true, content: updated }, 200, 0, env);
  } catch (error: any) {
    console.error('Error deleting content:', error);
    return createErrorResponse(request, 'Failed to delete content', 500, undefined, env);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
