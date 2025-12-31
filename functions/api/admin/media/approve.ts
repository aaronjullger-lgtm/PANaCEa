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

import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from '../../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

type ApprovalAction = 'approve' | 'reject';

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

    const body = await context.request.json();
    const { mediaId, action, reason } = body as {
      mediaId: string;
      action: ApprovalAction;
      reason?: string;
    };

    // Validate input
    if (!mediaId) {
      return createErrorResponse('mediaId is required', 400);
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return createErrorResponse('action must be "approve" or "reject"', 400);
    }

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
    return createErrorResponse(
      error instanceof Error ? error.message : 'Approval failed',
      500
    );
  } finally {
    await prisma.$disconnect();
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

    const body = await context.request.json();
    const { mediaIds, action, reason } = body as {
      mediaIds: string[];
      action: ApprovalAction;
      reason?: string;
    };

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return createErrorResponse('mediaIds array is required', 400);
    }

    if (mediaIds.length > 100) {
      return createErrorResponse('Maximum 100 items per batch', 400);
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return createErrorResponse('action must be "approve" or "reject"', 400);
    }

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
    await prisma.$disconnect();
  }
};
