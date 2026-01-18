/**
 * DifferentialDiagnosis Entry Generator v2
 * Creates missing differential diagnoses for PANCE coverage
 * Fixed to match Prisma schema exactly (uses presentingComplaint as unique key)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant differential diagnoses by presenting complaint
const PANCE_DIFFERENTIALS = [
  { presentingComplaint: 'Acute Chest Pain', category: 'Cardiovascular' },
  { presentingComplaint: 'Chronic Chest Pain', category: 'Cardiovascular' },
  { presentingComplaint: 'Palpitations', category: 'Cardiovascular' },
  { presentingComplaint: 'Syncope', category: 'Cardiovascular' },
  { presentingComplaint: 'Lower Extremity Edema', category: 'Cardiovascular' },
  { presentingComplaint: 'Acute Dyspnea', category: 'Pulmonary' },
  { presentingComplaint: 'Chronic Dyspnea', category: 'Pulmonary' },
  { presentingComplaint: 'Chronic Cough', category: 'Pulmonary' },
  { presentingComplaint: 'Hemoptysis', category: 'Pulmonary' },
  { presentingComplaint: 'Acute Abdominal Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Chronic Abdominal Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Right Upper Quadrant Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Left Lower Quadrant Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Right Lower Quadrant Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Epigastric Pain', category: 'Gastrointestinal' },
  { presentingComplaint: 'Nausea and Vomiting', category: 'Gastrointestinal' },
  { presentingComplaint: 'Acute Diarrhea', category: 'Gastrointestinal' },
  { presentingComplaint: 'Chronic Diarrhea', category: 'Gastrointestinal' },
  { presentingComplaint: 'GI Bleeding - Upper', category: 'Gastrointestinal' },
  { presentingComplaint: 'GI Bleeding - Lower', category: 'Gastrointestinal' },
  { presentingComplaint: 'Jaundice', category: 'Gastrointestinal' },
  { presentingComplaint: 'Dysphagia', category: 'Gastrointestinal' },
  { presentingComplaint: 'Acute Headache', category: 'Neurological' },
  { presentingComplaint: 'Chronic Headache', category: 'Neurological' },
  { presentingComplaint: 'Acute Altered Mental Status', category: 'Neurological' },
  { presentingComplaint: 'Dizziness', category: 'Neurological' },
  { presentingComplaint: 'Vertigo', category: 'Neurological' },
  { presentingComplaint: 'Seizure', category: 'Neurological' },
  { presentingComplaint: 'Focal Weakness', category: 'Neurological' },
  { presentingComplaint: 'Peripheral Neuropathy', category: 'Neurological' },
  { presentingComplaint: 'Tremor', category: 'Neurological' },
  { presentingComplaint: 'Acute Back Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Chronic Back Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Joint Pain - Monoarticular', category: 'Musculoskeletal' },
  { presentingComplaint: 'Joint Pain - Polyarticular', category: 'Musculoskeletal' },
  { presentingComplaint: 'Neck Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Shoulder Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Hip Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Knee Pain', category: 'Musculoskeletal' },
  { presentingComplaint: 'Hematuria', category: 'Genitourinary' },
  { presentingComplaint: 'Dysuria', category: 'Genitourinary' },
  { presentingComplaint: 'Oliguria/Anuria', category: 'Genitourinary' },
  { presentingComplaint: 'Flank Pain', category: 'Genitourinary' },
  { presentingComplaint: 'Scrotal Pain', category: 'Genitourinary' },
  { presentingComplaint: 'Vaginal Bleeding - Abnormal', category: 'Reproductive' },
  { presentingComplaint: 'Pelvic Pain - Female', category: 'Reproductive' },
  { presentingComplaint: 'Rash - Maculopapular', category: 'Dermatologic' },
  { presentingComplaint: 'Rash - Vesicular', category: 'Dermatologic' },
  { presentingComplaint: 'Rash - Petechial/Purpuric', category: 'Dermatologic' },
  { presentingComplaint: 'Pruritis', category: 'Dermatologic' },
  { presentingComplaint: 'Fever of Unknown Origin', category: 'Infectious Disease' },
  { presentingComplaint: 'Lymphadenopathy', category: 'Hematologic' },
  { presentingComplaint: 'Fatigue', category: 'General' },
  { presentingComplaint: 'Weight Loss - Unintentional', category: 'General' },
  { presentingComplaint: 'Night Sweats', category: 'General' },
  { presentingComplaint: 'Red Eye', category: 'EENT' },
  { presentingComplaint: 'Hearing Loss', category: 'EENT' },
  { presentingComplaint: 'Sore Throat', category: 'EENT' },
  { presentingComplaint: 'Epistaxis', category: 'EENT' },
  { presentingComplaint: 'Anxiety Symptoms', category: 'Psychiatry' },
  { presentingComplaint: 'Depression Symptoms', category: 'Psychiatry' },
];

interface DifferentialData {
  isEmergency?: boolean;
  differentialList?: string[];
  mustNotMiss?: string[];
  workup?: string;
  byAcuity?: Record<string, string[]>;
  byAge?: Record<string, string[]>;
  clinicalPearls?: string[];
  commonMistakes?: string[];
  diagnosticAlgorithm?: string;
  dispositionGuidance?: string;
  distinguishingFeatures?: Record<string, string>;
  initialWorkup?: string[];
  isHighYield?: boolean;
  keyExamFindings?: string[];
  keyQuestions?: string[];
  mnemonics?: string[];
  mostCommon?: string[];
  mostDangerous?: string[];
  oftenMissed?: string[];
  panceYield?: number;
  reassuringFeatures?: string[];
  redFlags?: string[];
  typicalPresentation?: string;
}

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private capacity: number = 5,
    private refillRate: number = 0.5
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const rateLimiter = new TokenBucket();

async function generateDifferentialData(
  presentingComplaint: string,
  category: string
): Promise<DifferentialData> {
  await rateLimiter.acquire();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive differential diagnosis information for presenting complaint: "${presentingComplaint}"

Category: ${category}

Provide accurate, PANCE/board-focused data including:
- Is this an emergency presentation? (boolean)
- Complete differential list (all reasonable diagnoses)
- Must not miss diagnoses (life-threatening or time-sensitive)
- Workup strategy
- Differential by acuity (object: acute, subacute, chronic with arrays)
- Differential by age (object: pediatric, adult, elderly with arrays)
- Clinical pearls and common mistakes
- Diagnostic algorithm (step-by-step approach)
- Disposition guidance
- Distinguishing features (object with diagnosis: key distinguishing features pairs)
- Initial workup (labs, imaging to order first)
- Whether high-yield for PANCE (panceYield 1-10)
- Key exam findings to look for
- Key history questions to ask
- Mnemonics for remembering differentials
- Most common causes
- Most dangerous causes
- Often missed diagnoses
- Reassuring features
- Red flags
- Typical presentation description

Return as JSON.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

function ensureString(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  return String(val);
}

function ensureArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

function ensureInt(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const num = parseInt(val);
    if (!isNaN(num)) return num;
  }
  return null;
}

function ensureBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  return false;
}

function ensureJson(val: unknown): Prisma.InputJsonValue | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object') return val as Prisma.InputJsonValue;
  return null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          DIFFERENTIAL DIAGNOSIS ENTRY GENERATOR v2               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.differentialDiagnosis.findMany({
      select: { presentingComplaint: true },
    });
    const existingComplaints = new Set(existing.map((e) => e.presentingComplaint.toLowerCase()));

    const missing = PANCE_DIFFERENTIALS.filter(
      (ddx) => !existingComplaints.has(ddx.presentingComplaint.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All differential diagnoses already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const ddx = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${ddx.presentingComplaint}`);

      try {
        const data = await generateDifferentialData(ddx.presentingComplaint, ddx.category);

        await prisma.differentialDiagnosis.create({
          data: {
            id: randomUUID(),
            presentingComplaint: ddx.presentingComplaint, // This is the unique key!
            category: ddx.category,
            isEmergency: ensureBool(data.isEmergency),
            differentialList: ensureArray(data.differentialList),
            mustNotMiss: ensureArray(data.mustNotMiss),
            workup: ensureString(data.workup),
            byAcuity: ensureJson(data.byAcuity),
            byAge: ensureJson(data.byAge),
            clinicalPearls: ensureArray(data.clinicalPearls),
            commonMistakes: ensureArray(data.commonMistakes),
            diagnosticAlgorithm: ensureString(data.diagnosticAlgorithm),
            dispositionGuidance: ensureString(data.dispositionGuidance),
            distinguishingFeatures: ensureJson(data.distinguishingFeatures),
            initialWorkup: ensureArray(data.initialWorkup),
            isHighYield: ensureBool(data.isHighYield),
            keyExamFindings: ensureArray(data.keyExamFindings),
            keyQuestions: ensureArray(data.keyQuestions),
            mnemonics: ensureArray(data.mnemonics),
            mostCommon: ensureArray(data.mostCommon),
            mostDangerous: ensureArray(data.mostDangerous),
            oftenMissed: ensureArray(data.oftenMissed),
            panceYield: ensureInt(data.panceYield),
            reassuringFeatures: ensureArray(data.reassuringFeatures),
            redFlags: ensureArray(data.redFlags),
            typicalPresentation: ensureString(data.typicalPresentation),
            updatedAt: new Date(),
          },
        });

        console.log(`  ✅ Created`);
        success++;
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failed++;
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUMMARY                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`Created: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total differential diagnoses now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
