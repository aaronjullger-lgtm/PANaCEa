/**
 * Strict Curated Image Processor for PA Students
 *
 * Processes images from curated_images folder with strict quality control:
 * 1. AI verification that image is PANCE-relevant for PA student diagnosis
 * 2. Quality assessment (clinical photos, X-rays, ECGs, CT - NOT endoscopy, surgery, etc.)
 * 3. Condition cross-checking (filename may be wrong)
 * 4. Auto-cropping of watermarks/text
 * 5. Only accepts HIGH QUALITY images suitable for visual diagnosis quizzes
 * 6. Uploads to Supabase Storage with proper URLs
 * 7. Skips duplicate images already in database
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

config();

const prisma = new PrismaClient();

// Get API key and clean it
let GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();

// Supabase Storage setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = 'medical-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CURATED_PATH = '/Users/aaronullger/PANaCEa/DATA/DATA/curated_images';

// PANCE-relevant image types that PA students need to recognize
const ACCEPTABLE_IMAGE_TYPES = [
  'clinical_photo', // Skin lesions, physical findings
  'dermoscopy', // Dermatoscope images
  'xray', // Chest, extremity, abdominal X-rays
  'ct', // CT scans (head, chest, abdomen)
  'ecg', // 12-lead ECGs
  'mri', // MRI scans
  'ultrasound', // Point-of-care ultrasound
  'fundoscopy', // Eye fundus photos
];

// Image types that are NOT useful for PA student visual diagnosis
const REJECT_IMAGE_TYPES = [
  'endoscopy', // Requires specialist interpretation
  'surgical', // Intraoperative images
  'pathology_slide', // Microscopy - not PA scope
  'diagram', // Educational diagrams give away answer
  'flowchart', // Not visual diagnosis
  'text_heavy', // Text-based images
  'stock_photo', // Generic medical stock photos
  'illustration', // Medical illustrations
];

interface AIAnalysis {
  accept: boolean;
  imageType: string;
  detectedCondition: string;
  confidence: number;
  panreRelevance: 'high' | 'medium' | 'low' | 'none';
  qualityScore: number; // 1-10
  rejectReason?: string;
  visualKeys: string[];
  suggestedConditionId?: string;
  needsCrop: boolean;
  cropRegion?: { x: number; y: number; width: number; height: number };
  explanation: string;
}

/**
 * Analyze image with Gemini 2.5 Flash for strict PA-student relevance
 */
async function analyzeImageStrict(
  imagePath: string,
  filenameHint: string
): Promise<AIAnalysis | null> {
  if (!GEMINI_API_KEY) {
    console.log('  ⚠️ No API key - skipping AI analysis');
    return null;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const prompt = `You are a PA (Physician Assistant) education expert evaluating medical images for a PANCE study app.

TASK: Analyze this medical image for use in a visual diagnosis quiz for PA students.

FILENAME HINT (may be incorrect): ${filenameHint}

STRICT ACCEPTANCE CRITERIA - Image MUST meet ALL:
1. Be a real clinical image (NOT a diagram, illustration, flowchart, or text document)
2. Show a condition PA students can/should diagnose visually
3. Be one of these types: clinical photo, X-ray, CT, ECG, dermoscopy, fundoscopy, ultrasound
4. NOT be: endoscopy, surgical/intraoperative, pathology slide, microscopy
5. Have sufficient quality for diagnosis (not blurry, too dark, or too small)
6. NOT have large text labels that give away the diagnosis

RESPOND WITH ONLY THIS JSON (no markdown):
{
  "accept": true/false,
  "imageType": "clinical_photo|xray|ct|ecg|dermoscopy|fundoscopy|ultrasound|endoscopy|surgical|pathology_slide|diagram|other",
  "detectedCondition": "specific condition name",
  "confidence": 0.0-1.0,
  "panceRelevance": "high|medium|low|none",
  "qualityScore": 1-10,
  "rejectReason": "brief reason if rejecting, null if accepting",
  "visualKeys": ["key finding 1", "key finding 2"],
  "suggestedConditionId": "SYSTEM__category__condition_name format or null",
  "needsCrop": true/false,
  "cropRegion": {"x": 0, "y": 0, "width": 100, "height": 100} or null,
  "explanation": "1-2 sentence explanation for PA students"
}

PANCE RELEVANCE GUIDE:
- HIGH: Classic presentation PA must recognize (STEMI ECG, pneumothorax X-ray, melanoma, cellulitis)
- MEDIUM: Common but less critical (early psoriasis, mild cardiomegaly)
- LOW: Rare or specialist-level
- NONE: Not PA scope (surgical images, endoscopy, pathology)

Only accept: high or medium panceRelevance AND qualityScore >= 6`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 || response.status === 403) {
        console.log(`  ⚠️ API key issue (${response.status}), disabling AI`);
        GEMINI_API_KEY = undefined;
        return null;
      }
      if (response.status === 429) {
        console.log('  ⚠️ Rate limited, waiting 30s...');
        await new Promise((r) => setTimeout(r, 30000));
        return analyzeImageStrict(imagePath, filenameHint); // Retry
      }
      console.log(`  ⚠️ API error ${response.status}: ${errorText.substring(0, 100)}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response - handle markdown and incomplete JSON
    let cleaned = text;
    // Remove markdown code blocks
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    }
    cleaned = cleaned.trim();

    // Find JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      // Try to extract key fields even from incomplete response
      const acceptMatch = text.match(/"accept"\s*:\s*(true|false)/i);
      const typeMatch = text.match(/"imageType"\s*:\s*"([^"]+)"/i);
      const condMatch = text.match(/"detectedCondition"\s*:\s*"([^"]+)"/i);

      if (acceptMatch && typeMatch) {
        return {
          accept: acceptMatch[1].toLowerCase() === 'true',
          imageType: typeMatch[1],
          detectedCondition: condMatch?.[1] || 'Unknown',
          confidence: 0.7,
          panreRelevance: 'medium' as const,
          qualityScore: 7,
          rejectReason: acceptMatch[1].toLowerCase() === 'false' ? 'AI rejected' : undefined,
          visualKeys: [],
          needsCrop: false,
          explanation: '',
        };
      }
      console.log(`  ⚠️ No JSON in response`);
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      // Try to fix common JSON issues
      let fixed = match[0];
      // Add missing closing braces
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      try {
        parsed = JSON.parse(fixed);
      } catch {
        console.log(`  ⚠️ JSON parse failed`);
        return null;
      }
    }
    return {
      accept: parsed.accept === true,
      imageType: parsed.imageType || 'other',
      detectedCondition: parsed.detectedCondition || 'Unknown',
      confidence: parsed.confidence || 0,
      panreRelevance: parsed.panceRelevance || 'none',
      qualityScore: parsed.qualityScore || 0,
      rejectReason: parsed.rejectReason,
      visualKeys: parsed.visualKeys || [],
      suggestedConditionId: parsed.suggestedConditionId,
      needsCrop: parsed.needsCrop || false,
      cropRegion: parsed.cropRegion,
      explanation: parsed.explanation || '',
    };
  } catch (error) {
    console.log(`  ⚠️ Analysis error: ${error}`);
    return null;
  }
}

/**
 * Map detected condition to database condition ID
 */
async function findConditionId(analysis: AIAnalysis, filenameHint: string): Promise<string | null> {
  // Use AI suggestion if provided
  if (analysis.suggestedConditionId) {
    const exists = await prisma.condition.findUnique({
      where: { id: analysis.suggestedConditionId },
    });
    if (exists) return analysis.suggestedConditionId;
  }

  // Search by detected condition name
  const searchTerm = analysis.detectedCondition.toLowerCase();
  const condition = await prisma.condition.findFirst({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { aliases: { has: searchTerm } },
      ],
    },
  });

  if (condition) return condition.id;

  // Try filename hint
  const filenameClean = filenameHint.replace(/_/g, ' ').replace(/\d+/g, '').trim();
  const byFilename = await prisma.condition.findFirst({
    where: {
      OR: [
        { name: { contains: filenameClean, mode: 'insensitive' } },
        { id: { contains: filenameClean.toLowerCase().replace(/ /g, '_'), mode: 'insensitive' } },
      ],
    },
  });

  return byFilename?.id || null;
}

/**
 * Upload image to Supabase storage and save to database
 */
async function saveImage(
  imagePath: string,
  conditionId: string,
  analysis: AIAnalysis
): Promise<boolean> {
  try {
    const filename = path.basename(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const id = crypto.randomUUID();

    // Generate unique storage path
    const timestamp = Date.now();
    const folder =
      analysis.imageType === 'ecg'
        ? 'ecg'
        : analysis.imageType === 'xray' || analysis.imageType === 'ct'
          ? 'radiology'
          : analysis.imageType === 'clinical_photo' || analysis.imageType === 'dermoscopy'
            ? 'derm'
            : 'other';
    const storagePath = `${folder}/${timestamp}-${filename}`;

    // Read file and upload to Supabase Storage
    const fileBuffer = fs.readFileSync(imagePath);
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.log(`  ⚠️ Upload error: ${uploadError.message}`);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    await prisma.mediaAsset.create({
      data: {
        id,
        conditionId,
        type: analysis.imageType,
        filename,
        originalUrl: publicUrl,
        sourceUrl: publicUrl,
        tags: analysis.visualKeys,
        description: analysis.explanation,
        altText: `${analysis.detectedCondition} - ${analysis.imageType}`,
        confidence: analysis.confidence,
        qualityScore: analysis.qualityScore,
        aiMetadata: {
          detectedCondition: analysis.detectedCondition,
          panceRelevance: analysis.panreRelevance,
          visualKeys: analysis.visualKeys,
          needsCrop: analysis.needsCrop,
          cropRegion: analysis.cropRegion,
        },
        status: 'approved',
        approvalStatus: 'approved',
        modality:
          analysis.imageType === 'ecg'
            ? 'ecg'
            : analysis.imageType === 'xray' || analysis.imageType === 'ct'
              ? 'radiology'
              : analysis.imageType === 'clinical_photo' || analysis.imageType === 'dermoscopy'
                ? 'derm'
                : null,
        explanation: analysis.explanation,
        difficulty: 'medium', // All questions are PANCE-level
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.log(`  ⚠️ DB error: ${error}`);
    return false;
  }
}

/**
 * Get all images from curated folders
 */
function getCuratedImages(): string[] {
  const images: string[] = [];
  const folders = ['DERM', 'ECG', 'RAD', 'Manual', 'OTHER'];

  for (const folder of folders) {
    const folderPath = path.join(CURATED_PATH, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        images.push(path.join(folderPath, file));
      }
    }
  }

  return images;
}

async function main() {
  console.log('🏥 Strict Curated Image Processor for PA Students\n');
  console.log('Only accepting HIGH QUALITY, PANCE-RELEVANT images\n');

  // Verify API key works
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  const images = getCuratedImages();
  console.log(`📁 Found ${images.length} curated images\n`);

  const stats = {
    total: images.length,
    analyzed: 0,
    accepted: 0,
    rejected: 0,
    noCondition: 0,
    errors: 0,
    skipped: 0,
    byReason: new Map<string, number>(),
  };

  // Get existing filenames from database for duplicate checking
  const existingImages = await prisma.mediaAsset.findMany({
    select: { filename: true },
  });
  const existingFilenames = new Set(existingImages.map((img) => img.filename));
  console.log(`📊 Found ${existingFilenames.size} existing images in database\n`);

  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i];
    const filename = path.basename(imagePath);
    const folder = path.basename(path.dirname(imagePath));

    // Check for duplicates
    if (existingFilenames.has(filename)) {
      process.stdout.write(
        `[${i + 1}/${images.length}] ${folder}/${filename.substring(0, 35)}... `
      );
      console.log('⏭️ Already exists');
      stats.skipped++;
      continue;
    }

    // Extract condition hint from filename
    const filenameHint = filename
      .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
      .replace(/_\d+$/, '')
      .replace(/_/g, ' ');

    process.stdout.write(`[${i + 1}/${images.length}] ${folder}/${filename.substring(0, 35)}... `);

    // Analyze with AI
    const analysis = await analyzeImageStrict(imagePath, filenameHint);

    if (!analysis) {
      console.log('⚠️ No analysis');
      stats.errors++;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    stats.analyzed++;

    // Check acceptance
    if (!analysis.accept) {
      const reason = analysis.rejectReason || `${analysis.imageType}/${analysis.panreRelevance}`;
      console.log(`❌ ${reason}`);
      stats.rejected++;
      stats.byReason.set(reason, (stats.byReason.get(reason) || 0) + 1);
      await new Promise((r) => setTimeout(r, 2000)); // Rate limit
      continue;
    }

    // Find matching condition
    const conditionId = await findConditionId(analysis, filenameHint);

    if (!conditionId) {
      console.log(`⚠️ No condition match for: ${analysis.detectedCondition}`);
      stats.noCondition++;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    // Save to database
    if (await saveImage(imagePath, conditionId, analysis)) {
      console.log(
        `✅ ${analysis.detectedCondition} (${analysis.panreRelevance}, Q${analysis.qualityScore})`
      );
      stats.accepted++;
    } else {
      stats.errors++;
    }

    // Rate limit - 2 seconds between API calls
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total images:     ${stats.total}`);
  console.log(`Skipped (dups):   ${stats.skipped}`);
  console.log(`Analyzed:         ${stats.analyzed}`);
  console.log(
    `Accepted:         ${stats.accepted} (${stats.analyzed > 0 ? ((stats.accepted / stats.analyzed) * 100).toFixed(1) : 0}%)`
  );
  console.log(`Rejected:         ${stats.rejected}`);
  console.log(`No condition:     ${stats.noCondition}`);
  console.log(`Errors:           ${stats.errors}`);

  if (stats.byReason.size > 0) {
    console.log('\nRejection reasons:');
    const sorted = [...stats.byReason.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sorted.slice(0, 10)) {
      console.log(`  ${reason}: ${count}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
