/**
 * Photo Manifest Service
 * 
 * Fetches medical images from the database/storage for photo drill modes
 * Replaces placeholder images with actual medical images from Supabase
 * Only fetches APPROVED images for use in production
 */

import { getMediaByConditionName } from '../../services/mediaStorageService';
import { prisma } from '../prisma';

export type PhotoCategory = 'ecg' | 'derm' | 'radiology';

export interface PhotoInfo {
  imageUrl: string;
  educationalCaption: string;
  keyFindings: string[];
  thumbnailUrl?: string;
}

/**
 * Get image URL for a medical condition
 * First checks database for APPROVED images only, falls back to placeholder
 */
export async function getImageForCondition(
  conditionName: string,
  category: PhotoCategory
): Promise<PhotoInfo> {
  try {
    // Find the condition
    const condition = await prisma.condition.findFirst({
      where: {
        name: {
          equals: conditionName,
          mode: 'insensitive',
        },
      },
    });

    if (!condition) {
      return getPlaceholderImage(conditionName, category);
    }

    // Fetch ONLY approved media for this condition
    const approvedMedia = await prisma.mediaAsset.findMany({
      where: {
        conditionId: condition.id,
        approvalStatus: 'approved', // CRITICAL: Only approved images
        isClinical: true, // Only clinical images
      },
      orderBy: {
        qualityScore: 'desc', // Highest quality first
      },
      take: 1,
    });
    
    if (approvedMedia && approvedMedia.length > 0) {
      const firstImage = approvedMedia[0];
      
      return {
        imageUrl: firstImage.originalUrl || '',
        thumbnailUrl: firstImage.thumbnailUrl || undefined,
        educationalCaption: firstImage.description || getDefaultCaption(conditionName, category),
        keyFindings: firstImage.tags || getDefaultFindings(conditionName),
      };
    }
  } catch (error) {
    console.warn(`Failed to fetch image for ${conditionName}:`, error);
  }
  
  // Fallback to placeholder
  return getPlaceholderImage(conditionName, category);
}

/**
 * Get multiple images for a condition (for cases with multiple examples)
 * Only fetches APPROVED clinical images
 */
export async function getImagesForCondition(
  conditionName: string,
  category: PhotoCategory,
  limit: number = 3
): Promise<PhotoInfo[]> {
  try {
    // Find the condition
    const condition = await prisma.condition.findFirst({
      where: {
        name: {
          equals: conditionName,
          mode: 'insensitive',
        },
      },
    });

    if (!condition) {
      return [getPlaceholderImage(conditionName, category)];
    }

    // Fetch ONLY approved clinical media
    const approvedMedia = await prisma.mediaAsset.findMany({
      where: {
        conditionId: condition.id,
        approvalStatus: 'approved',
        isClinical: true,
      },
      orderBy: {
        qualityScore: 'desc',
      },
      take: limit,
    });
    
    if (approvedMedia && approvedMedia.length > 0) {
      return approvedMedia.map(m => ({
        imageUrl: m.originalUrl || '',
        thumbnailUrl: m.thumbnailUrl || undefined,
        educationalCaption: m.description || getDefaultCaption(conditionName, category),
        keyFindings: m.tags || getDefaultFindings(conditionName),
      }));
    }
  } catch (error) {
    console.warn(`Failed to fetch images for ${conditionName}:`, error);
  }
  
  // Fallback to single placeholder
  return [getPlaceholderImage(conditionName, category)];
}

/**
 * Check if APPROVED real images exist for a condition
 */
export async function hasRealImages(conditionName: string): Promise<boolean> {
  try {
    const condition = await prisma.condition.findFirst({
      where: {
        name: {
          equals: conditionName,
          mode: 'insensitive',
        },
      },
    });

    if (!condition) return false;

    const count = await prisma.mediaAsset.count({
      where: {
        conditionId: condition.id,
        approvalStatus: 'approved',
        isClinical: true,
      },
    });

    return count > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Batch fetch images for multiple conditions
 * More efficient than fetching one at a time
 */
export async function batchGetImages(
  conditions: Array<{ name: string; category: PhotoCategory }>
): Promise<Map<string, PhotoInfo>> {
  const result = new Map<string, PhotoInfo>();
  
  // Process all in parallel
  await Promise.all(
    conditions.map(async ({ name, category }) => {
      const photo = await getImageForCondition(name, category);
      result.set(name, photo);
    })
  );
  
  return result;
}

// Helper functions

function getPlaceholderImage(conditionName: string, category: PhotoCategory): PhotoInfo {
  const categoryColors: Record<PhotoCategory, string> = {
    ecg: '1e293b',
    derm: '8b5cf6',
    radiology: '0ea5e9',
  };
  
  const color = categoryColors[category];
  
  return {
    imageUrl: `https://placehold.co/600x400/${color}/FFF?text=${encodeURIComponent(conditionName)}`,
    educationalCaption: getDefaultCaption(conditionName, category),
    keyFindings: getDefaultFindings(conditionName),
  };
}

function getDefaultCaption(conditionName: string, category: PhotoCategory): string {
  return `${conditionName} presentation. This is a placeholder image. Upload real medical images to replace this.`;
}

function getDefaultFindings(conditionName: string): string[] {
  return ['Key findings for ' + conditionName];
}

/**
 * Preload images for better performance
 * Call this when the user selects a category
 */
export async function preloadCategoryImages(category: PhotoCategory): Promise<void> {
  // This could be enhanced to fetch and cache all images for a category
  // For now, it's a placeholder for future optimization
  console.log(`Preloading images for category: ${category}`);
}
