#!/usr/bin/env npx tsx
/**
 * Bulk Medical Image Fetcher
 *
 * Fetches images from curated open-access medical image sources:
 * - Wikimedia Commons (CC0/public domain)
 * - OpenI NIH API
 *
 * Usage:
 *   npx tsx scripts/images/bulk-image-fetcher.ts fetch <system> [limit]
 *   npx tsx scripts/images/bulk-image-fetcher.ts fetch-one <conditionId>
 *   npx tsx scripts/images/bulk-image-fetcher.ts preview <conditionId>
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Initialize Supabase client with service role key for storage access
const supabaseUrl = process.env.SUPABASE_URL || 'https://lzfescdrpezzjhgveotz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_DIR = path.join(process.cwd(), 'scripts/images/downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// ============================================================================
// SYSTEM NAME MAPPING
// ============================================================================

const SYSTEM_MAP: Record<string, string> = {
  cardiology: 'CV',
  cardiovascular: 'CV',
  cv: 'CV',
  pulmonology: 'PULM',
  pulmonary: 'PULM',
  pulm: 'PULM',
  dermatology: 'DERM',
  derm: 'DERM',
  musculoskeletal: 'MSK',
  msk: 'MSK',
  ortho: 'MSK',
  neurology: 'NEURO',
  neuro: 'NEURO',
  gastroenterology: 'GI',
  gi: 'GI',
  heent: 'HEENT',
  ent: 'HEENT',
  infectious: 'ID',
  id: 'ID',
  hematology: 'HEME',
  heme: 'HEME',
  endocrinology: 'ENDO',
  endo: 'ENDO',
  nephrology: 'RENAL',
  renal: 'RENAL',
  reproductive: 'REPRO',
  repro: 'REPRO',
  obgyn: 'REPRO',
  psychiatry: 'PSYCH',
  psych: 'PSYCH',
  urology: 'GU',
  gu: 'GU',
};

function normalizeSystem(s: string): string {
  return SYSTEM_MAP[s.toLowerCase()] || s.toUpperCase();
}

// ============================================================================
// IMAGE EXPLANATION BUILDER
// ============================================================================

/**
 * Build a comprehensive explanation that teaches visual interpretation
 * Combines buzzwords (visual findings), gold standard criteria, and clinical pearls
 */
function buildImageExplanation(
  conditionName: string,
  modality: string,
  buzzwords: string[] | null,
  goldStandardDx: string | null,
  clinicalPearls: string[] | null
): string {
  const parts: string[] = [];

  // 1. What to look for (visual findings from buzzwords)
  const visualFindings = extractVisualFindings(buzzwords, modality);
  if (visualFindings.length > 0) {
    parts.push(`**Key Visual Findings for ${conditionName}:**`);
    parts.push(visualFindings.map((f) => `• ${f}`).join('\n'));
  }

  // 2. Diagnostic criteria from gold standard
  if (goldStandardDx) {
    parts.push(`\n**Diagnostic Criteria:** ${cleanMarkdown(goldStandardDx)}`);
  }

  // 3. Clinical pearl (most relevant one)
  if (clinicalPearls && clinicalPearls.length > 0) {
    parts.push(`\n**Clinical Pearl:** ${cleanMarkdown(clinicalPearls[0])}`);
  }

  // 4. Modality-specific interpretation tips
  const modalityTips = getModalityInterpretationTips(modality, conditionName);
  if (modalityTips) {
    parts.push(`\n**How to Read This ${getModalityDisplayName(modality)}:** ${modalityTips}`);
  }

  return (
    parts.join('\n') ||
    `This image demonstrates ${conditionName}. Study the characteristic findings to recognize this condition on exams.`
  );
}

/**
 * Extract visual/diagnostic findings from buzzwords
 * Filters for findings that describe what you SEE
 */
function extractVisualFindings(buzzwords: string[] | null, modality: string): string[] {
  if (!buzzwords) return [];

  // Keywords that indicate visual/diagnostic findings
  const visualKeywords = [
    'rhythm',
    'wave',
    'interval',
    'segment',
    'complex',
    'pattern',
    'sign',
    'finding',
    'appearance',
    'visible',
    'shows',
    'demonstrates',
    'lesion',
    'opacity',
    'density',
    'mass',
    'shadow',
    'enlargement',
    'widened',
    'narrowed',
    'elevated',
    'depressed',
    'prolonged',
    'irregular',
    'regular',
    'absent',
    'present',
    'classic',
    'pathognomonic',
    'characteristic',
    'typical',
    'diagnostic',
  ];

  return buzzwords
    .filter((b) => {
      const lower = b.toLowerCase();
      return (
        visualKeywords.some((kw) => lower.includes(kw)) ||
        lower.includes('**') || // Likely highlighted important finding
        lower.includes('ecg') ||
        lower.includes('x-ray') ||
        lower.includes('ct') ||
        lower.includes('mri')
      );
    })
    .map((b) => cleanMarkdown(b))
    .slice(0, 5); // Limit to top 5 findings
}

/**
 * Get modality-specific interpretation tips
 */
function getModalityInterpretationTips(modality: string, condition: string): string | null {
  const tips: Record<string, string> = {
    ecg: 'Systematically evaluate: Rate → Rhythm → Axis → Intervals (PR, QRS, QT) → ST segments → T waves. Compare to normal sinus rhythm to identify abnormalities.',
    xray: 'Use a systematic approach: Airways → Bones → Cardiac silhouette → Diaphragm → Everything else (soft tissues, mediastinum). Compare both sides for asymmetry.',
    ct: 'Scroll through slices systematically. Adjust window/level for different tissues (bone, soft tissue, lung). Look for the primary finding first, then secondary signs.',
    mri: 'Identify the sequence type (T1, T2, FLAIR, DWI). Compare signal intensities to known references (CSF, fat, muscle). Look for the characteristic pattern.',
    ultrasound:
      'Orient yourself to the probe marker. Identify key landmarks first. Look for echogenicity changes, masses, and fluid collections.',
    clinical_photo:
      'Note the location, distribution, morphology (shape, borders), color, and associated findings. Consider the clinical context.',
    fundoscopy:
      'Systematically examine: Optic disc → Vessels → Macula → Peripheral retina. Note any hemorrhages, exudates, or vascular changes.',
    microscopy:
      'Start with low power to assess overall architecture, then high power for cellular detail. Look for the characteristic pattern or cells.',
  };

  return tips[modality] || null;
}

function getModalityDisplayName(modality: string): string {
  const names: Record<string, string> = {
    ecg: 'ECG',
    xray: 'X-Ray',
    ct: 'CT Scan',
    mri: 'MRI',
    ultrasound: 'Ultrasound',
    clinical_photo: 'Clinical Photo',
    fundoscopy: 'Fundoscopic Exam',
    microscopy: 'Microscopy Image',
    diagram: 'Diagram',
  };
  return names[modality] || 'Image';
}

function cleanMarkdown(text: string): string {
  // Remove excessive asterisks but keep some formatting
  return text
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

// ============================================================================
// WIKIMEDIA COMMONS API
// ============================================================================

interface WikimediaImage {
  title: string;
  url: string;
  thumbUrl: string;
  descriptionUrl: string;
  width: number;
  height: number;
}

async function searchWikimediaCommons(query: string, limit = 5): Promise<WikimediaImage[]> {
  const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
  searchUrl.searchParams.set('action', 'query');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('generator', 'search');
  searchUrl.searchParams.set('gsrnamespace', '6'); // File namespace
  searchUrl.searchParams.set('gsrsearch', `${query} medical`);
  searchUrl.searchParams.set('gsrlimit', String(limit));
  searchUrl.searchParams.set('prop', 'imageinfo');
  searchUrl.searchParams.set('iiprop', 'url|size|extmetadata');
  searchUrl.searchParams.set('iiurlwidth', '1200');
  searchUrl.searchParams.set('origin', '*');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const res = await fetch(searchUrl.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    const data = await res.json();

    if (!data.query?.pages) return [];

    const images: WikimediaImage[] = [];
    for (const page of Object.values(data.query.pages) as any[]) {
      const info = page.imageinfo?.[0];
      if (!info) continue;

      // Skip SVGs, PDFs, and tiny images
      if (info.width < 400 || info.height < 300) continue;
      if (info.url?.endsWith('.svg')) continue;
      if (info.url?.endsWith('.pdf')) continue;
      if (info.url?.includes('.pdf')) continue;

      images.push({
        title: page.title.replace('File:', ''),
        url: info.url,
        thumbUrl: info.thumburl || info.url,
        descriptionUrl: info.descriptionurl,
        width: info.width,
        height: info.height,
      });
    }

    return images;
  } catch (err) {
    console.error(`Wikimedia search failed for "${query}":`, err);
    return [];
  }
}

// ============================================================================
// OPENI NIH API
// ============================================================================

interface OpenIImage {
  title: string;
  url: string;
  abstract: string;
  meshTerms: string[];
}

async function searchOpenI(query: string, limit = 5): Promise<OpenIImage[]> {
  const searchUrl = new URL('https://openi.nlm.nih.gov/api/search');
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('m', '1');
  searchUrl.searchParams.set('n', String(limit));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(searchUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();

    if (!data.list) return [];

    return data.list.map((item: any) => {
      // Build full URL - OpenI returns relative paths
      let imgUrl = item.imgLarge || item.imgGrid || item.imgThumb;
      if (imgUrl && !imgUrl.startsWith('http')) {
        imgUrl = `https://openi.nlm.nih.gov${imgUrl}`;
      }
      return {
        title: item.title || 'Medical Image',
        url: imgUrl,
        abstract: item.abstract || '',
        meshTerms: item.meshMajor || [],
      };
    });
  } catch (err) {
    console.error(`OpenI search failed for "${query}":`, err);
    return [];
  }
}

// ============================================================================
// IMAGE DOWNLOAD & UPLOAD
// ============================================================================

async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for downloads

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PANaCEa-Medical-Education/1.0 (Educational medical study app)',
        Accept: 'image/*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`Failed to download ${url}: ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const filepath = path.join(DOWNLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    return filepath;
  } catch (err) {
    console.error(`Download error for ${url}:`, err);
    return null;
  }
}

async function uploadToSupabase(
  filepath: string,
  conditionId: string,
  metadata: {
    title: string;
    modality: string;
    sourceUrl: string;
    condition: string;
  }
): Promise<boolean> {
  const filename = path.basename(filepath);
  const ext = path.extname(filename).toLowerCase();
  const timestamp = Date.now();
  const storagePath = `conditions/${conditionId}/${timestamp}-${filename}`;

  const fileBuffer = fs.readFileSync(filepath);
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('medical-images')
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return false;
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('medical-images').getPublicUrl(storagePath);

  // Fetch condition data for auto-population
  const condition = await prisma.medicalContent.findUnique({
    where: { conditionId },
    select: {
      condition: true,
      system: true,
      buzzwords: true,
      clinical_pearls: true,
      differentials: true,
      diagnostics: true,
      gold_standard_dx: true,
      image_query: true,
    },
  });

  // Build tags from buzzwords
  const tags: string[] = [];
  if (condition?.buzzwords && Array.isArray(condition.buzzwords)) {
    tags.push(...(condition.buzzwords as string[]).slice(0, 5));
  }
  tags.push(metadata.condition, metadata.modality);

  // Build distractors from differentials
  const distractors: string[] = [];
  if (condition?.differentials && Array.isArray(condition.differentials)) {
    for (const diff of (condition.differentials as any[]).slice(0, 3)) {
      if (typeof diff === 'string') {
        distractors.push(diff);
      } else if (diff?.condition) {
        distractors.push(diff.condition);
      }
    }
  }

  // Build comprehensive explanation with visual interpretation
  const explanation = buildImageExplanation(
    metadata.condition,
    metadata.modality,
    condition?.buzzwords as string[] | null,
    condition?.gold_standard_dx as string | null,
    condition?.clinical_pearls as string[] | null
  );

  // Generate a unique ID
  const assetId = `img_${conditionId.slice(0, 30)}_${timestamp}`;

  const attribution = metadata.sourceUrl.includes('wikimedia')
    ? 'Wikimedia Commons (CC)'
    : metadata.sourceUrl.includes('openi')
      ? 'OpenI NIH (Public Domain)'
      : 'Open Access Medical Image';

  // Convert to JSON strings for JSONB columns
  const distractorsJson = JSON.stringify(distractors);

  // Use raw SQL to insert - matching actual DB columns
  await prisma.$executeRaw`
    INSERT INTO "MediaAsset" (
      "id", "conditionId", "type", "filename", "originalUrl",
      "modality", "sourceQuality", "sourceUrl", "tags", "distractors",
      "explanation", "description", "mimeType", "citation", "updatedAt", "createdAt"
    ) VALUES (
      ${assetId},
      ${conditionId},
      'IMAGE',
      ${filename},
      ${publicUrl},
      ${metadata.modality},
      'verified',
      ${metadata.sourceUrl},
      ${tags},
      ${distractorsJson}::jsonb,
      ${explanation},
      ${metadata.title},
      ${contentType},
      ${attribution},
      NOW(),
      NOW()
    )
  `;

  console.log(`✅ Created MediaAsset ${assetId} for ${metadata.condition}`);
  return true;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function previewCondition(conditionId: string): Promise<void> {
  const condition = await prisma.medicalContent.findUnique({
    where: { conditionId },
    select: {
      condition: true,
      image_query: true,
      gold_standard_dx: true,
      best_initial_test: true,
      buzzwords: true,
      differentials: true,
    },
  });

  if (!condition) {
    console.log(`❌ Condition not found: ${conditionId}`);
    return;
  }

  console.log(`\n📋 ${condition.condition}`);
  console.log(`─────────────────────────────────────────`);

  // Parse queries
  const queries =
    condition.image_query
      ?.split(/[,;]/)
      .map((q) => q.trim())
      .filter((q) => q.length > 3) || [];

  if (queries.length === 0) {
    queries.push(condition.condition);
  }

  console.log(`\n🔎 Search queries: ${queries.length}`);
  for (const q of queries) {
    console.log(`   - "${q}"`);
  }

  // Search sources
  console.log(`\n📸 Searching Wikimedia Commons...`);
  for (const query of queries.slice(0, 2)) {
    const wikiImages = await searchWikimediaCommons(query, 3);
    if (wikiImages.length > 0) {
      console.log(`\n   Results for "${query}":`);
      for (const img of wikiImages) {
        console.log(`   ✓ ${img.title}`);
        console.log(`     ${img.width}x${img.height} - ${img.url}`);
      }
    }
  }

  console.log(`\n📸 Searching OpenI NIH...`);
  for (const query of queries.slice(0, 2)) {
    const openiImages = await searchOpenI(query, 3);
    if (openiImages.length > 0) {
      console.log(`\n   Results for "${query}":`);
      for (const img of openiImages) {
        console.log(`   ✓ ${img.title.slice(0, 60)}...`);
        console.log(`     ${img.url}`);
      }
    }
  }
}

async function fetchOneCondition(conditionId: string): Promise<void> {
  const condition = await prisma.medicalContent.findUnique({
    where: { conditionId },
    select: {
      conditionId: true,
      condition: true,
      image_query: true,
      system: true,
    },
  });

  if (!condition) {
    console.log(`❌ Condition not found: ${conditionId}`);
    return;
  }

  // Check existing images
  const existing = await prisma.mediaAsset.count({
    where: { conditionId },
  });

  if (existing >= 2) {
    console.log(`⏭️  ${condition.condition} already has ${existing} images, skipping`);
    return;
  }

  console.log(`\n🔄 Fetching images for: ${condition.condition}`);

  const queries = condition.image_query
    ?.split(/[,;]/)
    .map((q) => q.trim())
    .filter((q) => q.length > 3) || [condition.condition];

  let uploaded = 0;
  const targetImages = 2;

  // Try Wikimedia first
  for (const query of queries) {
    if (uploaded >= targetImages) break;

    const images = await searchWikimediaCommons(query, 3);
    for (const img of images) {
      if (uploaded >= targetImages) break;

      console.log(`   📥 Downloading: ${img.title}`);
      const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
      const filename = `${conditionId.replace(/[^a-z0-9]/gi, '_')}_${uploaded + 1}.${ext}`;

      const filepath = await downloadImage(img.url, filename);
      if (!filepath) continue;

      const modality = detectModality(query);
      const success = await uploadToSupabase(filepath, conditionId, {
        title: img.title,
        modality,
        sourceUrl: img.descriptionUrl,
        condition: condition.condition,
      });

      if (success) {
        uploaded++;
        // Clean up local file
        fs.unlinkSync(filepath);
      }
    }
  }

  // Skip OpenI for now - API appears to be down/slow
  // TODO: Re-enable when OpenI is responsive
  /*
  // Try OpenI if we still need images
  if (uploaded < targetImages) {
    for (const query of queries) {
      if (uploaded >= targetImages) break;
      
      const images = await searchOpenI(query, 3);
      for (const img of images) {
        if (uploaded >= targetImages) break;
        if (!img.url) continue;
        
        console.log(`   📥 Downloading from OpenI: ${img.title.slice(0, 50)}...`);
        const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
        const filename = `${conditionId.replace(/[^a-z0-9]/gi, '_')}_${uploaded + 1}.${ext}`;
        
        const filepath = await downloadImage(img.url, filename);
        if (!filepath) continue;
        
        const modality = detectModality(query);
        const success = await uploadToSupabase(filepath, conditionId, {
          title: img.title,
          modality,
          sourceUrl: `https://openi.nlm.nih.gov`,
          condition: condition.condition,
        });
        
        if (success) {
          uploaded++;
          fs.unlinkSync(filepath);
        }
      }
    }
  }
  */

  console.log(`   ✅ Uploaded ${uploaded}/${targetImages} images for ${condition.condition}`);
}

async function fetchSystem(system: string, limit = 10): Promise<void> {
  const normalizedSystem = normalizeSystem(system);

  // Get conditions that need images
  const conditions = await prisma.medicalContent.findMany({
    where: {
      system: normalizedSystem,
    },
    select: {
      conditionId: true,
      condition: true,
      image_query: true,
    },
    take: limit * 2,
  });

  // Filter to those needing images
  const existingCounts = await prisma.mediaAsset.groupBy({
    by: ['conditionId'],
    _count: { id: true },
    where: { conditionId: { in: conditions.map((c) => c.conditionId) } },
  });
  const countMap = new Map(existingCounts.map((e) => [e.conditionId, e._count.id]));

  const needingImages = conditions
    .filter((c) => (countMap.get(c.conditionId) || 0) < 2)
    .slice(0, limit);

  console.log(`\n📋 Fetching images for ${needingImages.length} ${normalizedSystem} conditions\n`);

  let processed = 0;
  for (const cond of needingImages) {
    processed++;
    console.log(`[${processed}/${needingImages.length}] ${cond.condition}`);
    await fetchOneCondition(cond.conditionId);

    // Rate limiting - be nice to the APIs
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n✅ Done! Processed ${processed} conditions.`);
}

function detectModality(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('ecg') || q.includes('ekg') || q.includes('electrocardiogram')) return 'ecg';
  if (q.includes('x-ray') || q.includes('xray') || q.includes('radiograph')) return 'xray';
  if (q.includes('ct') || q.includes('computed tomography')) return 'ct';
  if (q.includes('mri') || q.includes('magnetic resonance')) return 'mri';
  if (q.includes('ultrasound') || q.includes('echo')) return 'ultrasound';
  if (q.includes('fundus') || q.includes('retina') || q.includes('ophthalm')) return 'fundoscopy';
  if (q.includes('skin') || q.includes('rash') || q.includes('lesion') || q.includes('derm'))
    return 'clinical_photo';
  if (q.includes('microscop') || q.includes('smear') || q.includes('histol')) return 'microscopy';
  if (q.includes('diagram') || q.includes('illustration')) return 'diagram';
  return 'clinical_photo';
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const [command, arg1, arg2] = process.argv.slice(2);

  if (!supabaseKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.log('\nSet it with:');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY=your_key_here');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'preview':
        if (!arg1) {
          console.log('Usage: npx tsx scripts/images/bulk-image-fetcher.ts preview <conditionId>');
          break;
        }
        await previewCondition(arg1);
        break;

      case 'fetch-one':
        if (!arg1) {
          console.log(
            'Usage: npx tsx scripts/images/bulk-image-fetcher.ts fetch-one <conditionId>'
          );
          break;
        }
        await fetchOneCondition(arg1);
        break;

      case 'fetch':
        if (!arg1) {
          console.log('Usage: npx tsx scripts/images/bulk-image-fetcher.ts fetch <system> [limit]');
          console.log('\nSystems: cardiology, pulmonology, dermatology, neurology, etc.');
          break;
        }
        await fetchSystem(arg1, arg2 ? parseInt(arg2) : 10);
        break;

      default:
        console.log('Bulk Medical Image Fetcher');
        console.log('==========================\n');
        console.log('Commands:');
        console.log('  preview <conditionId>       - Preview available images for a condition');
        console.log('  fetch-one <conditionId>     - Fetch images for one condition');
        console.log('  fetch <system> [limit]      - Fetch images for multiple conditions\n');
        console.log('Examples:');
        console.log(
          '  npx tsx scripts/images/bulk-image-fetcher.ts preview CV__ecg__atrial_fibrillation'
        );
        console.log('  npx tsx scripts/images/bulk-image-fetcher.ts fetch cardiology 5');
        console.log(
          '  npx tsx scripts/images/bulk-image-fetcher.ts fetch-one CV__ecg__torsades_de_pointes'
        );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
