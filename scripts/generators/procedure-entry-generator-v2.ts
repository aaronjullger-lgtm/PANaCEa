/**
 * Procedure Entry Generator v2
 * Creates missing procedures for PANCE coverage
 * Fixed to match Prisma schema exactly
 */

import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant procedures
const PANCE_PROCEDURES = [
  { name: 'Nasogastric Tube Insertion', category: 'Gastrointestinal', system: 'Gastrointestinal' },
  { name: 'Foley Catheter Insertion', category: 'Urinary', system: 'Genitourinary' },
  { name: 'Suprapubic Catheter Placement', category: 'Urinary', system: 'Genitourinary' },
  {
    name: 'Central Venous Catheter Insertion',
    category: 'Vascular Access',
    system: 'Cardiovascular',
  },
  { name: 'Peripheral IV Insertion', category: 'Vascular Access', system: 'Cardiovascular' },
  { name: 'Arterial Line Placement', category: 'Vascular Access', system: 'Cardiovascular' },
  { name: 'Intraosseous Access', category: 'Vascular Access', system: 'Musculoskeletal' },
  { name: 'Chest Tube Insertion', category: 'Thoracic', system: 'Pulmonary' },
  { name: 'Needle Thoracostomy', category: 'Thoracic', system: 'Pulmonary' },
  { name: 'Needle Pericardiocentesis', category: 'Cardiac', system: 'Cardiovascular' },
  { name: 'Endotracheal Intubation', category: 'Airway', system: 'Pulmonary' },
  { name: 'Cricothyrotomy', category: 'Airway', system: 'Pulmonary' },
  { name: 'Bag-Valve-Mask Ventilation', category: 'Airway', system: 'Pulmonary' },
  { name: 'Cardioversion', category: 'Cardiac', system: 'Cardiovascular' },
  { name: 'Defibrillation', category: 'Cardiac', system: 'Cardiovascular' },
  { name: 'Transcutaneous Pacing', category: 'Cardiac', system: 'Cardiovascular' },
  { name: 'Paracentesis', category: 'Abdominal', system: 'Gastrointestinal' },
  { name: 'Diagnostic Peritoneal Lavage', category: 'Abdominal', system: 'Gastrointestinal' },
  { name: 'Incision and Drainage', category: 'Skin/Soft Tissue', system: 'Dermatologic' },
  { name: 'Wound Closure - Suturing', category: 'Skin/Soft Tissue', system: 'Dermatologic' },
  { name: 'Wound Closure - Staples', category: 'Skin/Soft Tissue', system: 'Dermatologic' },
  { name: 'Splinting', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Joint Reduction - Shoulder', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Joint Reduction - Elbow', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Joint Reduction - Hip', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Joint Reduction - Knee', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Fracture Reduction', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Joint Aspiration', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Corticosteroid Joint Injection', category: 'Orthopedic', system: 'Musculoskeletal' },
  { name: 'Trigger Point Injection', category: 'Pain Management', system: 'Musculoskeletal' },
  { name: 'Epistaxis Management', category: 'ENT', system: 'EENT' },
  { name: 'Foreign Body Removal - Ear', category: 'ENT', system: 'EENT' },
  { name: 'Foreign Body Removal - Nose', category: 'ENT', system: 'EENT' },
  { name: 'Foreign Body Removal - Eye', category: 'Ophthalmologic', system: 'EENT' },
  { name: 'Slit Lamp Examination', category: 'Ophthalmologic', system: 'EENT' },
  { name: 'Tonometry', category: 'Ophthalmologic', system: 'EENT' },
  { name: 'Lateral Canthotomy', category: 'Ophthalmologic', system: 'EENT' },
];

interface ProcedureData {
  displayName?: string;
  aliases?: string[];
  type?: string;
  description?: string;
  panceYield?: number;
  isHighYield?: boolean;
  boardYieldFacts?: string[];
  indications?: string[];
  absoluteContraindications?: string[];
  relativeContraindications?: string[];
  preparation?: string;
  equipment?: string[];
  anatomicLandmarks?: string[];
  technique?: string;
  positioning?: string;
  anesthesia?: string;
  duration?: string;
  complications?: string[];
  complicationRates?: Record<string, string>;
  emergencyManagement?: string;
  safetyChecklist?: string[];
  postProcedureCare?: string;
  expectedFindings?: string;
  abnormalFindings?: string[];
  followUp?: string;
  recovery?: string;
  consentPoints?: string[];
  documentationRequirements?: string[];
  clinicalPearls?: string[];
  commonMistakes?: string[];
  testQuestionTips?: string[];
  mnemonics?: string[];
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

async function generateProcedureData(
  name: string,
  category: string,
  system: string
): Promise<ProcedureData> {
  await rateLimiter.acquire();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive procedure information for: ${name}

Category: ${category}
System: ${system}

Provide accurate, PANCE/board-focused data including:
- Display name and aliases
- Type of procedure (diagnostic, therapeutic, etc.)
- Description
- PANCE yield (1-10) and whether high-yield
- Board yield facts
- Indications
- Absolute and relative contraindications
- Patient preparation
- Equipment needed
- Anatomic landmarks
- Step-by-step technique
- Patient positioning
- Anesthesia requirements
- Typical duration
- Complications and their rates (as object with complication: rate pairs)
- Emergency management of complications
- Safety checklist items
- Post-procedure care
- Expected normal findings
- Abnormal findings to watch for
- Follow-up requirements
- Recovery expectations
- Key consent points
- Documentation requirements
- Clinical pearls, common mistakes, test question tips, mnemonics

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
  console.log('║          PROCEDURE ENTRY GENERATOR v2                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.procedure.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const missing = PANCE_PROCEDURES.filter(
      (procedure) => !existingNames.has(procedure.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All procedures already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const procedure = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${procedure.name}`);

      try {
        const data = await generateProcedureData(
          procedure.name,
          procedure.category,
          procedure.system
        );

        await prisma.procedure.create({
          data: {
            id: randomUUID(),
            name: procedure.name,
            displayName: ensureString(data.displayName),
            aliases: ensureArray(data.aliases),
            category: procedure.category,
            type: ensureString(data.type),
            system: procedure.system,
            description: ensureString(data.description),
            panceYield: ensureInt(data.panceYield),
            isHighYield: ensureBool(data.isHighYield),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            indications: ensureArray(data.indications),
            absoluteContraindications: ensureArray(data.absoluteContraindications),
            relativeContraindications: ensureArray(data.relativeContraindications),
            preparation: ensureString(data.preparation),
            equipment: ensureArray(data.equipment),
            anatomicLandmarks: ensureArray(data.anatomicLandmarks),
            technique: ensureString(data.technique),
            positioning: ensureString(data.positioning),
            anesthesia: ensureString(data.anesthesia),
            duration: ensureString(data.duration),
            complications: ensureArray(data.complications),
            complicationRates: ensureJson(data.complicationRates),
            emergencyManagement: ensureString(data.emergencyManagement),
            safetyChecklist: ensureArray(data.safetyChecklist),
            postProcedureCare: ensureString(data.postProcedureCare),
            expectedFindings: ensureString(data.expectedFindings),
            abnormalFindings: ensureArray(data.abnormalFindings),
            followUp: ensureString(data.followUp),
            recovery: ensureString(data.recovery),
            consentPoints: ensureArray(data.consentPoints),
            documentationRequirements: ensureArray(data.documentationRequirements),
            clinicalPearls: ensureArray(data.clinicalPearls),
            commonMistakes: ensureArray(data.commonMistakes),
            testQuestionTips: ensureArray(data.testQuestionTips),
            mnemonics: ensureArray(data.mnemonics),
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
    console.log(`Total procedures now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
