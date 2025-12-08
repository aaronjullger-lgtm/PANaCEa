/**
 * Image Quality Assessment Service
 * 
 * Evaluates uploaded medical images for quality, clinical relevance,
 * and suitability for educational use.
 */

import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface QualityAssessment {
  qualityScore: number; // 0-100
  isClinical: boolean;
  resolution: { width: number; height: number };
  fileSize: number;
  issues: string[];
  recommendations: string[];
  aiAnalysis?: {
    description: string;
    clinicalFeatures: string[];
    diagnosticQuality: string; // "excellent" | "good" | "fair" | "poor"
    recommendation: 'approve' | 'reject' | 'review';
  };
}

/**
 * Minimum quality thresholds for auto-approval
 */
const QUALITY_THRESHOLDS = {
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  MIN_QUALITY_SCORE: 70,
  MAX_FILE_SIZE_MB: 10,
};

/**
 * Assess image quality using both technical and AI analysis
 */
export async function assessImageQuality(
  imageBuffer: Buffer,
  category: string
): Promise<QualityAssessment> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let qualityScore = 100;

  // Technical analysis using sharp
  const metadata = await sharp(imageBuffer).metadata();
  const { width = 0, height = 0, format, size = 0 } = metadata;

  // Check resolution
  if (width < QUALITY_THRESHOLDS.MIN_WIDTH || height < QUALITY_THRESHOLDS.MIN_HEIGHT) {
    issues.push(`Low resolution: ${width}x${height} (minimum: ${QUALITY_THRESHOLDS.MIN_WIDTH}x${QUALITY_THRESHOLDS.MIN_HEIGHT})`);
    qualityScore -= 30;
    recommendations.push('Use higher resolution images for better educational value');
  }

  // Check file size
  const fileSizeMB = size / (1024 * 1024);
  if (fileSizeMB > QUALITY_THRESHOLDS.MAX_FILE_SIZE_MB) {
    issues.push(`Large file size: ${fileSizeMB.toFixed(2)}MB (maximum: ${QUALITY_THRESHOLDS.MAX_FILE_SIZE_MB}MB)`);
    qualityScore -= 10;
    recommendations.push('Compress image to reduce file size while maintaining quality');
  }

  // Check format
  if (!['jpeg', 'jpg', 'png', 'webp'].includes(format || '')) {
    issues.push(`Unsupported format: ${format}`);
    qualityScore -= 20;
    recommendations.push('Convert to JPEG, PNG, or WebP format');
  }

  // AI-powered clinical analysis
  let aiAnalysis;
  try {
    aiAnalysis = await analyzeImageWithAI(imageBuffer, category);
    
    // Adjust score based on AI analysis
    if (aiAnalysis.diagnosticQuality === 'poor') {
      qualityScore -= 40;
      issues.push('AI detected poor diagnostic quality');
    } else if (aiAnalysis.diagnosticQuality === 'fair') {
      qualityScore -= 20;
      issues.push('AI detected fair diagnostic quality');
    } else if (aiAnalysis.diagnosticQuality === 'excellent') {
      qualityScore += 5; // Bonus for excellent images
    }

    if (!aiAnalysis.clinicalFeatures || aiAnalysis.clinicalFeatures.length === 0) {
      qualityScore -= 15;
      issues.push('No clear clinical features identified');
    }
  } catch (error) {
    console.warn('AI analysis failed:', error);
    // Don't penalize score if AI analysis fails
    recommendations.push('Manual review recommended (AI analysis unavailable)');
  }

  // Ensure score stays within 0-100 range
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    qualityScore,
    isClinical: aiAnalysis?.recommendation !== 'reject' && qualityScore >= 50,
    resolution: { width, height },
    fileSize: size,
    issues,
    recommendations,
    aiAnalysis,
  };
}

/**
 * Use AI to analyze image content for clinical relevance
 */
async function analyzeImageWithAI(
  imageBuffer: Buffer,
  category: string
): Promise<QualityAssessment['aiAnalysis']> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const base64Image = imageBuffer.toString('base64');
  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: 'image/jpeg',
    },
  };

  const prompt = `You are a medical imaging expert. Analyze this ${category} image for educational use.

Provide a JSON response with:
1. description: Brief description of what the image shows
2. clinicalFeatures: Array of key diagnostic features visible (e.g., ["irregular rhythm", "ST elevation"])
3. diagnosticQuality: Rate as "excellent", "good", "fair", or "poor" for educational purposes
4. recommendation: "approve" if suitable for medical education, "reject" if not clinical/poor quality, or "review" if uncertain

Example response:
{
  "description": "ECG showing atrial fibrillation with rapid ventricular response",
  "clinicalFeatures": ["irregularly irregular rhythm", "absent P waves", "rapid ventricular rate"],
  "diagnosticQuality": "excellent",
  "recommendation": "approve"
}`;

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain valid JSON');
  }

  const analysis = JSON.parse(jsonMatch[0]);
  
  return {
    description: analysis.description || 'No description available',
    clinicalFeatures: analysis.clinicalFeatures || [],
    diagnosticQuality: analysis.diagnosticQuality || 'fair',
    recommendation: analysis.recommendation || 'review',
  };
}

/**
 * Determine if image should be auto-approved based on quality assessment
 */
export function shouldAutoApprove(assessment: QualityAssessment): boolean {
  return (
    assessment.qualityScore >= QUALITY_THRESHOLDS.MIN_QUALITY_SCORE &&
    assessment.isClinical &&
    assessment.issues.length === 0 &&
    assessment.aiAnalysis?.recommendation === 'approve'
  );
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 300
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Optimize image for web delivery
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  maxWidth: number = 1920
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}
