/**
 * Media Asset Detail API Endpoint
 *
 * GET /api/admin/media/[id] - Get a single media asset
 * PUT /api/admin/media/[id] - Update media asset metadata
 * DELETE /api/admin/media/[id] - Delete a media asset
 */

import { z } from 'zod';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createSuccessResponse } from '../../_shared/auth';
import {
  withMiddleware,
  withCors,
  withErrorHandling,
  withAuth,
  withAdminRole,
  withRateLimit,
  withLogging,
  withValidation,
  adminEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { logger } from '../../_shared/secureLogger';

// Schema for media asset update (PUT body)
const MediaAssetUpdateSchema = z.object({
  conditionId: z.string().max(100).nullable().optional(),
  correctDiagnosis: z.string().max(500).optional(),
  distractors: z.array(z.string().max(500)).max(10).optional(),
  description: z.string().max(1000).optional(),
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  type: z.enum(['ecg', 'derm', 'radiology', 'labs', 'diagrams']).optional(),
  clinicalContext: z.string().max(2000).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
});

type MediaAssetUpdate = z.infer<typeof MediaAssetUpdateSchema>;

const MEDIA_BUCKET = 'medical-images';

/**
 * GET /api/admin/media/[id] - Get a single media asset
 */
export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withAdminRole(),
  withRateLimit({ requestsPerMinute: 60, endpointType: 'admin' }),
  withLogging(),
  async (context: AuthenticatedContext & { params: { id: string } }) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { id } = context.params;

      if (!id || id.length > 100) {
        return { status: 400, error: 'Invalid media ID' };
      }

      const media = await prisma.mediaAsset.findUnique({
        where: { id },
        include: {
          Condition: {
            select: { id: true, name: true },
          },
        },
      });

      if (!media) {
        return { status: 404, error: 'Media not found' };
      }

      logger.info('Media asset retrieved', {
        mediaId: id,
        userId: context.auth.userId,
      });

      return createSuccessResponse(context.request, media, 200, 0, context.env);
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * PUT /api/admin/media/[id] - Update media asset metadata
 */
export const onRequestPut = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withAdminRole(),
  withRateLimit({ requestsPerMinute: 30, endpointType: 'admin' }),
  withValidation(MediaAssetUpdateSchema),
  withLogging(),
  async (
    context: AuthenticatedContext & ValidatedContext<MediaAssetUpdate> & { params: { id: string } }
  ) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { id } = context.params;

      if (!id || id.length > 100) {
        return { status: 400, error: 'Invalid media ID' };
      }

      const {
        conditionId,
        correctDiagnosis,
        distractors,
        description,
        altText,
        tags,
        type,
        clinicalContext,
        qualityScore,
      } = context.validated;

      // Verify media exists
      const existingMedia = await prisma.mediaAsset.findUnique({
        where: { id },
      });

      if (!existingMedia) {
        return { status: 404, error: 'Media not found' };
      }

      // Build update data - only include fields that were provided
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (conditionId !== undefined) updateData.conditionId = conditionId;
      if (correctDiagnosis !== undefined) updateData.correctDiagnosis = correctDiagnosis;
      if (distractors !== undefined) updateData.distractors = distractors;
      if (description !== undefined) updateData.description = description;
      if (altText !== undefined) updateData.altText = altText;
      if (tags !== undefined) updateData.tags = tags;
      if (type !== undefined) updateData.type = type;
      if (clinicalContext !== undefined) updateData.clinicalContext = clinicalContext;
      if (qualityScore !== undefined) updateData.qualityScore = qualityScore;

      const updatedMedia = await prisma.mediaAsset.update({
        where: { id },
        data: updateData,
      });

      logger.info('Media asset updated', {
        mediaId: id,
        updatedFields: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
        userId: context.auth.userId,
      });

      return createSuccessResponse(
        context.request,
        {
          id: updatedMedia.id,
          message: 'Media updated successfully',
        },
        200,
        0,
        context.env
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * DELETE /api/admin/media/[id] - Delete a media asset
 */
export const onRequestDelete = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withAdminRole(),
  withRateLimit({ requestsPerMinute: 20, endpointType: 'admin' }),
  withLogging(),
  async (context: AuthenticatedContext & { params: { id: string } }) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { id } = context.params;

      if (!id || id.length > 100) {
        return { status: 400, error: 'Invalid media ID' };
      }

      // Get media to find the storage path
      const media = await prisma.mediaAsset.findUnique({
        where: { id },
      });

      if (!media) {
        return { status: 404, error: 'Media not found' };
      }

      // Extract storage path from URL
      const urlParts = media.originalUrl?.split(`/${MEDIA_BUCKET}/`);
      const storagePath = urlParts && urlParts.length > 1 ? urlParts[1] : null;

      // Delete from Supabase Storage if path exists
      if (storagePath) {
        try {
          const deleteResponse = await fetch(
            `${context.env.SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }
          );

          if (!deleteResponse.ok) {
            logger.warn('Storage delete failed', {
              mediaId: id,
              storagePath,
              error: await deleteResponse.text(),
            });
            // Continue with DB deletion even if storage fails
          }
        } catch (storageError) {
          logger.warn('Storage delete error', {
            mediaId: id,
            error: storageError instanceof Error ? storageError.message : String(storageError),
          });
        }

        // Also try to delete thumbnail if it exists
        if (media.thumbnailUrl) {
          const thumbParts = media.thumbnailUrl.split(`/${MEDIA_BUCKET}/`);
          const thumbPath = thumbParts && thumbParts.length > 1 ? thumbParts[1] : null;

          if (thumbPath) {
            try {
              await fetch(
                `${context.env.SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${thumbPath}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                }
              );
            } catch {
              // Ignore thumbnail deletion errors
            }
          }
        }
      }

      // Delete from database
      await prisma.mediaAsset.delete({
        where: { id },
      });

      logger.info('Media asset deleted', {
        mediaId: id,
        userId: context.auth.userId,
      });

      return createSuccessResponse(
        context.request,
        {
          id,
          message: 'Media deleted successfully',
        },
        200,
        0,
        context.env
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
