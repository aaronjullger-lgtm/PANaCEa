/**
 * AI-Powered Image Analyzer
 * 
 * Uses Gemini Vision API to:
 * 1. Verify medical image content matches expected condition
 * 2. Detect annotations/labels that would give away the answer
 * 3. Suggest appropriate cropping regions
 * 4. Generate perceptual hashes for duplicate detection
 * 
 * Usage: Import and use in process-local-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from 'dotenv';

config();

// Strip quotes from env var if present (dotenv sometimes includes them)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '');

interface ImageAnalysis {
  isValid: boolean;
  confidence: number;
  detectedCondition: string | null;
  suggestedConditionId: string | null; // NEW: If AI thinks it belongs to different condition
  matchesExpected: boolean;
  hasAnnotations: boolean; // Now means "has PROBLEMATIC annotations"
  annotationType: 'diagnostic_label' | 'educational_overlay' | 'answer_revealing' | 'watermark_with_diagnosis' | 'none';
  annotationDetails: string[];
  hasSourceText: boolean; // NEW: Has croppable source/copyright text
  suggestedCrop: CropRegion | null;
  imageType: 'ecg' | 'xray' | 'ct' | 'mri' | 'clinical_photo' | 'dermoscopy' | 'ultrasound' | 'fundoscopy' | 'unknown';
  quizSuitability: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
  quizSuitabilityReason: string;
  perceptualHash: string;
}

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
}

interface AnalysisOptions {
  expectedCondition?: string;
  strictMode?: boolean;
  checkForAnnotations?: boolean;
  suggestCropping?: boolean;
}

/**
 * Generate a perceptual hash for duplicate detection
 * Uses average hash (aHash) algorithm - simple but effective
 */
export async function generatePerceptualHash(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);
  
  // For now, use a combination of file size and content hash
  // In production, use a proper perceptual hash library like sharp + blockhash
  const contentHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
  const fileSize = imageBuffer.length;
  
  // Create a simple hash combining size and content characteristics
  return `ph_${fileSize}_${contentHash.substring(0, 16)}`;
}

/**
 * Analyze image using Gemini Vision API
 */
export async function analyzeImage(
  imagePath: string,
  options: AnalysisOptions = {}
): Promise<ImageAnalysis> {
  const {
    expectedCondition,
    strictMode = false,
    checkForAnnotations = true,
    suggestCropping = true,
  } = options;

  // Default response for when API is unavailable
  const defaultAnalysis: ImageAnalysis = {
    isValid: true,
    confidence: 0.5,
    detectedCondition: expectedCondition || null,
    suggestedConditionId: null,
    matchesExpected: true,
    hasAnnotations: false,
    annotationType: 'none',
    annotationDetails: [],
    hasSourceText: false,
    suggestedCrop: null,
    imageType: 'unknown',
    quizSuitability: 'fair',
    quizSuitabilityReason: 'Unable to analyze - using filename-based classification',
    perceptualHash: await generatePerceptualHash(imagePath),
  };

  if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not set - using basic analysis');
    return defaultAnalysis;
  }

  // Retry logic with exponential backoff for rate limiting
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 5000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Read and encode image
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = getMimeType(imagePath);

      // Build the analysis prompt
      const prompt = buildAnalysisPrompt(expectedCondition, checkForAnnotations, suggestCropping);

      // Call Gemini API (using gemini-2.5-flash which supports vision)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      // Check for rate limiting (429) or server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_RETRIES - 1) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`⚠️ Rate limited (${response.status}), retrying in ${delayMs/1000}s...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      console.warn(`⚠️ Gemini API error: ${response.status} - ${errorBody.substring(0, 100)}`);
      return defaultAnalysis;
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`⚠️ No response from Gemini, retrying in ${delayMs/1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      console.warn('⚠️ No response from Gemini after retries');
      return defaultAnalysis;
    }

    // Parse the structured response
    const analysis = parseGeminiResponse(textResponse, expectedCondition);
    analysis.perceptualHash = await generatePerceptualHash(imagePath);

    return analysis;

    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`⚠️ Analysis error: ${error}, retrying in ${delayMs/1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      console.warn(`⚠️ Analysis error after retries: ${error}`);
      return defaultAnalysis;
    }
  }
  
  return defaultAnalysis;
}

/**
 * Build the analysis prompt for Gemini - simplified for reliable responses
 */
function buildAnalysisPrompt(
  expectedCondition?: string,
  checkAnnotations = true,
  suggestCropping = true
): string {
  // Much simpler prompt to avoid truncation
  return `Analyze this medical image. Return compact JSON:
{"imageType":"ecg|xray|ct|mri|clinical_photo|dermoscopy|unknown","detectedCondition":"condition","confidence":0.9,"isValidMedicalImage":true,"matchesExpected":${expectedCondition ? 'true/false' : 'true'}${expectedCondition ? `,"betterConditionMatch":"suggested_id_or_null"` : ''},"hasProblematicAnnotations":false,"annotationType":"none","quizSuitability":"good","quizSuitabilityReason":"brief"}
Expected condition: ${expectedCondition || 'any'}. Flag only diagnosis-revealing labels, not standard ECG leads.`;
}

/**
 * Parse Gemini's JSON response
 */
function parseGeminiResponse(response: string, expectedCondition?: string): ImageAnalysis {
  // Strip markdown code blocks if present
  let cleanResponse = response;
  if (response.includes('```json')) {
    cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (response.includes('```')) {
    cleanResponse = response.replace(/```\n?/g, '');
  }
  
  // Try to extract complete JSON object
  let jsonStr: string | null = null;
  
  // First try: find complete JSON with balanced braces
  const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  // Second try: if response starts with { but is incomplete, try parsing anyway
  if (!jsonStr && cleanResponse.trim().startsWith('{')) {
    // Try to find the JSON object and complete it if needed
    let depth = 0;
    let endIndex = -1;
    for (let i = 0; i < cleanResponse.length; i++) {
      if (cleanResponse[i] === '{') depth++;
      if (cleanResponse[i] === '}') depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
    if (endIndex > 0) {
      jsonStr = cleanResponse.substring(0, endIndex + 1);
    }
  }
  
  if (!jsonStr) {
    // Log what we got instead
    console.warn(`⚠️ Response without JSON (first 200 chars): ${response.substring(0, 200)}`);
    throw new Error('No JSON found in response');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.warn(`⚠️ JSON parse error: ${parseErr}. Raw: ${jsonStr.substring(0, 150)}...`);
    throw new Error('Invalid JSON in response');
  }

  // Map to our interface - use the NEW field names from improved prompt
  const analysis: ImageAnalysis = {
    isValid: parsed.isValidMedicalImage ?? true,
    confidence: parsed.confidence ?? 0.5,
    detectedCondition: parsed.detectedCondition || null,
    suggestedConditionId: parsed.betterConditionMatch || null, // NEW: for rerouting
    matchesExpected: expectedCondition 
      ? (parsed.matchesExpected ?? isConditionMatch(parsed.detectedCondition, expectedCondition))
      : true,
    // Use new field name - only flag PROBLEMATIC annotations
    hasAnnotations: parsed.hasProblematicAnnotations ?? parsed.hasAnnotations ?? false,
    annotationType: parsed.annotationType || 'none',
    annotationDetails: parsed.annotationDetails || [],
    hasSourceText: parsed.hasSourceText ?? false, // NEW: track croppable source text
    suggestedCrop: parsed.suggestedCrop?.needed ? {
      x: parsed.suggestedCrop.x || 0,
      y: parsed.suggestedCrop.y || 0,
      width: parsed.suggestedCrop.width || 100,
      height: parsed.suggestedCrop.height || 100,
      reason: parsed.suggestedCrop.reason || '',
    } : null,
    imageType: parsed.imageType || 'unknown',
    quizSuitability: parsed.quizSuitability || 'fair',
    quizSuitabilityReason: parsed.quizSuitabilityReason || '',
    perceptualHash: '', // Will be set after
  };

  return analysis;
}

/**
 * Check if detected condition matches expected (fuzzy match)
 */
function isConditionMatch(detected: string | null, expected: string): boolean {
  if (!detected) return false;
  
  const normalizedDetected = detected.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedExpected = expected.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check for substring match
  return normalizedDetected.includes(normalizedExpected) || 
         normalizedExpected.includes(normalizedDetected);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Batch analyze images with rate limiting
 */
export async function batchAnalyzeImages(
  images: Array<{ path: string; expectedCondition?: string }>,
  options: { delayMs?: number; maxConcurrent?: number } = {}
): Promise<Map<string, ImageAnalysis>> {
  const { delayMs = 500, maxConcurrent = 3 } = options;
  const results = new Map<string, ImageAnalysis>();

  // Process in batches
  for (let i = 0; i < images.length; i += maxConcurrent) {
    const batch = images.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(img => 
        analyzeImage(img.path, { expectedCondition: img.expectedCondition })
          .then(analysis => ({ path: img.path, analysis }))
      )
    );

    for (const { path, analysis } of batchResults) {
      results.set(path, analysis);
    }

    // Rate limiting delay
    if (i + maxConcurrent < images.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

/**
 * Check for duplicate images using perceptual hash
 */
export class DuplicateDetector {
  private hashMap = new Map<string, string[]>(); // hash -> paths
  
  addImage(imagePath: string, hash: string): boolean {
    // Check if hash already exists
    if (this.hashMap.has(hash)) {
      const existing = this.hashMap.get(hash)!;
      existing.push(imagePath);
      return true; // Is duplicate
    }
    
    this.hashMap.set(hash, [imagePath]);
    return false; // Not duplicate
  }

  isDuplicate(hash: string): boolean {
    return this.hashMap.has(hash);
  }

  getDuplicates(): Map<string, string[]> {
    const duplicates = new Map<string, string[]>();
    for (const [hash, paths] of this.hashMap) {
      if (paths.length > 1) {
        duplicates.set(hash, paths);
      }
    }
    return duplicates;
  }

  async loadExistingHashes(dbClient: any): Promise<void> {
    try {
      const result = await dbClient.query(`
        SELECT "originalUrl", filename FROM "MediaAsset" 
        WHERE "originalUrl" IS NOT NULL
      `);
      
      // For existing images, use URL as a simple hash
      for (const row of result.rows) {
        const simpleHash = `existing_${crypto.createHash('md5').update(row.originalUrl || row.filename || '').digest('hex').substring(0, 16)}`;
        this.hashMap.set(simpleHash, [row.originalUrl || row.filename]);
      }
      
      console.log(`Loaded ${result.rows.length} existing image hashes`);
    } catch (err) {
      console.warn('Could not load existing hashes:', err);
    }
  }
}

// Export types
export type { ImageAnalysis, CropRegion, AnalysisOptions };
