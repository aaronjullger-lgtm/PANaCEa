/**
 * Media Approval API Endpoint
 *
 * Handles approval/rejection of media assets by admins.
 *
 * POST /api/admin/media/approve
 * - mediaId: ID of the media asset
 * - action: 'approve' | 'reject'
 * - reason: optional rejection reason
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
} from '../../_shared/auth';
import { validateRequest, AdminMediaApproveSchema } from '../../_shared/schemas';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

type ApprovalAction = 'approve' | 'reject';

// Batch approval schema
const BatchApproveSchema = z.object({
  mediaIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate - require admin role
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), AdminMediaApproveSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const {
      mediaId,
      action,
      rejectionReason: reason,
    } = (validation as { success: true; data: any }).data;

    // Get the media asset
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return createErrorResponse('Media not found', 404);
    }

    if (media.approvalStatus === 'approved' && action === 'approve') {
      return createErrorResponse('Media is already approved', 400);
    }

    // Update approval status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const newFolder = action === 'approve' ? 'approved' : 'rejected';
    const newFileStatus = action === 'approve' ? 'active' : 'rejected';

    const updatedMedia = await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        approvalStatus: newStatus,
        status: newFileStatus,
        folder: newFolder,
        approvedBy: action === 'approve' ? user.id : null,
        approvedAt: action === 'approve' ? new Date() : null,
        rejectionReason: action === 'reject' ? reason : null,
        updatedAt: new Date(),
      },
    });

    // Log the approval action
    console.log(`Media ${action}d: ${mediaId} by user ${user.id}`);

    return createSuccessResponse({
      id: updatedMedia.id,
      approvalStatus: updatedMedia.approvalStatus,
      action,
      message: `Media ${action}d successfully`,
    });
  } catch (error) {
    console.error('Media approval error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Approval failed', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
};

// Batch approval endpoint
export const onRequestPut = async (context: { request: Request; env: Env }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), BatchApproveSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { mediaIds, action, reason } = (validation as { success: true; data: any }).data;

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const newFolder = action === 'approve' ? 'approved' : 'rejected';
    const newFileStatus = action === 'approve' ? 'active' : 'rejected';

    const result = await prisma.mediaAsset.updateMany({
      where: {
        id: { in: mediaIds },
        approvalStatus: 'pending', // Only update pending items
      },
      data: {
        approvalStatus: newStatus,
        status: newFileStatus,
        folder: newFolder,
        approvedBy: action === 'approve' ? user.id : null,
        approvedAt: action === 'approve' ? new Date() : null,
        rejectionReason: action === 'reject' ? reason : null,
        updatedAt: new Date(),
      },
    });

    console.log(`Batch ${action}: ${result.count} items by user ${user.id}`);

    return createSuccessResponse({
      action,
      count: result.count,
      message: `${result.count} media items ${action}d successfully`,
    });
  } catch (error) {
    console.error('Batch approval error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Batch approval failed',
      500
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};