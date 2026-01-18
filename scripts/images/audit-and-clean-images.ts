#!/usr/bin/env npx ts-node

/**
 * Audit and Clean Database Images Script
 *
 * This script reviews all existing images in the database using AI analysis
 * to verify they match their assigned conditions and are appropriate clinical images.
 *
 * Actions:
 * - Verifies each image matches its assigned condition using Gemini Vision
 * - Detects and flags images with visible annotations/labels that give away answers
 * - Identifies irrelevant images (diagrams, infographics, text slides)
 * - Re-categorizes mismatched images to correct conditions
 * - Removes or flags inappropriate images
 *
 * Usage: npx tsx scripts/images/audit-and-clean-images.ts [--dry-run] [--limit N]
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Command line options
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const LIMIT_ARG = ARGS.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : undefined;
const UNREVIEWED_ONLY = ARGS.includes('--unreviewed-only');

// Rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_DELAY_MS = 1000; // 1 second between API calls to avoid rate limits

interface AuditResult {
  imageId: string;
  conditionId: string;
  filename: string;
  action: 'keep' | 'delete' | 'reclassify' | 'flag';
  reason: string;
  suggestedCondition?: string;
  isRelevant: boolean;
  isClinical: boolean;
  hasAnnotations: boolean;
  matchesCondition: boolean;
  confidence: number;
  aiAnalysis?: string;
}

interface AuditStats {
  total: number;
  reviewed: number;
  kept: number;
  deleted: number;
  reclassified: number;
  flagged: number;
  errors: number;
}

/**
 * Analyze an image using Gemini Vision API
 */
async function analyzeImageWithAI(
  imageUrl: string,
  expectedCondition: string,
  conditionName: string
): Promise<{
  isRelevant: boolean;
  isClinical: boolean;
  hasAnnotations: boolean;
  matchesCondition: boolean;
  confidence: number;
  suggestedCondition?: string;
  analysis: string;
  action: 'keep' | 'delete' | 'reclassify' | 'flag';
  reason: string;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    const prompt = `You are a medical education image auditor. Analyze this image for a medical quiz/flashcard application.

EXPECTED CONDITION: ${conditionName} (ID: ${expectedCondition})

Evaluate this image and respond in JSON format:
{
  "isRelevant": boolean,      // Is this a relevant medical/clinical image (not a diagram, infographic, text slide, or unrelated content)?
  "isClinical": boolean,      // Is this an actual clinical image (photo, X-ray, ECG, CT, MRI, dermoscopy, fundoscopy, etc)?
  "hasAnnotations": boolean,  // Does the image have visible text labels, arrows, or annotations that reveal the diagnosis?
  "matchesCondition": boolean, // Does this image actually show the expected condition?
  "confidence": number,        // 0-100 confidence in your assessment
  "detectedCondition": string, // What condition does this image actually show? (or "unknown" or "not_medical")
  "analysis": string,          // Brief explanation of what you see in the image
  "recommendation": string     // One of: "keep", "delete", "reclassify", "flag"
  "reason": string             // Why you made this recommendation
}

Guidelines:
- DELETE if: Image is not medical/clinical (text slide, diagram, cartoon, infographic, unrelated photo)
- DELETE if: Image has heavy annotations/labels that give away the diagnosis (defeats quiz purpose)
- RECLASSIFY if: Image is good clinical content but shows a different condition than expected
- FLAG if: Image quality is poor but might be salvageable, or if you're uncertain
- KEEP if: Image is relevant clinical content for the expected condition without problematic annotations

Be strict - we want high-quality, relevant clinical images without answer-revealing labels.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const aiResult = JSON.parse(jsonMatch[0]);

    return {
      isRelevant: aiResult.isRelevant ?? false,
      isClinical: aiResult.isClinical ?? false,
      hasAnnotations: aiResult.hasAnnotations ?? false,
      matchesCondition: aiResult.matchesCondition ?? false,
      confidence: aiResult.confidence ?? 0,
      suggestedCondition:
        aiResult.detectedCondition !== 'unknown' && aiResult.detectedCondition !== 'not_medical'
          ? aiResult.detectedCondition
          : undefined,
      analysis: aiResult.analysis || '',
      action: aiResult.recommendation || 'flag',
      reason: aiResult.reason || '',
    };
  } catch (error) {
    console.error(`  ❌ AI analysis error:`, error);
    return {
      isRelevant: false,
      isClinical: false,
      hasAnnotations: false,
      matchesCondition: false,
      confidence: 0,
      analysis: `Error: ${error}`,
      action: 'flag',
      reason: 'AI analysis failed',
    };
  }
}

/**
 * Get human-readable condition name from condition ID
 */
function getConditionName(conditionId: string): string {
  // Convert ID like "CV__ecg__atrial_fibrillation" to "Atrial Fibrillation"
  const parts = conditionId.split('__');
  const lastPart = parts[parts.length - 1];
  return lastPart
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Main audit function
 */
async function auditImages() {
  console.log('🔍 Image Audit and Cleanup Script');
  console.log('==================================');
  if (DRY_RUN) console.log('📋 DRY RUN MODE - No changes will be made');
  if (LIMIT) console.log(`📊 Processing up to ${LIMIT} images`);
  if (UNREVIEWED_ONLY) console.log('🆕 Only processing images without description (unreviewed)');
  console.log('');

  const stats: AuditStats = {
    total: 0,
    reviewed: 0,
    kept: 0,
    deleted: 0,
    reclassified: 0,
    flagged: 0,
    errors: 0,
  };

  const results: AuditResult[] = [];

  try {
    // Get images to audit
    const whereClause: any = {};
    if (UNREVIEWED_ONLY) {
      whereClause.OR = [{ description: null }, { description: '' }];
    }

    const images = await prisma.mediaAsset.findMany({
      where: whereClause,
      select: {
        id: true,
        filename: true,
        conditionId: true,
        originalUrl: true,
        thumbnailUrl: true,
        tags: true,
        description: true,
      },
      take: LIMIT,
      orderBy: { createdAt: 'desc' },
    });

    stats.total = images.length;
    console.log(`📷 Found ${stats.total} images to audit\n`);

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const progress = `[${i + 1}/${stats.total}]`;

      if (!image.conditionId) {
        console.log(`${progress} ⏭️ Skipping ${image.filename} - no condition assigned`);
        continue;
      }

      // Get image URL (prefer original, fallback to thumbnail)
      const imageUrl = image.originalUrl || image.thumbnailUrl;
      if (!imageUrl) {
        console.log(`${progress} ⏭️ Skipping ${image.filename} - no URL`);
        continue;
      }

      const conditionName = getConditionName(image.conditionId);
      console.log(`${progress} 🔍 Analyzing: ${image.filename}`);
      console.log(`       Condition: ${conditionName}`);

      // Analyze with AI
      const analysis = await analyzeImageWithAI(imageUrl, image.conditionId, conditionName);
      stats.reviewed++;

      const result: AuditResult = {
        imageId: image.id,
        conditionId: image.conditionId,
        filename: image.filename,
        action: analysis.action,
        reason: analysis.reason,
        suggestedCondition: analysis.suggestedCondition,
        isRelevant: analysis.isRelevant,
        isClinical: analysis.isClinical,
        hasAnnotations: analysis.hasAnnotations,
        matchesCondition: analysis.matchesCondition,
        confidence: analysis.confidence,
        aiAnalysis: analysis.analysis,
      };

      results.push(result);

      // Log result
      const actionEmoji = {
        keep: '✅',
        delete: '🗑️',
        reclassify: '🔄',
        flag: '⚠️',
      };

      console.log(
        `       ${actionEmoji[analysis.action]} ${analysis.action.toUpperCase()}: ${analysis.reason}`
      );
      if (analysis.suggestedCondition && analysis.action === 'reclassify') {
        console.log(`       → Suggested: ${analysis.suggestedCondition}`);
      }
      console.log('');

      // Update stats
      switch (analysis.action) {
        case 'keep':
          stats.kept++;
          break;
        case 'delete':
          stats.deleted++;
          break;
        case 'reclassify':
          stats.reclassified++;
          break;
        case 'flag':
          stats.flagged++;
          break;
      }

      // Execute action (if not dry run)
      if (!DRY_RUN) {
        try {
          switch (analysis.action) {
            case 'keep':
              // Update with AI analysis data
              await prisma.mediaAsset.update({
                where: { id: image.id },
                data: {
                  description: analysis.analysis,
                  tags: ['ai-verified', ...(image.tags || [])],
                  qualityScore: analysis.confidence / 100,
                  aiMetadata: {
                    auditedAt: new Date().toISOString(),
                    isRelevant: analysis.isRelevant,
                    isClinical: analysis.isClinical,
                    matchesCondition: analysis.matchesCondition,
                    confidence: analysis.confidence,
                  },
                },
              });
              break;

            case 'delete':
              // Delete from storage
              if (image.originalUrl) {
                const storagePath = image.originalUrl.split('/storage/v1/object/public/')[1];
                if (storagePath) {
                  const [bucket, ...pathParts] = storagePath.split('/');
                  await supabase.storage.from(bucket).remove([pathParts.join('/')]);
                }
              }
              // Delete from database
              await prisma.mediaAsset.delete({ where: { id: image.id } });
              break;

            case 'reclassify':
              // Mark for manual review with suggested condition
              await prisma.mediaAsset.update({
                where: { id: image.id },
                data: {
                  status: 'needs_review',
                  tags: ['needs-reclassification', ...(image.tags || [])],
                  aiMetadata: {
                    auditedAt: new Date().toISOString(),
                    suggestedCondition: analysis.suggestedCondition,
                    originalCondition: image.conditionId,
                    reason: analysis.reason,
                  },
                },
              });
              break;

            case 'flag':
              // Mark for manual review
              await prisma.mediaAsset.update({
                where: { id: image.id },
                data: {
                  status: 'needs_review',
                  tags: ['flagged-for-review', ...(image.tags || [])],
                  aiMetadata: {
                    auditedAt: new Date().toISOString(),
                    reason: analysis.reason,
                    confidence: analysis.confidence,
                  },
                },
              });
              break;
          }
        } catch (actionError) {
          console.error(`  ❌ Action failed:`, actionError);
          stats.errors++;
        }
      }

      // Rate limiting
      await delay(API_DELAY_MS);
    }

    // Save results to file
    const outputPath = path.join(__dirname, '../../data/exports/image-audit-results.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          auditedAt: new Date().toISOString(),
          dryRun: DRY_RUN,
          stats,
          results,
        },
        null,
        2
      )
    );

    // Print summary
    console.log('\n==================================');
    console.log('📊 AUDIT SUMMARY');
    console.log('==================================');
    console.log(`Total images: ${stats.total}`);
    console.log(`Reviewed: ${stats.reviewed}`);
    console.log(`✅ Keep: ${stats.kept} (${((stats.kept / stats.reviewed) * 100).toFixed(1)}%)`);
    console.log(
      `🗑️ Delete: ${stats.deleted} (${((stats.deleted / stats.reviewed) * 100).toFixed(1)}%)`
    );
    console.log(
      `🔄 Reclassify: ${stats.reclassified} (${((stats.reclassified / stats.reviewed) * 100).toFixed(1)}%)`
    );
    console.log(
      `⚠️ Flagged: ${stats.flagged} (${((stats.flagged / stats.reviewed) * 100).toFixed(1)}%)`
    );
    console.log(`❌ Errors: ${stats.errors}`);
    console.log('');
    console.log(`Results saved to: ${outputPath}`);

    if (DRY_RUN) {
      console.log('\n📋 This was a dry run. Run without --dry-run to apply changes.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
auditImages();
