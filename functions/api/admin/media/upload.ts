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
 */

import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from '../../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

type MediaCategory = 'ecg' | 'derm' | 'radiology' | 'labs' | 'diagrams';

const VALID_CATEGORIES: MediaCategory[] = ['ecg', 'derm', 'radiology', 'labs', 'diagrams'];
const MEDIA_BUCKET = 'medical-images';

function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate - require admin role
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    // Parse form data
    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as MediaCategory | null;
    const conditionId = formData.get('conditionId') as string | null;
    const correctDiagnosis = formData.get('correctDiagnosis') as string | null;
    const distractorsJson = formData.get('distractors') as string | null;
    const description = formData.get('description') as string | null;
    const altText = formData.get('altText') as string | null;
    const tags = formData.get('tags') as string | null;

    // Validate required fields
    if (!file) {
      return createErrorResponse('File is required', 400);
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return createErrorResponse(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return createErrorResponse('Invalid file type. Supported: JPEG, PNG, WebP, GIF', 400);
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return createErrorResponse('File too large. Maximum size is 10MB', 400);
    }

    // Parse distractors if provided
    let distractors: string[] = [];
    if (distractorsJson) {
      try {
        distractors = JSON.parse(distractorsJson);
        if (!Array.isArray(distractors)) {
          return createErrorResponse('Distractors must be a JSON array', 400);
        }
      } catch {
        return createErrorResponse('Invalid distractors JSON', 400);
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
          'Authorization': `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: fileBuffer,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('Supabase upload error:', error);
      return createErrorResponse('Failed to upload to storage', 500);
    }

    // Build public URL
    const publicUrl = `${context.env.SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;

    // Parse tags
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

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
        description: description || null,
        altText: altText || null,
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

    return createSuccessResponse({
      id: mediaAsset.id,
      filename: mediaAsset.filename,
      url: publicUrl,
      category,
      approvalStatus: 'pending',
      message: 'Media uploaded successfully. Pending approval.',
    });
  } catch (error) {
    console.error('Media upload error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Upload failed',
      500
    );
  } finally {
    await prisma.$disconnect();
  }
};

// GET - List media assets for admin
export const onRequestGet = async (context: { request: Request; env: Env }) => {
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

    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'pending';
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: any = {
      approvalStatus: status,
    };

    if (category && VALID_CATEGORIES.includes(category as MediaCategory)) {
      where.type = category;
    }

    const [media, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        skip: offset,
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

    return createSuccessResponse({
      media,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Media list error:', error);
    return createErrorResponse('Failed to list media', 500);
  } finally {
    await prisma.$disconnect();
  }
};
