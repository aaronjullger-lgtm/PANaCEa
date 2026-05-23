// @ts-nocheck
/**
 * ImagingStudy Entry Generator v2
 * Creates missing imaging studies for PANCE coverage
 * Fixed to match Prisma schema exactly
 */

import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant imaging studies
const PANCE_IMAGING_STUDIES = [
  { name: 'Ventilation-Perfusion Scan', modality: 'Nuclear Medicine', bodyRegion: 'Chest' },
  { name: 'HIDA Scan', modality: 'Nuclear Medicine', bodyRegion: 'Abdomen' },
  { name: 'Bone Scan', modality: 'Nuclear Medicine', bodyRegion: 'Whole Body' },
  { name: 'PET-CT', modality: 'Nuclear Medicine', bodyRegion: 'Whole Body' },
  { name: 'Renal Scan', modality: 'Nuclear Medicine', bodyRegion: 'Abdomen' },
  { name: 'Thyroid Uptake Scan', modality: 'Nuclear Medicine', bodyRegion: 'Neck' },
  { name: 'Myocardial Perfusion Imaging', modality: 'Nuclear Medicine', bodyRegion: 'Chest' },
  { name: 'Stress Echocardiography', modality: 'Ultrasound', bodyRegion: 'Chest' },
  { name: 'Transesophageal Echocardiography', modality: 'Ultrasound', bodyRegion: 'Chest' },
  { name: 'Carotid Duplex Ultrasound', modality: 'Ultrasound', bodyRegion: 'Neck' },
  { name: 'Lower Extremity Venous Doppler', modality: 'Ultrasound', bodyRegion: 'Lower Extremity' },
  { name: 'Renal Artery Doppler', modality: 'Ultrasound', bodyRegion: 'Abdomen' },
  { name: 'Scrotal Ultrasound', modality: 'Ultrasound', bodyRegion: 'Pelvis' },
  { name: 'Transvaginal Ultrasound', modality: 'Ultrasound', bodyRegion: 'Pelvis' },
  { name: 'Obstetric Ultrasound', modality: 'Ultrasound', bodyRegion: 'Pelvis' },
  { name: 'MRCP', modality: 'MRI', bodyRegion: 'Abdomen' },
  { name: 'MR Enterography', modality: 'MRI', bodyRegion: 'Abdomen' },
  { name: 'Cardiac MRI', modality: 'MRI', bodyRegion: 'Chest' },
  { name: 'CT Angiography - Coronary', modality: 'CT', bodyRegion: 'Chest' },
  { name: 'CT Angiography - Pulmonary', modality: 'CT', bodyRegion: 'Chest' },
  { name: 'CT Angiography - Aorta', modality: 'CT', bodyRegion: 'Chest/Abdomen' },
  { name: 'CT Urogram', modality: 'CT', bodyRegion: 'Abdomen/Pelvis' },
  { name: 'KUB (Plain Film)', modality: 'X-Ray', bodyRegion: 'Abdomen' },
  { name: 'Barium Swallow', modality: 'Fluoroscopy', bodyRegion: 'Chest/Esophagus' },
  { name: 'Upper GI Series', modality: 'Fluoroscopy', bodyRegion: 'Abdomen' },
  { name: 'Small Bowel Follow Through', modality: 'Fluoroscopy', bodyRegion: 'Abdomen' },
  { name: 'Barium Enema', modality: 'Fluoroscopy', bodyRegion: 'Abdomen' },
  { name: 'Voiding Cystourethrogram', modality: 'Fluoroscopy', bodyRegion: 'Pelvis' },
  { name: 'Mammography', modality: 'X-Ray', bodyRegion: 'Chest' },
  { name: 'DEXA Scan', modality: 'X-Ray', bodyRegion: 'Spine/Hip' },
];

interface ImagingStudyData {
  description?: string;
  indications?: string[];
  contraindications?: string[];
  advantages?: string[];
  limitations?: string[];
  usesContrast?: boolean;
  usesRadiation?: boolean;
  contrastType?: string;
  contrastAgent?: string;
  allergyProtocol?: string;
  radiationDose?: string;
  pregnancySafety?: string;
  renalConsiderations?: string;
  preparation?: string;
  scanDuration?: string;
  protocol?: string;
  normalFindings?: string;
  keyFindings?: Record<string, string>;
  classicSigns?: string[];
  firstLineFor?: string[];
  alternativeTo?: string[];
  whenToAvoid?: string[];
  panceYield?: number;
  isHighYield?: boolean;
  boardYieldFacts?: string[];
  clinicalPearls?: string[];
  commonMistakes?: string[];
  testQuestionTips?: string[];
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

async function generateImagingStudyData(
  name: string,
  modality: string,
  bodyRegion: string
): Promise<ImagingStudyData> {
  await rateLimiter.acquire();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive imaging study information for: ${name}

Modality: ${modality}
Body Region: ${bodyRegion}

Provide accurate, PANCE/board-focused data including:
- Description of the study
- Indications and contraindications
- Whether it uses contrast and/or radiation
- Contrast type, agent, allergy protocol if applicable
- Radiation dose level if applicable
- Pregnancy safety considerations
- Renal considerations if contrast used
- Patient preparation
- Scan duration
- Protocol details
- Normal and key abnormal findings (as object with condition: finding pairs)
- Classic radiologic signs
- When this is first-line imaging
- Alternative studies
- When to avoid this study
- PANCE yield (1-10) and whether high-yield
- Board yield facts, clinical pearls, common mistakes, test question tips

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
  console.log('║          IMAGING STUDY ENTRY GENERATOR v2                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.imagingStudy.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const missing = PANCE_IMAGING_STUDIES.filter(
      (study) => !existingNames.has(study.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All imaging studies already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const study = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${study.name}`);

      try {
        const data = await generateImagingStudyData(study.name, study.modality, study.bodyRegion);

        await prisma.imagingStudy.create({
          data: {
            id: randomUUID(),
            name: study.name,
            modality: study.modality,
            bodyRegion: study.bodyRegion,
            description: ensureString(data.description),
            indications: ensureArray(data.indications),
            contraindications: ensureArray(data.contraindications),
            usesContrast: ensureBool(data.usesContrast),
            usesRadiation: ensureBool(data.usesRadiation),
            contrastType: ensureString(data.contrastType),
            contrastAgent: ensureString(data.contrastAgent),
            allergyProtocol: ensureString(data.allergyProtocol),
            radiationDose: ensureString(data.radiationDose),
            pregnancySafety: ensureString(data.pregnancySafety),
            renalConsiderations: ensureString(data.renalConsiderations),
            preparation: ensureString(data.preparation),
            scanDuration: ensureString(data.scanDuration),
            protocol: ensureString(data.protocol),
            normalFindings: ensureString(data.normalFindings),
            keyFindings: ensureJson(data.keyFindings),
            classicSigns: ensureArray(data.classicSigns),
            firstLineFor: ensureArray(data.firstLineFor),
            alternativeTo: ensureArray(data.alternativeTo),
            whenToAvoid: ensureArray(data.whenToAvoid),
            advantages: ensureArray(data.advantages),
            limitations: ensureArray(data.limitations),
            panceYield: ensureInt(data.panceYield),
            isHighYield: ensureBool(data.isHighYield),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            clinicalPearls: ensureArray(data.clinicalPearls),
            commonMistakes: ensureArray(data.commonMistakes),
            testQuestionTips: ensureArray(data.testQuestionTips),
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
    console.log(`Total imaging studies now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
