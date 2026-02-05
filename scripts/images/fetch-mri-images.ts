#!/usr/bin/env npx tsx
/**
 * MRI Image Fetcher - Specialized Script
 *
 * Fetches MRI images from Wikimedia Commons for PA student visual diagnosis training.
 *
 * MRI Adequacy Criteria:
 * - Must be actual MRI image (not diagram/illustration)
 * - Appropriate sequence for pathology (T1, T2, FLAIR, DWI)
 * - Pathology clearly visible
 * - Minimal annotations
 * - Good signal quality (not too noisy)
 *
 * Usage:
 *   npx tsx scripts/images/fetch-mri-images.ts
 *   npx tsx scripts/images/fetch-mri-images.ts --dry-run
 *   npx tsx scripts/images/fetch-mri-images.ts --type=brain
 *   npx tsx scripts/images/fetch-mri-images.ts --condition="disc herniation"
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

// Rate limiting configuration
const RATE_LIMIT = {
  minDelayMs: 1500,
  maxDelayMs: 3000,
  rateLimitBackoffMs: 30000,
  searchDelayMs: 1000,
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for Gemini

async function rateLimitedDelay(isRateLimited = false): Promise<void> {
  const delay = isRateLimited
    ? RATE_LIMIT.rateLimitBackoffMs
    : Math.random() * (RATE_LIMIT.maxDelayMs - RATE_LIMIT.minDelayMs) + RATE_LIMIT.minDelayMs;
  await new Promise((r) => setTimeout(r, delay));
}

// ============================================================================
// MRI CONDITIONS - High-yield for PANCE
// ============================================================================

interface MRICondition {
  id: string;
  name: string;
  type: 'brain' | 'spine' | 'msk' | 'abdomen' | 'cardiac';
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  preferredSequence?: string;
  targetImageCount: number;
}

const MRI_CONDITIONS: MRICondition[] = [
  // =========== BRAIN MRI ===========
  {
    id: 'NEURO__cerebrovascular__ischemic_stroke',
    name: 'Acute Ischemic Stroke (MRI)',
    type: 'brain',
    searchTerms: [
      'acute stroke MRI DWI',
      'diffusion restriction stroke',
      'MRI brain infarct',
      'DWI acute ischemic stroke',
    ],
    correctDiagnosis: 'Acute Ischemic Stroke',
    distractors: ['Chronic infarct', 'Brain tumor', 'MS plaque'],
    visualFindings:
      'Bright on DWI with corresponding dark ADC map (restricted diffusion), T2/FLAIR bright in subacute phase',
    clinicalContext:
      'DWI most sensitive for acute stroke. Perfusion-diffusion mismatch = salvageable tissue.',
    preferredSequence: 'DWI/ADC',
    targetImageCount: 15,
  },
  {
    id: 'NEURO__demyelinating__multiple_sclerosis',
    name: 'Multiple Sclerosis',
    type: 'brain',
    searchTerms: [
      'multiple sclerosis MRI',
      'MS brain lesions MRI',
      'demyelinating plaques MRI',
      'periventricular lesions FLAIR',
    ],
    correctDiagnosis: 'Multiple Sclerosis',
    distractors: ['Small vessel disease', 'Migraine', 'Neuromyelitis optica'],
    visualFindings:
      'Periventricular ovoid T2/FLAIR hyperintense lesions (Dawson fingers), corpus callosum involvement, active lesions enhance',
    clinicalContext:
      'McDonald criteria use MRI dissemination in time and space. Active lesions enhance with gadolinium.',
    preferredSequence: 'T2 FLAIR',
    targetImageCount: 15,
  },
  {
    id: 'NEURO__cerebrovascular__intracerebral_hemorrhage',
    name: 'Intracerebral Hemorrhage',
    type: 'brain',
    searchTerms: [
      'MRI intracerebral hemorrhage',
      'gradient echo hemorrhage brain',
      'SWI microbleeds MRI',
      'brain MRI blood products',
    ],
    correctDiagnosis: 'Intracerebral Hemorrhage',
    distractors: ['Tumor', 'Stroke', 'Calcification'],
    visualFindings:
      'Signal varies with hemorrhage age; SWI/GRE sensitive to blood products, blooming artifact',
    clinicalContext:
      'MRI signal depends on hemoglobin oxidation state. GRE/SWI most sensitive for blood.',
    preferredSequence: 'GRE/SWI',
    targetImageCount: 12,
  },
  {
    id: 'NEURO__cerebrovascular__subarachnoid_hemorrhage',
    name: 'Subarachnoid Hemorrhage',
    type: 'brain',
    searchTerms: ['subarachnoid hemorrhage MRI FLAIR', 'SAH MRI', 'aneurysm rupture MRI'],
    correctDiagnosis: 'Subarachnoid Hemorrhage',
    distractors: ['Meningitis', 'Intracerebral hemorrhage', 'Trauma'],
    visualFindings:
      'FLAIR bright in sulci and cisterns, may see aneurysm on MRA, late subacute shows superficial siderosis',
    clinicalContext:
      'CT more sensitive acutely; MRI FLAIR for subacute SAH. Evaluate for aneurysm.',
    preferredSequence: 'FLAIR and MRA',
    targetImageCount: 10,
  },
  {
    id: 'NEURO__infectious__brain_abscess',
    name: 'Brain Abscess',
    type: 'brain',
    searchTerms: ['brain abscess MRI', 'ring enhancing lesion brain', 'pyogenic abscess MRI DWI'],
    correctDiagnosis: 'Brain Abscess',
    distractors: ['GBM', 'Metastasis', 'Demyelinating lesion'],
    visualFindings:
      'Ring-enhancing lesion with restricted diffusion centrally (bright DWI, dark ADC), surrounding edema',
    clinicalContext:
      'DWI differentiates from tumor (abscess restricts). Surgical drainage + antibiotics.',
    preferredSequence: 'DWI and T1+contrast',
    targetImageCount: 10,
  },
  {
    id: 'NEURO__demyelinating__acute_disseminated_encephalomyelitis_adem',
    name: 'ADEM',
    type: 'brain',
    searchTerms: [
      'ADEM MRI',
      'acute disseminated encephalomyelitis MRI',
      'post-infectious demyelination MRI',
    ],
    correctDiagnosis: 'Acute Disseminated Encephalomyelitis',
    distractors: ['Multiple sclerosis', 'Viral encephalitis', 'Leukodystrophy'],
    visualFindings:
      'Multiple large demyelinating lesions in white matter, often bilateral, may involve deep gray matter',
    clinicalContext:
      'Monophasic post-infectious/post-vaccination. Pediatric predominance. Steroids for treatment.',
    preferredSequence: 'T2 FLAIR',
    targetImageCount: 8,
  },
  // =========== SPINE MRI ===========
  {
    id: 'MSK__back__spine__lumbar_radiculopathy_herniated_disc',
    name: 'Lumbar Disc Herniation',
    type: 'spine',
    searchTerms: [
      'lumbar disc herniation MRI',
      'herniated disc MRI',
      'L5S1 disc protrusion',
      'cervical disc herniation MRI',
    ],
    correctDiagnosis: 'Lumbar Disc Herniation',
    distractors: ['Bulging disc', 'Spinal stenosis', 'Facet arthropathy'],
    visualFindings:
      'Disc material extending beyond vertebral body margin, nerve root compression, may see annular tear',
    clinicalContext:
      'Correlate with clinical symptoms. Most improve with conservative treatment. Surgery if severe or progressive.',
    preferredSequence: 'T2 sagittal and axial',
    targetImageCount: 15,
  },
  {
    id: 'MSK__back__spine__spinal_stenosis',
    name: 'Spinal Stenosis',
    type: 'spine',
    searchTerms: [
      'spinal stenosis MRI',
      'lumbar stenosis MRI',
      'narrowed spinal canal',
      'cervical stenosis MRI',
    ],
    correctDiagnosis: 'Spinal Stenosis',
    distractors: ['Disc herniation', 'Spondylolisthesis', 'Normal variant'],
    visualFindings:
      'Narrowing of central canal or neural foramina, ligamentum flavum hypertrophy, facet hypertrophy',
    clinicalContext:
      'Neurogenic claudication (pain with walking, relieved by sitting/leaning forward). Decompression if severe.',
    preferredSequence: 'T2',
    targetImageCount: 12,
  },
  {
    id: 'NEURO__spine__cauda_equina_syndrome',
    name: 'Cauda Equina Syndrome',
    type: 'spine',
    searchTerms: [
      'cauda equina syndrome MRI',
      'large central disc herniation',
      'cauda equina compression MRI',
    ],
    correctDiagnosis: 'Cauda Equina Syndrome',
    distractors: ['Simple disc herniation', 'Spinal stenosis', 'Tumor'],
    visualFindings: 'Large central disc herniation or mass compressing cauda equina nerve roots',
    clinicalContext:
      'Surgical emergency. Saddle anesthesia, urinary retention, bowel dysfunction. Urgent decompression.',
    preferredSequence: 'T2',
    targetImageCount: 10,
  },
  {
    id: 'MSK__back__spine__compression_vertebral_fracture',
    name: 'Vertebral Compression Fracture',
    type: 'spine',
    searchTerms: [
      'vertebral compression fracture MRI',
      'acute vertebral fracture MRI STIR',
      'pathologic fracture spine',
    ],
    correctDiagnosis: 'Vertebral Compression Fracture',
    distractors: ['Degenerative changes', 'Chronic fracture', 'Metastasis'],
    visualFindings:
      'Vertebral body height loss, STIR bright (acute), T1 dark. May have retropulsion.',
    clinicalContext:
      'STIR differentiates acute from chronic. Evaluate for pathologic cause. Kyphoplasty for pain.',
    preferredSequence: 'T1 and STIR',
    targetImageCount: 10,
  },
  {
    id: 'NEURO__spinal_cord_disorders_demyelinating_disease__transverse_myelitis',
    name: 'Transverse Myelitis',
    type: 'spine',
    searchTerms: [
      'transverse myelitis MRI',
      'spinal cord myelitis MRI',
      'longitudinally extensive myelitis',
    ],
    correctDiagnosis: 'Transverse Myelitis',
    distractors: ['MS', 'Cord compression', 'Spinal cord infarct'],
    visualFindings:
      'T2 hyperintense spinal cord lesion, may span multiple segments, cord swelling acutely',
    clinicalContext:
      'Consider MS, NMO, infection, autoimmune. CSF analysis helpful. Steroids for treatment.',
    preferredSequence: 'T2 sagittal',
    targetImageCount: 10,
  },
  // =========== MSK MRI ===========
  {
    id: 'MSK__ligament_injury__anterior_cruciate_ligament_acl_tear',
    name: 'ACL Tear',
    type: 'msk',
    searchTerms: [
      'ACL tear MRI',
      'anterior cruciate ligament rupture MRI',
      'knee ACL injury MRI',
      'ACL complete tear',
    ],
    correctDiagnosis: 'ACL Tear',
    distractors: ['PCL tear', 'Meniscus tear', 'MCL tear'],
    visualFindings:
      'Discontinuity of ACL fibers, abnormal signal/edema, empty notch sign, bone bruise pattern',
    clinicalContext:
      'Common sports injury. Positive Lachman test. ACL reconstruction for active patients.',
    preferredSequence: 'PD and T2',
    targetImageCount: 15,
  },
  {
    id: 'MSK__meniscal_injury__medial_meniscus_tear',
    name: 'Meniscus Tear',
    type: 'msk',
    searchTerms: [
      'meniscus tear MRI',
      'meniscal tear knee',
      'bucket handle meniscus',
      'medial meniscus tear MRI',
    ],
    correctDiagnosis: 'Meniscus Tear',
    distractors: ['Meniscal degeneration', 'ACL tear', 'Osteochondral defect'],
    visualFindings:
      'Linear high signal extending to articular surface, displaced fragment in bucket handle',
    clinicalContext:
      'Joint line tenderness, McMurray test. Arthroscopic repair/debridement if symptomatic.',
    preferredSequence: 'PD',
    targetImageCount: 15,
  },
  {
    id: 'MSK__soft_tissueoveruse__rotator_cuff_tear',
    name: 'Rotator Cuff Tear',
    type: 'msk',
    searchTerms: [
      'rotator cuff tear MRI',
      'supraspinatus tear MRI',
      'shoulder tendon tear MRI',
      'full thickness RTC tear',
    ],
    correctDiagnosis: 'Rotator Cuff Tear',
    distractors: ['Tendinosis', 'Bursitis', 'Labral tear'],
    visualFindings: 'Gap in tendon continuity, retraction, fatty atrophy of muscle if chronic',
    clinicalContext:
      'Supraspinatus most common. Physical therapy first. Surgical repair for large/refractory tears.',
    preferredSequence: 'T2 and PD fat-sat',
    targetImageCount: 15,
  },
  {
    id: 'MSK__ligament_injury__posterior_cruciate_ligament_pcl_injury',
    name: 'PCL Tear',
    type: 'msk',
    searchTerms: ['PCL tear MRI', 'posterior cruciate ligament tear MRI', 'PCL injury knee MRI'],
    correctDiagnosis: 'PCL Tear',
    distractors: ['ACL tear', 'Meniscus tear', 'MCL tear'],
    visualFindings: 'Abnormal signal or discontinuity of PCL, loss of normal low signal',
    clinicalContext:
      'Dashboard injury mechanism. Less common than ACL. Often treated conservatively.',
    preferredSequence: 'T2 sagittal',
    targetImageCount: 10,
  },
  {
    id: 'MSK__soft_tissueoveruse__achilles_tendon_rupture',
    name: 'Achilles Tendon Rupture',
    type: 'msk',
    searchTerms: ['Achilles tendon tear MRI', 'Achilles rupture MRI', 'Achilles tendon injury MRI'],
    correctDiagnosis: 'Achilles Tendon Rupture',
    distractors: ['Tendinosis', 'Partial tear', 'Bursitis'],
    visualFindings: 'Complete discontinuity of tendon fibers, retraction, surrounding edema/fluid',
    clinicalContext: 'Positive Thompson test. Surgical vs conservative based on patient factors.',
    preferredSequence: 'T2 sagittal',
    targetImageCount: 10,
  },
  // =========== ABDOMINAL MRI ===========
  {
    id: 'GI__liver__hepatocellular_carcinoma',
    name: 'Hepatocellular Carcinoma',
    type: 'abdomen',
    searchTerms: ['hepatocellular carcinoma MRI', 'HCC MRI', 'liver mass MRI LI-RADS'],
    correctDiagnosis: 'Hepatocellular Carcinoma',
    distractors: ['Hemangioma', 'FNH', 'Metastasis'],
    visualFindings:
      'Arterial phase enhancement with washout in portal/delayed phases, capsule, T2 mild hyperintense',
    clinicalContext:
      'LI-RADS classification. In cirrhosis, imaging criteria diagnostic. AFP may be elevated.',
    preferredSequence: 'Dynamic contrast T1',
    targetImageCount: 12,
  },
  {
    id: 'GI__pancreas__pancreatic_cancer',
    name: 'Pancreatic Adenocarcinoma',
    type: 'abdomen',
    searchTerms: [
      'pancreatic adenocarcinoma MRI',
      'pancreatic cancer MRI MRCP',
      'pancreatic mass MRI',
    ],
    correctDiagnosis: 'Pancreatic Adenocarcinoma',
    distractors: ['Pancreatitis', 'IPMN', 'Neuroendocrine tumor'],
    visualFindings:
      'Hypointense mass on T1, ductal dilation (double duct sign), vascular involvement',
    clinicalContext:
      'MRCP shows ductal anatomy. Assess resectability (vascular involvement). Poor prognosis.',
    preferredSequence: 'T1 and MRCP',
    targetImageCount: 10,
  },
  // =========== CARDIAC MRI ===========
  {
    id: 'CV__cardiomyopathy__hypertrophic_cardiomyopathy',
    name: 'Hypertrophic Cardiomyopathy',
    type: 'cardiac',
    searchTerms: ['hypertrophic cardiomyopathy MRI', 'HCM cardiac MRI', 'septal hypertrophy MRI'],
    correctDiagnosis: 'Hypertrophic Cardiomyopathy',
    distractors: ['Athletes heart', 'Hypertensive heart disease', 'Amyloidosis'],
    visualFindings:
      'Asymmetric septal hypertrophy, SAM of mitral valve, late gadolinium enhancement at RV insertion',
    clinicalContext:
      'Most common cause of sudden cardiac death in athletes. ICD for high-risk patients.',
    preferredSequence: 'Cine and LGE',
    targetImageCount: 10,
  },
  {
    id: 'CV__carditis__myocarditis',
    name: 'Myocarditis',
    type: 'cardiac',
    searchTerms: ['myocarditis MRI', 'cardiac MRI myocarditis', 'myocardial inflammation MRI'],
    correctDiagnosis: 'Myocarditis',
    distractors: ['MI', 'Cardiomyopathy', 'Pericarditis'],
    visualFindings:
      'Subepicardial/mid-wall late gadolinium enhancement (non-coronary pattern), edema on T2',
    clinicalContext:
      'Lake Louise criteria. Viral etiology common. Supportive care, avoid exercise.',
    preferredSequence: 'T2 and LGE',
    targetImageCount: 10,
  },
];

// Calculate total target images
const TOTAL_TARGET_IMAGES = MRI_CONDITIONS.reduce((sum, c) => sum + c.targetImageCount, 0);
console.log(
  `📊 MRI conditions: ${MRI_CONDITIONS.length} conditions, ${TOTAL_TARGET_IMAGES} total target images`
);

// ============================================================================
// HELPER FUNCTIONS & API
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
                description: page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '',
                license: page.imageinfo?.[0]?.extmetadata?.License?.value || 'Unknown',
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

async function searchRadiopaediaImages(searchTerm: string, limit: number = 8): Promise<any[]> {
  // Radiopaedia search via their JSON API
  const url = `https://radiopaedia.org/search.json?q=${encodeURIComponent(searchTerm)}&scope=cases&lang=us`;
  const options = {
    headers: {
      'User-Agent': 'PANaCEa-MedicalEducation/1.0 (medical-education-app) Node.js',
      Accept: 'application/json',
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
            const results = (json.results || json || []).slice(0, limit).map((item: any) => ({
              title: item.title || item.name || 'MRI Case',
              url: item.thumbnail_url || item.image_url,
              originalUrl: item.url ? `https://radiopaedia.org${item.url}` : null,
              description: item.description || item.modality || '',
              license: 'Radiopaedia CC-BY-NC-SA',
              source: 'radiopaedia',
              caseId: item.id,
            }));
            resolve(results.filter((r: any) => r.url));
          } catch (e) {
            console.log(`    ⚠️ Radiopaedia parse error: ${e}`);
            resolve([]);
          }
        });
      })
      .on('error', (e) => {
        console.log(`    ⚠️ Radiopaedia search error: ${e}`);
        resolve([]);
      });
  });
}

// Combined search across multiple sources
async function searchAllSources(searchTerm: string, limit: number = 15): Promise<any[]> {
  const results: any[] = [];

  // Search Wikimedia first
  try {
    const wikimediaResults = await searchWikimediaImages(searchTerm, Math.ceil(limit * 0.7));
    results.push(...wikimediaResults);
    await new Promise((r) => setTimeout(r, RATE_LIMIT.searchDelayMs));
  } catch (e) {
    console.log(`    ⚠️ Wikimedia search error: ${e}`);
  }

  // Search Radiopaedia
  try {
    const radiopaediaResults = await searchRadiopaediaImages(searchTerm, Math.ceil(limit * 0.3));
    results.push(...radiopaediaResults);
  } catch (e) {
    console.log(`    ⚠️ Radiopaedia search error: ${e}`);
  }

  return results.slice(0, limit);
}

// ============================================================================
// PRE-FILTERING - Skip obviously irrelevant images before AI analysis
// ============================================================================

const MRI_EXCLUSION_KEYWORDS = [
  'room',
  'equipment',
  'machine',
  'scanner',
  'hospital',
  'building',
  'doctor',
  'patient photo',
  'nurse',
  'portrait',
  'photograph of',
  'diagram',
  'illustration',
  'drawing',
  'cartoon',
  'icon',
  'logo',
  'x-ray',
  'xray',
  'radiograph',
  'ct scan',
  'ecg',
  'ekg',
  'ultrasound',
];

function preFilterMRIResult(
  result: any,
  condition: { type: string }
): { pass: boolean; reason?: string } {
  const title = (result.title || '').toLowerCase();
  const description = (result.description || '').toLowerCase();
  const combined = `${title} ${description}`;

  for (const keyword of MRI_EXCLUSION_KEYWORDS) {
    if (combined.includes(keyword)) {
      return { pass: false, reason: `Contains "${keyword}"` };
    }
  }

  return { pass: true };
}

interface MRIAnalysis {
  isValidMRI: boolean;
  isActualMRIImage: boolean;
  mriType: 'brain' | 'spine' | 'msk' | 'abdomen' | 'cardiac' | 'other' | 'not_mri';
  sequenceType: string;
  pathologyVisible: boolean;
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  qualityScore: number;
  detectedFinding: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

async function analyzeMRIImage(
  imageUrl: string,
  condition: MRICondition,
  retryCount = 0
): Promise<MRIAnalysis | null> {
  if (!genAI) {
    console.log('  ⚠️ Gemini SDK not initialized');
    return null;
  }

  try {
    const imageBuffer = await fetchImageAsBuffer(imageUrl);

    // Check file size
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`  ⚠️ Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB`);
      return null;
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

    const prompt = `You are an expert radiologist evaluating MRI images for PA student training.

Analyze this image:

Expected condition: ${condition.correctDiagnosis}
Expected MRI type: ${condition.type}
Preferred sequence: ${condition.preferredSequence || 'any'}
Expected findings: ${condition.visualFindings}

Respond in JSON:
{
  "isValidMRI": boolean,
  "isActualMRIImage": boolean,
  "mriType": "brain|spine|msk|abdomen|cardiac|other|not_mri",
  "sequenceType": string,
  "pathologyVisible": boolean,
  "annotationLevel": "none|minimal|moderate|heavy",
  "qualityScore": number (1-10),
  "detectedFinding": string,
  "matchesCondition": boolean,
  "confidence": number (0-1),
  "rejectReason": string|null,
  "accept": boolean
}

Accept only: actual MRI (not illustration/diagram), qualityScore >= 6, pathology visible, minimal annotations, matches expected condition type.

Respond ONLY with valid JSON.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text();
    if (!text) return null;

    await rateLimitedDelay();
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (e: any) {
    const errorMsg = e?.message || String(e);

    // Handle rate limiting with retry
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      if (retryCount < 3) {
        console.log(
          `  ⏳ Rate limited, waiting ${RATE_LIMIT.rateLimitBackoffMs / 1000}s (retry ${retryCount + 1}/3)...`
        );
        await rateLimitedDelay(true);
        return analyzeMRIImage(imageUrl, condition, retryCount + 1);
      }
    }

    console.log(`  ⚠️ Analysis error: ${errorMsg.substring(0, 100)}`);
    return null;
  }
}

function fetchImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const protocol = url.startsWith('https') ? https : require('http');
    protocol
      .get(url, options, (res: any) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchImageAsBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function uploadToSupabase(buffer: Buffer, filename: string): Promise<string> {
  const storagePath = `mri/${filename}`;
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
  condition: MRICondition,
  analysis: MRIAnalysis
): Promise<void> {
  await prisma.mediaAsset.create({
    data: {
      id: uuidv4(),
      conditionId,
      type: 'mri',
      filename: `mri_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: [
        'mri',
        condition.type,
        analysis.sequenceType?.toLowerCase() || '',
        condition.name.toLowerCase(),
      ].filter(Boolean),
      description: condition.clinicalContext,
      altText: `MRI showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      aiMetadata: {
        mriType: analysis.mriType,
        sequenceType: analysis.sequenceType,
        detectedFinding: analysis.detectedFinding,
      },
      status: 'active',
      approvalStatus: 'approved',
      modality: 'mri',
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
    } as any,
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function processCondition(
  condition: MRICondition,
  dryRun: boolean
): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };
  console.log(
    `\n🧲 Processing: ${condition.name} (${condition.type}) - Target: ${condition.targetImageCount}`
  );

  const existingCount = await prisma.mediaAsset.count({ where: { conditionId: condition.id } });
  if (existingCount >= condition.targetImageCount) {
    console.log(`  ✓ Already have ${existingCount}/${condition.targetImageCount}, skipping`);
    return stats;
  }

  const targetCount = condition.targetImageCount - existingCount;
  console.log(`  Need ${targetCount} more (have ${existingCount}/${condition.targetImageCount})`);

  for (const searchTerm of condition.searchTerms) {
    if (stats.saved >= targetCount) break;
    console.log(`  🔍 Searching: "${searchTerm}"`);

    try {
      const results = await searchAllSources(searchTerm, 10);
      stats.fetched += results.length;
      console.log(`    Found ${results.length} results`);

      for (const result of results) {
        if (stats.saved >= targetCount || !result.url) break;
        if (await checkDuplicate(condition.id, result.originalUrl || result.url)) {
          console.log(`    ⏭️ Duplicate: ${result.title?.substring(0, 30)}...`);
          continue;
        }

        // Pre-filter based on title/description before expensive AI call
        const preFilter = preFilterMRIResult(result, condition);
        if (!preFilter.pass) {
          console.log(
            `    ⏭️ Pre-filtered: ${preFilter.reason} - ${result.title?.substring(0, 30)}`
          );
          continue;
        }

        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeMRIImage(result.url, condition);

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
            `mri_${condition.id.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`
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

        await rateLimitedDelay();
      }
    } catch (e) {
      console.log(`    ⚠️ Search error: ${e}`);
      stats.errors++;
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT.searchDelayMs));
  }
  return stats;
}

async function main() {
  console.log('🧲 MRI Image Fetcher for PA Student Training');
  console.log('='.repeat(60));
  console.log(
    `📊 ${MRI_CONDITIONS.length} conditions, ${TOTAL_TARGET_IMAGES} total target images\n`
  );

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

  if (args.includes('--help')) {
    console.log(`
Usage: npx tsx scripts/images/fetch-mri-images.ts [options]

Options:
  --dry-run              Show what would be saved without actually saving
  --type=<type>          Filter by MRI type: brain, spine, msk, abdomen, cardiac
  --condition=<name>     Filter by condition name (partial match)
  --help                 Show this help

Examples:
  npx tsx scripts/images/fetch-mri-images.ts --dry-run
  npx tsx scripts/images/fetch-mri-images.ts --type=brain
  npx tsx scripts/images/fetch-mri-images.ts --condition=stroke
`);
    process.exit(0);
  }

  if (dryRun) console.log('🔍 DRY RUN MODE\n');

  // Verify condition IDs exist in database
  console.log('🔍 Verifying condition IDs in database...');
  let verifiedCount = 0;
  for (const condition of MRI_CONDITIONS) {
    const exists = await prisma.condition.findUnique({ where: { id: condition.id } });
    if (exists) {
      verifiedCount++;
    } else {
      console.log(`  ⚠️ Condition not found: ${condition.id}`);
    }
  }
  console.log(`  ✓ ${verifiedCount}/${MRI_CONDITIONS.length} conditions verified\n`);

  let conditions = MRI_CONDITIONS;
  if (typeFilter) conditions = conditions.filter((c) => c.type === typeFilter);
  if (conditionFilter)
    conditions = conditions.filter((c) => c.name.toLowerCase().includes(conditionFilter));

  console.log(`Processing ${conditions.length} conditions...\n`);

  const totals = { fetched: 0, saved: 0, errors: 0 };
  for (const condition of conditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched;
    totals.saved += stats.saved;
    totals.errors += stats.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    `📊 MRI SUMMARY: ${conditions.length} conditions | ${totals.fetched} fetched | ${totals.saved} saved | ${totals.errors} errors`
  );
  await prisma.$disconnect();
}

main().catch(console.error);
