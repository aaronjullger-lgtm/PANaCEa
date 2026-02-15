/**
 * Hunter-Gatherer Auto-Curator Pipeline
 *
 * Automatically discovers, grades, and ingests open-source medical images from Open-i.
 *
 * Pipeline:
 * 1. Search Open-i API for medical images by condition
 * 2. Grade each image using Gemini 1.5 Pro Vision (1-10 scale)
 * 3. Auto-approve and ingest images scoring > 7/10
 * 4. Discard images scoring < 5/10
 *
 * Usage:
 *   npx tsx scripts/intelligence/hunt-images.ts
 *   npx tsx scripts/intelligence/hunt-images.ts --condition="Pneumonia"
 *   npx tsx scripts/intelligence/hunt-images.ts --system="Pulmonary" --maxPerCondition=5
 *   npx tsx scripts/intelligence/hunt-images.ts --dryRun
 *   npx tsx scripts/intelligence/hunt-images.ts --maxTotal=20
 *
 * Requires: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           DIRECT_DATABASE_URL or DATABASE_URL
 */

import { config } from 'dotenv';
config();

import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma, disconnect } from '../_shared/db';
import { supabaseAdmin } from '../../lib/supabase/admin';
import { searchOpenI, type OpenIImage } from '../../lib/open-i';
import { gradeMedicalImage, type GradeResult } from '../../lib/gemini';

const BUCKET = 'medical-images';
const PAUSE_MS = 500; // Rate limiting between Gemini calls
const DEFAULT_MAX_PER_CONDITION = 10;
const DEFAULT_MAX_TOTAL = 50;

interface Args {
  condition: string | null;
  system: string | null;
  maxPerCondition: number;
  maxTotal: number;
  dryRun: boolean;
}

interface Stats {
  conditionsSearched: number;
  candidatesFound: number;
  candidatesGraded: number;
  winnersIngested: number;
  borderline: number;
  discarded: number;
  errors: number;
  skippedDuplicates: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  return {
    condition: getArg(args, 'condition'),
    system: getArg(args, 'system'),
    maxPerCondition: parseInt(getArg(args, 'maxPerCondition') || String(DEFAULT_MAX_PER_CONDITION)),
    maxTotal: parseInt(getArg(args, 'maxTotal') || String(DEFAULT_MAX_TOTAL)),
    dryRun: args.includes('--dryRun'),
  };
}

function getArg(args: string[], key: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${key}=`));
  if (!arg) return null;
  return arg.split('=')[1]?.trim() || null;
}

async function main(): Promise<void> {
  console.log('🔍 Hunter-Gatherer Auto-Curator Pipeline\n');

  const args = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('🧪 DRY RUN MODE: Will grade but not ingest\n');
  }

  // Load conditions from database
  const conditions = await loadConditions(args);
  console.log(`📚 Found ${conditions.length} conditions to process\n`);

  if (conditions.length === 0) {
    console.log('No conditions found. Exiting.');
    return;
  }

  // Cost guardrail: Warn if potentially expensive
  const estimatedCalls = conditions.length * args.maxPerCondition;
  if (estimatedCalls > args.maxTotal) {
    console.log(`⚠️  WARNING: This will make approximately ${estimatedCalls} Gemini API calls.`);
    console.log(`   Cost guardrail is set to ${args.maxTotal} calls.`);
    console.log(`   To proceed with more, use --maxTotal=${estimatedCalls}\n`);
    console.log('Exiting to prevent unexpected API costs.');
    return;
  }

  const stats: Stats = {
    conditionsSearched: 0,
    candidatesFound: 0,
    candidatesGraded: 0,
    winnersIngested: 0,
    borderline: 0,
    discarded: 0,
    errors: 0,
    skippedDuplicates: 0,
  };

  // Process each condition
  for (const condition of conditions) {
    try {
      await processCondition(condition, args, apiKey, stats);
    } catch (error) {
      console.error(`❌ Error processing ${condition.name}:`, error);
      stats.errors++;
    }

    // Check if we've hit the max total limit
    if (stats.candidatesGraded >= args.maxTotal) {
      console.log(`\n🛑 Reached max total limit (${args.maxTotal} calls). Stopping.`);
      break;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Conditions searched:    ${stats.conditionsSearched}`);
  console.log(`Candidates found:       ${stats.candidatesFound}`);
  console.log(`Candidates graded:      ${stats.candidatesGraded}`);
  console.log(`Skipped (duplicates):   ${stats.skippedDuplicates}`);
  console.log(`Winners ingested:       ${stats.winnersIngested}`);
  console.log(`Borderline (5-7):       ${stats.borderline}`);
  console.log(`Discarded (< 5):        ${stats.discarded}`);
  console.log(`Errors:                 ${stats.errors}`);
  console.log('='.repeat(60));
}

async function loadConditions(
  args: Args
): Promise<Array<{ id: string; name: string; system: string }>> {
  const where: any = { status: 'published' };

  if (args.condition) {
    where.OR = [
      { name: { contains: args.condition, mode: 'insensitive' } },
      { displayName: { contains: args.condition, mode: 'insensitive' } },
    ];
  }

  if (args.system) {
    where.system = { contains: args.system, mode: 'insensitive' };
  }

  return await prisma.condition.findMany({
    where,
    select: { id: true, name: true, system: true },
    orderBy: { name: 'asc' },
  });
}

async function processCondition(
  condition: { id: string; name: string; system: string },
  args: Args,
  apiKey: string,
  stats: Stats
): Promise<void> {
  console.log(`\n🔎 Searching: ${condition.name} (${condition.system})`);
  stats.conditionsSearched++;

  // Check if condition has MedicalContent with image_query
  const medicalContent = await prisma.medicalContent.findUnique({
    where: { conditionId: condition.id },
    select: { image_query: true },
  });

  const searchQuery = medicalContent?.image_query || condition.name;
  console.log(`   Query: "${searchQuery}"`);

  // Search Open-i
  let candidates: OpenIImage[];
  try {
    candidates = await searchOpenI(searchQuery, {
      maxResults: args.maxPerCondition,
      imageType: 'all',
    });
  } catch (error) {
    console.error(`   ❌ Open-i search failed:`, error instanceof Error ? error.message : error);
    stats.errors++;
    return;
  }

  console.log(`   Found ${candidates.length} candidates`);
  stats.candidatesFound += candidates.length;

  if (candidates.length === 0) {
    return;
  }

  // Process each candidate
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`\n   [${i + 1}/${candidates.length}] ${candidate.title.slice(0, 50)}...`);
    console.log(`   Source: ${candidate.source} | License: ${candidate.license}`);
    console.log(`   URL: ${candidate.imageUrl}`);

    // Check for duplicates (by sourceUrl or contentHash)
    const isDuplicate = await checkDuplicate(candidate.imageUrl);
    if (isDuplicate) {
      console.log(`   ⏭️  Skipped (already ingested)`);
      stats.skippedDuplicates++;
      continue;
    }

    // Grade the image
    let grade: GradeResult;
    try {
      grade = await gradeMedicalImage(candidate.imageUrl, condition.name, apiKey);
      stats.candidatesGraded++;
    } catch (error) {
      console.error(`   ❌ Grading failed:`, error instanceof Error ? error.message : error);
      stats.errors++;
      continue;
    }

    console.log(
      `   📊 Score: ${grade.educationalScore}/10 | Classic: ${grade.isClassic} | Modality: ${grade.modality}`
    );
    console.log(`   Reasoning: ${grade.reasoning.slice(0, 100)}...`);

    // Apply scoring tiers
    if (grade.educationalScore > 7) {
      console.log(`   ✅ WINNER (score > 7) - Ingesting...`);
      if (!args.dryRun) {
        try {
          await ingestImage(candidate, condition, grade);
          stats.winnersIngested++;
          console.log(`   ✅ Ingested successfully`);
        } catch (error) {
          console.error(`   ❌ Ingest failed:`, error instanceof Error ? error.message : error);
          stats.errors++;
        }
      } else {
        console.log(`   🧪 (dry run - would ingest)`);
        stats.winnersIngested++;
      }
    } else if (grade.educationalScore >= 5) {
      console.log(`   ⚠️  Borderline (5-7) - Skipping`);
      stats.borderline++;
    } else {
      console.log(`   ❌ Discarded (< 5)`);
      stats.discarded++;
    }

    // Rate limiting
    if (i < candidates.length - 1) {
      await sleep(PAUSE_MS);
    }

    // Check max total limit
    if (stats.candidatesGraded >= args.maxTotal) {
      console.log(`\n   🛑 Reached max total limit (${args.maxTotal})`);
      break;
    }
  }
}

async function checkDuplicate(sourceUrl: string): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: { sourceUrl },
    select: { id: true },
  });
  return existing !== null;
}

async function ingestImage(
  candidate: OpenIImage,
  condition: { id: string; name: string },
  grade: GradeResult
): Promise<void> {
  // Download image
  const imageRes = await fetch(candidate.imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download image: ${imageRes.status}`);
  }

  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Compute content hash for dedup
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

  // Generate filename
  const conditionSlug = condition.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const ext = inferExtension(candidate.imageUrl) || 'jpg';
  const filename = `${hash}.${ext}`;
  const storagePath = `open-i/${conditionSlug}/${filename}`;

  // Upload to Supabase
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: inferMimeType(ext),
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // Create MediaAsset record
  await prisma.mediaAsset.create({
    data: {
      id: uuidv4(),
      conditionId: condition.id,
      type: 'image',
      filename,
      originalUrl: publicUrl,
      sourceUrl: candidate.imageUrl,
      storagePath,
      contentHash: hash,
      tags: [condition.name, grade.modality, 'auto-curated', 'open-i'],
      description: candidate.caption || candidate.title,
      altText: `${condition.name} - ${grade.modality}`,
      mimeType: inferMimeType(ext),
      fileSize: buffer.length,
      approvalStatus: 'approved',
      status: 'approved',
      folder: 'approved',
      isClassicPortrayal: grade.isClassic,
      qualityScore: grade.educationalScore * 10, // Normalize to 0-100 scale
      modality: grade.modality,
      licenseType: 'OPEN_ACCESS_CC_BY',
      attribution: `Open-i / ${candidate.source}`,
      aiMetadata: {
        gradeResult: grade,
        source: 'open-i-auto-curator',
        ingestedAt: new Date().toISOString(),
      },
      uploadedBy: 'system',
      updatedAt: new Date(),
    },
  });
}

function inferExtension(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'jpg';
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.gif')) return 'gif';
  if (lower.includes('.webp')) return 'webp';
  return null;
}

function inferMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    disconnect();
  });
