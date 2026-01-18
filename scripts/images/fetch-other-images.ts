#!/usr/bin/env npx tsx
/**
 * Other Modalities Image Fetcher - Specialized Script
 *
 * Fetches images for clinical findings that don't fit into ECG/XR/CT/MRI/Derm:
 * - Physical exam findings (fundoscopy, otoscopy, throat exam)
 * - Lab findings (blood smears, urinalysis)
 * - Ultrasound images
 * - Specialized clinical photos (nail findings, oral lesions)
 *
 * Adequacy Criteria vary by modality - see individual condition definitions.
 *
 * Usage:
 *   npx tsx scripts/images/fetch-other-images.ts
 *   npx tsx scripts/images/fetch-other-images.ts --dry-run
 *   npx tsx scripts/images/fetch-other-images.ts --type=fundoscopy
 *   npx tsx scripts/images/fetch-other-images.ts --condition="papilledema"
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as https from 'https';
import 'dotenv/config';

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = 'medical-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();

// Initialize Gemini SDK
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI?.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
  },
});

// Rate limiting configuration
const RATE_LIMIT = {
  BACKOFF_DELAY_MS: 30000,
  NORMAL_DELAY_MS: 1500,
  SEARCH_DELAY_MS: 1000,
  MAX_IMAGE_SIZE: 4 * 1024 * 1024, // 4MB
  rateLimitBackoffMs: 30000,
  maxDelayMs: 3000,
  minDelayMs: 1500,
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for Gemini

async function rateLimitedDelay(isRateLimited = false): Promise<void> {
  const delay = isRateLimited
    ? RATE_LIMIT.rateLimitBackoffMs
    : Math.random() * (RATE_LIMIT.maxDelayMs - RATE_LIMIT.minDelayMs) + RATE_LIMIT.minDelayMs;
  await new Promise((r) => setTimeout(r, delay));
}

// ============================================================================
// OTHER MODALITY CONDITIONS - High-yield for PANCE
// ============================================================================

interface OtherCondition {
  id: string;
  name: string;
  type:
    | 'fundoscopy'
    | 'otoscopy'
    | 'throat'
    | 'ultrasound'
    | 'blood_smear'
    | 'clinical_photo'
    | 'nails'
    | 'oral';
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  targetImageCount: number;
}

const OTHER_CONDITIONS: OtherCondition[] = [
  // =========== FUNDOSCOPY ===========
  {
    id: 'HEENT__eye__retina__diabetic_retinopathy__nonproliferative',
    name: 'Diabetic Retinopathy (NPDR)',
    type: 'fundoscopy',
    searchTerms: [
      'diabetic retinopathy fundus',
      'nonproliferative diabetic retinopathy',
      'diabetic eye fundoscopy',
      'NPDR fundus',
    ],
    correctDiagnosis: 'Diabetic Retinopathy',
    distractors: [
      'Hypertensive Retinopathy',
      'Retinal Vein Occlusion',
      'Age-related Macular Degeneration',
    ],
    visualFindings: 'Microaneurysms, dot-blot hemorrhages, hard exudates, cotton wool spots',
    clinicalContext:
      'Screen annually. Tight glucose control. Laser for proliferative. Anti-VEGF for macular edema.',
    targetImageCount: 12,
  },
  {
    id: 'HEENT__eye__retina__diabetic_retinopathy__proliferative',
    name: 'Diabetic Retinopathy (PDR)',
    type: 'fundoscopy',
    searchTerms: [
      'proliferative diabetic retinopathy fundus',
      'PDR neovascularization',
      'diabetic retinopathy NVD NVE',
    ],
    correctDiagnosis: 'Proliferative Diabetic Retinopathy',
    distractors: ['NPDR', 'Retinal Vein Occlusion', 'Hypertensive Retinopathy'],
    visualFindings:
      'Neovascularization of disc (NVD) or elsewhere (NVE), vitreous hemorrhage, tractional detachment',
    clinicalContext:
      'Urgent referral. Panretinal photocoagulation. Anti-VEGF injections. High risk of vision loss.',
    targetImageCount: 10,
  },
  {
    id: 'CV__blood_pressure__malignant_hypertension',
    name: 'Hypertensive Retinopathy',
    type: 'fundoscopy',
    searchTerms: [
      'hypertensive retinopathy fundus',
      'malignant hypertension fundoscopy',
      'hypertensive eye changes',
      'grade IV retinopathy',
    ],
    correctDiagnosis: 'Hypertensive Retinopathy',
    distractors: ['Diabetic Retinopathy', 'Retinal Vein Occlusion', 'Papilledema'],
    visualFindings:
      'Arteriolar narrowing, AV nicking, flame hemorrhages, cotton wool spots, papilledema in severe',
    clinicalContext:
      'Grade severity (Keith-Wagener-Barker). Papilledema = malignant HTN emergency. Control BP.',
    targetImageCount: 10,
  },
  // =========== OTOSCOPY ===========
  {
    id: 'HEENT__ear__middle__acute_otitis_media',
    name: 'Acute Otitis Media',
    type: 'otoscopy',
    searchTerms: [
      'acute otitis media otoscopy',
      'bulging tympanic membrane',
      'middle ear infection otoscope',
      'AOM otoscopy',
    ],
    correctDiagnosis: 'Acute Otitis Media',
    distractors: ['Otitis Externa', 'Otitis Media with Effusion', 'Bullous Myringitis'],
    visualFindings:
      'Bulging, erythematous tympanic membrane, loss of light reflex, may see purulent effusion',
    clinicalContext:
      'Common in children. Amoxicillin first-line. Watchful waiting option in mild cases >2yo.',
    targetImageCount: 12,
  },
  {
    id: 'HEENT__ear__middle__otitis_media_with_effusion_serous_otitis',
    name: 'Otitis Media with Effusion',
    type: 'otoscopy',
    searchTerms: [
      'otitis media effusion otoscopy',
      'serous otitis media',
      'glue ear otoscopy',
      'OME tympanic membrane',
    ],
    correctDiagnosis: 'Otitis Media with Effusion',
    distractors: ['Acute Otitis Media', 'Tympanosclerosis', 'Cholesteatoma'],
    visualFindings:
      'Retracted TM, air-fluid level or bubbles behind TM, amber color, decreased mobility',
    clinicalContext:
      'Fluid without acute infection. Usually resolves. Myringotomy tubes if chronic with hearing loss.',
    targetImageCount: 10,
  },
  // =========== THROAT EXAM ===========
  {
    id: 'HEENT__throat__pharynx__group_a_streptococcal_pharyngitis',
    name: 'Streptococcal Pharyngitis',
    type: 'throat',
    searchTerms: [
      'strep throat pharyngitis',
      'exudative tonsillitis',
      'strep pharynx exam',
      'tonsillar exudates',
    ],
    correctDiagnosis: 'Streptococcal Pharyngitis',
    distractors: ['Viral Pharyngitis', 'Infectious Mononucleosis', 'Peritonsillar Abscess'],
    visualFindings:
      'Tonsillar exudates, palatal petechiae, erythematous pharynx, tender cervical adenopathy',
    clinicalContext:
      'Centor criteria. Rapid strep or culture. Penicillin/amoxicillin to prevent rheumatic fever.',
    targetImageCount: 12,
  },
  {
    id: 'HEENT__throat__pharynx__peritonsillar_abscess',
    name: 'Peritonsillar Abscess',
    type: 'throat',
    searchTerms: [
      'peritonsillar abscess throat',
      'quinsy exam',
      'PTA throat exam',
      'uvula deviation abscess',
    ],
    correctDiagnosis: 'Peritonsillar Abscess',
    distractors: ['Severe Tonsillitis', 'Retropharyngeal Abscess', 'Epiglottitis'],
    visualFindings:
      'Unilateral tonsillar bulge, uvula deviation to opposite side, trismus, hot potato voice',
    clinicalContext:
      'Complication of tonsillitis. Needle aspiration or I&D. IV antibiotics. ENT consult.',
    targetImageCount: 10,
  },
  // =========== BLOOD SMEAR ===========
  {
    id: 'HEME__hemoglobinopathy__sickle_cell_disease',
    name: 'Sickle Cell Disease (Smear)',
    type: 'blood_smear',
    searchTerms: [
      'sickle cell blood smear',
      'drepanocytes microscopy',
      'sickled red blood cells smear',
      'sickle cell peripheral smear',
    ],
    correctDiagnosis: 'Sickle Cell Disease',
    distractors: ['Iron Deficiency Anemia', 'Thalassemia', 'Spherocytosis'],
    visualFindings: 'Sickled (crescent-shaped) RBCs, target cells, Howell-Jolly bodies (asplenia)',
    clinicalContext:
      'Hemoglobin SS disease. Vaso-occlusive crises. Hydroxyurea, transfusion, pain management.',
    targetImageCount: 12,
  },
  {
    id: 'ID__parasitic__malaria',
    name: 'Malaria',
    type: 'blood_smear',
    searchTerms: [
      'malaria blood smear',
      'plasmodium smear microscopy',
      'ring forms malaria',
      'malaria parasite smear',
    ],
    correctDiagnosis: 'Malaria',
    distractors: ['Babesiosis', 'Anemia', 'Thrombocytopenia'],
    visualFindings: 'Ring-form trophozoites inside RBCs, banana-shaped gametocytes (P. falciparum)',
    clinicalContext:
      'Travel history endemic areas. Thick smear for screening, thin for speciation. Artemisinin-based therapy.',
    targetImageCount: 10,
  },
  // =========== ULTRASOUND ===========
  {
    id: 'GI__gallbladder__choledocholithiasis',
    name: 'Gallstones (Cholelithiasis)',
    type: 'ultrasound',
    searchTerms: [
      'gallstones ultrasound',
      'cholelithiasis sonography',
      'gallbladder stones US',
      'shadowing gallstones',
    ],
    correctDiagnosis: 'Cholelithiasis',
    distractors: ['Gallbladder Polyp', 'Gallbladder Sludge', 'Cholecystitis'],
    visualFindings: 'Echogenic foci with posterior acoustic shadowing, mobile with position change',
    clinicalContext:
      'Most asymptomatic. Biliary colic = RUQ pain after fatty meals. Elective cholecystectomy if symptomatic.',
    targetImageCount: 10,
  },
  {
    id: 'GI__gallbladder__cholecystitis',
    name: 'Acute Cholecystitis',
    type: 'ultrasound',
    searchTerms: [
      'acute cholecystitis ultrasound',
      'cholecystitis sonography',
      'gallbladder wall thickening US',
      'sonographic murphy sign',
    ],
    correctDiagnosis: 'Acute Cholecystitis',
    distractors: ['Biliary Colic', 'Pancreatitis', 'Hepatitis'],
    visualFindings:
      'Gallbladder wall thickening >3mm, pericholecystic fluid, stones, sonographic Murphy sign',
    clinicalContext:
      'RUQ pain, fever, Murphy sign. IV antibiotics, cholecystectomy (early preferred).',
    targetImageCount: 12,
  },
  // =========== ORAL FINDINGS ===========
  {
    id: 'HEENT__oral_cavity__oral_candidiasis_thrush',
    name: 'Oral Candidiasis (Thrush)',
    type: 'oral',
    searchTerms: [
      'oral thrush candidiasis',
      'white plaques mouth candida',
      'oral candida albicans',
      'thrush oral exam',
    ],
    correctDiagnosis: 'Oral Candidiasis',
    distractors: ['Leukoplakia', 'Lichen Planus', 'Oral Hairy Leukoplakia'],
    visualFindings: 'White, curd-like plaques that scrape off to reveal erythematous base',
    clinicalContext:
      'Candida albicans. Risk factors: inhaled steroids, antibiotics, immunocompromise. Nystatin or fluconazole.',
    targetImageCount: 10,
  },
  {
    id: 'ID__fungal__candidiasis',
    name: 'Systemic Candidiasis',
    type: 'clinical_photo',
    searchTerms: [
      'candidiasis skin',
      'cutaneous candidiasis',
      'candida intertrigo',
      'candida diaper rash',
    ],
    correctDiagnosis: 'Cutaneous Candidiasis',
    distractors: ['Contact dermatitis', 'Psoriasis', 'Tinea'],
    visualFindings:
      'Beefy red erythema with satellite papules/pustules, occurs in moist skin folds',
    clinicalContext:
      'Moisture + warmth. Keep dry, topical antifungals. Oral fluconazole for severe/recurrent.',
    targetImageCount: 8,
  },
];

// Calculate total target images
const TOTAL_TARGET_IMAGES = OTHER_CONDITIONS.reduce((sum, c) => sum + c.targetImageCount, 0);
console.log(
  `📊 OTHER conditions: ${OTHER_CONDITIONS.length} conditions, ${TOTAL_TARGET_IMAGES} total target images`
);

// ============================================================================
// API & HELPERS
// ============================================================================

async function searchWikimediaImages(searchTerm: string, limit: number = 10): Promise<any[]> {
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  const url = `${baseUrl}?${params.toString()}`;
  const options = {
    headers: {
      'User-Agent':
        'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
    },
  };

  return new Promise((resolve, reject) => {
    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const pages = json.query?.pages || {};
            resolve(
              Object.values(pages).map((page: any) => ({
                title: page.title,
                url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
                originalUrl: page.imageinfo?.[0]?.url,
                source: 'wikimedia',
              }))
            );
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function searchRadiopaediaImages(searchTerm: string, limit: number = 5): Promise<any[]> {
  try {
    const searchUrl = `https://radiopaedia.org/search?utf8=%E2%9C%93&q=${encodeURIComponent(searchTerm)}&scope=cases&lang=us`;
    return new Promise((resolve) => {
      https
        .get(searchUrl, { headers: { 'User-Agent': 'PANaCEa-MedicalEducation/1.0' } }, (res) => {
          let html = '';
          res.on('data', (chunk) => (html += chunk));
          res.on('end', () => {
            const caseMatches = html.match(/\/cases\/[^"'\s>]+/g) || [];
            const uniqueCases = [...new Set(caseMatches)].slice(0, limit);
            const results = uniqueCases.map((casePath) => ({
              title: casePath.split('/').pop()?.replace(/-/g, ' ') || 'Radiopaedia Case',
              url: `https://radiopaedia.org${casePath}`,
              originalUrl: `https://radiopaedia.org${casePath}`,
              source: 'radiopaedia',
            }));
            resolve(results);
          });
          res.on('error', () => resolve([]));
        })
        .on('error', () => resolve([]));
    });
  } catch {
    return [];
  }
}

async function searchAllSources(searchTerm: string): Promise<any[]> {
  const [wikimedia, radiopaedia] = await Promise.all([
    searchWikimediaImages(searchTerm, 8),
    searchRadiopaediaImages(searchTerm, 4),
  ]);
  return [...wikimedia, ...radiopaedia];
}

interface OtherAnalysis {
  isValidImage: boolean;
  isActualClinical: boolean;
  modalityType: string;
  findingVisible: boolean;
  goodQuality: boolean;
  privacyConcern: boolean;
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  qualityScore: number;
  detectedFinding: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

async function analyzeImage(
  imageUrl: string,
  condition: OtherCondition
): Promise<OtherAnalysis | null> {
  if (!GEMINI_API_KEY || !geminiModel) return null;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const imageBuffer = await fetchImageAsBuffer(imageUrl);

      // Check image size
      if (imageBuffer.length > RATE_LIMIT.MAX_IMAGE_SIZE) {
        console.log(`  ⚠️ Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB`);
        return null;
      }

      const base64Image = imageBuffer.toString('base64');
      const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

      const prompt = `You are an expert clinician evaluating medical images for PA student training.

Image type: ${condition.type}
Expected condition: ${condition.correctDiagnosis}
Expected findings: ${condition.visualFindings}

Evaluate and respond in JSON:
{
  "isValidImage": boolean,
  "isActualClinical": boolean,
  "modalityType": string,
  "findingVisible": boolean,
  "goodQuality": boolean,
  "privacyConcern": boolean,
  "annotationLevel": "none|minimal|moderate|heavy",
  "qualityScore": number,
  "detectedFinding": string,
  "matchesCondition": boolean,
  "confidence": number,
  "rejectReason": string|null,
  "accept": boolean
}

CRITERIA:
- Must be actual clinical image (not illustration)
- Finding must be clearly visible
- No identifiable patient features for clinical photos
- qualityScore >= 6
- Minimal annotations

Respond ONLY with valid JSON.`;

      const result = await geminiModel.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Image } },
      ]);

      const text = result.response.text();
      if (!text) return null;

      // Normal delay between API calls
      await new Promise((r) => setTimeout(r, RATE_LIMIT.NORMAL_DELAY_MS + Math.random() * 1500));

      return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e: any) {
      const errorMsg = e.message || String(e);

      // Handle rate limiting
      if (
        errorMsg.includes('429') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('quota')
      ) {
        console.log(
          `  ⏳ Rate limited (attempt ${attempt}/${maxRetries}), waiting ${RATE_LIMIT.BACKOFF_DELAY_MS / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, RATE_LIMIT.BACKOFF_DELAY_MS));
        if (attempt === maxRetries) return null;
        continue;
      }

      console.log(`  Analysis error: ${errorMsg}`);
      return null;
    }
  }
  return null;
}

function fetchImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res: any) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchImageAsBuffer(res.headers.location).then(resolve).catch(reject);
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function uploadToSupabase(buffer: Buffer, filename: string, type: string): Promise<string> {
  const storagePath = `other/${type}/${filename}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function checkDuplicate(conditionId: string, originalUrl: string): Promise<boolean> {
  return !!(await prisma.mediaAsset.findFirst({
    where: { OR: [{ conditionId, sourceUrl: originalUrl }, { originalUrl }] },
  }));
}

async function saveMediaAsset(
  conditionId: string,
  publicUrl: string,
  originalUrl: string,
  condition: OtherCondition,
  analysis: OtherAnalysis
): Promise<void> {
  await prisma.mediaAsset.create({
    data: {

      updatedAt: new Date(),

      id: uuidv4(),
      conditionId,
      type: 'PHOTO',
      filename: `${condition.type}_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: [condition.type, condition.name.toLowerCase()],
      description: condition.clinicalContext,
      altText: `${condition.type} showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      aiMetadata: {
        modalityType: analysis.modalityType,
        detectedFinding: analysis.detectedFinding,
      },
      status: 'approved',
      approvalStatus: 'approved',
      modality: condition.type,
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function processCondition(
  condition: OtherCondition,
  dryRun: boolean
): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };
  console.log(`\n🔍 Processing: ${condition.name} (${condition.type})`);

  const existingCount = await prisma.mediaAsset.count({ where: { conditionId: condition.id } });
  const targetCount = condition.targetImageCount - existingCount;
  if (targetCount <= 0) {
    console.log(`  ✓ Already have ${existingCount}/${condition.targetImageCount}, skipping`);
    return stats;
  }

  console.log(`  Need ${targetCount} more (have ${existingCount}/${condition.targetImageCount})`);

  for (const searchTerm of condition.searchTerms) {
    if (stats.saved >= targetCount) break;
    console.log(`  🔍 Searching: "${searchTerm}"`);

    try {
      const results = await searchAllSources(searchTerm);
      stats.fetched += results.length;

      for (const result of results) {
        if (stats.saved >= targetCount || !result.url) break;
        if (await checkDuplicate(condition.id, result.originalUrl || result.url)) continue;

        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeImage(result.url, condition);

        if (!analysis?.accept) {
          console.log(`    ❌ Rejected: ${analysis?.rejectReason || 'Not suitable'}`);
          continue;
        }

        if (dryRun) {
          console.log(`    ✅ Would save: ${analysis.detectedFinding} (Q${analysis.qualityScore})`);
          stats.saved++;
          continue;
        }

        try {
          const buffer = await fetchImageAsBuffer(result.url);
          const publicUrl = await uploadToSupabase(
            buffer,
            `${condition.type}_${Date.now()}.jpg`,
            condition.type
          );
          await saveMediaAsset(
            condition.id,
            publicUrl,
            result.originalUrl || result.url,
            condition,
            analysis
          );
          console.log(`    ✅ Saved: ${analysis.detectedFinding} (Q${analysis.qualityScore})`);
          stats.saved++;
        } catch (e) {
          console.log(`    ⚠️ Error: ${e}`);
          stats.errors++;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e) {
      console.log(`    ⚠️ Search error: ${e}`);
      stats.errors++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return stats;
}

async function main() {
  console.log('🔍 Other Modalities Image Fetcher for PA Student Training\n' + '='.repeat(60));

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const typeFilter = args
    .find((a) => a.startsWith('--type='))
    ?.split('=')[1]
    ?.toLowerCase();
  const conditionFilter = args
    .find((a) => a.startsWith('--condition='))
    ?.split('=')[1]
    ?.toLowerCase();

  if (dryRun) console.log('🔍 DRY RUN MODE\n');

  let conditions = OTHER_CONDITIONS;
  if (typeFilter) conditions = conditions.filter((c) => c.type === typeFilter);
  if (conditionFilter)
    conditions = conditions.filter((c) => c.name.toLowerCase().includes(conditionFilter));

  console.log(`Processing ${conditions.length} conditions...\n`);
  console.log('Types included: ' + [...new Set(conditions.map((c) => c.type))].join(', ') + '\n');

  // Verify conditions exist in database
  let verifiedCount = 0;
  for (const condition of conditions) {
    const exists = await prisma.condition.findUnique({ where: { id: condition.id } });
    if (exists) verifiedCount++;
    else console.log(`  ⚠️ Condition not found: ${condition.id}`);
  }

  const totals = { fetched: 0, saved: 0, errors: 0 };
  for (const condition of conditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched;
    totals.saved += stats.saved;
    totals.errors += stats.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    `📊 OTHER SUMMARY: ${conditions.length} conditions | ${totals.fetched} fetched | ${totals.saved} saved | ${totals.errors} errors`
  );
  await prisma.$disconnect();
}

main().catch(console.error);
