/**
 * Media Approval API Endpoint
 *
 * Handles approval/rejection of media assets by admins.
 *
 * POST /api/admin/media/approve - Single approval
 * PUT /api/admin/media/approve - Batch approval
 *
 * Security: adminEndpoint() middleware with rate limiting, auth, Zod validation, and logging
 */

import { z } from 'zod';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { logger } from '../../_shared/secureLogger';
import {
  adminEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';

// Single approval schema
const SingleApproveSchema = z.object({
  mediaId: z.string().min(1).max(100),
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

// Batch approval schema
const BatchApproveSchema = z.object({
  mediaIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

type SingleApproveInput = z.infer<typeof SingleApproveSchema>;
type BatchApproveInput = z.infer<typeof BatchApproveSchema>;

// Single media approval
export const onRequestPost = adminEndpoint(
  SingleApproveSchema,
  async (context: AuthenticatedContext & ValidatedContext<SingleApproveInput>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { mediaId, action, rejectionReason } = context.validated;

      // Fetch user for approval tracking
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      // Get the media asset
      const media = await prisma.mediaAsset.findUnique({
        where: { id: mediaId },
      });

      if (!media) {
        return { status: 404, error: 'Media not found' };
      }

      if (media.approvalStatus === 'approved' && action === 'approve') {
        return { status: 400, error: 'Media is already approved' };
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
          rejectionReason: action === 'reject' ? rejectionReason : null,
        },
      });

      logger.info('Media approval action', {
        userId: context.auth.userId,
        mediaId,
        action,
        previousStatus: media.approvalStatus,
        newStatus,
      });

      return {
        data: {
          id: updatedMedia.id,
          approvalStatus: updatedMedia.approvalStatus,
          action,
          message: `Media ${action}d successfully`,
        },
      };
    } catch (error) {
      logger.error('Media approval error', error, {
        userId: context.auth.userId,
      });
      return { status: 500, error: error instanceof Error ? error.message : 'Approval failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// Batch media approval
export const onRequestPut = adminEndpoint(
  BatchApproveSchema,
  async (context: AuthenticatedContext & ValidatedContext<BatchApproveInput>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { mediaIds, action, reason } = context.validated;

      // Fetch user for approval tracking
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, error: 'User not found' };
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
        },
      });

      logger.info('Batch media approval', {
        userId: context.auth.userId,
        action,
        requestedCount: mediaIds.length,
        updatedCount: result.count,
      });

      return {
        data: {
          action,
          count: result.count,
          message: `${result.count} media items ${action}d successfully`,
        },
      };
    } catch (error) {
      logger.error('Batch approval error', error, {
        userId: context.auth.userId,
      });
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Batch approval failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
