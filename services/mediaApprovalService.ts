/**
 * Media Approval Service
 * 
 * Manages the approval workflow for uploaded medical images and resources.
 * Implements a "no-use" to "use" folder system via approval status.
 */

import { prisma } from '../lib/prisma';
import { 
  assessImageQuality, 
  shouldAutoApprove, 
  generateThumbnail,
  optimizeImage,
  QualityAssessment 
} from './imageQualityService';
import { supabaseAdmin, getStorageUrl } from '../lib/supabase';

const MEDIA_BUCKET = 'medical-images';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalDecision {
  mediaId: string;
  status: ApprovalStatus;
  approvedBy: string;
  rejectionReason?: string;
}

/**
 * Process uploaded media with quality assessment
 * Auto-approves high-quality images, others go to pending
 */
export async function processUploadedMedia(
  mediaId: string,
  imageBuffer: Buffer,
  category: string
): Promise<{
  assessment: QualityAssessment;
  autoApproved: boolean;
}> {
  // Assess image quality
  const assessment = await assessImageQuality(imageBuffer, category);
  
  // Determine if auto-approval is warranted
  const autoApproved = shouldAutoApprove(assessment);
  
  // Update database with assessment results
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      qualityScore: assessment.qualityScore,
      isClinical: assessment.isClinical,
      approvalStatus: autoApproved ? 'approved' : 'pending',
      approvedAt: autoApproved ? new Date() : null,
      approvedBy: autoApproved ? 'system' : null,
      aiMetadata: {
        assessment: {
          issues: assessment.issues,
          recommendations: assessment.recommendations,
          aiAnalysis: assessment.aiAnalysis,
        },
      },
      dimensions: assessment.resolution,
      fileSize: assessment.fileSize,
    },
  });

  // Generate and upload thumbnail if approved
  if (autoApproved) {
    await generateAndUploadThumbnail(mediaId, imageBuffer);
  }

  return { assessment, autoApproved };
}

/**
 * Get all pending media awaiting approval
 */
export async function getPendingMedia(options?: {
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = { approvalStatus: 'pending' };
  
  if (options?.category) {
    where.type = options.category;
  }

  const media = await prisma.mediaAsset.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      condition: {
        select: {
          id: true,
          name: true,
          system: true,
        },
      },
    },
  });

  const total = await prisma.mediaAsset.count({ where });

  return { media, total };
}

/**
 * Get all approved media ready for use
 */
export async function getApprovedMedia(options?: {
  category?: string;
  conditionId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = { approvalStatus: 'approved' };
  
  if (options?.category) {
    where.type = options.category;
  }
  
  if (options?.conditionId) {
    where.conditionId = options.conditionId;
  }

  const media = await prisma.mediaAsset.findMany({
    where,
    orderBy: { approvedAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      condition: {
        select: {
          id: true,
          name: true,
          system: true,
        },
      },
    },
  });

  const total = await prisma.mediaAsset.count({ where });

  return { media, total };
}

/**
 * Approve a media asset (move from "no-use" to "use")
 */
export async function approveMedia(decision: ApprovalDecision): Promise<void> {
  const { mediaId, approvedBy } = decision;

  // Get the media asset
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    throw new Error('Media asset not found');
  }

  if (media.approvalStatus === 'approved') {
    throw new Error('Media is already approved');
  }

  // Update approval status
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      approvalStatus: 'approved',
      approvedBy,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  // Generate thumbnail if not already done
  if (!media.thumbnailUrl && media.originalUrl) {
    // Download original image
    const response = await fetch(media.originalUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    await generateAndUploadThumbnail(mediaId, imageBuffer);
  }
}

/**
 * Reject a media asset
 */
export async function rejectMedia(decision: ApprovalDecision): Promise<void> {
  const { mediaId, approvedBy, rejectionReason } = decision;

  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      approvalStatus: 'rejected',
      approvedBy,
      approvedAt: new Date(),
      rejectionReason: rejectionReason || 'Quality standards not met',
    },
  });
}

/**
 * Batch approve multiple media assets
 */
export async function batchApproveMedia(
  mediaIds: string[],
  approvedBy: string
): Promise<{ approved: number; failed: string[] }> {
  const failed: string[] = [];
  let approved = 0;

  for (const mediaId of mediaIds) {
    try {
      await approveMedia({ mediaId, status: 'approved', approvedBy });
      approved++;
    } catch (error) {
      console.error(`Failed to approve ${mediaId}:`, error);
      failed.push(mediaId);
    }
  }

  return { approved, failed };
}

/**
 * Generate and upload thumbnail for media asset
 */
async function generateAndUploadThumbnail(
  mediaId: string,
  imageBuffer: Buffer
): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });

  if (!media) return;

  try {
    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer, 300);
    
    // Upload to Supabase Storage
    const thumbnailPath = `${media.type}/thumbnails/${media.filename}`;
    const { error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading thumbnail:', error);
      return;
    }

    // Update database with thumbnail URL
    const thumbnailUrl = getStorageUrl(MEDIA_BUCKET, thumbnailPath);
    await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { thumbnailUrl },
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
  }
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  const [pending, approved, rejected, total] = await Promise.all([
    prisma.mediaAsset.count({ where: { approvalStatus: 'pending' } }),
    prisma.mediaAsset.count({ where: { approvalStatus: 'approved' } }),
    prisma.mediaAsset.count({ where: { approvalStatus: 'rejected' } }),
    prisma.mediaAsset.count(),
  ]);

  const approvalRate = total > 0 ? (approved / total) * 100 : 0;

  return {
    pending,
    approved,
    rejected,
    total,
    approvalRate: Math.round(approvalRate * 10) / 10,
  };
}

/**
 * Re-assess a rejected media asset (give it another chance)
 */
export async function reassessMedia(mediaId: string): Promise<QualityAssessment> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });

  if (!media || !media.originalUrl) {
    throw new Error('Media asset not found or has no URL');
  }

  // Download the image
  const response = await fetch(media.originalUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  // Re-assess quality
  const assessment = await assessImageQuality(imageBuffer, media.type);

  // Update database with new assessment
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      qualityScore: assessment.qualityScore,
      isClinical: assessment.isClinical,
      aiMetadata: {
        assessment: {
          issues: assessment.issues,
          recommendations: assessment.recommendations,
          aiAnalysis: assessment.aiAnalysis,
        },
      },
    },
  });

  return assessment;
}
