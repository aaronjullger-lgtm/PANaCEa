#!/usr/bin/env npx tsx
/**
 * Fetch Curated Images Script
 * 
 * Downloads and uploads CLEAN, un-annotated medical images from verified sources.
 * These are suitable for Photo Drill quiz mode.
 * 
 * Usage:
 *   npx tsx scripts/images/fetch-curated-images.ts [system]
 * 
 * Examples:
 *   npx tsx scripts/images/fetch-curated-images.ts ecg
 *   npx tsx scripts/images/fetch-curated-images.ts derm
 *   npx tsx scripts/images/fetch-curated-images.ts all
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Load environment
import 'dotenv/config';

const prisma = new PrismaClient();

// Supabase client with service role
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// CURATED IMAGE DATABASE
// These are VERIFIED clean images suitable for quiz mode
// ============================================================================

interface CuratedImage {
  conditionId: string;
  url: string;
  title: string;
  modality: 'ecg' | 'derm' | 'xray';
  source: string;
  license: string;
  visualFindings: string;
  correctDiagnosis: string;
  distractors: string[];
  isAnnotated: boolean;
  usageType: 'quiz' | 'reference' | 'both';
}

/**
 * ECG Images - VERIFIED WORKING URLs from Wikimedia Commons
 * These are clean ECG strips without annotations
 */
const ECG_IMAGES: CuratedImage[] = [
  // Atrial Fibrillation
  {
    conditionId: "CV__ecg__atrial_fibrillation",
    url: "https://upload.wikimedia.org/wikipedia/commons/3/32/ECG_Atrial_Fibrillation.jpg",
    title: "Atrial Fibrillation ECG",
    modality: "ecg",
    source: "Wikimedia Commons",
    license: "CC BY-SA 4.0",
    visualFindings: "Look for: (1) Irregularly irregular R-R intervals, (2) Absence of P waves, (3) Fibrillatory baseline between QRS complexes",
    correctDiagnosis: "Atrial Fibrillation",
    distractors: ["Atrial Flutter", "Multifocal Atrial Tachycardia", "Sinus Arrhythmia"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Atrial Flutter - Unlabeled version perfect for quiz
  {
    conditionId: "CV__ecg__atrial_flutter",
    url: "https://upload.wikimedia.org/wikipedia/commons/4/41/Atrial_Flutter_Unlabeled.jpg",
    title: "Atrial Flutter ECG - Unlabeled",
    modality: "ecg",
    source: "Wikimedia Commons",
    license: "CC BY-SA 3.0",
    visualFindings: "Look for: (1) Sawtooth flutter waves (F waves), best seen in II, III, aVF, (2) Regular atrial rate ~300 bpm, (3) Variable AV block (2:1, 3:1, 4:1), (4) Regular ventricular rate if fixed block",
    correctDiagnosis: "Atrial Flutter",
    distractors: ["Atrial Fibrillation", "Sinus Tachycardia", "Atrial Tachycardia"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Ventricular Tachycardia
  {
    conditionId: "CV__ecg__ventricular_tachycardia",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Lead_II_rhythm_ventricular_tachycardia_Vtach_VT_%28cropped%29.JPG",
    title: "Ventricular Tachycardia ECG",
    modality: "ecg",
    source: "Wikimedia Commons",
    license: "CC BY-SA 3.0",
    visualFindings: "Look for: (1) Wide QRS complexes (>120ms), (2) Regular rhythm at rate >100, (3) AV dissociation if visible, (4) Absence of typical LBBB/RBBB morphology",
    correctDiagnosis: "Ventricular Tachycardia",
    distractors: ["SVT with Aberrancy", "Atrial Fibrillation with WPW", "Hyperkalemia"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Torsades de Pointes
  {
    conditionId: "CV__ecg__torsades_de_pointes",
    url: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Torsades_converted_by_AICD_ECG_strip_Lead_II.JPG",
    title: "Torsades de Pointes",
    modality: "ecg",
    source: "Wikimedia Commons",
    license: "CC BY-SA 3.0",
    visualFindings: "Look for: (1) Polymorphic VT with QRS that 'twists' around baseline, (2) Sinusoidal variation in QRS amplitude, (3) Associated with prolonged QT",
    correctDiagnosis: "Torsades de Pointes",
    distractors: ["Polymorphic VT (normal QT)", "Ventricular Fibrillation", "Artifact"],
    isAnnotated: false,
    usageType: "quiz"
  },
];

/**
 * Dermatology Images - VERIFIED WORKING URLs from Wikimedia Commons
 * These are clean clinical photos without annotations
 */
const DERM_IMAGES: CuratedImage[] = [
  // Herpes Zoster
  {
    conditionId: "ID__viral__herpes_zoster_shingles",
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a8/Day03_shingles_or_Herpes_Zoster_Virus_attacking_forehead_and_eye.jpg",
    title: "Herpes Zoster - Dermatomal Distribution",
    modality: "derm",
    source: "Wikimedia Commons",
    license: "CC BY-SA 4.0",
    visualFindings: "Look for: (1) Grouped vesicles on erythematous base, (2) Dermatomal distribution (V1 trigeminal), (3) Does NOT cross midline, (4) Various stages of vesicle evolution",
    correctDiagnosis: "Herpes Zoster (Shingles)",
    distractors: ["Herpes Simplex", "Contact Dermatitis", "Bullous Impetigo"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Psoriasis
  {
    conditionId: "DERM__papulosquamous__plaque_psoriasis",
    url: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Psoriasis_on_back.jpg",
    title: "Plaque Psoriasis on Back",
    modality: "derm",
    source: "Wikimedia Commons",
    license: "CC BY-SA 3.0",
    visualFindings: "Look for: (1) Well-demarcated erythematous plaques, (2) Silvery-white scale, (3) Classic distribution pattern, (4) Auspitz sign if scale removed",
    correctDiagnosis: "Plaque Psoriasis",
    distractors: ["Eczema", "Seborrheic Dermatitis", "Pityriasis Rosea"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Melanoma
  {
    conditionId: "DERM__oncology__melanoma",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/6c/Melanoma.jpg",
    title: "Melanoma",
    modality: "derm",
    source: "Wikimedia Commons",
    license: "Public Domain (NCI)",
    visualFindings: "Apply ABCDE: (A) Asymmetry, (B) Border irregularity, (C) Color variation, (D) Diameter >6mm, (E) Evolution/change",
    correctDiagnosis: "Melanoma",
    distractors: ["Dysplastic Nevus", "Seborrheic Keratosis", "Lentigo"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Atopic Dermatitis
  {
    conditionId: "DERM__dermatitis__eczema__atopic_dermatitis",
    url: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Atopic_dermatitis_child_3.jpg",
    title: "Atopic Dermatitis in Child",
    modality: "derm",
    source: "Wikimedia Commons",
    license: "CC BY-SA 4.0",
    visualFindings: "Look for: (1) Flexural distribution (antecubital, popliteal fossa), (2) Lichenification from chronic scratching, (3) Excoriations, (4) Dry, scaly skin",
    correctDiagnosis: "Atopic Dermatitis",
    distractors: ["Contact Dermatitis", "Psoriasis", "Seborrheic Dermatitis"],
    isAnnotated: false,
    usageType: "quiz"
  },
];

/**
 * Radiology Images - VERIFIED WORKING URLs from Wikimedia Commons
 */
const XRAY_IMAGES: CuratedImage[] = [
  // Viral Pneumonia
  {
    conditionId: "PULM__infectious__viral_pneumonia",
    url: "https://upload.wikimedia.org/wikipedia/commons/d/d2/SARS_xray.jpg",
    title: "Viral Pneumonia CXR (SARS)",
    modality: "xray",
    source: "Wikimedia Commons",
    license: "Public Domain (CDC)",
    visualFindings: "Look for: (1) Bilateral infiltrates, (2) Ground-glass opacities, (3) Air bronchograms within consolidation, (4) No cardiomegaly",
    correctDiagnosis: "Viral Pneumonia",
    distractors: ["Pulmonary Edema", "ARDS", "Pulmonary Fibrosis"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Pneumothorax
  {
    conditionId: "PULM__pleural_disease__pneumothorax",
    url: "https://upload.wikimedia.org/wikipedia/commons/5/57/Pneumothorax_CT.jpg",
    title: "Pneumothorax CT",
    modality: "xray",
    source: "Wikimedia Commons", 
    license: "CC BY-SA 3.0",
    visualFindings: "Look for: (1) Air in pleural space (black), (2) Collapsed lung, (3) Sharp pleural line, (4) Mediastinal shift if tension",
    correctDiagnosis: "Pneumothorax",
    distractors: ["Large Bulla", "Pleural Effusion", "Atelectasis"],
    isAnnotated: false,
    usageType: "quiz"
  },
  // Pleural Effusion
  {
    conditionId: "PULM__pleural_disease__pleural_effusion",
    url: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Pleurisy_and_pneumothorax.jpg",
    title: "Pleural Effusion CXR",
    modality: "xray",
    source: "Wikimedia Commons",
    license: "Public Domain",
    visualFindings: "Look for: (1) Blunting of costophrenic angle, (2) Meniscus sign, (3) Opacification of hemithorax, (4) Mediastinal shift away if large",
    correctDiagnosis: "Pleural Effusion",
    distractors: ["Hemothorax", "Consolidation", "Elevated Hemidiaphragm"],
    isAnnotated: false,
    usageType: "quiz"
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Download image from URL with timeout
 */
async function downloadImage(url: string, timeout = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const request = protocol.get(url, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) StudyPANaCEa/1.0'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        clearTimeout(timeoutId);
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, timeout).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        clearTimeout(timeoutId);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timeoutId);
        resolve(Buffer.concat(chunks));
      });
      response.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Get MIME type from URL
 */
function getMimeType(url: string): string {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
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
 * Upload image to Supabase Storage
 */
async function uploadToSupabase(
  buffer: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string> {
  const storagePath = `medical-images/${filename}`;
  
  const { error } = await supabase.storage
    .from('medical-images')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true
    });
  
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage
    .from('medical-images')
    .getPublicUrl(storagePath);
  
  return urlData.publicUrl;
}

/**
 * Create MediaAsset record in database
 */
async function createMediaAsset(image: CuratedImage, publicUrl: string): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date();
  
  // Map modality to type
  const typeMap: Record<string, string> = {
    'ecg': 'ECG',
    'derm': 'PHOTO',
    'xray': 'IMAGING'
  };
  
  await prisma.$executeRaw`
    INSERT INTO "MediaAsset" (
      "id", "conditionId", "type", "filename", "originalUrl", 
      "tags", "description", "mimeType", "status", "approvalStatus",
      "isClinical", "correctDiagnosis", "distractors", "explanation",
      "modality", "sourceUrl", "citation", "sourceQuality",
      "isAnnotated", "usageType", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${image.conditionId}, ${typeMap[image.modality] || 'IMAGING'}, 
      ${path.basename(new URL(image.url).pathname)}, ${publicUrl},
      ${[image.modality, image.source.toLowerCase().replace(/\s+/g, '-')]},
      ${image.visualFindings}, ${getMimeType(image.url)},
      'approved', 'approved', true, ${image.correctDiagnosis},
      ${JSON.stringify(image.distractors)}::jsonb, ${image.visualFindings},
      ${image.modality}, ${image.url}, ${`${image.source} - ${image.license}`},
      'verified', ${image.isAnnotated}, ${image.usageType},
      ${now}, ${now}
    )
    ON CONFLICT ("id") DO NOTHING
  `;
}

/**
 * Check if condition already has a quiz image
 * Note: Using raw SQL to avoid Prisma client sync issues with new fields
 */
async function hasExistingQuizImage(conditionId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "MediaAsset" 
    WHERE "conditionId" = ${conditionId}
    AND "status" = 'approved'
    AND ("isAnnotated" = false OR "isAnnotated" IS NULL)
  `;
  return result[0]?.count > 0;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function processImage(image: CuratedImage): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already exists
    const exists = await hasExistingQuizImage(image.conditionId);
    if (exists) {
      console.log(`  ⏭️  ${image.conditionId} - already has quiz image, skipping`);
      return { success: true };
    }
    
    console.log(`  📥 Downloading from ${image.source}...`);
    const buffer = await downloadImage(image.url);
    
    if (buffer.length < 1000) {
      throw new Error('Image too small (< 1KB)');
    }
    
    console.log(`  📤 Uploading to Supabase (${Math.round(buffer.length / 1024)}KB)...`);
    const filename = `${image.conditionId}_${Date.now()}${path.extname(new URL(image.url).pathname) || '.jpg'}`;
    const publicUrl = await uploadToSupabase(buffer, filename, getMimeType(image.url));
    
    console.log(`  💾 Creating database record...`);
    await createMediaAsset(image, publicUrl);
    
    console.log(`  ✅ ${image.correctDiagnosis}`);
    return { success: true };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ❌ Failed: ${message}`);
    return { success: false, error: message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const category = args[0]?.toLowerCase() || 'all';
  
  console.log('🏥 Curated Medical Image Fetcher\n');
  console.log('This fetches CLEAN, un-annotated images suitable for Photo Drill quiz mode.\n');
  
  let images: CuratedImage[] = [];
  
  switch (category) {
    case 'ecg':
      images = ECG_IMAGES;
      console.log('📊 Processing ECG images...\n');
      break;
    case 'derm':
      images = DERM_IMAGES;
      console.log('🔬 Processing Dermatology images...\n');
      break;
    case 'xray':
    case 'radiology':
      images = XRAY_IMAGES;
      console.log('🩻 Processing Radiology images...\n');
      break;
    case 'all':
    default:
      images = [...ECG_IMAGES, ...DERM_IMAGES, ...XRAY_IMAGES];
      console.log('📋 Processing ALL curated images...\n');
  }
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const image of images) {
    console.log(`\n🎯 ${image.conditionId}`);
    const result = await processImage(image);
    
    if (result.success) {
      if (result.error === undefined) {
        success++;
      } else {
        skipped++;
      }
    } else {
      failed++;
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${success}`);
  console.log(`⏭️  Skipped (existing): ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Total processed: ${images.length}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
