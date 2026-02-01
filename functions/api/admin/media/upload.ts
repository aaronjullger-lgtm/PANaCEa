/**
 * Media Upload API Endpoint
 *
 * Handles medical image uploads to Supabase Storage.
 * Creates MediaAsset records with pending approval status.
 *
 * POST /api/admin/media/upload
 * - Form data with 'file' field
 * - category: 'ecg' | 'derm' | 'radiology' | 'labs' | 'diagrams'
 * - conditionId: optional link to condition
 * - correctDiagnosis: for drill questions
 * - distractors: JSON string array of wrong answers
 *
 * GET /api/admin/media/upload
 * - List media assets with filters
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
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { logger } from '../../_shared/secureLogger';

type MediaCategory = 'ecg' | 'derm' | 'radiology' | 'labs' | 'diagrams';

const VALID_CATEGORIES: MediaCategory[] = ['ecg', 'derm', 'radiology', 'labs', 'diagrams'];
const MEDIA_BUCKET = 'medical-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Schema for GET query parameters
const ListMediaQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  category: z.enum(['ecg', 'derm', 'radiology', 'labs', 'diagrams']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).default(50),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).default(0),
});

type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;

function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * POST /api/admin/media/upload - Upload media file
 * Uses FormData, so we use withMiddleware directly instead of adminEndpoint
 */
export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withAdminRole(),
  withRateLimit({ requestsPerMinute: 20, endpointType: 'admin' }),
  withLogging(),
  async (context: AuthenticatedContext) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Get user for uploadedBy field
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 401, error: 'User not found' };
      }

      // Parse form data
      const formData = await context.request.formData();
      const file = formData.get('file') as File | null;
      const category = formData.get('category') as string | null;
      const conditionId = formData.get('conditionId') as string | null;
      const correctDiagnosis = formData.get('correctDiagnosis') as string | null;
      const distractorsJson = formData.get('distractors') as string | null;
      const description = formData.get('description') as string | null;
      const altText = formData.get('altText') as string | null;
      const tags = formData.get('tags') as string | null;

      // Validate required fields
      if (!file) {
        return { status: 400, error: 'File is required' };
      }

      if (!category || !VALID_CATEGORIES.includes(category as MediaCategory)) {
        return {
          status: 400,
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        };
      }

      // Validate file type
      if (!VALID_MIME_TYPES.includes(file.type)) {
        return { status: 400, error: 'Invalid file type. Supported: JPEG, PNG, WebP, GIF' };
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return { status: 400, error: 'File too large. Maximum size is 10MB' };
      }

      // Parse distractors if provided
      let distractors: string[] = [];
      if (distractorsJson) {
        try {
          distractors = JSON.parse(distractorsJson);
          if (!Array.isArray(distractors)) {
            return { status: 400, error: 'Distractors must be a JSON array' };
          }
          // Validate distractors length
          if (distractors.length > 10) {
            return { status: 400, error: 'Maximum 10 distractors allowed' };
          }
        } catch {
          return { status: 400, error: 'Invalid distractors JSON' };
        }
      }

      // Sanitize filename
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const sanitizedFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const storagePath = `${category}/${sanitizedFilename}`;

      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();

      const uploadResponse = await fetch(
        `${context.env.SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': file.type,
            'x-upsert': 'true',
          },
          body: fileBuffer,
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        logger.error('Supabase upload failed', { error, storagePath });
        return { status: 500, error: 'Failed to upload to storage' };
      }

      // Build public URL
      const publicUrl = `${context.env.SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;

      // Parse tags
      const tagArray = tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20) // Max 20 tags
        : [];

      // Create MediaAsset record
      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          id: generateId(),
          type: category,
          filename: sanitizedFilename,
          originalUrl: publicUrl,
          conditionId: conditionId || null,
          correctDiagnosis: correctDiagnosis || null,
          distractors: distractors.length > 0 ? distractors : null,
          description: description?.slice(0, 1000) || null,
          altText: altText?.slice(0, 500) || null,
          tags: tagArray,
          mimeType: file.type,
          fileSize: file.size,
          uploadedBy: user.id,
          approvalStatus: 'pending',
          status: 'pending_review',
          folder: 'inbox',
          mediaType: 'image',
          updatedAt: new Date(),
        },
      });

      logger.info('Media uploaded successfully', {
        mediaId: mediaAsset.id,
        category,
        userId: context.auth.userId,
      });

      return createSuccessResponse(
        context.request,
        {
          id: mediaAsset.id,
          filename: mediaAsset.filename,
          url: publicUrl,
          category,
          approvalStatus: 'pending',
          message: 'Media uploaded successfully. Pending approval.',
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
 * GET /api/admin/media/upload - List media assets for admin
 */
export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withAdminRole(),
  withRateLimit({ requestsPerMinute: 60, endpointType: 'admin' }),
  withValidation(ListMediaQuerySchema, { source: 'query' }),
  withLogging(),
  async (context: AuthenticatedContext & ValidatedContext<ListMediaQuery>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { status, category, limit, offset } = context.validated;

      const where: any = {
        approvalStatus: status,
      };

      if (category) {
        where.type = category;
      }

      const [media, total] = await Promise.all([
        prisma.mediaAsset.findMany({
          where,
          orderBy: { uploadedAt: 'desc' },
          take: typeof limit === 'number' ? limit : 50,
          skip: typeof offset === 'number' ? offset : 0,
          select: {
            id: true,
            type: true,
            filename: true,
            originalUrl: true,
            thumbnailUrl: true,
            conditionId: true,
            correctDiagnosis: true,
            distractors: true,
            description: true,
            tags: true,
            approvalStatus: true,
            qualityScore: true,
            uploadedAt: true,
            uploadedBy: true,
            Condition: {
              select: { name: true },
            },
          },
        }),
        prisma.mediaAsset.count({ where }),
      ]);

      logger.info('Media list retrieved', {
        status,
        category,
        count: media.length,
        total,
        userId: context.auth.userId,
      });

      return createSuccessResponse(
        context.request,
        {
          media,
          total,
          limit: typeof limit === 'number' ? limit : 50,
          offset: typeof offset === 'number' ? offset : 0,
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
