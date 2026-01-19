#!/usr/bin/env npx tsx
/**
 * X-Ray Image Fetcher - Specialized Script
 *
 * Fetches X-ray images from Wikimedia Commons and Radiopaedia for PA student visual diagnosis training.
 * Covers Chest X-rays, MSK X-rays, and Abdominal X-rays.
 *
 * X-Ray Adequacy Criteria:
 * - Must be actual radiograph (not diagram/illustration)
 * - Adequate exposure and contrast
 * - Proper positioning visible
 * - Key anatomical landmarks identifiable
 * - Pathology clearly demonstrable
 * - Minimal annotations (labels OK, excessive arrows not OK)
 *
 * Usage:
 *   npx tsx scripts/images/fetch-xray-images.ts
 *   npx tsx scripts/images/fetch-xray-images.ts --dry-run
 *   npx tsx scripts/images/fetch-xray-images.ts --type=chest
 *   npx tsx scripts/images/fetch-xray-images.ts --condition="pneumothorax"
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as https from 'https';
import 'dotenv/config';

const prisma = new PrismaClient();

// Supabase Storage
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = 'medical-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Gemini for AI verification - use SDK like the working ECG script
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Rate limiting configuration
const RATE_LIMIT = {
  baseDelayMs: 3000, // 3 seconds between API calls
  maxDelayMs: 60000, // Max 60 second backoff
  searchDelayMs: 1500, // 1.5 seconds between searches
  rateLimitBackoffMs: 30000, // 30 second initial backoff on 429
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
  await new Promise((r) => setTimeout(r, currentBackoff));
  apiCallCount++;

  if (apiCallCount % 10 === 0) {
    console.log(`  ⏳ Periodic cooldown (${apiCallCount} API calls)...`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ============================================================================
// X-RAY CONDITIONS - High-yield for PANCE
// ============================================================================

interface XRayCondition {
  conditionId: string;
  name: string;
  type: 'chest' | 'msk' | 'abdominal';
  searchTerms: string[];
  correctDiagnosis: string;
  distractors: string[];
  visualFindings: string;
  clinicalContext: string;
  targetImageCount: number;
}

const XRAY_CONDITIONS: XRayCondition[] = [
  // =========== CHEST X-RAYS ===========
  {
    conditionId: 'PULM__pleural_disease__pneumothorax',
    name: 'Pneumothorax',
    type: 'chest',
    searchTerms: [
      'pneumothorax chest xray',
      'collapsed lung radiograph',
      'pneumothorax PA film',
      'spontaneous pneumothorax',
    ],
    correctDiagnosis: 'Pneumothorax',
    distractors: ['Skin fold artifact', 'Bullous emphysema', 'Loculated effusion'],
    visualFindings:
      'Visceral pleural line visible, absent lung markings beyond the line, may see deep sulcus sign',
    clinicalContext:
      'Can be spontaneous (tall thin males, Marfan) or traumatic. Tension PTX is emergency - decompress immediately.',
    targetImageCount: 15,
  },
  {
    conditionId: 'PULM__pleural_disease__tension_pneumothorax',
    name: 'Tension Pneumothorax',
    type: 'chest',
    searchTerms: [
      'tension pneumothorax xray',
      'mediastinal shift pneumothorax',
      'tension PTX radiograph',
    ],
    correctDiagnosis: 'Tension Pneumothorax',
    distractors: ['Simple Pneumothorax', 'Massive Hemothorax', 'Diaphragmatic hernia'],
    visualFindings:
      'Complete lung collapse, mediastinal shift AWAY from affected side, tracheal deviation, flattened hemidiaphragm',
    clinicalContext:
      'Clinical diagnosis - do NOT wait for CXR. Needle decompression 2nd ICS MCL, then chest tube.',
    targetImageCount: 10,
  },
  {
    conditionId: 'PULM__infectious__communityacquired_pneumonia',
    name: 'Lobar Pneumonia',
    type: 'chest',
    searchTerms: [
      'lobar pneumonia chest xray',
      'pneumonia consolidation radiograph',
      'bacterial pneumonia xray',
      'streptococcal pneumonia xray',
    ],
    correctDiagnosis: 'Lobar Pneumonia',
    distractors: ['Lung cancer', 'Pulmonary edema', 'Atelectasis'],
    visualFindings:
      'Dense homogeneous consolidation confined to a lobe, air bronchograms, silhouette sign',
    clinicalContext:
      'Classic for Strep pneumoniae. Look for air bronchograms. Treat with appropriate antibiotics.',
    targetImageCount: 20,
  },
  {
    conditionId: 'PULM__pleural_disease__pleural_effusion',
    name: 'Pleural Effusion',
    type: 'chest',
    searchTerms: [
      'pleural effusion chest xray',
      'fluid in lung xray',
      'blunted costophrenic angle',
      'pleural effusion radiograph',
    ],
    correctDiagnosis: 'Pleural Effusion',
    distractors: ['Elevated hemidiaphragm', 'Consolidation', 'Pleural thickening'],
    visualFindings:
      'Blunted costophrenic angle, meniscus sign, homogeneous density, mediastinal shift if large',
    clinicalContext:
      'Causes: CHF (bilateral), infection, malignancy, PE. Thoracentesis for diagnosis and treatment.',
    targetImageCount: 15,
  },
  {
    conditionId: 'CV__heart_failure__leftsided_heart_failure',
    name: 'Pulmonary Edema',
    type: 'chest',
    searchTerms: [
      'pulmonary edema chest xray',
      'CHF chest xray',
      'bat wing pulmonary edema',
      'cardiogenic pulmonary edema',
    ],
    correctDiagnosis: 'Pulmonary Edema',
    distractors: ['Bilateral Pneumonia', 'ARDS', 'Pulmonary hemorrhage'],
    visualFindings:
      'Cardiomegaly, cephalization, Kerley B lines, perihilar "bat wing" opacities, bilateral effusions',
    clinicalContext:
      'Cardiogenic vs non-cardiogenic. CHF shows cardiomegaly. Treat underlying cause, diuretics, oxygen.',
    targetImageCount: 15,
  },
  {
    conditionId: 'PULM__obstructive__chronic_obstructive_pulmonary_disease_copd',
    name: 'COPD/Emphysema',
    type: 'chest',
    searchTerms: [
      'emphysema chest xray',
      'COPD radiograph',
      'hyperinflated lungs xray',
      'flattened diaphragms xray',
    ],
    correctDiagnosis: 'COPD/Emphysema',
    distractors: ['Asthma', 'Normal hyperinflation', 'Pneumothorax'],
    visualFindings:
      'Hyperinflated lungs, flattened diaphragms, increased AP diameter, bullae, diminished vascular markings',
    clinicalContext:
      'Chronic disease from smoking. FEV1/FVC <0.7. Bronchodilators, steroids, O2 if hypoxic.',
    targetImageCount: 12,
  },
  {
    conditionId: 'PULM__infectious__tuberculosis',
    name: 'Tuberculosis',
    type: 'chest',
    searchTerms: [
      'tuberculosis chest xray',
      'TB cavitary lesion',
      'upper lobe infiltrate TB',
      'miliary tuberculosis xray',
    ],
    correctDiagnosis: 'Tuberculosis',
    distractors: ['Lung cancer', 'Pneumonia', 'Sarcoidosis'],
    visualFindings:
      'Upper lobe infiltrates, cavitary lesions, hilar adenopathy, miliary pattern (disseminated)',
    clinicalContext:
      'Active TB is airborne precautions. AFB smear/culture. RIPE therapy (Rifampin, INH, PZA, Ethambutol).',
    targetImageCount: 15,
  },
  {
    conditionId: 'PULM__oncology__non_small_cell_lung_cancer',
    name: 'Lung Cancer',
    type: 'chest',
    searchTerms: [
      'lung cancer chest xray',
      'lung mass radiograph',
      'pulmonary nodule xray',
      'hilar mass xray',
    ],
    correctDiagnosis: 'Lung Cancer',
    distractors: ['Granuloma', 'Pneumonia', 'Metastatic disease'],
    visualFindings:
      'Solitary pulmonary nodule or mass, hilar enlargement, mediastinal widening, pleural effusion',
    clinicalContext:
      'Most common cancer death. LDCT screening for high risk. Biopsy for diagnosis, stage for treatment.',
    targetImageCount: 12,
  },
  {
    conditionId: 'PULM__interstitial__sarcoidosis',
    name: 'Sarcoidosis',
    type: 'chest',
    searchTerms: [
      'sarcoidosis chest xray',
      'bilateral hilar adenopathy',
      'sarcoid radiograph',
      'interstitial lung disease xray',
    ],
    correctDiagnosis: 'Sarcoidosis',
    distractors: ['Lymphoma', 'TB', 'Lung cancer'],
    visualFindings:
      'Bilateral hilar lymphadenopathy (BHL), reticulonodular infiltrates, "potato nodes"',
    clinicalContext:
      'Non-caseating granulomas. More common in African Americans. Many resolve spontaneously. Steroids if symptomatic.',
    targetImageCount: 12,
  },
  {
    conditionId: 'PULM__critical_care__acute_respiratory_distress_syndrome_ards',
    name: 'ARDS',
    type: 'chest',
    searchTerms: [
      'ARDS chest xray',
      'acute respiratory distress syndrome radiograph',
      'bilateral infiltrates ARDS',
      'white out lungs',
    ],
    correctDiagnosis: 'Acute Respiratory Distress Syndrome (ARDS)',
    distractors: ['Cardiogenic pulmonary edema', 'Bilateral pneumonia', 'Pulmonary hemorrhage'],
    visualFindings:
      'Bilateral diffuse alveolar infiltrates, air bronchograms, NO cardiomegaly (vs CHF)',
    clinicalContext:
      'P/F ratio <300. Low tidal volume ventilation (6 mL/kg). Treat underlying cause. High mortality.',
    targetImageCount: 10,
  },
  // =========== MSK X-RAYS ===========
  {
    conditionId: 'MSK__traumafracture__colles_fracture',
    name: 'Colles Fracture',
    type: 'msk',
    searchTerms: [
      'Colles fracture xray',
      'distal radius fracture',
      'dinner fork deformity radiograph',
      'wrist fracture FOOSH',
    ],
    correctDiagnosis: 'Colles Fracture (Distal Radius Fracture)',
    distractors: ['Smith fracture', 'Barton fracture', 'Scaphoid fracture'],
    visualFindings:
      'Distal radius fracture with dorsal angulation and displacement, "dinner fork" deformity',
    clinicalContext:
      'FOOSH injury. Check for median nerve injury. Reduce and splint, ortho referral.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__traumafracture__smith_fracture',
    name: 'Smith Fracture',
    type: 'msk',
    searchTerms: [
      'Smith fracture xray',
      'reverse Colles fracture',
      'volar angulated wrist fracture',
    ],
    correctDiagnosis: 'Smith Fracture',
    distractors: ['Colles fracture', 'Barton fracture', 'Galeazzi fracture'],
    visualFindings: 'Distal radius fracture with VOLAR angulation (opposite of Colles)',
    clinicalContext:
      'Fall on back of hand or direct blow. Often unstable, may need surgical fixation.',
    targetImageCount: 10,
  },
  {
    conditionId: 'MSK__traumafracture__scaphoid_fracture',
    name: 'Scaphoid Fracture',
    type: 'msk',
    searchTerms: [
      'scaphoid fracture xray',
      'navicular fracture',
      'snuffbox tenderness xray',
      'carpal bone fracture',
    ],
    correctDiagnosis: 'Scaphoid Fracture',
    distractors: ['Lunate fracture', 'Radial styloid fracture', 'Normal variant'],
    visualFindings:
      'May be subtle initially - look for cortical irregularity, sclerotic line, may need MRI if XR negative',
    clinicalContext:
      'Anatomic snuffbox tenderness + FOOSH = treat as fracture even if XR negative. AVN risk with delayed treatment.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__traumafracture__hip_fracture',
    name: 'Hip Fracture',
    type: 'msk',
    searchTerms: [
      'hip fracture xray',
      'femoral neck fracture radiograph',
      'intertrochanteric fracture',
      'subcapital hip fracture',
    ],
    correctDiagnosis: 'Hip Fracture',
    distractors: ['Pubic ramus fracture', 'Acetabular fracture', 'Greater trochanter avulsion'],
    visualFindings:
      'Femoral neck or intertrochanteric fracture line, shortened externally rotated leg on exam',
    clinicalContext:
      'Common in elderly with osteoporosis. High mortality. Surgical fixation usually required.',
    targetImageCount: 15,
  },
  {
    conditionId: 'MSK__traumafracture__ankle_fracture_bimalleolartrimalleolar',
    name: 'Ankle Fracture',
    type: 'msk',
    searchTerms: [
      'ankle fracture xray',
      'malleolar fracture radiograph',
      'Weber ankle fracture',
      'bimalleolar fracture',
    ],
    correctDiagnosis: 'Ankle Fracture',
    distractors: ['Ankle sprain', 'Os trigonum', 'Accessory ossicle'],
    visualFindings:
      'Fracture of lateral/medial malleolus, Weber classification based on fibular fracture level',
    clinicalContext:
      'Weber A (below syndesmosis) stable, B (at level) may need surgery, C (above) usually surgical.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__traumafracture__anterior_shoulder_dislocation',
    name: 'Anterior Shoulder Dislocation',
    type: 'msk',
    searchTerms: [
      'shoulder dislocation xray',
      'anterior glenohumeral dislocation',
      'dislocated shoulder radiograph',
    ],
    correctDiagnosis: 'Anterior Shoulder Dislocation',
    distractors: ['Posterior dislocation', 'Proximal humerus fracture', 'AC separation'],
    visualFindings:
      'Humeral head anterior and inferior to glenoid, loss of normal glenohumeral alignment',
    clinicalContext:
      'Anterior 95%. Check axillary nerve function. Reduce, sling, ortho follow-up. High recurrence in young.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__traumafracture__posterior_shoulder_dislocation',
    name: 'Posterior Shoulder Dislocation',
    type: 'msk',
    searchTerms: [
      'posterior shoulder dislocation xray',
      'lightbulb sign shoulder',
      'posterior glenohumeral dislocation',
    ],
    correctDiagnosis: 'Posterior Shoulder Dislocation',
    distractors: ['Anterior dislocation', 'Proximal humerus fracture', 'Normal variant'],
    visualFindings: 'Lightbulb sign (internal rotation), loss of half-moon overlap, rim sign',
    clinicalContext:
      'Rare (5%). Associated with seizures, electrocution. Often missed on AP film - need axillary/Y view.',
    targetImageCount: 10,
  },
  {
    conditionId: 'MSK__traumafracture__clavicle_fracture',
    name: 'Clavicle Fracture',
    type: 'msk',
    searchTerms: [
      'clavicle fracture xray',
      'broken collarbone radiograph',
      'midshaft clavicle fracture',
    ],
    correctDiagnosis: 'Clavicle Fracture',
    distractors: ['AC separation', 'SC dislocation', 'Scapula fracture'],
    visualFindings: 'Fracture line (80% middle third), displacement, shortening',
    clinicalContext:
      'Common injury from fall on shoulder. Most heal with sling. Surgery if shortened >2cm or displaced.',
    targetImageCount: 10,
  },
  {
    conditionId: 'MSK__traumafracture__boxer_fracture_5th_metacarpal_neck',
    name: 'Boxer Fracture',
    type: 'msk',
    searchTerms: ['boxer fracture xray', '5th metacarpal fracture', 'metacarpal neck fracture'],
    correctDiagnosis: 'Boxer Fracture (5th Metacarpal Neck)',
    distractors: ['Bennett fracture', 'Metacarpal shaft fracture', 'Phalanx fracture'],
    visualFindings: 'Fracture of 5th metacarpal neck with volar angulation of distal fragment',
    clinicalContext:
      'Punching injury. Acceptable angulation up to 40°. Ulnar gutter splint, ortho follow-up.',
    targetImageCount: 10,
  },
  {
    conditionId: 'MSK__pediatric__salter_harris_fractures',
    name: 'Salter-Harris Fracture',
    type: 'msk',
    searchTerms: [
      'Salter Harris fracture xray',
      'growth plate fracture',
      'pediatric fracture epiphysis',
      'physis fracture',
    ],
    correctDiagnosis: 'Salter-Harris Fracture',
    distractors: ['Normal physis', 'Avulsion fracture', 'Osteochondroma'],
    visualFindings:
      'Fracture involving growth plate: Type I (through physis), II (above), III (below), IV (through), V (crush)',
    clinicalContext:
      'Pediatric fractures. SALTR mnemonic. Type II most common. Higher types have worse prognosis for growth.',
    targetImageCount: 15,
  },
  {
    conditionId: 'MSK__arthritis__osteoarthritis',
    name: 'Osteoarthritis',
    type: 'msk',
    searchTerms: [
      'osteoarthritis xray',
      'degenerative joint disease radiograph',
      'knee osteoarthritis xray',
      'hip OA xray',
    ],
    correctDiagnosis: 'Osteoarthritis',
    distractors: ['Rheumatoid arthritis', 'Gout', 'Septic arthritis'],
    visualFindings: 'Joint space narrowing, osteophytes, subchondral sclerosis, subchondral cysts',
    clinicalContext:
      'Most common arthritis. Weight-bearing joints. NSAIDs, PT, joint replacement if severe.',
    targetImageCount: 15,
  },
  {
    conditionId: 'MSK__arthritis__rheumatoid_arthritis',
    name: 'Rheumatoid Arthritis',
    type: 'msk',
    searchTerms: [
      'rheumatoid arthritis xray',
      'RA hands xray',
      'erosive arthritis radiograph',
      'MCP joint erosions',
    ],
    correctDiagnosis: 'Rheumatoid Arthritis',
    distractors: ['Osteoarthritis', 'Psoriatic arthritis', 'Gout'],
    visualFindings:
      'Symmetric erosions at MCP/PIP joints, periarticular osteopenia, ulnar deviation, swan neck/boutonniere',
    clinicalContext:
      'Autoimmune, symmetric small joint involvement. DMARDs early. RF and anti-CCP positive.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__crystal_disease__gout',
    name: 'Gout',
    type: 'msk',
    searchTerms: [
      'gout xray',
      'gouty arthritis radiograph',
      'tophaceous gout xray',
      'rat bite erosions gout',
    ],
    correctDiagnosis: 'Gout',
    distractors: ['Pseudogout', 'Septic arthritis', 'Rheumatoid arthritis'],
    visualFindings:
      'Punched out erosions with overhanging edges ("rat bite"), periarticular soft tissue (tophi), preserved joint space early',
    clinicalContext:
      'Uric acid crystals. First MTP classic (podagra). NSAIDs/colchicine acute, allopurinol chronic.',
    targetImageCount: 12,
  },
  {
    conditionId: 'MSK__oncology__osteosarcoma',
    name: 'Osteosarcoma',
    type: 'msk',
    searchTerms: [
      'osteosarcoma xray',
      'bone tumor radiograph',
      'Codman triangle xray',
      'sunburst periosteal reaction',
    ],
    correctDiagnosis: 'Osteosarcoma',
    distractors: ['Ewing sarcoma', 'Osteomyelitis', 'Osteochondroma'],
    visualFindings:
      'Mixed lytic/scite lesion, sunburst periosteal reaction, Codman triangle, soft tissue mass',
    clinicalContext:
      'Most common primary bone malignancy. Bimodal: adolescents (knee) and elderly. Chemo + surgery.',
    targetImageCount: 10,
  },
  {
    conditionId: 'MSK__oncology__ewing_sarcoma',
    name: 'Ewing Sarcoma',
    type: 'msk',
    searchTerms: [
      'Ewing sarcoma xray',
      'onion skin periosteal reaction',
      'pediatric bone tumor xray',
    ],
    correctDiagnosis: 'Ewing Sarcoma',
    distractors: ['Osteosarcoma', 'Osteomyelitis', 'Lymphoma'],
    visualFindings:
      'Permeative lytic lesion, "onion skin" periosteal reaction, diaphyseal location, soft tissue mass',
    clinicalContext:
      'Second most common pediatric bone malignancy. Can mimic osteomyelitis. Chemo + surgery/radiation.',
    targetImageCount: 12,
  },
  // =========== ABDOMINAL X-RAYS ===========
  {
    conditionId: 'GI__small_bowel__small_bowel_obstruction',
    name: 'Small Bowel Obstruction',
    type: 'abdominal',
    searchTerms: [
      'small bowel obstruction xray',
      'SBO abdominal radiograph',
      'dilated small bowel xray',
      'air fluid levels SBO',
    ],
    correctDiagnosis: 'Small Bowel Obstruction',
    distractors: ['Ileus', 'Large bowel obstruction', 'Gastric outlet obstruction'],
    visualFindings:
      'Dilated small bowel (>3cm), air-fluid levels on upright, stacked coins/valvulae conniventes, paucity of colonic gas',
    clinicalContext:
      'Adhesions most common cause. NPO, NG tube, surgery if complete or strangulated.',
    targetImageCount: 15,
  },
  {
    conditionId: 'GI__obstruction__large_bowel_obstruction',
    name: 'Large Bowel Obstruction',
    type: 'abdominal',
    searchTerms: [
      'large bowel obstruction xray',
      'LBO radiograph',
      'colonic obstruction xray',
      'cecal dilation',
    ],
    correctDiagnosis: 'Large Bowel Obstruction',
    distractors: ['Small bowel obstruction', 'Ogilvie syndrome', 'Toxic megacolon'],
    visualFindings:
      'Dilated colon (>6cm, cecum >9cm critical), haustra visible, air-fluid levels, transition point',
    clinicalContext:
      'Cancer, volvulus, diverticulitis common causes. CT for etiology. Surgery usually needed.',
    targetImageCount: 12,
  },
  {
    conditionId: 'GI__perforation__pneumoperitoneum',
    name: 'Pneumoperitoneum (Free Air)',
    type: 'abdominal',
    searchTerms: [
      'pneumoperitoneum xray',
      'free air under diaphragm',
      'perforated viscus radiograph',
      'Rigler sign',
    ],
    correctDiagnosis: 'Pneumoperitoneum (Free Intraperitoneal Air)',
    distractors: ['Chilaiditi sign', 'Subphrenic abscess', 'Basal atelectasis'],
    visualFindings:
      'Free air under diaphragm on upright CXR, Rigler sign (both sides of bowel wall visible), football sign supine',
    clinicalContext:
      'Perforated hollow viscus until proven otherwise. Surgical emergency. Upright CXR most sensitive.',
    targetImageCount: 12,
  },
  {
    conditionId: 'GI__obstruction__sigmoid_volvulus',
    name: 'Sigmoid Volvulus',
    type: 'abdominal',
    searchTerms: [
      'sigmoid volvulus xray',
      'coffee bean sign',
      'volvulus radiograph',
      'twisted sigmoid colon',
    ],
    correctDiagnosis: 'Sigmoid Volvulus',
    distractors: ['Cecal volvulus', 'Large bowel obstruction', 'Megacolon'],
    visualFindings:
      'Coffee bean or bent inner tube sign, massively dilated sigmoid pointing toward RUQ, loss of haustral markings',
    clinicalContext:
      'Common in elderly, institutionalized. Sigmoid decompression if viable, surgery if ischemic or recurrent.',
    targetImageCount: 12,
  },
  {
    conditionId: 'GI__obstruction__cecal_volvulus',
    name: 'Cecal Volvulus',
    type: 'abdominal',
    searchTerms: ['cecal volvulus xray', 'cecal volvulus radiograph', 'twisted cecum xray'],
    correctDiagnosis: 'Cecal Volvulus',
    distractors: ['Sigmoid volvulus', 'Small bowel obstruction', 'Appendicitis'],
    visualFindings:
      'Dilated cecum in LUQ or central abdomen (out of position), small bowel dilation, absent rectal gas',
    clinicalContext:
      'Less common than sigmoid. Usually needs surgery. Cannot decompress endoscopically.',
    targetImageCount: 10,
  },
  {
    conditionId: 'GI__small_bowel__ileus',
    name: 'Ileus',
    type: 'abdominal',
    searchTerms: [
      'ileus xray',
      'paralytic ileus radiograph',
      'adynamic ileus',
      'postoperative ileus',
    ],
    correctDiagnosis: 'Ileus (Paralytic)',
    distractors: ['Small bowel obstruction', 'Large bowel obstruction', 'Gastroparesis'],
    visualFindings:
      'Diffuse dilation of both small and large bowel, scattered air-fluid levels, gas throughout colon',
    clinicalContext:
      'Post-op, medications, electrolytes, sepsis. Supportive care - NPO, correct underlying cause.',
    targetImageCount: 10,
  },
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
    origin: '*',
  });

  const url = `${baseUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
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
              source: 'wikimedia',
            }));
            resolve(results);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

// ============================================================================
// RADIOPAEDIA-STYLE SEARCH (via Wikimedia medical images)
// ============================================================================

async function searchRadiologyImages(searchTerm: string, limit: number = 10): Promise<any[]> {
  // Search Wikimedia specifically for radiology/medical imaging with quality indicators
  const baseUrl = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchTerm} radiograph OR xray OR chest OR fracture filetype:bitmap`,
    gsrlimit: limit.toString(),
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  const url = `${baseUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
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
              source: 'radiology',
            }));
            resolve(results);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

// ============================================================================
// COMBINED SEARCH - Multiple Sources
// ============================================================================

async function searchAllSources(searchTerm: string, limit: number = 10): Promise<any[]> {
  const results: any[] = [];

  // Try radiology-specific search first
  try {
    const radioResults = await searchRadiologyImages(searchTerm, Math.ceil(limit / 2));
    results.push(...radioResults);
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) {
    console.log(`    ⚠️ Radiology search failed: ${e}`);
  }

  // Then general Wikimedia search
  try {
    const wikimediaResults = await searchWikimediaImages(searchTerm, limit);
    const existingUrls = new Set(results.map((r) => r.originalUrl));
    const newResults = wikimediaResults.filter((r) => !existingUrls.has(r.originalUrl));
    results.push(...newResults);
  } catch (e) {
    console.log(`    ⚠️ Wikimedia search failed: ${e}`);
  }

  return results.slice(0, limit * 2);
}

// ============================================================================
// PRE-FILTERING - Skip obviously irrelevant images before AI analysis
// ============================================================================

// Keywords that indicate image is NOT what we want (for X-rays)
const XRAY_EXCLUSION_KEYWORDS = [
  'room',
  'equipment',
  'machine',
  'scanner',
  'hospital',
  'clinic',
  'doctor',
  'patient',
  'nurse',
  'technician',
  'portrait',
  'photo of',
  'building',
  'exterior',
  'interior',
  'diagram',
  'illustration',
  'drawing',
  'cartoon',
  'icon',
  'logo',
  'symbol',
  'badge',
  'poster',
  'infographic',
  'certificate',
  'diploma',
  'award',
  'medal',
  'trophy',
];

// Keywords that suggest image IS an actual radiograph
const XRAY_INCLUSION_KEYWORDS = [
  'radiograph',
  'x-ray',
  'xray',
  'chest',
  'thorax',
  'lung',
  'pneumo',
  'fracture',
  'bone',
  'joint',
  'spine',
  'vertebra',
  'pelvis',
  'hip',
  'skull',
  'abdomen',
  'film',
  'lateral',
  'ap view',
  'pa view',
  'oblique',
];

function preFilterXRayResult(
  result: any,
  condition: { type: string; name: string }
): { pass: boolean; reason?: string } {
  const title = (result.title || '').toLowerCase();
  const description = (result.description || '').toLowerCase();
  const combined = `${title} ${description}`;

  // Check exclusion keywords
  for (const keyword of XRAY_EXCLUSION_KEYWORDS) {
    if (combined.includes(keyword)) {
      return { pass: false, reason: `Contains "${keyword}"` };
    }
  }

  // For chest X-rays, reject if clearly MSK
  if (condition.type === 'chest') {
    const mskKeywords = [
      'hand',
      'wrist',
      'finger',
      'knee',
      'ankle',
      'foot',
      'tibia',
      'fibula',
      'femur',
      'humerus',
      'radius',
      'ulna',
      'metacarpal',
      'phalanx',
    ];
    for (const kw of mskKeywords) {
      if (
        combined.includes(kw) &&
        !combined.includes('chest') &&
        !combined.includes('thorax') &&
        !combined.includes('lung')
      ) {
        return { pass: false, reason: `MSK image (${kw}) for chest condition` };
      }
    }
  }

  // For MSK X-rays, reject if clearly chest
  if (condition.type === 'msk') {
    const chestKeywords = ['pneumonia', 'pleural', 'pulmonary', 'lung', 'thorax', 'mediastin'];
    for (const kw of chestKeywords) {
      if (combined.includes(kw) && !combined.includes('fracture') && !combined.includes('bone')) {
        return { pass: false, reason: `Chest image (${kw}) for MSK condition` };
      }
    }
  }

  // Bonus: check for inclusion keywords
  const hasInclusionKeyword = XRAY_INCLUSION_KEYWORDS.some((kw) => combined.includes(kw));
  if (!hasInclusionKeyword && combined.length > 20) {
    // If no radiograph-related keywords and has a real description, might be irrelevant
    // But don't reject - just note it
  }

  return { pass: true };
}

// ============================================================================
// AI VERIFICATION - X-RAY SPECIFIC
// ============================================================================

interface XRayAnalysis {
  isValidXRay: boolean;
  isActualRadiograph: boolean;
  xrayType: 'chest' | 'msk' | 'abdominal' | 'other' | 'not_xray';
  adequateExposure: boolean;
  properPositioning: boolean;
  pathologyVisible: boolean;
  annotationLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
  qualityScore: number;
  detectedFinding: string;
  matchesCondition: boolean;
  confidence: number;
  rejectReason?: string;
  accept: boolean;
}

// Max image size for Gemini (4MB after base64 = ~3MB original)
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

async function analyzeXRayImage(
  imageUrl: string,
  condition: XRayCondition,
  retryCount = 0
): Promise<XRayAnalysis | null> {
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

    // Check magic bytes for valid image
    const magicBytes = imageBuffer.slice(0, 4).toString('hex');
    const isJpeg = magicBytes.startsWith('ffd8');
    const isPng = magicBytes === '89504e47';
    if (!isJpeg && !isPng) {
      console.log(`  ⏭️ Not a valid JPEG/PNG image`);
      return null;
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    const prompt = `You are an expert radiologist evaluating X-ray images for PA student training.

Analyze this image with STRICT criteria for X-ray quality:

Expected condition: ${condition.correctDiagnosis}
Expected X-ray type: ${condition.type}
Expected findings: ${condition.visualFindings}

Evaluate and respond in JSON format:
{
  "isValidXRay": boolean,           // Is this actually an X-ray image?
  "isActualRadiograph": boolean,    // Is this a real radiograph (not diagram)?
  "xrayType": "chest|msk|abdominal|other|not_xray",
  "adequateExposure": boolean,      // Can structures be adequately seen?
  "properPositioning": boolean,     // Is patient positioning appropriate?
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
- MUST be actual radiograph (not illustration/diagram)
- MUST match the expected X-ray type
- adequateExposure must be true
- qualityScore >= 6
- pathologyVisible should be true for the expected condition
- annotationLevel must be "none" or "minimal"
- NO cartoons, drawings, or educational diagrams

Respond ONLY with valid JSON.`;

    // Use SDK with gemini-2.5-flash (like ECG script)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text();
    if (!text) return null;

    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);

    // Handle rate limiting with backoff
    if (
      errorMsg.includes('429') ||
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.toLowerCase().includes('quota')
    ) {
      console.log(`  ⚠️ Rate limited! Waiting ${RATE_LIMIT.rateLimitBackoffMs / 1000}s...`);
      await rateLimitedDelay(true);
      if (retryCount < 2) {
        return analyzeXRayImage(imageUrl, condition, retryCount + 1);
      }
    }

    // Retry once on transient errors
    if (retryCount < 1 && errorMsg.includes('400')) {
      console.log(`  ⚠️ Retrying after error...`);
      await new Promise((r) => setTimeout(r, 2000));
      return analyzeXRayImage(imageUrl, condition, retryCount + 1);
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
        'User-Agent':
          'PANaCEa-MedicalEducation/1.0 (https://github.com/StudyPANaCEa; medical-education-app) Node.js',
      },
    };
    protocol
      .get(options, (res: any) => {
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

async function uploadToSupabase(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const storagePath = `xray/${filename}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

  return data.publicUrl;
}

async function checkDuplicate(conditionId: string, originalUrl: string): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      OR: [{ conditionId, sourceUrl: originalUrl }, { originalUrl }],
    },
  });
  return !!existing;
}

async function saveMediaAsset(
  conditionId: string,
  publicUrl: string,
  originalUrl: string,
  condition: XRayCondition,
  analysis: XRayAnalysis
): Promise<void> {
  const id = uuidv4();
  const filename = `xray_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;

  await prisma.mediaAsset.create({
    data: {
      id,
      conditionId,
      type: 'xray',
      filename,
      originalUrl: publicUrl,
      sourceUrl: originalUrl,
      tags: ['xray', condition.type, condition.name.toLowerCase()],
      description: condition.clinicalContext,
      altText: `X-ray showing ${condition.correctDiagnosis}`,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      aiMetadata: {
        xrayType: analysis.xrayType,
        detectedFinding: analysis.detectedFinding,
        qualityScore: analysis.qualityScore,
        pathologyVisible: analysis.pathologyVisible,
        adequateExposure: analysis.adequateExposure,
      },
      status: 'approved',
      approvalStatus: 'approved',
      modality: 'xray',
      explanation: condition.visualFindings,
      correctDiagnosis: condition.correctDiagnosis,
      distractors: condition.distractors,
      difficulty: 'medium',
      isClinical: true,
    } as any,
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function processCondition(
  condition: XRayCondition,
  dryRun: boolean
): Promise<{ fetched: number; saved: number; errors: number }> {
  const stats = { fetched: 0, saved: 0, errors: 0 };

  console.log(
    `\n🩻 Processing: ${condition.name} (${condition.type}) - target: ${condition.targetImageCount} images`
  );

  const existingCount = await prisma.mediaAsset.count({
    where: { conditionId: condition.conditionId, type: 'xray' },
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
        if (
          urlLower.includes('.svg') ||
          urlLower.includes('.gif') ||
          urlLower.includes('.webp') ||
          urlLower.includes('.tiff')
        ) {
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
        const preFilter = preFilterXRayResult(result, condition);
        if (!preFilter.pass) {
          console.log(
            `    ⏭️ Pre-filtered: ${preFilter.reason} - ${result.title?.substring(0, 35)}`
          );
          continue;
        }

        console.log(`    🤖 Analyzing: ${result.title?.substring(0, 40)}...`);
        const analysis = await analyzeXRayImage(result.url, condition);

        if (!analysis) {
          stats.errors++;
          continue;
        }

        if (!analysis.accept) {
          console.log(`    ❌ Rejected: ${analysis.rejectReason || 'Not suitable'}`);
          continue;
        }

        if (dryRun) {
          console.log(`    ✅ Would save: ${analysis.detectedFinding} (Q${analysis.qualityScore})`);
          stats.saved++;
          continue;
        }

        try {
          const imageBuffer = await fetchImageAsBuffer(result.url);
          const filename = `xray_${condition.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
          const publicUrl = await uploadToSupabase(imageBuffer, filename, 'image/jpeg');

          await saveMediaAsset(
            condition.conditionId,
            publicUrl,
            result.originalUrl || result.url,
            condition,
            analysis
          );

          console.log(`    ✅ Saved: ${analysis.detectedFinding} (Q${analysis.qualityScore})`);
          stats.saved++;
        } catch (uploadError) {
          console.log(`    ⚠️ Upload error: ${uploadError}`);
          stats.errors++;
        }

        // Rate limit between API calls
        await rateLimitedDelay();
      }
    } catch (searchError) {
      console.log(`    ⚠️ Search error: ${searchError}`);
      stats.errors++;
    }

    // Rate limit between searches
    await new Promise((r) => setTimeout(r, RATE_LIMIT.searchDelayMs));
  }

  return stats;
}

async function main() {
  console.log('🩻 X-Ray Image Fetcher for PA Student Training\n');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const typeFilter = args
    .find((a) => a.startsWith('--type='))
    ?.split('=')[1]
    ?.toLowerCase() as 'chest' | 'msk' | 'abdominal' | undefined;
  const conditionFilter = args
    .find((a) => a.startsWith('--condition='))
    ?.split('=')[1]
    ?.toLowerCase();

  if (dryRun) console.log('🔍 DRY RUN MODE - No images will be saved\n');

  let conditions = XRAY_CONDITIONS;
  if (typeFilter) {
    conditions = conditions.filter((c) => c.type === typeFilter);
    console.log(`Filtered to ${conditions.length} ${typeFilter} X-ray conditions\n`);
  }
  if (conditionFilter) {
    conditions = conditions.filter((c) => c.name.toLowerCase().includes(conditionFilter));
    console.log(`Filtered to ${conditions.length} conditions matching "${conditionFilter}"\n`);
  }

  console.log('Verifying condition IDs in database...');
  for (const condition of conditions) {
    const exists = await prisma.condition.findUnique({ where: { id: condition.conditionId } });
    if (!exists) console.log(`  ⚠️ Condition not found: ${condition.conditionId}`);
  }

  const totals = { fetched: 0, saved: 0, errors: 0 };

  for (const condition of conditions) {
    const stats = await processCondition(condition, dryRun);
    totals.fetched += stats.fetched;
    totals.saved += stats.saved;
    totals.errors += stats.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 X-RAY FETCH SUMMARY');
  console.log('='.repeat(60));
  console.log(`Conditions processed: ${conditions.length}`);
  console.log(`Images fetched:       ${totals.fetched}`);
  console.log(`Images saved:         ${totals.saved}`);
  console.log(`Errors:               ${totals.errors}`);

  await prisma.$disconnect();
}

main().catch(console.error);
