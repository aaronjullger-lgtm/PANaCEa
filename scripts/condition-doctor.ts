#!/usr/bin/env tsx
/**
 * CONDITION DOCTOR - Comprehensive Condition Database Curator
 *
 * Features:
 * 1. Add new high-yield conditions (2024/2025 Blueprint additions)
 * 2. Merge duplicate/triplicate conditions (cross-system deduplication)
 * 3. Fix technical formatting duplicates (snake_case normalization)
 * 4. AI-powered content generation for new conditions
 *
 * Usage:
 *   npx tsx scripts/condition-doctor.ts [options]
 *   --dry-run          Preview changes without applying
 *   --add-new          Add new conditions only
 *   --merge-dupes      Merge duplicates only
 *   --analyze          Analyze and report without changes
 *   --limit=N          Limit AI calls
 */

import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

// Load environment variables
config();

// Prisma v7 requires adapter for PostgreSQL
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}
const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==================== Configuration ====================
const MODEL_NAME = 'gemini-2.5-pro';
const apiKey = process.env.GEMINI_API_KEY || '';

let model: any = null;
if (apiKey) {
  const client = new GoogleGenerativeAI(apiKey);
  model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });
  console.log('✅ Gemini API key found');
} else {
  console.log('⚠️ No Gemini API key - will use placeholder content');
}

// ==================== Token Bucket Rate Limiter ====================
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((r) => setTimeout(r, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}
const tokenBucket = new TokenBucket(5, 0.5);

// ==================== New High-Yield Conditions (2024/2025 Updates) ====================
interface NewCondition {
  system: string;
  subcategory: string;
  condition: string;
  aliases: string[];
  relatedSystems?: string[];
  panceYield?: number;
  notes?: string;
}

const NEW_HIGH_YIELD_CONDITIONS: NewCondition[] = [
  // =====================================================
  // ORIGINAL ADDITIONS (already added)
  // =====================================================
  {
    system: 'CV',
    subcategory: 'Cardiomyopathy',
    condition: 'Stress Cardiomyopathy',
    aliases: [
      'Takotsubo Cardiomyopathy',
      'Broken Heart Syndrome',
      'Apical Ballooning Syndrome',
      'Takotsubo Syndrome',
    ],
    panceYield: 3,
    notes: 'High-yield new addition for CV - classic post-emotional stress presentation',
  },
  {
    system: 'GI',
    subcategory: 'Toxicology',
    condition: 'Cannabinoid Hyperemesis Syndrome',
    aliases: ['CHS', 'Cannabis Hyperemesis', 'Cyclic Vomiting from Cannabis'],
    relatedSystems: ['PSYCH'],
    panceYield: 3,
    notes: 'Increasingly tested - hot showers relieve symptoms buzzword',
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Mpox',
    aliases: ['Monkeypox', 'Mpox Virus Infection', 'Orthopoxvirus Infection'],
    relatedSystems: ['DERM'],
    panceYield: 3,
    notes: '2024 Blueprint addition - characteristic rash progression',
  },
  {
    system: 'ID',
    subcategory: 'Post-Infectious',
    condition: 'Long COVID',
    aliases: [
      'PASC',
      'Post-Acute Sequelae of SARS-CoV-2',
      'Post-COVID Syndrome',
      'Long-Haul COVID',
      'Post-COVID Condition',
    ],
    relatedSystems: ['PULM', 'NEURO', 'CV'],
    panceYield: 3,
    notes: 'Now a recognized clinical entity for PANCE 2024',
  },
  {
    system: 'PULM',
    subcategory: 'Toxicology',
    condition: 'EVALI',
    aliases: [
      'E-cigarette or Vaping Product Use-Associated Lung Injury',
      'Vaping-Associated Lung Injury',
      'VALI',
      'Vape Lung',
    ],
    relatedSystems: ['OTHER'],
    panceYield: 3,
    notes: 'Critical pulmonary/emergency topic - vitamin E acetate association',
  },
  {
    system: 'PSYCH',
    subcategory: 'Eating Disorders',
    condition: 'Binge Eating Disorder',
    aliases: ['BED', 'Compulsive Overeating'],
    panceYield: 3,
    notes: 'Standalone blueprint item - distinct from bulimia (no purging)',
  },
  {
    system: 'PSYCH',
    subcategory: 'Gender Identity',
    condition: 'Gender Dysphoria',
    aliases: ['Gender Identity Disorder', 'Gender Incongruence'],
    panceYield: 2,
    notes: 'Specifically listed in behavioral health updates 2024',
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Beriberi',
    aliases: ['Thiamine Deficiency', 'Vitamin B1 Deficiency', 'Wet Beriberi', 'Dry Beriberi'],
    relatedSystems: ['CV', 'NEURO'],
    panceYield: 3,
    notes: 'Wet vs Dry distinction is frequent buzzword target',
  },
  {
    system: 'PSYCH',
    subcategory: 'Substance Use - Stimulants',
    condition: 'Synthetic Cathinone Toxicity',
    aliases: [
      'Bath Salts',
      'Synthetic Cathinones',
      'Bath Salts Intoxication',
      'Flakka',
      'MDPV Toxicity',
    ],
    relatedSystems: ['OTHER'],
    panceYield: 2,
    notes: 'Toxicology/poisoning - sympathomimetic toxidrome',
  },
  {
    system: 'PSYCH',
    subcategory: 'Substance Use - Opioids',
    condition: 'Kratom Use Disorder',
    aliases: ['Kratom Toxicity', 'Mitragyna speciosa', 'Kratom Addiction', 'Kratom Dependence'],
    panceYield: 2,
    notes: 'Newer substance use topic - opioid-like effects',
  },

  // =====================================================
  // NEW PANCE 2025 HIGH-YIELD ADDITIONS
  // =====================================================
  {
    system: 'PULM',
    subcategory: 'Pediatric',
    condition: 'Bronchiolitis',
    aliases: [
      'RSV Bronchiolitis',
      'Respiratory Syncytial Virus Bronchiolitis',
      'Viral Bronchiolitis',
    ],
    panceYield: 3,
    notes: 'RSV focus - supportive care, wheezing in infants < 2 years',
  },
  {
    system: 'ID',
    subcategory: 'Viral',
    condition: 'Hand-Foot-and-Mouth Disease',
    aliases: ['HFMD', 'Coxsackievirus A16', 'Enterovirus Infection', 'Hand Foot Mouth'],
    relatedSystems: ['DERM'],
    panceYield: 3,
    notes: 'Coxsackievirus - oral ulcers + vesicular rash on palms/soles',
  },
  {
    system: 'MSK',
    subcategory: 'Trauma/Fracture',
    condition: 'Boxer Fracture',
    aliases: ['Fifth Metacarpal Fracture', '5th Metacarpal Neck Fracture', 'Brawler Fracture'],
    panceYield: 3,
    notes: '5th metacarpal neck fracture - classic mechanism: punching with closed fist',
  },
  {
    system: 'HEENT',
    subcategory: 'Eye - Glaucoma',
    condition: 'Acute Angle-Closure Glaucoma',
    aliases: ['AACG', 'Closed-Angle Glaucoma', 'Narrow-Angle Glaucoma', 'Acute Glaucoma'],
    panceYield: 3,
    notes: 'Emergency - mid-dilated pupil, halos, rock-hard eye, immediate IOP lowering',
  },
  {
    system: 'GI',
    subcategory: 'Hepatic',
    condition: 'Spontaneous Bacterial Peritonitis',
    aliases: ['SBP', 'Primary Bacterial Peritonitis'],
    relatedSystems: ['ID'],
    panceYield: 3,
    notes: 'ANC > 250, Cefotaxime treatment, cirrhosis complication',
  },
  {
    system: 'CV',
    subcategory: 'Arrhythmia',
    condition: 'Multifocal Atrial Tachycardia',
    aliases: ['MAT', 'Chaotic Atrial Tachycardia', 'Wandering Atrial Pacemaker'],
    panceYield: 2,
    notes: '3+ P wave morphologies, irregular, associated with COPD/hypoxia',
  },
  {
    system: 'GI',
    subcategory: 'Nutrition',
    condition: 'Refeeding Syndrome',
    aliases: ['Refeeding Hypophosphatemia'],
    relatedSystems: ['ENDO'],
    panceYield: 3,
    notes: 'Hypophosphatemia focus - malnourished patients, slow refeeding, monitor electrolytes',
  },
  {
    system: 'NEURO',
    subcategory: 'Spine',
    condition: 'Conus Medullaris Syndrome',
    aliases: ['Conus Syndrome'],
    panceYield: 3,
    notes: 'Differential for Cauda Equina - sudden onset, symmetric, early bladder dysfunction',
  },
  {
    system: 'OTHER',
    subcategory: 'Emergency Medicine',
    condition: 'Mass Casualty Triage',
    aliases: ['START Triage', 'Mass Casualty Incident Triage', 'MCI Triage', 'Disaster Triage'],
    panceYield: 2,
    notes: 'START Algorithm: Red (Immediate), Yellow (Delayed), Green (Minor), Black (Deceased)',
  },

  // =====================================================
  // USPSTF SCREENING GUIDELINES (Clinical Entries)
  // =====================================================
  {
    system: 'OTHER',
    subcategory: 'Preventive Medicine',
    condition: 'Lung Cancer Screening',
    aliases: ['LDCT Screening', 'Low-Dose CT Screening', 'Lung Cancer USPSTF'],
    relatedSystems: ['PULM'],
    panceYield: 3,
    notes:
      'USPSTF: Annual low-dose CT for adults 50-80 with 20+ pack-year history, currently smoking or quit within 15 years',
  },
  {
    system: 'OTHER',
    subcategory: 'Preventive Medicine',
    condition: 'Abdominal Aortic Aneurysm Screening',
    aliases: ['AAA Screening', 'Aortic Aneurysm Screening', 'AAA USPSTF'],
    relatedSystems: ['CV'],
    panceYield: 3,
    notes: 'USPSTF: One-time ultrasound for men 65-75 who have ever smoked',
  },
  {
    system: 'OTHER',
    subcategory: 'Preventive Medicine',
    condition: 'Colorectal Cancer Screening',
    aliases: ['CRC Screening', 'Colon Cancer Screening', 'Colonoscopy Screening', 'FIT Testing'],
    relatedSystems: ['GI'],
    panceYield: 3,
    notes: 'USPSTF: Age 45-75, colonoscopy q10y, FIT annually, or CT colonography q5y',
  },
  {
    system: 'OTHER',
    subcategory: 'Preventive Medicine',
    condition: 'Osteoporosis Screening',
    aliases: ['DEXA Screening', 'Bone Density Screening', 'DXA Screening', 'Osteoporosis USPSTF'],
    relatedSystems: ['MSK', 'ENDO'],
    panceYield: 3,
    notes: 'USPSTF: Women 65+, or postmenopausal women <65 with risk factors (FRAX)',
  },
];

// ==================== Accented Name Standardization ====================
// Map informal/anglicized spellings to proper accented forms (word boundaries enforced)
const ACCENTED_NAME_CORRECTIONS: Array<{
  informal: string;
  formal: string;
  wholeWordOnly: boolean;
}> = [
  // Eponymous syndromes with diacritics - must be whole word matches
  { informal: 'Sjogren', formal: 'Sjögren', wholeWordOnly: true },
  { informal: 'Meniere', formal: 'Ménière', wholeWordOnly: true },
  { informal: 'Guillain-Barre', formal: 'Guillain-Barré', wholeWordOnly: true },
  { informal: 'Behcet', formal: 'Behçet', wholeWordOnly: true },
  { informal: 'Lofgren', formal: 'Löfgren', wholeWordOnly: true },

  // Apostrophe standardization - only fix missing apostrophes, not add to already-correct ones
  // These need very careful matching to avoid breaking other words
  { informal: 'Hashimoto Thyroiditis', formal: "Hashimoto's Thyroiditis", wholeWordOnly: false },
  { informal: 'Paget Disease', formal: "Paget's Disease", wholeWordOnly: false },
  { informal: 'Crohn Disease', formal: "Crohn's Disease", wholeWordOnly: false },
  { informal: 'Addison Disease', formal: "Addison's Disease", wholeWordOnly: false },
  { informal: 'Cushing Disease', formal: "Cushing's Disease", wholeWordOnly: false },
  { informal: 'Cushing Syndrome', formal: "Cushing's Syndrome", wholeWordOnly: false },
  { informal: 'Parkinson Disease', formal: "Parkinson's Disease", wholeWordOnly: false },
  { informal: 'Alzheimer Disease', formal: "Alzheimer's Disease", wholeWordOnly: false },
  { informal: 'Bell Palsy', formal: "Bell's Palsy", wholeWordOnly: false },
  { informal: 'Graves Disease', formal: "Graves' Disease", wholeWordOnly: false },
];

// ==================== Duplicate/Triplicate Groups to Merge ====================
interface DuplicateGroup {
  canonicalName: string;
  canonicalSystem: string;
  canonicalSubcategory: string;
  relatedSystems: string[];
  conditionIds: string[]; // All conditionIds to merge (first one kept as primary)
  aliases?: string[];
}

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  // =====================================================
  // TRIPLICATES (3 entries each)
  // =====================================================
  {
    canonicalName: 'Community-Acquired Pneumonia',
    canonicalSystem: 'PULM',
    canonicalSubcategory: 'Infectious',
    relatedSystems: ['ID'],
    conditionIds: [
      'PULM__infectious__community_acquired_pneumonia',
      'PULM__infectious__communityacquired_pneumonia',
      'ID__respiratory__communityacquired_pneumonia',
    ],
    aliases: ['CAP', 'Walking Pneumonia'],
  },
  {
    canonicalName: 'Hospital-Acquired Pneumonia',
    canonicalSystem: 'PULM',
    canonicalSubcategory: 'Infectious',
    relatedSystems: ['ID'],
    conditionIds: [
      'PULM__infectious__hospital_acquired_pneumonia',
      'PULM__infectious__hospitalacquired_pneumonia',
      'ID__respiratory__hospitalacquired_pneumonia',
    ],
    aliases: ['HAP', 'Nosocomial Pneumonia', 'Healthcare-Associated Pneumonia'],
  },

  // =====================================================
  // HIGH-YIELD DUPLICATES (2 entries each)
  // =====================================================
  {
    canonicalName: 'Acute Kidney Injury',
    canonicalSystem: 'RENAL',
    canonicalSubcategory: 'Acute Kidney Injury',
    relatedSystems: ['GU'],
    conditionIds: ['GU__acute_renal_failure', 'RENAL__aki'],
    aliases: ['AKI', 'Acute Renal Failure', 'ARF'],
  },
  {
    canonicalName: 'Carpal Tunnel Syndrome',
    canonicalSystem: 'MSK',
    canonicalSubcategory: 'Soft Tissue/Overuse',
    relatedSystems: ['NEURO'],
    conditionIds: ['MSK__soft_tissueoveruse', 'NEURO__peripheral_neuropathy'],
    aliases: ['CTS', 'Median Nerve Compression'],
  },
  {
    canonicalName: 'Cellulitis',
    canonicalSystem: 'DERM',
    canonicalSubcategory: 'Infectious',
    relatedSystems: ['ID'],
    conditionIds: ['ID__bacterial', 'DERM__infectious'],
    aliases: ['Skin Infection', 'Soft Tissue Infection'],
  },
  {
    canonicalName: 'Chronic Kidney Disease',
    canonicalSystem: 'RENAL',
    canonicalSubcategory: 'Chronic Kidney Disease',
    relatedSystems: ['GU'],
    conditionIds: ['GU__chronic_renal_failure', 'RENAL__ckd'],
    aliases: ['CKD', 'Chronic Renal Failure', 'End-Stage Renal Disease', 'ESRD'],
  },
  {
    canonicalName: 'Delirium',
    canonicalSystem: 'PSYCH',
    canonicalSubcategory: 'Neurocognitive Disorders',
    relatedSystems: ['NEURO'],
    conditionIds: ['PSYCH__neurocognitive_disorders', 'NEURO__cognitive'],
    aliases: ['Acute Confusional State', 'Encephalopathy', 'Altered Mental Status'],
  },
  {
    canonicalName: 'Giant Cell Arteritis',
    canonicalSystem: 'CV',
    canonicalSubcategory: 'Vascular Disease',
    relatedSystems: ['HEENT', 'MSK'],
    conditionIds: ['HEENT__eye_vision_systemic', 'CV__vascular_disease'],
    aliases: ['GCA', 'Temporal Arteritis', 'Cranial Arteritis', 'Horton Disease'],
  },
  {
    canonicalName: 'Pelvic Inflammatory Disease',
    canonicalSystem: 'REPRO',
    canonicalSubcategory: 'Gynecology',
    relatedSystems: ['ID'],
    conditionIds: ['REPRO__gynecology', 'ID__sti'],
    aliases: ['PID', 'Salpingitis', 'Tubo-ovarian Abscess'],
  },
  {
    canonicalName: 'Prostate Cancer',
    canonicalSystem: 'GU',
    canonicalSubcategory: 'Oncology',
    relatedSystems: [],
    conditionIds: ['GU__prostate', 'GU__oncology'],
    aliases: ['Prostatic Carcinoma', 'Prostate Adenocarcinoma'],
  },
  {
    canonicalName: 'Tardive Dyskinesia',
    canonicalSystem: 'NEURO',
    canonicalSubcategory: 'Movement Disorders',
    relatedSystems: ['PSYCH'],
    conditionIds: ['PSYCH__medication_induced_movement_disorders', 'NEURO__movement_disorders'],
    aliases: ['TD', 'Antipsychotic-Induced Movement Disorder'],
  },
];

// ==================== Technical Formatting Duplicates ====================
// These are duplicates caused by inconsistent snake_case formatting
const FORMATTING_DUPLICATE_PATTERNS: Array<{
  correctPattern: string;
  incorrectPatterns: string[];
  description: string;
}> = [
  {
    correctPattern: 'av_nodal_reentry',
    incorrectPatterns: ['av_nodal_re_entry'],
    description: 'AVNRT naming',
  },
  {
    correctPattern: 'wolff_parkinson_white',
    incorrectPatterns: ['wolffparkinsonwhite'],
    description: 'WPW Syndrome naming',
  },
  {
    correctPattern: 'first_degree',
    incorrectPatterns: ['firstdegree', 'first-degree'],
    description: 'AV Block degree naming',
  },
  {
    correctPattern: 'second_degree',
    incorrectPatterns: ['seconddegree', 'second-degree'],
    description: 'AV Block degree naming',
  },
  {
    correctPattern: 'third_degree',
    incorrectPatterns: ['thirddegree', 'third-degree'],
    description: 'AV Block degree naming',
  },
  {
    correctPattern: 'non_small_cell',
    incorrectPatterns: ['nonsmall_cell', 'non-small_cell', 'nonsmallcell'],
    description: 'NSCLC naming',
  },
];

// ==================== Additional Duplicates List ====================
// These need to be detected and merged based on condition name similarity
const KNOWN_DUPLICATE_CONDITIONS = [
  'Abnormal Uterine Bleeding',
  'Achilles Tendon Rupture',
  'Acute Arterial Occlusion',
  'Acute Interstitial Nephritis',
  'Asbestosis',
  'Autism Spectrum Disorder',
  'Bladder Cancer',
  'Brain Abscess',
  'Cauda Equina Syndrome',
  'De Quervain Tenosynovitis',
  'Diabetic Nephropathy',
  'Encephalitis',
  'Epiglottitis',
  'Erectile Dysfunction',
  'Erysipelas',
  'Ewing Sarcoma',
  'Folliculitis',
  'Giant Cell Arteritis', // Remaining duplicate
  'Herpes Zoster',
  'Hidradenitis Suppurativa',
  'High-Output Heart Failure',
  'Hirsutism',
  'Impetigo',
  'Insulinoma',
  'Kawasaki Disease',
  'Left-Sided Heart Failure',
  'Pediculosis',
  'Nursemaid Elbow',
  'Obesity',
  'Occupational Lung Disease',
  'Osteosarcoma',
  'Pelvic Inflammatory Disease', // Remaining duplicate
  'Penile Cancer',
  'Polycystic Kidney Disease',
  'Polycystic Ovary Syndrome',
  'Premenstrual Dysphoric Disorder',
  'Raynaud', // Remaining duplicate (matches Raynaud's Disease and Raynaud Disease)
  'Renal Cell Carcinoma',
  'Right-Sided Heart Failure',
  'Silicosis',
  'Smoke Inhalation Injury',
  'Testicular Cancer',
  'Tourette Syndrome',
  'Transposition of the Great Arteries',
  'Trichomoniasis',
  'Tuberous Sclerosis',
  'Varicella',
  'Viral Meningitis',
];

// ==================== Helper Functions ====================

function generateConditionId(system: string, subcategory: string, condition: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  return `${system}__${normalize(subcategory)}__${normalize(condition)}`;
}

function normalizeConditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==================== Accented Name Standardization ====================
// Map of conditions that should use formal accented spelling
const ACCENTED_NAME_MAP: Record<string, string> = {
  'sjogren syndrome': 'Sjögren Syndrome',
  'sjogrens syndrome': 'Sjögren Syndrome',
  "sjogren's syndrome": 'Sjögren Syndrome',
  'meniere disease': 'Ménière Disease',
  'menieres disease': 'Ménière Disease',
  "meniere's disease": 'Ménière Disease',
  'guillain barre syndrome': 'Guillain-Barré Syndrome',
  'guillain-barre syndrome': 'Guillain-Barré Syndrome',
  'guillainbarre syndrome': 'Guillain-Barré Syndrome',
  'behcet disease': 'Behçet Disease',
  'behcets disease': 'Behçet Disease',
  "behcet's disease": 'Behçet Disease',
  'crohn disease': 'Crohn Disease',
  'crohns disease': 'Crohn Disease',
  "crohn's disease": 'Crohn Disease',
  'grave disease': 'Graves Disease',
  'graves disease': 'Graves Disease',
  "grave's disease": 'Graves Disease',
  'hashimoto thyroiditis': 'Hashimoto Thyroiditis',
  'hashimotos thyroiditis': 'Hashimoto Thyroiditis',
  "hashimoto's thyroiditis": 'Hashimoto Thyroiditis',
  'tourette syndrome': 'Tourette Syndrome',
  'tourettes syndrome': 'Tourette Syndrome',
  "tourette's syndrome": 'Tourette Syndrome',
  'kawasaki disease': 'Kawasaki Disease',
  'kawasakis disease': 'Kawasaki Disease',
  'parkinson disease': 'Parkinson Disease',
  'parkinsons disease': 'Parkinson Disease',
  "parkinson's disease": 'Parkinson Disease',
  'alzheimer disease': 'Alzheimer Disease',
  'alzheimers disease': 'Alzheimer Disease',
  "alzheimer's disease": 'Alzheimer Disease',
  'hodgkin lymphoma': 'Hodgkin Lymphoma',
  'hodgkins lymphoma': 'Hodgkin Lymphoma',
  "hodgkin's lymphoma": 'Hodgkin Lymphoma',
  'raynaud disease': 'Raynaud Disease',
  'raynauds disease': 'Raynaud Disease',
  "raynaud's disease": 'Raynaud Disease',
  'paget disease': 'Paget Disease',
  'pagets disease': 'Paget Disease',
  "paget's disease": 'Paget Disease',
  'addison disease': 'Addison Disease',
  'addisons disease': 'Addison Disease',
  "addison's disease": 'Addison Disease',
  'cushing syndrome': 'Cushing Syndrome',
  'cushings syndrome': 'Cushing Syndrome',
  "cushing's syndrome": 'Cushing Syndrome',
  'bell palsy': 'Bell Palsy',
  'bells palsy': 'Bell Palsy',
  "bell's palsy": 'Bell Palsy',
  'wernicke encephalopathy': 'Wernicke Encephalopathy',
  'wernickes encephalopathy': 'Wernicke Encephalopathy',
  'korsakoff syndrome': 'Korsakoff Syndrome',
  'korsakoffs syndrome': 'Korsakoff Syndrome',
  'peutz jeghers syndrome': 'Peutz-Jeghers Syndrome',
  'peutzjeghers syndrome': 'Peutz-Jeghers Syndrome',
  'dupuytren contracture': 'Dupuytren Contracture',
  'dupuytrens contracture': 'Dupuytren Contracture',
  "dupuytren's contracture": 'Dupuytren Contracture',
};

function standardizeAccentedName(name: string): string {
  const normalized = name.toLowerCase().replace(/['']/g, "'").trim();
  return ACCENTED_NAME_MAP[normalized] || name;
}

// ==================== Deep Merge Function ====================
// Merges content from multiple records, keeping the best data from each
function deepMergeContent(records: any[]): {
  buzzwords: string[];
  clinical_pearls: any;
  gold_standard_dx: string | null;
  first_line_rx: string | null;
  best_initial_test: string | null;
  overview: string | null;
  pathophysiology: string | null;
  diagnostics: string | null;
  treatment: string | null;
} {
  // Collect and dedupe buzzwords from all records
  const allBuzzwords = new Set<string>();
  records.forEach((r) => {
    if (r.buzzwords && Array.isArray(r.buzzwords)) {
      r.buzzwords.forEach((b: string) => allBuzzwords.add(b));
    }
  });

  // Collect clinical pearls from all records
  let mergedPearls: string[] = [];
  records.forEach((r) => {
    if (r.clinical_pearls) {
      if (Array.isArray(r.clinical_pearls)) {
        mergedPearls.push(...r.clinical_pearls);
      } else if (typeof r.clinical_pearls === 'object') {
        // Handle JSON object format
        const pearls = Object.values(r.clinical_pearls).flat();
        mergedPearls.push(...pearls.filter((p): p is string => typeof p === 'string'));
      }
    }
  });
  mergedPearls = [...new Set(mergedPearls)]; // Dedupe

  // Get the most detailed gold_standard_dx (longest non-null)
  const goldStandards = records
    .map((r) => r.gold_standard_dx)
    .filter((g) => g && typeof g === 'string' && g.trim().length > 0);
  const bestGoldStandard = goldStandards.sort((a, b) => b.length - a.length)[0] || null;

  // Get the most detailed first_line_rx
  const firstLineRxs = records
    .map((r) => r.first_line_rx)
    .filter((f) => f && typeof f === 'string' && f.trim().length > 0);
  const bestFirstLineRx = firstLineRxs.sort((a, b) => b.length - a.length)[0] || null;

  // Get the best initial test
  const bestInitialTests = records
    .map((r) => r.best_initial_test)
    .filter((t) => t && typeof t === 'string' && t.trim().length > 0);
  const bestInitialTest = bestInitialTests.sort((a, b) => b.length - a.length)[0] || null;

  // Get longest overview, pathophysiology, diagnostics, treatment
  const getLongest = (field: string) => {
    const values = records
      .map((r) => r[field])
      .filter((v) => v && typeof v === 'string' && v.trim().length > 50);
    return values.sort((a, b) => b.length - a.length)[0] || null;
  };

  return {
    buzzwords: [...allBuzzwords],
    clinical_pearls: mergedPearls.length > 0 ? mergedPearls : null,
    gold_standard_dx: bestGoldStandard,
    first_line_rx: bestFirstLineRx,
    best_initial_test: bestInitialTest,
    overview: getLongest('overview'),
    pathophysiology: getLongest('pathophysiology'),
    diagnostics: getLongest('diagnostics'),
    treatment: getLongest('treatment'),
  };
}

// ==================== AI Content Generation ====================

async function generateConditionContent(condition: NewCondition): Promise<any> {
  if (!model) {
    return generatePlaceholderContent(condition);
  }

  const prompt = `You are a PANCE exam content expert. Generate comprehensive, board-exam-level medical content for this condition.

CONDITION: ${condition.condition}
SYSTEM: ${condition.system}
SUBCATEGORY: ${condition.subcategory}
ALIASES: ${condition.aliases.join(', ')}
${condition.notes ? `CONTEXT: ${condition.notes}` : ''}

Generate a JSON object with these fields:
{
  "overview": "2-3 paragraph comprehensive overview including definition and clinical significance",
  "etiology": "Causes and risk factors",
  "pathophysiology": "Disease mechanism - be specific and testable",
  "epidemiology": "Incidence, prevalence, demographics",
  "symptoms": "Markdown bullet list of symptoms",
  "physicalExam": "Markdown bullet list of exam findings",
  "diagnostics": "Diagnostic workup including labs, imaging, and criteria",
  "treatment": "First-line and alternative treatments",
  "prognosis": "Expected outcomes",
  "complications": "Potential complications",
  "differentialDiagnosis": "Key differentials",
  "riskFactors": "Risk factors as markdown list",
  "buzzwords": ["Array of 3-5 HIGH-YIELD buzzwords for board recognition"],
  "classic_patient": "Classic patient vignette in quotes (e.g., 'Young woman with chest pain after emotional stress')",
  "gold_standard_dx": "Gold standard diagnostic test (< 8 words)",
  "first_line_rx": "First-line treatment (< 8 words)",
  "best_initial_test": "Best initial test",
  "clinical_pearls": ["Array of 2-3 high-yield clinical pearls"]
}

IMPORTANT:
- Content should be PANCE-exam focused and high-yield
- Include testable facts and classic presentations
- Buzzwords should be pathognomonic findings
- Return ONLY valid JSON`;

  try {
    await tokenBucket.acquire();
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\n?|```/g, '')
      .trim();
    return JSON.parse(text);
  } catch (err: any) {
    console.error(`   ❌ AI error: ${err.message}`);
    return generatePlaceholderContent(condition);
  }
}

function generatePlaceholderContent(condition: NewCondition): any {
  return {
    overview: `${condition.condition} is a condition classified under ${condition.system} (${condition.subcategory}). ${condition.notes || 'Content to be generated.'}`,
    etiology: 'Etiology to be generated.',
    pathophysiology: 'Pathophysiology to be generated.',
    epidemiology: 'Epidemiology to be generated.',
    symptoms: '- Symptoms to be generated',
    physicalExam: '- Physical exam findings to be generated',
    diagnostics: 'Diagnostic workup to be generated.',
    treatment: 'Treatment to be generated.',
    prognosis: 'Prognosis to be generated.',
    complications: 'Complications to be generated.',
    differentialDiagnosis: 'Differential diagnosis to be generated.',
    riskFactors: '- Risk factors to be generated',
    buzzwords: [],
    classic_patient: null,
    gold_standard_dx: null,
    first_line_rx: null,
    best_initial_test: null,
    clinical_pearls: [],
  };
}

// ==================== Phase 1: Add New Conditions ====================

async function addNewConditions(dryRun: boolean): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🆕 PHASE 1: ADD NEW HIGH-YIELD CONDITIONS');
  console.log('═'.repeat(70));

  let added = 0;
  let skipped = 0;

  for (const condition of NEW_HIGH_YIELD_CONDITIONS) {
    const conditionId = generateConditionId(
      condition.system,
      condition.subcategory,
      condition.condition
    );

    // Check if exists in MedicalContent
    const existsContent = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    // Check if exists in Condition table
    const existsCondition = await prisma.condition.findFirst({
      where: {
        OR: [
          { name: { equals: condition.condition, mode: 'insensitive' } },
          { aliases: { has: condition.condition } },
        ],
      },
    });

    if (existsContent || existsCondition) {
      console.log(`   ⏭️ ${condition.condition} - already exists`);
      skipped++;
      continue;
    }

    console.log(`\n   🆕 Adding: ${condition.condition}`);
    console.log(`      System: ${condition.system} | Subcategory: ${condition.subcategory}`);
    console.log(`      Aliases: ${condition.aliases.join(', ')}`);
    if (condition.notes) console.log(`      Notes: ${condition.notes}`);

    if (!dryRun) {
      // Generate content
      const content = await generateConditionContent(condition);

      // Create in MedicalContent table
      try {
        await prisma.medicalContent.create({
          data: {
            id: uuidv4(),
            conditionId,
            system: condition.system,
            subcategory: condition.subcategory,
            condition: condition.condition,
            relatedSystems: condition.relatedSystems || [],
            overview: content.overview,
            etiology: content.etiology,
            pathophysiology: content.pathophysiology,
            epidemiology: content.epidemiology,
            symptoms: content.symptoms,
            physicalExam: content.physicalExam,
            diagnostics: content.diagnostics,
            treatment: content.treatment,
            prognosis: content.prognosis,
            complications: content.complications,
            differentialDiagnosis: content.differentialDiagnosis,
            riskFactors: content.riskFactors,
            buzzwords: content.buzzwords || [],
            classic_patient: content.classic_patient,
            gold_standard_dx: content.gold_standard_dx,
            first_line_rx: content.first_line_rx,
            best_initial_test: content.best_initial_test,
            clinical_pearls: content.clinical_pearls,
            pance_yield: condition.panceYield || 2,
            synonyms: condition.aliases,
            status: 'published',
            createdBy: 'condition-doctor',
            updatedBy: 'condition-doctor',
          } as any,
        });
        console.log(`      ✅ Created in MedicalContent`);
      } catch (e: any) {
        console.log(`      ❌ MedicalContent error: ${e.message}`);
      }

      // Create in Condition table
      try {
        await prisma.condition.create({
          data: {
            id: uuidv4(),
            name: condition.condition,
            system: condition.system,
            subcategory: condition.subcategory,
            relatedSystems: condition.relatedSystems || [],
            displayName: condition.condition,
            aliases: condition.aliases,
            status: 'published',
          } as any,
        });
        console.log(`      ✅ Created in Condition table`);
      } catch (e: any) {
        console.log(`      ❌ Condition table error: ${e.message}`);
      }

      added++;
    } else {
      console.log(`      [DRY RUN] Would create condition`);
      added++;
    }
  }

  console.log(`\n   Summary: ${added} added, ${skipped} skipped`);
  return added;
}

// ==================== Phase 2: Merge Duplicates ====================

async function mergeDuplicates(dryRun: boolean): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔄 PHASE 2: MERGE DUPLICATE/TRIPLICATE CONDITIONS');
  console.log('═'.repeat(70));

  let merged = 0;

  for (const group of DUPLICATE_GROUPS) {
    console.log(`\n   📋 ${group.canonicalName}`);
    console.log(`      Merging ${group.conditionIds.length} records → ${group.canonicalSystem}`);

    // Find all matching records in MedicalContent
    const records = await prisma.medicalContent.findMany({
      where: {
        OR: [
          { conditionId: { in: group.conditionIds } },
          { condition: { equals: group.canonicalName, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (records.length === 0) {
      console.log(`      ⚠️ No records found`);
      continue;
    }

    if (records.length === 1) {
      console.log(`      ✓ Already single record`);
      // Just update the record with relatedSystems
      if (!dryRun) {
        await prisma.medicalContent.update({
          where: { id: records[0].id },
          data: {
            relatedSystems: [...new Set([...records[0].relatedSystems, ...group.relatedSystems])],
          },
        });
      }
      continue;
    }

    console.log(`      Found ${records.length} records to merge:`);
    for (const r of records) {
      console.log(`        - ${r.conditionId} (${r.system})`);
    }

    // Pick the most complete record as primary
    const primary = records[0]; // Already sorted by updatedAt
    const duplicates = records.slice(1);

    if (!dryRun) {
      // DEEP MERGE - combine best content from all records
      const mergedContent = deepMergeContent(records);
      const allRelatedSystems = [
        ...new Set([...records.flatMap((r) => r.relatedSystems), ...group.relatedSystems]),
      ];

      // Update primary record
      const canonicalConditionId = generateConditionId(
        group.canonicalSystem,
        group.canonicalSubcategory,
        group.canonicalName
      );

      // Check if canonical ID already exists (avoid collision)
      const existingCanonical = await prisma.medicalContent.findUnique({
        where: { conditionId: canonicalConditionId },
      });

      if (existingCanonical && existingCanonical.id !== primary.id) {
        // Deep merge into existing canonical
        const existingMerged = deepMergeContent([existingCanonical, ...records]);
        await prisma.medicalContent.update({
          where: { id: existingCanonical.id },
          data: {
            relatedSystems: allRelatedSystems,
            buzzwords: existingMerged.buzzwords,
            clinical_pearls: existingMerged.clinical_pearls,
            gold_standard_dx: existingMerged.gold_standard_dx,
            first_line_rx: existingMerged.first_line_rx,
            best_initial_test: existingMerged.best_initial_test,
            overview: existingMerged.overview || existingCanonical.overview,
            pathophysiology: existingMerged.pathophysiology || existingCanonical.pathophysiology,
            diagnostics: existingMerged.diagnostics || existingCanonical.diagnostics,
            treatment: existingMerged.treatment || existingCanonical.treatment,
            updatedBy: 'condition-doctor',
          },
        });
        // Delete all duplicates including primary
        await prisma.medicalContent.deleteMany({
          where: { id: { in: records.map((r) => r.id) } },
        });
        console.log(`      🔀 Deep merged into existing canonical`);
      } else {
        // Update primary with canonical ID and deep merged data
        try {
          await prisma.medicalContent.update({
            where: { id: primary.id },
            data: {
              conditionId: canonicalConditionId,
              condition: group.canonicalName,
              system: group.canonicalSystem,
              subcategory: group.canonicalSubcategory,
              relatedSystems: allRelatedSystems,
              buzzwords: mergedContent.buzzwords,
              clinical_pearls: mergedContent.clinical_pearls,
              gold_standard_dx: mergedContent.gold_standard_dx || primary.gold_standard_dx,
              first_line_rx: mergedContent.first_line_rx || primary.first_line_rx,
              best_initial_test: mergedContent.best_initial_test || primary.best_initial_test,
              overview: mergedContent.overview || primary.overview,
              pathophysiology: mergedContent.pathophysiology || primary.pathophysiology,
              diagnostics: mergedContent.diagnostics || primary.diagnostics,
              treatment: mergedContent.treatment || primary.treatment,
              synonyms: group.aliases
                ? [...new Set([...((primary.synonyms as string[]) || []), ...group.aliases])]
                : primary.synonyms,
              updatedBy: 'condition-doctor',
            },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            // Unique constraint - delete primary and keep existing
            await prisma.medicalContent.delete({ where: { id: primary.id } });
          } else {
            throw e;
          }
        }

        // Delete duplicates
        for (const dup of duplicates) {
          await prisma.medicalContent.delete({ where: { id: dup.id } });
        }
      }

      // Also merge in Condition table
      const conditionRecords = await prisma.condition.findMany({
        where: {
          OR: [
            { name: { equals: group.canonicalName, mode: 'insensitive' } },
            { name: { in: records.map((r) => r.condition) } },
          ],
        },
      });

      if (conditionRecords.length > 1) {
        const primaryCond = conditionRecords[0];
        const dupConds = conditionRecords.slice(1);

        await prisma.condition.update({
          where: { id: primaryCond.id },
          data: {
            name: group.canonicalName,
            system: group.canonicalSystem,
            subcategory: group.canonicalSubcategory,
            relatedSystems: [...new Set([...primaryCond.relatedSystems, ...group.relatedSystems])],
            aliases: [...new Set([...primaryCond.aliases, ...(group.aliases || [])])],
          },
        });

        await prisma.condition.deleteMany({
          where: { id: { in: dupConds.map((c) => c.id) } },
        });
      }

      console.log(`      ✅ Merged into ${canonicalConditionId}`);
      merged++;
    } else {
      console.log(`      [DRY RUN] Would merge ${records.length} records`);
      merged++;
    }
  }

  console.log(`\n   Summary: ${merged} groups merged`);
  return merged;
}

// ==================== Phase 3: Auto-detect and Merge Remaining Duplicates ====================

async function autoDetectDuplicates(dryRun: boolean): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 PHASE 3: AUTO-DETECT REMAINING DUPLICATES');
  console.log('═'.repeat(70));

  let merged = 0;

  // First, use SQL to find actual duplicates by condition name
  const sqlDuplicates = await prisma.$queryRaw<Array<{ condition: string; count: bigint }>>`
    SELECT condition, COUNT(*) as count
    FROM "MedicalContent"
    GROUP BY condition
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  console.log(`\n   Found ${sqlDuplicates.length} duplicate condition names in database\n`);

  for (const dup of sqlDuplicates) {
    const conditionName = dup.condition;
    const count = Number(dup.count);

    // Find all records with this exact name
    const records = await prisma.medicalContent.findMany({
      where: { condition: conditionName },
      orderBy: { updatedAt: 'desc' },
    });

    if (records.length <= 1) continue;

    console.log(`\n   📋 "${conditionName}" - Found ${records.length} duplicate records`);
    for (const r of records) {
      console.log(
        `      - ${r.conditionId} (${r.system}) - Updated: ${r.updatedAt.toISOString().split('T')[0]}`
      );
    }

    if (!dryRun && records.length > 1) {
      // Pick the most recently updated record as primary
      const primary = records[0];
      const duplicates = records.slice(1);

      // Deep merge content from all records
      const mergedContent = deepMergeContent(records);

      // Collect all related systems
      const allRelatedSystems = [
        ...new Set(records.flatMap((r) => [r.system, ...r.relatedSystems])),
      ];
      const primarySystem = primary.system;
      const otherSystems = allRelatedSystems.filter((s) => s !== primarySystem);

      // Update primary with merged data
      await prisma.medicalContent.update({
        where: { id: primary.id },
        data: {
          ...mergedContent,
          relatedSystems: otherSystems,
          updatedBy: 'condition-doctor-auto-merge',
          updatedAt: new Date(),
        },
      });

      // Update or create corresponding Condition record
      const primaryCond = await prisma.condition.findUnique({
        where: { id: primary.conditionId },
      });

      if (primaryCond) {
        await prisma.condition.update({
          where: { id: primary.conditionId },
          data: {
            relatedSystems: otherSystems,
            updatedAt: new Date(),
          },
        });
      }

      // Delete duplicate MedicalContent records
      await prisma.medicalContent.deleteMany({
        where: { id: { in: duplicates.map((d) => d.id) } },
      });

      // Handle duplicate Condition records carefully (they may have foreign keys)
      const dupCondIds = duplicates
        .map((d) => d.conditionId)
        .filter((id) => id !== primary.conditionId);
      if (dupCondIds.length > 0) {
        // First, update any references to point to the primary
        try {
          // Update QuestionSeed references
          await prisma.questionSeed.updateMany({
            where: { conditionId: { in: dupCondIds } },
            data: { conditionId: primary.conditionId },
          });

          // Update Question references
          await prisma.question.updateMany({
            where: { conditionId: { in: dupCondIds } },
            data: { conditionId: primary.conditionId },
          });

          // Update PreGeneratedQuestion references
          await prisma.preGeneratedQuestion.updateMany({
            where: { conditionId: { in: dupCondIds } },
            data: { conditionId: primary.conditionId },
          });
        } catch (refError) {
          console.log(
            `      ⚠️  Warning: Could not update all references - ${refError instanceof Error ? refError.message : 'unknown error'}`
          );
        }

        // Now safe to delete the duplicate Condition records
        try {
          await prisma.condition.deleteMany({
            where: { id: { in: dupCondIds } },
          });
        } catch (deleteError) {
          console.log(
            `      ⚠️  Warning: Could not delete duplicate Condition records - ${deleteError instanceof Error ? deleteError.message : 'unknown error'}`
          );
        }
      }

      console.log(`      ✅ Merged ${records.length} records into ${primary.conditionId}`);
      merged++;
    } else if (dryRun) {
      console.log(`      [DRY RUN] Would merge ${records.length} records`);
      merged++;
    }
  }

  // Also check the KNOWN_DUPLICATE_CONDITIONS list for stragglers
  for (const conditionName of KNOWN_DUPLICATE_CONDITIONS) {
    const normalized = normalizeConditionName(conditionName);

    // Find all records with similar names
    const records = await prisma.medicalContent.findMany({
      where: {
        OR: [
          { condition: { contains: conditionName, mode: 'insensitive' } },
          { condition: { contains: normalized.replace(/ /g, '_'), mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (records.length <= 1) continue;

    // Check if we already processed this in SQL duplicates
    if (sqlDuplicates.some((d) => d.condition === records[0].condition)) continue;

    console.log(`\n   📋 ${conditionName} (fuzzy match) - Found ${records.length} records`);
    for (const r of records) {
      console.log(`      - ${r.conditionId} (${r.system})`);
    }

    if (!dryRun && records.length > 1) {
      const primary = records[0];
      const duplicates = records.slice(1);

      // Collect all related systems
      const allRelatedSystems = [
        ...new Set(records.flatMap((r) => [r.system, ...r.relatedSystems])),
      ];
      const primarySystem = primary.system;
      const otherSystems = allRelatedSystems.filter((s) => s !== primarySystem);

      // Update primary with merged data
      await prisma.medicalContent.update({
        where: { id: primary.id },
        data: {
          relatedSystems: otherSystems,
          buzzwords: [...new Set(records.flatMap((r) => r.buzzwords))],
          updatedBy: 'condition-doctor',
        },
      });

      // Delete duplicates
      await prisma.medicalContent.deleteMany({
        where: { id: { in: duplicates.map((d) => d.id) } },
      });

      console.log(`      ✅ Merged into ${primary.conditionId}`);
      merged++;
    } else if (dryRun) {
      console.log(`      [DRY RUN] Would merge`);
      merged++;
    }
  }

  console.log(`\n   Summary: ${merged} additional duplicates merged`);
  return merged;
}

// ==================== Phase 3b: Merge Condition Table Duplicates ====================

async function mergeConditionTableDuplicates(dryRun: boolean): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 PHASE 3B: MERGE CONDITION TABLE DUPLICATES');
  console.log('═'.repeat(70));

  let merged = 0;

  // Find duplicates in Condition table
  const conditionDuplicates = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
    SELECT name, COUNT(*) as count
    FROM "Condition"
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  console.log(
    `\n   Found ${conditionDuplicates.length} duplicate condition names in Condition table\n`
  );

  for (const dup of conditionDuplicates) {
    const conditionName = dup.name;
    const count = Number(dup.count);

    // Find all Condition records with this exact name
    const records = await prisma.condition.findMany({
      where: { name: conditionName },
      orderBy: { updatedAt: 'desc' },
    });

    if (records.length <= 1) continue;

    console.log(`\n   📋 "${conditionName}" - Found ${records.length} duplicate Condition records`);
    for (const r of records) {
      console.log(
        `      - ${r.id} (${r.system}) - Updated: ${r.updatedAt.toISOString().split('T')[0]}`
      );
    }

    if (!dryRun && records.length > 1) {
      // Pick the most recently updated record as primary
      const primary = records[0];
      const duplicates = records.slice(1);

      // Collect all related systems and aliases
      const allRelatedSystems = [
        ...new Set(records.flatMap((r) => [r.system, ...r.relatedSystems])),
      ];
      const primarySystem = primary.system;
      const otherSystems = allRelatedSystems.filter((s) => s !== primarySystem);
      const allAliases = [...new Set(records.flatMap((r) => r.aliases))];

      // Update primary with merged data
      await prisma.condition.update({
        where: { id: primary.id },
        data: {
          relatedSystems: otherSystems,
          aliases: allAliases,
          updatedAt: new Date(),
        },
      });

      // Update foreign key references to point to primary
      const dupIds = duplicates.map((d) => d.id);

      try {
        await prisma.questionSeed.updateMany({
          where: { conditionId: { in: dupIds } },
          data: { conditionId: primary.id },
        });

        await prisma.question.updateMany({
          where: { conditionId: { in: dupIds } },
          data: { conditionId: primary.id },
        });

        await prisma.preGeneratedQuestion.updateMany({
          where: { conditionId: { in: dupIds } },
          data: { conditionId: primary.id },
        });

        // Update MedicalContent references
        await prisma.medicalContent.updateMany({
          where: { conditionId: { in: dupIds } },
          data: { conditionId: primary.id },
        });
      } catch (refError) {
        console.log(
          `      ⚠️  Warning: Could not update all references - ${refError instanceof Error ? refError.message : 'unknown error'}`
        );
      }

      // Now safe to delete duplicates
      try {
        await prisma.condition.deleteMany({
          where: { id: { in: dupIds } },
        });
        console.log(`      ✅ Merged ${records.length} Condition records into ${primary.id}`);
        merged++;
      } catch (deleteError) {
        console.log(
          `      ❌ Failed to delete: ${deleteError instanceof Error ? deleteError.message : 'unknown error'}`
        );
      }
    } else if (dryRun) {
      console.log(`      [DRY RUN] Would merge ${records.length} records`);
      merged++;
    }
  }

  console.log(`\n   Summary: ${merged} Condition duplicates merged`);
  return merged;
}

// ==================== Phase 4: Fix Formatting Duplicates ====================

async function fixFormattingDuplicates(dryRun: boolean): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔧 PHASE 4: FIX TECHNICAL FORMATTING DUPLICATES');
  console.log('═'.repeat(70));

  let fixed = 0;

  for (const pattern of FORMATTING_DUPLICATE_PATTERNS) {
    console.log(`\n   📋 ${pattern.description}`);
    console.log(`      Correct: ${pattern.correctPattern}`);
    console.log(`      Incorrect: ${pattern.incorrectPatterns.join(', ')}`);

    for (const incorrect of pattern.incorrectPatterns) {
      const records = await prisma.medicalContent.findMany({
        where: {
          conditionId: { contains: incorrect },
        },
      });

      if (records.length === 0) continue;

      for (const record of records) {
        const newConditionId = record.conditionId.replace(incorrect, pattern.correctPattern);

        // Check if correct version exists
        const correctExists = await prisma.medicalContent.findUnique({
          where: { conditionId: newConditionId },
        });

        if (correctExists) {
          console.log(`      🔄 ${record.conditionId} → merge into ${newConditionId}`);
          if (!dryRun) {
            // Merge into correct record
            await prisma.medicalContent.update({
              where: { id: correctExists.id },
              data: {
                buzzwords: [...new Set([...correctExists.buzzwords, ...record.buzzwords])],
                relatedSystems: [
                  ...new Set([...correctExists.relatedSystems, ...record.relatedSystems]),
                ],
              },
            });
            await prisma.medicalContent.delete({ where: { id: record.id } });
          }
        } else {
          console.log(`      📝 ${record.conditionId} → rename to ${newConditionId}`);
          if (!dryRun) {
            await prisma.medicalContent.update({
              where: { id: record.id },
              data: { conditionId: newConditionId },
            });
          }
        }
        fixed++;
      }
    }
  }

  console.log(`\n   Summary: ${fixed} formatting issues fixed`);
  return fixed;
}

// ==================== Phase 5: Standardize Accented Names ====================

async function standardizeAccentedNames(dryRun: boolean): Promise<number> {
  console.log('\n' + '─'.repeat(70));
  console.log('📝 PHASE 5: STANDARDIZE ACCENTED NAMES');
  console.log('─'.repeat(70));

  let fixed = 0;

  for (const correction of ACCENTED_NAME_CORRECTIONS) {
    const { informal, formal, wholeWordOnly } = correction;

    // Build regex pattern - whole word only uses word boundaries
    const regexPattern = wholeWordOnly
      ? new RegExp(`\\b${informal}\\b`, 'gi')
      : new RegExp(informal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    // Find records with informal spelling
    const medicalRecords = await prisma.medicalContent.findMany({
      where: { condition: { contains: informal, mode: 'insensitive' } },
    });

    const conditionRecords = await prisma.condition.findMany({
      where: { name: { contains: informal, mode: 'insensitive' } },
    });

    // Filter to only records that actually match our pattern
    const matchingMedical = medicalRecords.filter((r) => regexPattern.test(r.condition));
    const matchingCondition = conditionRecords.filter((r) => {
      regexPattern.lastIndex = 0; // Reset regex state
      return regexPattern.test(r.name);
    });

    if (matchingMedical.length > 0 || matchingCondition.length > 0) {
      console.log(`\n   📌 "${informal}" → "${formal}"`);
      console.log(`      MedicalContent: ${matchingMedical.length} records`);
      console.log(`      Condition: ${matchingCondition.length} records`);

      if (!dryRun) {
        // Update MedicalContent display names
        for (const record of matchingMedical) {
          regexPattern.lastIndex = 0; // Reset regex state
          const newConditionName = record.condition.replace(regexPattern, formal);

          if (newConditionName !== record.condition) {
            await prisma.medicalContent.update({
              where: { id: record.id },
              data: { condition: newConditionName },
            });
            console.log(`      ✓ Updated: ${record.condition} → ${newConditionName}`);
            fixed++;
          }
        }

        // Update Condition display names
        for (const record of matchingCondition) {
          regexPattern.lastIndex = 0; // Reset regex state
          const newName = record.name.replace(regexPattern, formal);

          if (newName !== record.name) {
            await prisma.condition.update({
              where: { id: record.id },
              data: { name: newName },
            });
            console.log(`      ✓ Updated Condition: ${record.name} → ${newName}`);
            fixed++;
          }
        }
      }
    }
  }

  console.log(`\n   Summary: ${fixed} names standardized with proper accents`);
  return fixed;
}

// ==================== Phase 6: Sync Condition ↔ MedicalContent ====================

async function syncConditionTables(dryRun: boolean): Promise<{ created: number; linked: number }> {
  console.log('\n' + '─'.repeat(70));
  console.log('🔗 PHASE 6: SYNC CONDITION ↔ MEDICALCONTENT TABLES');
  console.log('─'.repeat(70));

  let created = 0;
  let linked = 0;

  // Get all MedicalContent records
  const allMedicalContent = await prisma.medicalContent.findMany({
    select: { id: true, conditionId: true, condition: true, system: true, subcategory: true },
  });

  // Get all Condition records
  const allConditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  // Create map of condition IDs
  const conditionMap = new Map(allConditions.map((c) => [c.id, c]));
  const conditionNameMap = new Map(allConditions.map((c) => [c.name.toLowerCase(), c]));

  console.log(`\n   📋 MedicalContent records: ${allMedicalContent.length}`);
  console.log(`   📋 Condition records: ${allConditions.length}`);

  // Find MedicalContent records without corresponding Condition entry
  const orphanedContent: typeof allMedicalContent = [];

  for (const mc of allMedicalContent) {
    const byId = conditionMap.has(mc.conditionId);
    const byName = conditionNameMap.has(mc.condition.toLowerCase());

    if (!byId && !byName) {
      orphanedContent.push(mc);
    }
  }

  console.log(`\n   🔍 MedicalContent without Condition entry: ${orphanedContent.length}`);

  if (orphanedContent.length > 0 && !dryRun) {
    console.log('\n   Creating missing Condition entries...');

    for (const mc of orphanedContent) {
      // Check if we can create a Condition for this
      const existingCondition = await prisma.condition.findUnique({
        where: { id: mc.conditionId },
      });

      if (!existingCondition) {
        try {
          await prisma.condition.create({
            data: {
              id: mc.conditionId,
              name: mc.condition,
              system: mc.system,
              subcategory: mc.subcategory || 'General',
              aliases: [],
              relatedSystems: [],
            } as any,
          });
          console.log(`      ✓ Created Condition: ${mc.condition} (${mc.system})`);
          created++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          // Might fail due to unique constraint, skip
          console.log(`      ⚠ Skipped ${mc.condition}: ${errorMessage}`);
        }
      }
    }
  }

  // Find Condition records without corresponding MedicalContent
  const conditionIds = new Set(allMedicalContent.map((mc) => mc.conditionId));
  const orphanedConditions = allConditions.filter((c) => !conditionIds.has(c.id));

  console.log(`\n   🔍 Condition records without MedicalContent: ${orphanedConditions.length}`);

  if (orphanedConditions.length > 0) {
    console.log('\n   Orphaned Condition records (need manual review):');
    for (const c of orphanedConditions.slice(0, 20)) {
      console.log(`      - ${c.name} (${c.system}): ${c.id}`);
    }
    if (orphanedConditions.length > 20) {
      console.log(`      ... and ${orphanedConditions.length - 20} more`);
    }
  }

  console.log(`\n   Summary: ${created} Condition records created, ${linked} links fixed`);
  return { created, linked };
}

// ==================== Analysis Report ====================

async function analyzeConditions(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CONDITION DATABASE ANALYSIS');
  console.log('═'.repeat(70));

  // Count records
  const totalContent = await prisma.medicalContent.count();
  const totalConditions = await prisma.condition.count();

  console.log(`\n   📋 Total MedicalContent records: ${totalContent}`);
  console.log(`   📋 Total Condition records: ${totalConditions}`);

  // Find potential duplicates
  const allRecords = await prisma.medicalContent.findMany({
    select: { conditionId: true, condition: true, system: true },
  });

  const nameGroups = new Map<string, typeof allRecords>();
  for (const record of allRecords) {
    const normalized = normalizeConditionName(record.condition);
    if (!nameGroups.has(normalized)) {
      nameGroups.set(normalized, []);
    }
    nameGroups.get(normalized)!.push(record);
  }

  const duplicateGroups = [...nameGroups.entries()].filter(([_, records]) => records.length > 1);

  console.log(`\n   🔍 Potential duplicate groups: ${duplicateGroups.length}`);

  if (duplicateGroups.length > 0) {
    console.log('\n   Top duplicates:');
    for (const [name, records] of duplicateGroups.slice(0, 10)) {
      console.log(`      ${name}: ${records.length} records`);
      for (const r of records) {
        console.log(`         - ${r.system}: ${r.conditionId}`);
      }
    }
  }

  // Check for new conditions
  console.log('\n   🆕 New conditions to add:');
  for (const condition of NEW_HIGH_YIELD_CONDITIONS) {
    const exists = await prisma.medicalContent.findFirst({
      where: { condition: { equals: condition.condition, mode: 'insensitive' } },
    });
    const status = exists ? '✓ exists' : '✗ missing';
    console.log(`      ${status}: ${condition.condition}`);
  }
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const addNewOnly = args.includes('--add-new');
  const mergeDupesOnly = args.includes('--merge-dupes');
  const analyzeOnly = args.includes('--analyze');
  const standardizeOnly = args.includes('--standardize');
  const syncOnly = args.includes('--sync');

  console.log('\n' + '═'.repeat(70));
  console.log('🩺 CONDITION DOCTOR');
  console.log('═'.repeat(70));
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(
    `   Options: ${
      [
        addNewOnly && 'add-new',
        mergeDupesOnly && 'merge-dupes',
        analyzeOnly && 'analyze',
        standardizeOnly && 'standardize',
        syncOnly && 'sync',
      ]
        .filter(Boolean)
        .join(', ') || 'all phases'
    }`
  );

  try {
    if (analyzeOnly) {
      await analyzeConditions();
      return;
    }

    const runAll = !addNewOnly && !mergeDupesOnly && !standardizeOnly && !syncOnly;

    if (runAll) {
      // Run all phases in order
      await addNewConditions(dryRun);
      await mergeDuplicates(dryRun);
      await autoDetectDuplicates(dryRun);
      await mergeConditionTableDuplicates(dryRun);
      await fixFormattingDuplicates(dryRun);
      await standardizeAccentedNames(dryRun);
      await syncConditionTables(dryRun);
    } else {
      if (addNewOnly) {
        await addNewConditions(dryRun);
      }
      if (mergeDupesOnly) {
        await mergeDuplicates(dryRun);
        await autoDetectDuplicates(dryRun);
        await mergeConditionTableDuplicates(dryRun);
        await fixFormattingDuplicates(dryRun);
      }
      if (standardizeOnly) {
        await standardizeAccentedNames(dryRun);
      }
      if (syncOnly) {
        await syncConditionTables(dryRun);
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ CONDITION DOCTOR - COMPLETE');
    console.log('═'.repeat(70) + '\n');
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
