/**
 * Smart Image Cropper
 * 
 * Crops images to remove annotations while preserving medical content.
 * Uses sharp for image processing.
 */

import * as fs from 'fs';
import * as path from 'path';

// We'll use sharp if available, otherwise skip cropping
let sharp: any = null;
try {
  sharp = require('sharp');
} catch {
  console.warn('⚠️ Sharp not installed - cropping disabled. Run: npm install sharp');
}

interface CropRegion {
  x: number;      // percentage from left (0-100)
  y: number;      // percentage from top (0-100)  
  width: number;  // percentage width (0-100)
  height: number; // percentage height (0-100)
  reason: string;
}

interface CropResult {
  success: boolean;
  outputPath: string;
  originalSize: { width: number; height: number };
  croppedSize: { width: number; height: number };
  error?: string;
}

/**
 * Crop an image based on percentage-based region
 */
export async function cropImage(
  inputPath: string,
  region: CropRegion,
  outputPath?: string
): Promise<CropResult> {
  if (!sharp) {
    return {
      success: false,
      outputPath: inputPath,
      originalSize: { width: 0, height: 0 },
      croppedSize: { width: 0, height: 0 },
      error: 'Sharp not installed',
    };
  }

  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Convert percentages to pixels
    const left = Math.round((region.x / 100) * originalWidth);
    const top = Math.round((region.y / 100) * originalHeight);
    const width = Math.round((region.width / 100) * originalWidth);
    const height = Math.round((region.height / 100) * originalHeight);

    // Ensure valid dimensions
    const cropWidth = Math.min(width, originalWidth - left);
    const cropHeight = Math.min(height, originalHeight - top);

    // Generate output path if not provided
    const finalOutputPath = outputPath || generateCroppedPath(inputPath);

    // Perform crop
    await sharp(inputPath)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toFile(finalOutputPath);

    return {
      success: true,
      outputPath: finalOutputPath,
      originalSize: { width: originalWidth, height: originalHeight },
      croppedSize: { width: cropWidth, height: cropHeight },
    };

  } catch (error) {
    return {
      success: false,
      outputPath: inputPath,
      originalSize: { width: 0, height: 0 },
      croppedSize: { width: 0, height: 0 },
      error: String(error),
    };
  }
}

/**
 * Auto-crop common annotation patterns
 * Removes typical header/footer regions where labels appear
 */
export async function autoCropAnnotations(
  inputPath: string,
  annotationType: 'header' | 'footer' | 'sides' | 'watermark'
): Promise<CropResult> {
  // Common crop regions for different annotation types
  const cropRegions: Record<string, CropRegion> = {
    header: { x: 0, y: 10, width: 100, height: 90, reason: 'Remove header labels' },
    footer: { x: 0, y: 0, width: 100, height: 90, reason: 'Remove footer labels' },
    sides: { x: 5, y: 0, width: 90, height: 100, reason: 'Remove side annotations' },
    watermark: { x: 5, y: 5, width: 90, height: 90, reason: 'Remove corner watermarks' },
  };

  const region = cropRegions[annotationType];
  return cropImage(inputPath, region);
}

/**
 * Resize image to optimal quiz size
 */
export async function resizeForQuiz(
  inputPath: string,
  maxWidth = 1200,
  maxHeight = 900,
  outputPath?: string
): Promise<CropResult> {
  if (!sharp) {
    return {
      success: false,
      outputPath: inputPath,
      originalSize: { width: 0, height: 0 },
      croppedSize: { width: 0, height: 0 },
      error: 'Sharp not installed',
    };
  }

  try {
    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    const finalOutputPath = outputPath || generateResizedPath(inputPath);

    const result = await sharp(inputPath)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toFile(finalOutputPath);

    return {
      success: true,
      outputPath: finalOutputPath,
      originalSize: { width: originalWidth, height: originalHeight },
      croppedSize: { width: result.width, height: result.height },
    };

  } catch (error) {
    return {
      success: false,
      outputPath: inputPath,
      originalSize: { width: 0, height: 0 },
      croppedSize: { width: 0, height: 0 },
      error: String(error),
    };
  }
}

/**
 * Process image for quiz use (crop + resize)
 */
export async function processForQuiz(
  inputPath: string,
  cropRegion?: CropRegion | null,
  options: { maxWidth?: number; maxHeight?: number; outputDir?: string } = {}
): Promise<CropResult> {
  const { maxWidth = 1200, maxHeight = 900, outputDir } = options;

  let currentPath = inputPath;
  let result: CropResult = {
    success: true,
    outputPath: inputPath,
    originalSize: { width: 0, height: 0 },
    croppedSize: { width: 0, height: 0 },
  };

  // Step 1: Crop if region provided
  if (cropRegion) {
    const cropOutputPath = outputDir 
      ? path.join(outputDir, `cropped_${path.basename(inputPath)}`)
      : undefined;
    
    result = await cropImage(inputPath, cropRegion, cropOutputPath);
    if (!result.success) {
      return result;
    }
    currentPath = result.outputPath;
  }

  // Step 2: Resize for optimal display
  const resizeOutputPath = outputDir
    ? path.join(outputDir, `quiz_${path.basename(inputPath)}`)
    : generateResizedPath(currentPath);

  const resizeResult = await resizeForQuiz(currentPath, maxWidth, maxHeight, resizeOutputPath);

  // Clean up intermediate file if we created one
  if (cropRegion && currentPath !== inputPath && currentPath !== resizeResult.outputPath) {
    try {
      fs.unlinkSync(currentPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  return resizeResult;
}

/**
 * Generate output path for cropped image
 */
function generateCroppedPath(inputPath: string): string {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const name = path.basename(inputPath, ext);
  return path.join(dir, `${name}_cropped${ext}`);
}

/**
 * Generate output path for resized image
 */
function generateResizedPath(inputPath: string): string {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const name = path.basename(inputPath, ext);
  return path.join(dir, `${name}_quiz.jpg`);
}

/**
 * Check if sharp is available
 */
export function isSharpAvailable(): boolean {
  return sharp !== null;
}

export type { CropRegion, CropResult };
