/**
 * API: Create new medical content
 * POST /api/admin/content/create
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { canEditContent, type UserRole } from '../../_shared/rbac';
import { createDraft } from '../../../../lib/services/cms/contentService';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateRequest, AdminContentCreateSchema } from '../../_shared/schemas';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

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
    const validation = await validateRequest(request.clone(), AdminContentCreateSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { conditionId, system, subcategory, condition, content, description } = (
      validation as { success: true; data: any }
    ).data;

    // Check if conditionId already exists
    const existing = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (existing) {
      return createErrorResponse(
        request,
        'Content with this conditionId already exists',
        409,
        undefined,
        env
      );
    }

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
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

    return createSuccessResponse(request, newContent, 201, 0, env);
  } catch (error: any) {
    console.error('Error creating content:', error);
    return createErrorResponse(
      request,
      error.message || 'Failed to create content',
      500,
      undefined,
      env
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
