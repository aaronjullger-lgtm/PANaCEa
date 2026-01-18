/**
 * Media Storage Service
 *
 * Manages medical images (ECG, dermatology, radiology) using Supabase Storage.
 * Handles upload, retrieval, and metadata management for the photo drill modes.
 */

import { supabaseAdmin, getStorageUrl } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { processUploadedMedia } from './mediaApprovalService';
import { optimizeImage } from './imageQualityService';

const MEDIA_BUCKET = 'medical-images';

export type MediaCategory = 'ecg' | 'derm' | 'radiology' | 'labs' | 'diagrams';

export interface UploadMediaOptions {
  file: File | Buffer;
  filename: string;
  category: MediaCategory;
  conditionId?: string;
  tags?: string[];
  description?: string;
  altText?: string;
  uploadedBy?: string;
}

export interface MediaAssetInfo {
  id: string;
  filename: string;
  category: MediaCategory;
  originalUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  description?: string;
  altText?: string;
  conditionId?: string;
}

/**
 * Upload a media file to Supabase Storage with quality assessment
 */
export async function uploadMedia(
  options: UploadMediaOptions
): Promise<MediaAssetInfo & { qualityScore?: number; autoApproved?: boolean }> {
  const {
    file,
    filename,
    category,
    conditionId,
    tags = [],
    description,
    altText,
    uploadedBy,
  } = options;

  // Sanitize filename: remove spaces, special chars, make lowercase
  const sanitizedFilename = filename
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');

  // Convert file to buffer for processing
  let imageBuffer: Buffer;
  if (file instanceof Buffer) {
    imageBuffer = file;
  } else if ('arrayBuffer' in file) {
    imageBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    throw new Error('Unsupported file type');
  }

  // Optimize image before upload
  const optimizedBuffer = await optimizeImage(imageBuffer);

  // Build storage path: category/filename
  const storagePath = `${category}/${sanitizedFilename}`;

  try {
    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, optimizedBuffer, {
        contentType: getContentType(sanitizedFilename),
        cacheControl: '3600', // Cache for 1 hour
        upsert: true, // Allow overwriting existing files
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Get public URL
    const publicUrl = getStorageUrl(MEDIA_BUCKET, storagePath);

    // Save metadata to database (with pending approval status)
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        type: getCategoryType(category),
        filename: sanitizedFilename,
        originalUrl: publicUrl,
        conditionId: conditionId || null,
        tags,
        description,
        altText,
        mimeType: getContentType(sanitizedFilename),
        fileSize: optimizedBuffer.length,
        uploadedBy: uploadedBy || null,
        approvalStatus: 'pending', // Start as pending
      },
    });

    // Process upload with quality assessment
    const { assessment, autoApproved } = await processUploadedMedia(
      mediaAsset.id,
      optimizedBuffer,
      category
    );

    return {
      id: mediaAsset.id,
      filename: sanitizedFilename,
      category,
      originalUrl: publicUrl,
      tags,
      description,
      altText,
      conditionId,
      qualityScore: assessment.qualityScore,
      autoApproved,
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

/**
 * Get media assets by condition
 */
export async function getMediaByCondition(conditionId: string): Promise<MediaAssetInfo[]> {
  const assets = await prisma.mediaAsset.findMany({
    where: { conditionId },
    orderBy: { uploadedAt: 'desc' },
  });

  return assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    category: getMediaCategory(asset.type),
    originalUrl: asset.originalUrl || '',
    thumbnailUrl: asset.thumbnailUrl || undefined,
    tags: asset.tags,
    description: asset.description || undefined,
    altText: asset.altText || undefined,
    conditionId: asset.conditionId || undefined,
  }));
}

/**
 * Get media assets by category
 */
export async function getMediaByCategory(category: MediaCategory): Promise<MediaAssetInfo[]> {
  const type = getCategoryType(category);

  const assets = await prisma.mediaAsset.findMany({
    where: { type },
    orderBy: { uploadedAt: 'desc' },
  });

  return assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    category,
    originalUrl: asset.originalUrl || '',
    thumbnailUrl: asset.thumbnailUrl || undefined,
    tags: asset.tags,
    description: asset.description || undefined,
    altText: asset.altText || undefined,
    conditionId: asset.conditionId || undefined,
  }));
}

/**
 * Search media assets by tags
 */
export async function searchMediaByTags(tags: string[]): Promise<MediaAssetInfo[]> {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      tags: {
        hasSome: tags,
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    category: getMediaCategory(asset.type),
    originalUrl: asset.originalUrl || '',
    thumbnailUrl: asset.thumbnailUrl || undefined,
    tags: asset.tags,
    description: asset.description || undefined,
    altText: asset.altText || undefined,
    conditionId: asset.conditionId || undefined,
  }));
}

/**
 * Delete a media asset
 */
export async function deleteMedia(mediaId: string): Promise<void> {
  // Get media asset info
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });

  if (!asset) {
    throw new Error('Media asset not found');
  }

  if (!asset.originalUrl) {
    throw new Error('Media asset has no URL');
  }

  // Extract storage path from URL
  const url = new URL(asset.originalUrl);
  const pathParts = url.pathname.split('/');
  const storagePath = pathParts.slice(-2).join('/'); // category/filename

  try {
    // Delete from Supabase Storage
    const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([storagePath]);

    if (error) {
      console.error('Error deleting from storage:', error);
      // Continue to delete from database even if storage deletion fails
    }

    // Delete from database
    await prisma.mediaAsset.delete({
      where: { id: mediaId },
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
}

/**
 * Get all media for a specific condition by name
 */
export async function getMediaByConditionName(conditionName: string): Promise<MediaAssetInfo[]> {
  // First, find the condition
  const condition = await prisma.condition.findFirst({
    where: {
      name: {
        equals: conditionName,
        mode: 'insensitive',
      },
    },
  });

  if (!condition) {
    return [];
  }

  return getMediaByCondition(condition.id);
}

/**
 * Associate media with a condition
 */
export async function linkMediaToCondition(mediaId: string, conditionId: string): Promise<void> {
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: { conditionId },
  });
}

/**
 * Update media tags and metadata
 */
export async function updateMediaMetadata(
  mediaId: string,
  metadata: {
    tags?: string[];
    description?: string;
    altText?: string;
    conditionId?: string;
  }
): Promise<void> {
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: metadata,
  });
}

/**
 * Get media statistics
 */
export async function getMediaStats() {
  const [total, byType, byCondition] = await Promise.all([
    prisma.mediaAsset.count(),
    prisma.mediaAsset.groupBy({
      by: ['type'],
      _count: true,
    }),
    prisma.mediaAsset.groupBy({
      by: ['conditionId'],
      _count: true,
      where: {
        conditionId: { not: null },
      },
    }),
  ]);

  return {
    total,
    byType,
    linkedToConditions: byCondition.length,
    unlinked: total - byCondition.reduce((sum, item) => sum + (item as any)._count, 0),
  };
}

// Helper functions

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

function getCategoryType(category: MediaCategory): string {
  const typeMap: Record<MediaCategory, string> = {
    ecg: 'ekg',
    derm: 'photo',
    radiology: 'imaging',
    labs: 'labs',
    diagrams: 'diagram',
  };
  return typeMap[category] || 'other';
}

function getMediaCategory(type: string): MediaCategory {
  const categoryMap: Record<string, MediaCategory> = {
    ekg: 'ecg',
    photo: 'derm',
    imaging: 'radiology',
    labs: 'labs',
    diagram: 'diagrams',
  };
  return categoryMap[type] || 'derm';
}
