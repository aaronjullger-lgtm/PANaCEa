#!/usr/bin/env npx tsx
/**
 * DDx Doctor - AI-powered generator for DifferentialDiagnosis table
 *
 * Generates comprehensive differential diagnosis frameworks by presenting symptom.
 * Updates existing records with clinically useful fields:
 *   - mostDangerous: must-not-miss diagnoses
 *   - oftenMissed: commonly overlooked conditions
 *   - distinguishingFeatures: how to differentiate conditions (JSON)
 *   - diagnosticAlgorithm: step-by-step approach
 *   - dispositionGuidance: admit vs discharge criteria
 *   - byAcuity: DDx organized by urgency (JSON)
 *   - byAge: age-specific DDx patterns (JSON)
 *   - reassuringFeatures: what makes dangerous diagnoses less likely
 *   - commonMistakes: diagnostic pitfalls
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ddx-doctor.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ddx-doctor.ts --update-existing
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ddx-doctor.ts --batch=20
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Rate limiting
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
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5); // 5 tokens, refill 0.5/sec

// Comprehensive presenting symptoms for PANCE differential diagnosis (~100 complaints)
const PRESENTING_SYMPTOMS = [
  // Cardiovascular (10)
  { symptom: 'Chest Pain', category: 'CV', isEmergency: true },
  { symptom: 'Dyspnea on Exertion', category: 'CV', isEmergency: false },
  { symptom: 'Palpitations', category: 'CV', isEmergency: false },
  { symptom: 'Syncope', category: 'CV', isEmergency: true },
  { symptom: 'Lower Extremity Edema', category: 'CV', isEmergency: false },
  { symptom: 'Orthopnea', category: 'CV', isEmergency: false },
  { symptom: 'Paroxysmal Nocturnal Dyspnea', category: 'CV', isEmergency: false },
  { symptom: 'Claudication', category: 'CV', isEmergency: false },
  { symptom: 'Cyanosis', category: 'CV', isEmergency: true },
  { symptom: 'Heart Murmur', category: 'CV', isEmergency: false },

  // Pulmonary (10)
  { symptom: 'Acute Dyspnea', category: 'PULM', isEmergency: true },
  { symptom: 'Chronic Cough', category: 'PULM', isEmergency: false },
  { symptom: 'Hemoptysis', category: 'PULM', isEmergency: true },
  { symptom: 'Wheezing', category: 'PULM', isEmergency: false },
  { symptom: 'Pleuritic Chest Pain', category: 'PULM', isEmergency: false },
  { symptom: 'Stridor', category: 'PULM', isEmergency: true },
  { symptom: 'Sleep Apnea Symptoms', category: 'PULM', isEmergency: false },
  { symptom: 'Chronic Dyspnea', category: 'PULM', isEmergency: false },
  { symptom: 'Productive Cough', category: 'PULM', isEmergency: false },
  { symptom: 'Hypoxia', category: 'PULM', isEmergency: true },

  // GI (15)
  { symptom: 'Acute Abdominal Pain', category: 'GI', isEmergency: true },
  { symptom: 'Right Upper Quadrant Pain', category: 'GI', isEmergency: false },
  { symptom: 'Right Lower Quadrant Pain', category: 'GI', isEmergency: true },
  { symptom: 'Left Lower Quadrant Pain', category: 'GI', isEmergency: false },
  { symptom: 'Epigastric Pain', category: 'GI', isEmergency: false },
  { symptom: 'Upper GI Bleeding', category: 'GI', isEmergency: true },
  { symptom: 'Lower GI Bleeding', category: 'GI', isEmergency: true },
  { symptom: 'Jaundice', category: 'GI', isEmergency: false },
  { symptom: 'Dysphagia', category: 'GI', isEmergency: false },
  { symptom: 'Chronic Diarrhea', category: 'GI', isEmergency: false },
  { symptom: 'Nausea and Vomiting', category: 'GI', isEmergency: false },
  { symptom: 'Constipation', category: 'GI', isEmergency: false },
  { symptom: 'Abdominal Distension', category: 'GI', isEmergency: false },
  { symptom: 'Rectal Pain', category: 'GI', isEmergency: false },
  { symptom: 'Heartburn and Reflux', category: 'GI', isEmergency: false },
  { symptom: 'Acute Diarrhea', category: 'GI', isEmergency: false },
  { symptom: 'Odynophagia', category: 'GI', isEmergency: false },

  // Neurological (12)
  { symptom: 'Headache', category: 'NEURO', isEmergency: false },
  { symptom: 'Acute Focal Weakness', category: 'NEURO', isEmergency: true },
  { symptom: 'Altered Mental Status', category: 'NEURO', isEmergency: true },
  { symptom: 'Dizziness and Vertigo', category: 'NEURO', isEmergency: false },
  { symptom: 'Seizure', category: 'NEURO', isEmergency: true },
  { symptom: 'Numbness and Tingling', category: 'NEURO', isEmergency: false },
  { symptom: 'Memory Loss', category: 'NEURO', isEmergency: false },
  { symptom: 'Tremor', category: 'NEURO', isEmergency: false },
  { symptom: 'Gait Disturbance', category: 'NEURO', isEmergency: false },
  { symptom: 'Facial Weakness', category: 'NEURO', isEmergency: true },
  { symptom: 'Speech Difficulty', category: 'NEURO', isEmergency: true },
  { symptom: 'Neck Stiffness', category: 'NEURO', isEmergency: true },

  // MSK (12)
  { symptom: 'Low Back Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Shoulder Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Knee Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Monoarticular Joint Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Polyarticular Joint Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Neck Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Hip Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Ankle Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Wrist and Hand Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Elbow Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Muscle Weakness', category: 'MSK', isEmergency: false },
  { symptom: 'Joint Swelling', category: 'MSK', isEmergency: false },

  // GU/Renal (10)
  { symptom: 'Hematuria', category: 'GU', isEmergency: false },
  { symptom: 'Dysuria', category: 'GU', isEmergency: false },
  { symptom: 'Flank Pain', category: 'RENAL', isEmergency: false },
  { symptom: 'Acute Kidney Injury', category: 'RENAL', isEmergency: true },
  { symptom: 'Urinary Incontinence', category: 'GU', isEmergency: false },
  { symptom: 'Urinary Retention', category: 'GU', isEmergency: true },
  { symptom: 'Testicular Pain', category: 'GU', isEmergency: true },
  { symptom: 'Scrotal Swelling', category: 'GU', isEmergency: false },
  { symptom: 'Pelvic Pain Female', category: 'GYN', isEmergency: false },
  { symptom: 'Vaginal Bleeding', category: 'GYN', isEmergency: true },

  // OB/GYN (8)
  { symptom: 'Amenorrhea', category: 'GYN', isEmergency: false },
  { symptom: 'Abnormal Uterine Bleeding', category: 'GYN', isEmergency: false },
  { symptom: 'Vaginal Discharge', category: 'GYN', isEmergency: false },
  { symptom: 'Breast Mass', category: 'GYN', isEmergency: false },
  { symptom: 'Breast Pain', category: 'GYN', isEmergency: false },
  { symptom: 'Nipple Discharge', category: 'GYN', isEmergency: false },
  { symptom: 'First Trimester Bleeding', category: 'OB', isEmergency: true },
  { symptom: 'Third Trimester Bleeding', category: 'OB', isEmergency: true },

  // Endocrine (8)
  { symptom: 'Fatigue', category: 'ENDO', isEmergency: false },
  { symptom: 'Unintentional Weight Loss', category: 'ENDO', isEmergency: false },
  { symptom: 'Polyuria and Polydipsia', category: 'ENDO', isEmergency: false },
  { symptom: 'Weight Gain', category: 'ENDO', isEmergency: false },
  { symptom: 'Heat Intolerance', category: 'ENDO', isEmergency: false },
  { symptom: 'Cold Intolerance', category: 'ENDO', isEmergency: false },
  { symptom: 'Thyroid Nodule', category: 'ENDO', isEmergency: false },
  { symptom: 'Hypoglycemia Symptoms', category: 'ENDO', isEmergency: true },

  // HEENT (10)
  { symptom: 'Sore Throat', category: 'HEENT', isEmergency: false },
  { symptom: 'Red Eye', category: 'HEENT', isEmergency: false },
  { symptom: 'Acute Visual Loss', category: 'HEENT', isEmergency: true },
  { symptom: 'Hearing Loss', category: 'HEENT', isEmergency: false },
  { symptom: 'Ear Pain', category: 'HEENT', isEmergency: false },
  { symptom: 'Nasal Congestion', category: 'HEENT', isEmergency: false },
  { symptom: 'Epistaxis', category: 'HEENT', isEmergency: false },
  { symptom: 'Tinnitus', category: 'HEENT', isEmergency: false },
  { symptom: 'Facial Pain', category: 'HEENT', isEmergency: false },
  { symptom: 'Hoarseness', category: 'HEENT', isEmergency: false },
  { symptom: 'Neck Mass', category: 'HEENT', isEmergency: false },

  // Skin (8)
  { symptom: 'Diffuse Rash', category: 'DERM', isEmergency: false },
  { symptom: 'Concerning Skin Lesion', category: 'DERM', isEmergency: false },
  { symptom: 'Pruritus', category: 'DERM', isEmergency: false },
  { symptom: 'Skin Ulcer', category: 'DERM', isEmergency: false },
  { symptom: 'Hair Loss', category: 'DERM', isEmergency: false },
  { symptom: 'Urticaria', category: 'DERM', isEmergency: false },
  { symptom: 'Petechiae and Purpura', category: 'DERM', isEmergency: true },
  { symptom: 'Cellulitis', category: 'DERM', isEmergency: false },

  // Hematology/Oncology (5)
  { symptom: 'Lymphadenopathy', category: 'HEME', isEmergency: false },
  { symptom: 'Splenomegaly', category: 'HEME', isEmergency: false },
  { symptom: 'Anemia Symptoms', category: 'HEME', isEmergency: false },
  { symptom: 'Easy Bruising', category: 'HEME', isEmergency: false },
  { symptom: 'Night Sweats', category: 'HEME', isEmergency: false },

  // Infectious Disease (5)
  { symptom: 'Fever', category: 'ID', isEmergency: false },
  { symptom: 'Fever of Unknown Origin', category: 'ID', isEmergency: false },
  { symptom: 'Sepsis Presentation', category: 'ID', isEmergency: true },
  { symptom: 'Immunocompromised with Fever', category: 'ID', isEmergency: true },
  { symptom: 'Travel-Related Illness', category: 'ID', isEmergency: false },

  // Psych (6)
  { symptom: 'Anxiety', category: 'PSYCH', isEmergency: false },
  { symptom: 'Depression', category: 'PSYCH', isEmergency: false },
  { symptom: 'Acute Psychosis', category: 'PSYCH', isEmergency: true },
  { symptom: 'Suicidal Ideation', category: 'PSYCH', isEmergency: true },
  { symptom: 'Insomnia', category: 'PSYCH', isEmergency: false },
  { symptom: 'Substance Intoxication', category: 'PSYCH', isEmergency: true },
];

interface DDxAIResponse {
  typicalPresentation: string;
  mustNotMiss: string[];
  mostCommon: string[];
  differentialList: string[];
  redFlags: string[];
  keyQuestions: string[];
  keyExamFindings: string[];
  initialWorkup: string[];
  workup: string;
  clinicalPearls: string[];
  mnemonics: string[];
  // New clinically useful fields
  mostDangerous: string[];
  oftenMissed: string[];
  distinguishingFeatures: Record<string, string>;
  diagnosticAlgorithm: string;
  dispositionGuidance: string;
  byAcuity: { emergent: string[]; urgent: string[]; routine: string[] };
  byAge: { pediatric: string[]; adult: string[]; geriatric: string[] };
  reassuringFeatures: string[];
  commonMistakes: string[];
}

async function generateDDxContent(
  symptom: { symptom: string; category: string; isEmergency: boolean },
  isUpdate: boolean = false
): Promise<DDxAIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.acquire();

  const prompt = `Generate a comprehensive differential diagnosis framework for "${symptom.symptom}" for PA/medical student education.

Return a JSON object with EXACTLY these fields:
{
  "typicalPresentation": "Typical patient presentation with this complaint (2-3 sentences)",
  "mustNotMiss": ["Array of 4-6 life-threatening diagnoses that MUST be ruled out"],
  "mostCommon": ["Array of 5-7 most common/likely diagnoses for this presentation"],
  "differentialList": ["Array of 8-12 comprehensive differential diagnoses ordered by likelihood"],
  "redFlags": ["Array of 5-7 symptoms/signs indicating serious pathology"],
  "keyQuestions": ["Array of 5-7 most important history questions"],
  "keyExamFindings": ["Array of 4-6 exam findings to look for"],
  "initialWorkup": ["Array of 4-6 initial diagnostic tests"],
  "workup": "Step-by-step diagnostic approach (3-4 sentences)",
  "clinicalPearls": ["Array of 3-4 high-yield clinical pearls"],
  "mnemonics": ["Array of 1-2 helpful memory aids, or empty if none commonly used"],
  
  "mostDangerous": ["Array of 3-5 diagnoses with highest morbidity/mortality if missed"],
  "oftenMissed": ["Array of 3-5 diagnoses commonly overlooked or misdiagnosed"],
  "distinguishingFeatures": {
    "Diagnosis1 vs Diagnosis2": "Key differentiating feature",
    "Diagnosis3 vs Diagnosis4": "Key differentiating feature"
  },
  "diagnosticAlgorithm": "Step-by-step clinical reasoning: First rule out X by..., then consider Y if..., finally Z when... (4-5 sentences)",
  "dispositionGuidance": "Admit if: [criteria]. Discharge with follow-up if: [criteria]. (2-3 sentences)",
  "byAcuity": {
    "emergent": ["Diagnoses requiring immediate intervention (minutes)"],
    "urgent": ["Diagnoses requiring same-day workup (hours)"],
    "routine": ["Diagnoses appropriate for outpatient workup (days-weeks)"]
  },
  "byAge": {
    "pediatric": ["Most likely diagnoses in children/adolescents"],
    "adult": ["Most likely diagnoses in adults 18-65"],
    "geriatric": ["Most likely diagnoses in elderly >65"]
  },
  "reassuringFeatures": ["Array of 3-5 findings that make dangerous diagnoses LESS likely"],
  "commonMistakes": ["Array of 3-5 common diagnostic errors or pitfalls"]
}

Emergency status: ${symptom.isEmergency ? 'YES - prioritize emergent causes' : 'NO - but rule out dangerous causes first'}
Focus on PANCE-relevant differentials and practical clinical reasoning.
Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${symptom.symptom}`);
  }

  return JSON.parse(jsonMatch[0]);
}

function ensureArray(value: any, fallback: string): string[] {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }
  return [fallback];
}

async function createDDx(
  symptom: (typeof PRESENTING_SYMPTOMS)[0],
  content: DDxAIResponse
): Promise<void> {
  const crypto = await import('crypto');
  await prisma.differentialDiagnosis.create({
    data: {
      id: uuidv4(),
      presentingComplaint: symptom.symptom,
      category: symptom.category,
      isEmergency: symptom.isEmergency,
      typicalPresentation: content.typicalPresentation,
      mustNotMiss: ensureArray(content.mustNotMiss, 'See mustNotMiss for critical diagnoses'),
      mostCommon: ensureArray(content.mostCommon, 'Common causes vary by patient population'),
      differentialList: ensureArray(
        content.differentialList,
        'Differential varies by clinical context'
      ),
      redFlags: ensureArray(content.redFlags, 'Assess for signs of serious pathology'),
      keyQuestions: ensureArray(content.keyQuestions, 'Obtain thorough history'),
      keyExamFindings: ensureArray(content.keyExamFindings, 'Perform focused physical exam'),
      initialWorkup: ensureArray(content.initialWorkup, 'Workup guided by clinical presentation'),
      workup: content.workup || 'Tailor workup to clinical presentation and risk factors.',
      clinicalPearls: ensureArray(content.clinicalPearls, 'Apply clinical reasoning to each case'),
      mnemonics: content.mnemonics || [],
      // New clinically useful fields
      mostDangerous: ensureArray(content.mostDangerous, 'Assess for life-threatening causes'),
      oftenMissed: ensureArray(content.oftenMissed, 'Consider atypical presentations'),
      distinguishingFeatures: content.distinguishingFeatures || {},
      diagnosticAlgorithm:
        content.diagnosticAlgorithm || 'Apply systematic clinical reasoning based on presentation.',
      dispositionGuidance:
        content.dispositionGuidance || 'Disposition depends on clinical stability and diagnosis.',
      byAcuity: content.byAcuity || { emergent: [], urgent: [], routine: [] },
      byAge: content.byAge || { pediatric: [], adult: [], geriatric: [] },
      reassuringFeatures: ensureArray(
        content.reassuringFeatures,
        'Evaluate for features suggesting benign etiology'
      ),
      commonMistakes: ensureArray(content.commonMistakes, 'Avoid premature diagnostic closure'),
      isHighYield: true,
      panceYield: 3,
    } as any,
  });
}

async function updateDDx(id: string, content: DDxAIResponse): Promise<void> {
  await prisma.differentialDiagnosis.update({
    where: { id },
    data: {
      // Update all fields including new ones
      typicalPresentation: content.typicalPresentation,
      mustNotMiss: ensureArray(content.mustNotMiss, 'See mustNotMiss for critical diagnoses'),
      mostCommon: ensureArray(content.mostCommon, 'Common causes vary by patient population'),
      differentialList: ensureArray(
        content.differentialList,
        'Differential varies by clinical context'
      ),
      redFlags: ensureArray(content.redFlags, 'Assess for signs of serious pathology'),
      keyQuestions: ensureArray(content.keyQuestions, 'Obtain thorough history'),
      keyExamFindings: ensureArray(content.keyExamFindings, 'Perform focused physical exam'),
      initialWorkup: ensureArray(content.initialWorkup, 'Workup guided by clinical presentation'),
      workup: content.workup || 'Tailor workup to clinical presentation and risk factors.',
      clinicalPearls: ensureArray(content.clinicalPearls, 'Apply clinical reasoning to each case'),
      mnemonics: content.mnemonics || [],
      // New clinically useful fields
      mostDangerous: ensureArray(content.mostDangerous, 'Assess for life-threatening causes'),
      oftenMissed: ensureArray(content.oftenMissed, 'Consider atypical presentations'),
      distinguishingFeatures: content.distinguishingFeatures || {},
      diagnosticAlgorithm:
        content.diagnosticAlgorithm || 'Apply systematic clinical reasoning based on presentation.',
      dispositionGuidance:
        content.dispositionGuidance || 'Disposition depends on clinical stability and diagnosis.',
      byAcuity: content.byAcuity || { emergent: [], urgent: [], routine: [] },
      byAge: content.byAge || { pediatric: [], adult: [], geriatric: [] },
      reassuringFeatures: ensureArray(
        content.reassuringFeatures,
        'Evaluate for features suggesting benign etiology'
      ),
      commonMistakes: ensureArray(content.commonMistakes, 'Avoid premature diagnostic closure'),
    },
  });
}

async function needsUpdate(record: any): Promise<boolean> {
  // Check if the new clinically useful fields are empty
  const emptyMostDangerous = !record.mostDangerous || record.mostDangerous.length === 0;
  const emptyOftenMissed = !record.oftenMissed || record.oftenMissed.length === 0;
  const emptyDistinguishing = !record.distinguishingFeatures;
  const emptyAlgorithm = !record.diagnosticAlgorithm;
  const emptyDisposition = !record.dispositionGuidance;
  const emptyByAcuity = !record.byAcuity;
  const emptyByAge = !record.byAge;
  const emptyReassuring = !record.reassuringFeatures || record.reassuringFeatures.length === 0;
  const emptyMistakes = !record.commonMistakes || record.commonMistakes.length === 0;

  return (
    emptyMostDangerous ||
    emptyOftenMissed ||
    emptyDistinguishing ||
    emptyAlgorithm ||
    emptyDisposition ||
    emptyByAcuity ||
    emptyByAge ||
    emptyReassuring ||
    emptyMistakes
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const updateExisting = args.includes('--update-existing');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;

  console.log('🔍 DDx Doctor - Differential Diagnosis Generator');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : updateExisting ? 'UPDATE EXISTING' : 'CREATE NEW'}`);
  if (batchSize) console.log(`   Batch size: ${batchSize}`);
  console.log('');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  // Phase 1: Process known symptoms list
  console.log('📋 Phase 1: Processing presenting symptoms list...\n');

  for (const symptom of PRESENTING_SYMPTOMS) {
    if (batchSize && processed >= batchSize) {
      console.log(`\n⏸️  Batch limit reached (${batchSize})`);
      break;
    }

    try {
      const existing = await prisma.differentialDiagnosis.findFirst({
        where: { presentingComplaint: symptom.symptom },
      });

      if (existing) {
        if (updateExisting && (await needsUpdate(existing))) {
          if (dryRun) {
            console.log(`  📝 Would update: ${symptom.symptom}`);
            updated++;
          } else {
            console.log(`  🔄 Updating: ${symptom.symptom}...`);
            const content = await generateDDxContent(symptom, true);
            await updateDDx(existing.id, content);
            console.log(`  ✅ Updated: ${symptom.symptom}`);
            updated++;
          }
          processed++;
        } else {
          console.log(`  ⏭️  Skipped: ${symptom.symptom} (exists, complete)`);
          skipped++;
        }
      } else {
        if (dryRun) {
          console.log(`  📝 Would create: ${symptom.symptom}`);
          created++;
        } else {
          console.log(`  🔄 Creating: ${symptom.symptom}...`);
          const content = await generateDDxContent(symptom);
          await createDDx(symptom, content);
          console.log(`  ✅ Created: ${symptom.symptom}`);
          created++;
        }
        processed++;
      }
    } catch (error: any) {
      console.error(`  ❌ Failed: ${symptom.symptom} - ${error.message}`);
      failed++;
      // Continue to next symptom
    }
  }

  // Phase 2: Update any existing records not in the symptoms list
  if (updateExisting && (!batchSize || processed < batchSize)) {
    console.log('\n📋 Phase 2: Checking existing records for updates...\n');

    const allRecords = await prisma.differentialDiagnosis.findMany();
    const knownSymptoms = new Set(PRESENTING_SYMPTOMS.map((s) => s.symptom));

    for (const record of allRecords) {
      if (batchSize && processed >= batchSize) {
        console.log(`\n⏸️  Batch limit reached (${batchSize})`);
        break;
      }

      if (knownSymptoms.has(record.presentingComplaint)) continue; // Already processed

      if (await needsUpdate(record)) {
        try {
          const symptomInfo = {
            symptom: record.presentingComplaint,
            category: record.category,
            isEmergency: record.isEmergency,
          };

          if (dryRun) {
            console.log(`  📝 Would update: ${record.presentingComplaint}`);
            updated++;
          } else {
            console.log(`  🔄 Updating: ${record.presentingComplaint}...`);
            const content = await generateDDxContent(symptomInfo, true);
            await updateDDx(record.id, content);
            console.log(`  ✅ Updated: ${record.presentingComplaint}`);
            updated++;
          }
          processed++;
        } catch (error: any) {
          console.error(`  ❌ Failed: ${record.presentingComplaint} - ${error.message}`);
          failed++;
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DDx Doctor Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed:  ${failed}`);
  console.log(`   Total processed: ${processed}`);

  const totalRecords = await prisma.differentialDiagnosis.count();
  console.log(`\n   Total DDx records in database: ${totalRecords}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
