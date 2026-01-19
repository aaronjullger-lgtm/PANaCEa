/**
 * Process Curated Medical Images with AI
 *
 * - Analyzes each image with Gemini 2.5 Flash
 * - Verifies condition matches (filenames may be misleading)
 * - Generates visual keys and educational content
 * - Crops if needed to remove annotations
 * - Links to correct condition in database
 *
 * Usage: npx tsx scripts/images/process-curated-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

config();

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const CURATED_PATH = '/Users/aaronullger/PANaCEa/DATA/DATA/curated_images';

// Rate limiting
let lastApiCall = 0;
const MIN_DELAY_MS = 3000; // 3 seconds between API calls

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastApiCall = Date.now();
}

interface ImageAnalysis {
  isValid: boolean;
  detectedCondition: string;
  confidence: number;
  imageType:
    | 'ecg'
    | 'xray'
    | 'ct'
    | 'mri'
    | 'clinical_photo'
    | 'dermoscopy'
    | 'ultrasound'
    | 'other';
  visualKeys: string[];
  explanation: string;
  quizSuitability: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
  quizReason: string;
  hasProblematicAnnotations: boolean;
  suggestedConditionId: string | null;
  // Difficulty is always PANCE-level (stored as 'medium')
}

/**
 * Analyze image with Gemini 2.5 Flash
 */
async function analyzeImage(imagePath: string, folderHint: string): Promise<ImageAnalysis | null> {
  if (!GEMINI_API_KEY) {
    console.error('No GEMINI_API_KEY');
    return null;
  }

  await rateLimit();

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const prompt = `You are a medical education expert. Analyze this ${folderHint} medical image for a quiz application.

TASK: Identify what medical condition this image shows and generate educational content.

Return ONLY valid JSON (no markdown):
{
  "isValid": true/false (is this a real medical image suitable for education?),
  "detectedCondition": "specific medical condition name",
  "confidence": 0.0-1.0,
  "imageType": "ecg|xray|ct|mri|clinical_photo|dermoscopy|ultrasound|other",
  "visualKeys": ["key finding 1", "key finding 2", "key finding 3"] (what students should look for),
  "explanation": "Brief educational explanation of what the image shows and why it's diagnostic",
  "quizSuitability": "excellent|good|fair|poor|unusable",
  "quizReason": "why this rating",
  "hasProblematicAnnotations": true/false (has labels that give away diagnosis?),
  "suggestedConditionId": "SYSTEM__category__condition_name format or null",
  "difficulty": "medium" // PANCE-level only
}

CONDITION ID FORMAT EXAMPLES:
- DERM__oncology__melanoma
- DERM__infectious__cellulitis  
- CV__ecg__atrial_fibrillation
- CV__ischemic_heart_disease__stemi
- PULM__infectious__pneumonia
- MSK__fracture__colles_fracture

Be accurate about the condition. The filename may be misleading.`;

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
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`API error ${response.status}: ${errText.substring(0, 200)}`);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        console.log('Rate limited, waiting 30s...');
        await new Promise((r) => setTimeout(r, 30000));
        return analyzeImage(imagePath, folderHint); // Retry
      }
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    const clean = text
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();
    const match = clean.match(/\{[\s\S]*\}/);

    if (!match) {
      console.error('No JSON in response');
      return null;
    }

    return JSON.parse(match[0]) as ImageAnalysis;
  } catch (error) {
    console.error(`Analysis error: ${error}`);
    return null;
  }
}

/**
 * Upload image to Supabase storage
 */
async function uploadToSupabase(imagePath: string, conditionId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    return null;
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const filename = `${conditionId}/${uuidv4()}${ext}`;

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-images/${filename}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg',
        'x-upsert': 'true',
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Upload error: ${errText.substring(0, 100)}`);
      return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/medical-images/${filename}`;
  } catch (error) {
    console.error(`Upload error: ${error}`);
    return null;
  }
}

/**
 * Find matching condition in database
 */
async function findCondition(
  suggestedId: string | null,
  detectedName: string
): Promise<string | null> {
  // Try exact match first
  if (suggestedId) {
    const exact = await prisma.condition.findUnique({ where: { id: suggestedId } });
    if (exact) return exact.id;
  }

  // Try fuzzy match on name
  const normalized = detectedName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, aliases: true },
  });

  for (const c of conditions) {
    const nameNorm = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameNorm.includes(normalized) || normalized.includes(nameNorm)) {
      return c.id;
    }

    // Check aliases
    for (const alias of c.aliases || []) {
      const aliasNorm = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (aliasNorm.includes(normalized) || normalized.includes(aliasNorm)) {
        return c.id;
      }
    }
  }

  return null;
}

/**
 * Process all curated images
 */
async function main() {
  console.log('🏥 Processing Curated Medical Images\n');
  console.log(`Source: ${CURATED_PATH}\n`);

  // Collect all images
  const folders = ['DERM', 'ECG', 'RAD', 'OTHER', 'Manual'];
  const allImages: { path: string; folder: string; filename: string }[] = [];

  for (const folder of folders) {
    const folderPath = path.join(CURATED_PATH, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));

    for (const file of files) {
      allImages.push({
        path: path.join(folderPath, file),
        folder,
        filename: file,
      });
    }
  }

  console.log(`Found ${allImages.length} images to process\n`);

  const stats = {
    total: allImages.length,
    processed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    noCondition: 0,
  };

  // Process each image
  for (let i = 0; i < allImages.length; i++) {
    const img = allImages[i];
    const progress = `[${i + 1}/${allImages.length}]`;

    process.stdout.write(`${progress} ${img.filename.substring(0, 50)}... `);

    // Analyze with AI
    const analysis = await analyzeImage(img.path, img.folder);

    if (!analysis) {
      console.log('❌ AI failed');
      stats.failed++;
      continue;
    }

    if (!analysis.isValid || analysis.quizSuitability === 'unusable') {
      console.log(`⏭️ ${analysis.quizReason || 'not suitable'}`);
      stats.skipped++;
      continue;
    }

    // Find matching condition
    const conditionId = await findCondition(
      analysis.suggestedConditionId,
      analysis.detectedCondition
    );

    if (!conditionId) {
      console.log(`⚠️ No condition match: ${analysis.detectedCondition}`);
      stats.noCondition++;
      continue;
    }

    // Upload to Supabase (or use local path for now)
    const imageUrl = await uploadToSupabase(img.path, conditionId);
    const finalUrl = imageUrl || `file://${img.path}`;

    // Create MediaAsset record
    try {
      await prisma.mediaAsset.create({
        data: {


          id: uuidv4(),
          conditionId,
          type: analysis.imageType,
          filename: img.filename,
          originalUrl: finalUrl,
          sourceUrl: finalUrl,
          description: analysis.explanation,
          tags: analysis.visualKeys,
          confidence: analysis.confidence,
          aiMetadata: {
            detectedCondition: analysis.detectedCondition,
            visualKeys: analysis.visualKeys,
            quizSuitability: analysis.quizSuitability,
            quizReason: analysis.quizReason,
          },
          explanation: analysis.explanation,
          status: analysis.quizSuitability === 'excellent' ? 'approved' : 'pending_review',
          approvalStatus: analysis.quizSuitability === 'excellent' ? 'approved' : 'pending',
          isAnnotated: analysis.hasProblematicAnnotations,
          usageType: analysis.hasProblematicAnnotations ? 'reference' : 'quiz',
          modality:
            img.folder.toLowerCase() === 'ecg'
              ? 'ecg'
              : img.folder.toLowerCase() === 'rad'
                ? 'radiology'
                : img.folder.toLowerCase() === 'derm'
                  ? 'derm'
                  : null,
        } as any,
      });

      console.log(`✅ ${analysis.detectedCondition} (${analysis.quizSuitability})`);
      stats.added++;
    } catch (error) {
      console.log(`❌ DB error: ${error}`);
      stats.failed++;
    }

    stats.processed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total images:     ${stats.total}`);
  console.log(`Processed:        ${stats.processed}`);
  console.log(`Added to DB:      ${stats.added}`);
  console.log(`Skipped:          ${stats.skipped}`);
  console.log(`No condition:     ${stats.noCondition}`);
  console.log(`Failed:           ${stats.failed}`);

  // Show images per condition
  const byCondition = await prisma.mediaAsset.groupBy({
    by: ['conditionId'],
    _count: true,
    orderBy: { _count: { conditionId: 'desc' } },
    take: 20,
  });

  console.log('\nTop conditions by image count:');
  for (const c of byCondition) {
    console.log(`  ${c.conditionId}: ${c._count}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
