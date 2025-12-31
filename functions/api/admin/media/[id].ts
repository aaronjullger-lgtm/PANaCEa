/**
 * Media Asset Detail API Endpoint
 * 
 * GET /api/admin/media/[id] - Get a single media asset
 * PUT /api/admin/media/[id] - Update media asset metadata
 * DELETE /api/admin/media/[id] - Delete a media asset
 */

import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from '../../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const MEDIA_BUCKET = 'medical-images';

export const onRequestGet = async (context: { request: Request; env: Env; params: { id: string } }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    const { id } = context.params;

    const media = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        Condition: {
          select: { id: true, name: true },
        },
      },
    });

    if (!media) {
      return createErrorResponse('Media not found', 404);
    }

    return createSuccessResponse(media);
  } catch (error) {
    console.error('Media fetch error:', error);
    return createErrorResponse('Failed to fetch media', 500);
  } finally {
    await prisma.$disconnect();
  }
};

export const onRequestPut = async (context: { request: Request; env: Env; params: { id: string } }) => {
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

    const { id } = context.params;
    const body = await context.request.json();

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
    } = body as {
      conditionId?: string | null;
      correctDiagnosis?: string;
      distractors?: string[];
      description?: string;
      altText?: string;
      tags?: string[];
      type?: string;
      clinicalContext?: string;
      qualityScore?: number;
    };

    // Verify media exists
    const existingMedia = await prisma.mediaAsset.findUnique({
      where: { id },
    });

    if (!existingMedia) {
      return createErrorResponse('Media not found', 404);
    }

    // Build update data
    const updateData: any = {
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

    return createSuccessResponse({
      id: updatedMedia.id,
      message: 'Media updated successfully',
    });
  } catch (error) {
    console.error('Media update error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Update failed',
      500
    );
  } finally {
    await prisma.$disconnect();
  }
};

export const onRequestDelete = async (context: { request: Request; env: Env; params: { id: string } }) => {
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

    const { id } = context.params;

    // Get media to find the storage path
    const media = await prisma.mediaAsset.findUnique({
      where: { id },
    });

    if (!media) {
      return createErrorResponse('Media not found', 404);
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
              'Authorization': `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );

        if (!deleteResponse.ok) {
          console.warn('Storage delete failed:', await deleteResponse.text());
          // Continue with DB deletion even if storage fails
        }
      } catch (storageError) {
        console.warn('Storage delete error:', storageError);
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
                  'Authorization': `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
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

    console.log(`Media deleted: ${id} by user ${user.id}`);

    return createSuccessResponse({
      id,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error('Media delete error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Delete failed',
      500
    );
  } finally {
    await prisma.$disconnect();
  }
};
