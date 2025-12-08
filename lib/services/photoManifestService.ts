/**
 * Photo Manifest Service
 * 
 * Fetches medical images from the database/storage for photo drill modes
 * Replaces placeholder images with actual medical images from Supabase
 */

import { getMediaByConditionName } from '../../services/mediaStorageService';

export type PhotoCategory = 'ecg' | 'derm' | 'radiology';

export interface PhotoInfo {
  imageUrl: string;
  educationalCaption: string;
  keyFindings: string[];
  thumbnailUrl?: string;
}

/**
 * Get image URL for a medical condition
 * First checks database for real images, falls back to placeholder
 */
export async function getImageForCondition(
  conditionName: string,
  category: PhotoCategory
): Promise<PhotoInfo> {
  try {
    // Try to fetch from database
    const media = await getMediaByConditionName(conditionName);
    
    if (media && media.length > 0) {
      // Use the first available image
      const firstImage = media[0];
      
      return {
        imageUrl: firstImage.originalUrl,
        thumbnailUrl: firstImage.thumbnailUrl,
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
 */
export async function getImagesForCondition(
  conditionName: string,
  category: PhotoCategory,
  limit: number = 3
): Promise<PhotoInfo[]> {
  try {
    const media = await getMediaByConditionName(conditionName);
    
    if (media && media.length > 0) {
      return media.slice(0, limit).map(m => ({
        imageUrl: m.originalUrl,
        thumbnailUrl: m.thumbnailUrl,
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
 * Check if real images exist for a condition
 */
export async function hasRealImages(conditionName: string): Promise<boolean> {
  try {
    const media = await getMediaByConditionName(conditionName);
    return media && media.length > 0;
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
