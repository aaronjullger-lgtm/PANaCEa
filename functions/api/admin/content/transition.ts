/**
 * API: Transition content status
 * POST /api/admin/content/transition
 *
 * Body: { contentId, newStatus, description }
 *
 * Valid transitions:
 * - draft -> pending_review, archived
 * - pending_review -> draft, approved, archived
 * - approved -> published, draft, archived
 * - published -> archived, draft
 * - archived -> draft
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import {
  canEditContent,
  canApproveContent,
  canPublishContent,
  type UserRole,
} from '../../_shared/rbac';
import { transitionStatus, type ContentStatus } from '../../../../lib/services/cms/contentService';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateRequest, AdminContentTransitionSchema } from '../../_shared/schemas';

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
      select: { id: true, role: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), AdminContentTransitionSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { contentId, newStatus, description } = (validation as { success: true; data: any }).data;

    // Check permissions based on target status
    const userRole = user.role as UserRole;

    if (newStatus === 'pending_review' && !canEditContent(userRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions to submit for review', 403);
    }

    if (newStatus === 'approved' && !canApproveContent(userRole)) {
      return createErrorResponse('Forbidden: Only approvers can approve content', 403);
    }

    if (newStatus === 'published' && !canPublishContent(userRole)) {
      return createErrorResponse('Forbidden: Only admins can publish content', 403);
    }

    // Get client IP and user agent for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const updated = await transitionStatus(prisma as any, contentId, newStatus as ContentStatus, {
      userId: user.id,
      userRole,
      ipAddress,
      userAgent,
      description: description || `Status changed to ${newStatus}`,
    });

    return createSuccessResponse(updated);
  } catch (error: any) {
    console.error('Error transitioning content status:', error);
    return createErrorResponse(error.message || 'Failed to transition status', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
