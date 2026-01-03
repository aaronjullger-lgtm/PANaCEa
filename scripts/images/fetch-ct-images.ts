#!/usr/bin/env npx tsx
/**
 * CT Image Fetcher - Specialized Script
 * 
 * Fetches CT scan images from Wikimedia Commons for PA student visual diagnosis training.
 * 
 * CT Adequacy Criteria:
 * - Must be actual CT image (not diagram/illustration)
 * - Appropriate window/level for pathology (bone, soft tissue, lung)
 * - Pathology clearly visible and identifiable
 * - Minimal annotations
 * - Representative slice showing key findings
 * 
 * Usage:
 *   npx tsx scripts/images/fetch-ct-images.ts
 *   npx tsx scripts/images/fetch-ct-images.ts --dry-run
 *   npx tsx scripts/images/fetch-ct-images.ts --type=head
 *   npx tsx scripts/images/fetch-ct-images.ts --condition="appendicitis"
 */

import { PrismaClient } from '@prisma/client';
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

// Gemini for AI verification - use SDK
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Rate limiting configuration
const RATE_LIMIT = {
  baseDelayMs: 3000,
  maxDelayMs: 60000,
  searchDelayMs: 1500,
  rateLimitBackoffMs: 30000
};
let currentBackoff = RATE_LIMIT.baseDelayMs;
let apiCallCount = 0;

async function rateLimitedDelay(afterError = false): Promise<void> {
  if (afterError) {
    currentBackoff = Math.min(currentBackoff * 2, RATE_LIMIT.maxDelayMs);
    console.log(`  ⏳ Rate limit backoff: ${currentBackoff / 1000}s`);
  } else {
    currentBackoff = RATE_LIMIT.baseDelayMs;
  }
  await new Promise(r => setTimeout(r, currentBackoff));
  apiCallCount++;
  
  if (apiCallCount % 10 === 0) {
    console.log(`  ⏳ Periodic cooldown (${apiCallCount} API calls)...`);
    await new Promise(r => setTimeout(r, 5000));
  }
}

// ============================================================================
// CT CONDITIONS - High-yield for PANCE
// ============================================================================

interface CTCondition {
  conditionId: string;
  name: string;
  type: 'head' | 'chest' | 'abdomen' | 'spine';
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  windowSetting?: string;
  targetImageCount: number;
}

const CT_CONDITIONS: CTCondition[] = [
  // =========== HEAD CT ===========
  {
    conditionId: 'NEURO__cerebrovascular__ischemic_stroke',
    name: 'Acute Ischemic Stroke',
    type: 'head',
    searchTerms: ['ischemic stroke CT', 'MCA stroke CT', 'acute infarct CT brain', 'cerebral infarction CT'],
    correctDiagnosis: 'Acute Ischemic Stroke',
    distractors: ['Hemorrhagic stroke', 'Brain tumor', 'Subdural hematoma'],
    visualFindings: 'Loss of gray-white differentiation, sulcal effacement, hyperdense MCA sign (early), wedge-shaped hypodensity (later)',
    clinicalContext: 'CT first to rule out hemorrhage before tPA. Time is brain - door-to-needle <60min.',
    targetImageCount: 15
  },
  {
    conditionId: 'NEURO__cerebrovascular__intracerebral_hemorrhage',
    name: 'Hemorrhagic Stroke (ICH)',
    type: 'head',
    searchTerms: ['intracerebral hemorrhage CT', 'hemorrhagic stroke CT', 'ICH CT brain', 'hypertensive hemorrhage CT'],
    correctDiagnosis: 'Intracerebral Hemorrhage',
    distractors: ['Ischemic stroke', 'Hemorrhagic transformation', 'Brain metastasis'],
    visualFindings: 'Hyperdense (white) collection in brain parenchyma, surrounding edema, possible mass effect',
    clinicalContext: 'HTN most common cause. Control BP, reverse anticoagulation, neurosurgery consult if large.',
    targetImageCount: 15
  },
  {
    conditionId: 'NEURO__trauma__subdural_hematoma',
    name: 'Subdural Hematoma',
    type: 'head',
    searchTerms: ['subdural hematoma CT', 'SDH CT brain', 'crescent shaped hemorrhage CT', 'acute subdural CT'],
    correctDiagnosis: 'Subdural Hematoma',
    distractors: ['Epidural hematoma', 'Subarachnoid hemorrhage', 'Chronic subdural hygroma'],
    visualFindings: 'Crescent-shaped collection crossing suture lines, acute=hyperdense, chronic=hypodense, midline shift',
    clinicalContext: 'Bridging vein rupture. Common in elderly/alcoholics. May need surgical evacuation.',
    targetImageCount: 15
  },
  {
    conditionId: 'NEURO__trauma__epidural_hematoma',
    name: 'Epidural Hematoma',
    type: 'head',
    searchTerms: ['epidural hematoma CT', 'EDH CT brain', 'lens shaped hemorrhage CT', 'biconvex hematoma'],
    correctDiagnosis: 'Epidural Hematoma',
    distractors: ['Subdural hematoma', 'Contusion', 'Intracerebral hemorrhage'],
    visualFindings: 'Biconvex/lens-shaped hyperdense collection, does NOT cross suture lines, often temporal with skull fracture',
    clinicalContext: 'Middle meningeal artery injury. Classic lucid interval. Surgical emergency - rapid deterioration.',
    targetImageCount: 12
  },
  {
    conditionId: 'NEURO__cerebrovascular__subarachnoid_hemorrhage',
    name: 'Subarachnoid Hemorrhage',
    type: 'head',
    searchTerms: ['subarachnoid hemorrhage CT', 'SAH CT brain', 'blood in cisterns CT', 'aneurysmal SAH CT'],
    correctDiagnosis: 'Subarachnoid Hemorrhage',
    distractors: ['Subdural hematoma', 'Meningitis', 'Normal variant'],
    visualFindings: 'Hyperdense blood in subarachnoid spaces, basal cisterns, sylvian fissures, interhemispheric fissure',
    clinicalContext: 'Thunderclap headache, worst of life. Aneurysm most common. CTA/LP if CT negative. Vasospasm risk days 3-14.',
    targetImageCount: 12
  },
  {
    conditionId: 'NEURO__infectious__brain_abscess',
    name: 'Brain Abscess',
    type: 'head',
    searchTerms: ['brain abscess CT', 'ring enhancing lesion CT brain', 'cerebral abscess CT'],
    correctDiagnosis: 'Brain Abscess',
    distractors: ['Brain tumor', 'Metastasis', 'Glioblastoma'],
    visualFindings: 'Ring-enhancing lesion with central hypodensity, surrounding vasogenic edema, mass effect',
    clinicalContext: 'Source: sinus, dental, endocarditis. Antibiotics +/- surgical drainage. MRI better for characterization.',
    targetImageCount: 10
  },
  {
    conditionId: 'NEURO__cognitive__normal_pressure_hydrocephalus_nph',
    name: 'Normal Pressure Hydrocephalus',
    type: 'head',
    searchTerms: ['normal pressure hydrocephalus CT', 'NPH CT brain', 'ventriculomegaly CT', 'hydrocephalus CT'],
    correctDiagnosis: 'Normal Pressure Hydrocephalus',
    distractors: ['Brain atrophy', 'Obstructive hydrocephalus', 'Dementia'],
    visualFindings: 'Ventricular enlargement out of proportion to sulcal atrophy, Evans index >0.3, periventricular T2 hyperintensity',
    clinicalContext: 'Classic triad: wet, wobbly, wacky (incontinence, gait apraxia, dementia). VP shunt is treatment.',
    targetImageCount: 10
  },
  // =========== CHEST CT ===========
  {
    conditionId: 'PULM__pulmonary_circulation__pulmonary_embolism',
    name: 'Pulmonary Embolism',
    type: 'chest',
    searchTerms: ['pulmonary embolism CT', 'PE CTA', 'saddle embolus CT', 'filling defect pulmonary artery'],
    correctDiagnosis: 'Pulmonary Embolism',
    distractors: ['Pneumonia', 'Lung cancer', 'Pulmonary artery sarcoma'],
    visualFindings: 'Filling defect in pulmonary arteries on CTA, saddle embolus at bifurcation, RV strain signs',
    clinicalContext: 'CTA gold standard. Anticoagulation, thrombolytics if massive, catheter-directed therapy option.',
    targetImageCount: 15
  },
  {
    conditionId: 'PULM__oncology__non_small_cell_lung_cancer',
    name: 'Lung Cancer (CT)',
    type: 'chest',
    searchTerms: ['lung cancer CT', 'lung mass CT', 'pulmonary nodule malignant CT', 'spiculated lung mass'],
    correctDiagnosis: 'Lung Cancer',
    distractors: ['Granuloma', 'Hamartoma', 'Metastasis'],
    visualFindings: 'Spiculated mass, mediastinal lymphadenopathy, invasion of chest wall/mediastinum, satellite nodules',
    clinicalContext: 'Smoking biggest risk factor. Staging with PET-CT. Biopsy for tissue diagnosis.',
    targetImageCount: 12
  },
  {
    conditionId: 'CV__vascular_disease__aortic_dissection',
    name: 'Aortic Dissection',
    type: 'chest',
    searchTerms: ['aortic dissection CT', 'intimal flap CT', 'Stanford type A dissection', 'aortic dissection CTA'],
    correctDiagnosis: 'Aortic Dissection',
    distractors: ['Aortic aneurysm', 'Intramural hematoma', 'Penetrating ulcer'],
    visualFindings: 'Intimal flap separating true and false lumens, may see differential enhancement',
    clinicalContext: 'Type A (ascending) = surgical emergency. Type B = medical management unless complicated.',
    targetImageCount: 12
  },
  {
    conditionId: 'CV__vascular_disease__aortic_aneurysm',
    name: 'Aortic Aneurysm',
    type: 'chest',
    searchTerms: ['thoracic aortic aneurysm CT', 'TAA CT', 'aortic aneurysm CT'],
    correctDiagnosis: 'Thoracic Aortic Aneurysm',
    distractors: ['Aortic dissection', 'Mediastinal mass', 'Tortuous aorta'],
    visualFindings: 'Dilated aorta >4cm (ascending) or >3cm (descending), mural thrombus, calcification',
    clinicalContext: 'Screen if Marfan, bicuspid aortic valve. Surgical repair if >5.5cm or symptomatic.',
    targetImageCount: 10
  },
  {
    conditionId: 'PULM__interstitial__idiopathic_pulmonary_fibrosis',
    name: 'Pulmonary Fibrosis (CT)',
    type: 'chest',
    searchTerms: ['pulmonary fibrosis CT', 'UIP pattern CT', 'honeycombing CT', 'interstitial lung disease CT'],
    correctDiagnosis: 'Idiopathic Pulmonary Fibrosis',
    distractors: ['NSIP', 'Hypersensitivity pneumonitis', 'Sarcoidosis'],
    visualFindings: 'Honeycombing (basilar/peripheral), traction bronchiectasis, reticulation, ground glass (minimal)',
    clinicalContext: 'UIP pattern on HRCT. Poor prognosis. Antifibrotics (pirfenidone, nintedanib). Lung transplant option.',
    targetImageCount: 10
  },
  // =========== ABDOMINAL CT ===========
  {
    conditionId: 'GI__appendix__appendicitis',
    name: 'Appendicitis',
    type: 'abdomen',
    searchTerms: ['appendicitis CT', 'inflamed appendix CT', 'appendiceal diameter CT', 'acute appendicitis CT'],
    correctDiagnosis: 'Acute Appendicitis',
    distractors: ['Mesenteric adenitis', 'Epiploic appendagitis', 'Right ovarian pathology'],
    visualFindings: 'Dilated appendix >6mm, wall thickening, periappendiceal fat stranding, appendicolith, no contrast filling',
    clinicalContext: 'RLQ pain, anorexia, migration of pain. CT if diagnosis unclear. Appendectomy treatment of choice.',
    targetImageCount: 15
  },
  {
    conditionId: 'GI__colon__diverticulosis',
    name: 'Diverticulitis',
    type: 'abdomen',
    searchTerms: ['diverticulitis CT', 'sigmoid diverticulitis CT', 'colonic diverticula inflammation', 'acute diverticulitis CT'],
    correctDiagnosis: 'Acute Diverticulitis',
    distractors: ['Colon cancer', 'Colitis', 'Epiploic appendagitis'],
    visualFindings: 'Sigmoid wall thickening, pericolic fat stranding, diverticula, abscess if complicated',
    clinicalContext: 'LLQ pain in elderly. Uncomplicated = antibiotics (or even observation). Complicated = drainage/surgery.',
    targetImageCount: 12
  },
  {
    conditionId: 'GI__small_bowel__ileus',
    name: 'Small Bowel Obstruction (CT)',
    type: 'abdomen',
    searchTerms: ['small bowel obstruction CT', 'SBO CT abdomen', 'transition point CT', 'bowel obstruction CT'],
    correctDiagnosis: 'Small Bowel Obstruction',
    distractors: ['Ileus', 'Large bowel obstruction', 'Crohn disease'],
    visualFindings: 'Dilated proximal bowel >3cm, decompressed distal bowel, transition point, small bowel feces sign',
    clinicalContext: 'Adhesions most common. CT shows transition point and complications (strangulation, closed loop).',
    targetImageCount: 12
  },
  {
    conditionId: 'GU__glomerular_disease__glomerulonephritis',
    name: 'Kidney Stone (Ureterolithiasis)',
    type: 'abdomen',
    searchTerms: ['kidney stone CT', 'ureteral stone CT', 'ureterolithiasis CT', 'renal calculus CT'],
    correctDiagnosis: 'Ureterolithiasis',
    distractors: ['Phlebolith', 'Appendicolith', 'Calcified lymph node'],
    visualFindings: 'Hyperdense stone in ureter, hydronephrosis/hydroureter proximal, perinephric stranding, tissue rim sign',
    clinicalContext: 'Colicky flank pain, hematuria. <5mm usually pass. Alpha blockers for MET. Surgery if >10mm or infected.',
    targetImageCount: 12
  },
  {
    conditionId: 'GI__pancreas__chronic_pancreatitis',
    name: 'Acute Pancreatitis',
    type: 'abdomen',
    searchTerms: ['acute pancreatitis CT', 'pancreatic inflammation CT', 'necrotizing pancreatitis CT', 'pancreatitis CT'],
    correctDiagnosis: 'Acute Pancreatitis',
    distractors: ['Pancreatic cancer', 'Chronic pancreatitis', 'Peripancreatic abscess'],
    visualFindings: 'Pancreatic enlargement, peripancreatic fat stranding, fluid collections, lack of enhancement (necrosis)',
    clinicalContext: 'Gallstones and alcohol most common. Supportive care. CT for complications if severe or not improving.',
    targetImageCount: 12
  },
  {
    conditionId: 'GI__liver__hepatocellular_carcinoma',
    name: 'Liver Abscess',
    type: 'abdomen',
    searchTerms: ['liver abscess CT', 'hepatic abscess CT', 'pyogenic liver abscess CT'],
    correctDiagnosis: 'Liver Abscess',
    distractors: ['Hepatic cyst', 'Hepatocellular carcinoma', 'Metastasis'],
    visualFindings: 'Hypodense lesion with rim enhancement, internal septations, gas (if gas-forming organism)',
    clinicalContext: 'Pyogenic (biliary, portal) vs amebic. Antibiotics + drainage. Amebic responds to metronidazole.',
    targetImageCount: 10
  },
  {
    conditionId: 'GI__gallbladder__cholecystitis',
    name: 'Acute Cholecystitis',
    type: 'abdomen',
    searchTerms: ['acute cholecystitis CT', 'gallbladder inflammation CT', 'cholecystitis CT'],
    correctDiagnosis: 'Acute Cholecystitis',
    distractors: ['Cholelithiasis', 'Cholangitis', 'Hepatitis'],
    visualFindings: 'Gallbladder wall thickening >3mm, pericholecystic fluid/fat stranding, gallstones, + Murphy sign',
    clinicalContext: 'RUQ pain, fever, positive Murphy. Ultrasound first-line. Cholecystectomy within 72 hours ideal.',
    targetImageCount: 10
  },
  {
    conditionId: 'CV__vascular_disease__aortic_aneurysm',
    name: 'Abdominal Aortic Aneurysm',
    type: 'abdomen',
    searchTerms: ['abdominal aortic aneurysm CT', 'AAA CT', 'ruptured AAA CT'],
    correctDiagnosis: 'Abdominal Aortic Aneurysm',
    distractors: ['Aortic dissection', 'Retroperitoneal hematoma', 'Lymphadenopathy'],
    visualFindings: 'Aortic diameter >3cm, mural thrombus, calcification, retroperitoneal hemorrhage if ruptured',
    clinicalContext: 'Rupture = surgical emergency. Screen males 65-75 who smoked. Repair if >5.5cm or symptomatic.',
    targetImageCount: 12
  },
  // =========== SPINE CT ===========
  {
    conditionId: 'MSK__back__spine__compression_vertebral_fracture',
    name: 'Vertebral Compression Fracture',
    type: 'spine',
    searchTerms: ['vertebral compression fracture CT', 'spine fracture CT', 'osteoporotic fracture CT'],
    correctDiagnosis: 'Vertebral Compression Fracture',
    distractors: ['Pathologic fracture', 'Schmorl node', 'Degenerative changes'],
    visualFindings: 'Anterior wedging of vertebral body, loss of height, cortical disruption, possible retropulsion',
    clinicalContext: 'Osteoporosis common cause. Rule out malignancy. Pain management, vertebroplasty if refractory.',
    targetImageCount: 10
  },
  {
    conditionId: 'MSK__back__spine__spinal_stenosis',
    name: 'Spinal Stenosis',
    type: 'spine',
    searchTerms: ['spinal stenosis CT', 'lumbar stenosis CT', 'central canal stenosis CT'],
    correctDiagnosis: 'Spinal Stenosis',
    distractors: ['Disc herniation', 'Spondylolisthesis', 'Normal aging'],
    visualFindings: 'Narrowed central canal, facet hypertrophy, ligamentum flavum thickening, disc bulge',
    clinicalContext: 'Neurogenic claudication - worse with walking, better leaning forward. MRI better for soft tissue.',
    targetImageCount: 10
  },
  {
    conditionId: 'MSK__back__spine__spondylolisthesis',
    name: 'Spondylolisthesis (CT Spine)',
    type: 'spine',
    searchTerms: ['spondylolisthesis CT', 'cervical spine fracture CT', 'C-spine fracture CT', 'hangman fracture CT'],
    correctDiagnosis: 'Spondylolisthesis / Spine Fracture',
    distractors: ['Degenerative changes', 'Normal variant', 'Disc herniation'],
    visualFindings: 'Anterior displacement of vertebra, pars interarticularis defect, fracture line if traumatic',
    clinicalContext: 'May be degenerative or traumatic. CT for bony detail, MRI for ligamentous/cord injury.',
    targetImageCount: 12
  }
];

// ============================================================================
// WIKIMEDIA COMMONS API
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
    origin: '*'
  });

  const url = `${baseUrl}?${params.toString()}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          const results = Object.values(pages).map((page: any) => ({
            title: page.title,
            url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            originalUrl: page.imageinfo?.[0]?.url,
            description: page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '',
            license: page.imageinfo?.[0]?.extmetadata?.License?.value || 'Unknown',
            author: page.imageinfo?.[0]?.extmetadata?.Artist?.value || 'Unknown',
            mime: page.imageinfo?.[0]?.mime,
            width: page.imageinfo?.[0]?.width,
            height: page.imageinfo?.[0]?.height,
            source: 'wikimedia'
          }));
          resolve(results);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// CT-SPECIFIC SEARCH (enhanced medical terms)
// ============================================================================

async function searchCTImages(searchTerm: string, limit: number = 10): Promise<any[]> {
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} CT OR "computed tomography" OR scan filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*'
  });

  const url = `${baseUrl}?${params.toString()}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          const results = Object.values(pages).map((page: any) => ({
            title: page.title,
            url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            originalUrl: page.imageinfo?.[0]?.url,
            description: page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '',
            license: page.imageinfo?.[0]?.extmetadata?.License?.value || 'CC',
            author: page.imageinfo?.[0]?.extmetadata?.Artist?.value || 'Medical imaging',
            mime: page.imageinfo?.[0]?.mime,
            width: page.imageinfo?.[0]?.width,
            height: page.imageinfo?.[0]?.height,
            source: 'ct-specific'
          }));
          resolve(results);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// COMBINED SEARCH - Multiple Sources
// ============================================================================

async function searchAllSources(searchTerm: string, limit: number = 10): Promise<any[]> {
  const results: any[] = [];
  
  // Try CT-specific search first
  try {
    const ctResults = await searchCTImages(searchTerm, Math.ceil(limit / 2));
    results.push(...ctResults);
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.log(`    ⚠️ CT-specific search failed: ${e}`);
  }
  
  // Then general Wikimedia search
  try {
    const wikimediaResults = await searchWikimediaImages(searchTerm, limit);
    const existingUrls = new Set(results.map(r => r.originalUrl));
    const newResults = wikimediaResults.filter(r => !existingUrls.has(r.originalUrl));
    results.push(...newResults);
  } catch (e) {
    console.log(`    ⚠️ Wikimedia search failed: ${e}`);
  }
  
  return results.slice(0, limit * 2);
}

// ============================================================================
// PRE-FILTERING - Skip obviously irrelevant images before AI analysis
// ============================================================================

const CT_EXCLUSION_KEYWORDS = [
  'room', 'equipment', 'machine', 'scanner', 'hospital', 'building',
  'doctor', 'patient photo', 'nurse', 'technician', 'portrait',
  'diagram', 'illustration', 'drawing', 'cartoon', 'icon', 'logo',
  'infographic', 'chart', 'x-ray room', 'mri room', 'ecg', 'ekg',
  'photograph of', 'picture of machine'
];

function preFilterCTResult(result: any, condition: { type: string }): { pass: boolean; reason?: string } {
  const title = (result.title || '').toLowerCase();
  const description = (result.description || '').toLowerCase();
  const combined = `${title} ${description}`;
  
  for (const keyword of CT_EXCLUSION_KEYWORDS) {
    if (combined.includes(keyword)) {
      return { pass: false, reason: `Contains "${keyword}"` };
    }
  }
  
  // For head CT, reject if clearly abdominal/chest
  if (condition.type === 'head') {
    const otherTypes = ['abdomen', 'pelvis', 'liver', 'kidney', 'bowel', 'chest ct', 'lung ct'];
    for (const kw of otherTypes) {
      if (combined.includes(kw) && !combined.includes('head') && !combined.includes('brain')) {
        return { pass: false, reason: `Non-head CT (${kw})` };
      }
    }
  }
  
  return { pass: true };
}

// ============================================================================
// AI VERIFICATION - CT SPECIFIC
// ============================================================================

interface CTAnalysis {
  isValidCT: boolean;
  isActualCTImage: boolean;
  ctType: 'head' | 'chest' | 'abdomen' | 'spine' | 'other' | 'not_ct';
  appropriateWindow: boolean;
  pathologyVisible: boolean;
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  qualityScore: number;
  detectedFinding: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

// Max image size for Gemini
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

async function analyzeCTImage(imageUrl: string, condition: CTCondition, retryCount = 0): Promise<CTAnalysis | null> {
  if (!genAI) {
    console.log('⚠️ No Gemini API key - skipping AI verification');
    return null;
  }

  try {
    const imageBuffer = await fetchImageAsBuffer(imageUrl);
    
    // Skip images that are too large
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`  ⏭️ Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }
    
    // Check magic bytes
    const magicBytes = imageBuffer.slice(0, 4).toString('hex');
    const isJpeg = magicBytes.startsWith('ffd8');
    const isPng = magicBytes === '89504e47';
    if (!isJpeg && !isPng) {
      console.log(`  ⏭️ Not a valid JPEG/PNG image`);
      return null;
    }
    
    const base64Image = imageBuffer.toString('base64');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    const prompt = `You are an expert radiologist evaluating CT scan images for PA student training.

Analyze this image with STRICT criteria for CT quality:

Expected condition: ${condition.correctDiagnosis}
Expected CT type: ${condition.type}
Expected findings: ${condition.visualFindings}

Evaluate and respond in JSON format:
{
  "isValidCT": boolean,             // Is this actually a CT image?
  "isActualCTImage": boolean,       // Is this real CT (not diagram/3D render)?
  "ctType": "head|chest|abdomen|spine|other|not_ct",
  "appropriateWindow": boolean,     // Is window/level appropriate for the pathology?
  "pathologyVisible": boolean,      // Is the expected pathology clearly visible?
  "annotationLevel": "none|minimal|moderate|heavy",
  "qualityScore": number,           // 1-10 overall quality for teaching
  "detectedFinding": string,        // What pathology do you see?
  "matchesCondition": boolean,      // Does it match expected condition?
  "confidence": number,             // 0.0-1.0
  "rejectReason": string|null,
  "accept": boolean
}

STRICT CRITERIA FOR ACCEPTANCE:
- MUST be actual CT image (not illustration/3D reconstruction/diagram)
- MUST match the expected CT type
- appropriateWindow must be true
- qualityScore >= 6
- pathologyVisible should be true for the expected condition
- annotationLevel must be "none" or "minimal"
- NO cartoons, drawings, or educational diagrams

Respond ONLY with valid JSON.`;

    // Use SDK with gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2 }
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ]);

    const text = result.response.text();
    if (!text) return null;
    
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Handle rate limiting with backoff
    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota')) {
      console.log(`  ⚠️ Rate limited! Waiting ${RATE_LIMIT.rateLimitBackoffMs / 1000}s...`);
      await rateLimitedDelay(true);
      if (retryCount < 2) {
        return analyzeCTImage(imageUrl, condition, retryCount + 1);
      }
    }
    
    // Retry once on transient errors
    if (retryCount < 1 && errorMsg.includes('400')) {
      console.log(`  ⚠️ Retrying after error...`);
      await new Promise(r => setTimeout(r, 2000));
      return analyzeCTImage(imageUrl, condition, retryCount + 1);
    }
    
    console.log(`  Analysis error: ${error}`);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function fetchImageAsBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js'
      }
    };
    protocol.get(options, (res: any) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchImageAsBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function uploadToSupabase(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const storagePath = `ct/${filename}`;
  
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  
  if (error) throw new Error(`Upload failed: ${error.message}`);
  
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function checkDuplicate(conditionId: string, originalUrl: string): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: { OR: [{ conditionId, sourceUrl: originalUrl }, { originalUrl }] }
  });
  return !!existing;
}

async function saveMediaAsset(
  conditionId: string,
  publicUrl: string,
  originalUrl: string,
  condition: CTCondition,
  analysis: CTAnalysis
): Promise<void> {
  const id = crypto.randomUUID();
  
  await prisma.mediaAsset.create({
    data: {
      id,
      conditionId,
      type: 'ct',
      filename: `ct_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: ['ct', condition.type, condition.name.toLowerCase()],
      description: condition.clinicalContext,
      altText: `CT showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      aiMetadata: {
        ctType: analysis.ctType,
        detectedFinding: analysis.detectedFinding,
        qualityScore: analysis.qualityScore,
        appropriateWindow: analysis.appropriateWindow
      },
      status: 'approved',
      approvalStatus: 'approved',
      modality: 'ct',
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
      updatedAt: new Date()
    }
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function processCondition(condition: CTCondition, dryRun: boolean): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };
  
  console.log(`\n🔬 Processing: ${condition.name} (${condition.type}) - target: ${condition.targetImageCount} images`);
  
  const existingCount = await prisma.mediaAsset.count({
    where: { conditionId: condition.conditionId, type: 'ct' }
  });
  
  if (existingCount >= condition.targetImageCount) {
    console.log(`  ✓ Already have ${existingCount} images, skipping`);
    return stats;
  }
  
  const targetCount = condition.targetImageCount - existingCount;
  console.log(`  Need ${targetCount} more images (have ${existingCount})`);
  
  // Fetch more results per search for higher targets
  const resultsPerSearch = Math.min(25, Math.ceil(targetCount / condition.searchTerms.length) + 8);
  
  for (const searchTerm of condition.searchTerms) {
    if (stats.saved >= targetCount) break;
    
    console.log(`  🔍 Searching: "${searchTerm}" (fetching up to ${resultsPerSearch})`);
    
    try {
      // Use combined sources
      const results = await searchAllSources(searchTerm, resultsPerSearch);
      stats.fetched += results.length;
      console.log(`    Found ${results.length} results from all sources`);
      
      for (const result of results) {
        if (stats.saved >= targetCount) break;
        if (!result.url) continue;
        
        // Skip unsupported formats
        const urlLower = result.url.toLowerCase();
        if (urlLower.includes('.svg') || urlLower.includes('.gif') || urlLower.includes('.webp') || urlLower.includes('.tiff')) {
          console.log(`    ⏭️ Skipping unsupported format: ${result.title?.substring(0, 40)}`);
          continue;
        }
        
        if (result.mime && !['image/jpeg', 'image/png', 'image/jpg'].includes(result.mime)) {
          console.log(`    ⏭️ Skipping unsupported mime: ${result.mime}`);
          continue;
        }
        
        if (await checkDuplicate(condition.conditionId, result.originalUrl || result.url)) {
          console.log(`    ⏭️ Duplicate: ${result.title?.substring(0, 40)}`);
          continue;
        }
        
        // Pre-filter based on title/description before expensive AI call
        const preFilter = preFilterCTResult(result, condition);
        if (!preFilter.pass) {
          console.log(`    ⏭️ Pre-filtered: ${preFilter.reason} - ${result.title?.substring(0, 35)}`);
          continue;
        }
        
        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeCTImage(result.url, condition);
        
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
          const imageBuffer = await fetchImageAsBuffer(result.url);
          const filename = `ct_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
          const publicUrl = await uploadToSupabase(imageBuffer, filename, 'image/jpeg');
          await saveMediaAsset(condition.conditionId, publicUrl, result.originalUrl || result.url, condition, analysis);
          console.log(`    ✅ Saved: ${analysis.detectedFinding} (Q${analysis.qualityScore})`);
          stats.saved++;
        } catch (e) {
          console.log(`    ⚠️ Upload error: ${e}`);
          stats.errors++;
        }
        
        // Rate limit between API calls
        await rateLimitedDelay();
      }
    } catch (e) {
      console.log(`    ⚠️ Search error: ${e}`);
      stats.errors++;
    }
    
    // Rate limit between searches
    await new Promise(r => setTimeout(r, RATE_LIMIT.searchDelayMs));
  }
  
  return stats;
}

async function main() {
  console.log('🔬 CT Image Fetcher for PA Student Training\n');
  console.log('='.repeat(60));
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1]?.toLowerCase();
  const conditionFilter = args.find(a => a.startsWith('--condition='))?.split('=')[1]?.toLowerCase();
  
  if (dryRun) console.log('🔍 DRY RUN MODE\n');
  
  let conditions = CT_CONDITIONS;
  if (typeFilter) conditions = conditions.filter(c => c.type === typeFilter);
  if (conditionFilter) conditions = conditions.filter(c => c.name.toLowerCase().includes(conditionFilter));
  
  // Calculate total target images
  const totalTargetImages = conditions.reduce((sum, c) => sum + c.targetImageCount, 0);
  
  console.log(`Processing ${conditions.length} conditions (${totalTargetImages} target images)...\n`);
  
  // Verify condition IDs exist in database
  console.log('🔍 Verifying condition IDs in database...');
  const dbConditions = await prisma.condition.findMany({
    select: { id: true }
  });
  const dbConditionIds = new Set(dbConditions.map(c => c.id));
  
  const missingConditions = conditions.filter(c => !dbConditionIds.has(c.conditionId));
  if (missingConditions.length > 0) {
    console.log(`⚠️ ${missingConditions.length} condition IDs not found in database:`);
    missingConditions.forEach(c => console.log(`   - ${c.conditionId} (${c.name})`));
  }
  
  const validConditions = conditions.filter(c => dbConditionIds.has(c.conditionId));
  console.log(`✓ ${validConditions.length} conditions verified\n`);
  
  const totals = { fetched: 0, saved: 0, errors: 0 };
  
  for (const condition of validConditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched;
    totals.saved += stats.saved;
    totals.errors += stats.errors;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CT FETCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`Conditions: ${validConditions.length}/${conditions.length}`);
  console.log(`Target images: ${validConditions.reduce((sum, c) => sum + c.targetImageCount, 0)}`);
  console.log(`Fetched: ${totals.fetched} | Saved: ${totals.saved} | Errors: ${totals.errors}`);
  
  if (missingConditions.length > 0) {
    console.log(`\n⚠️ Missing condition IDs: ${missingConditions.map(c => c.conditionId).join(', ')}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
