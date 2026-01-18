/**
 * ECGPattern Entry Generator v2
 * Creates missing ECG patterns for PANCE coverage
 * Fixed to match Prisma schema exactly
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant ECG patterns
const PANCE_ECG_PATTERNS = [
  { name: 'Wandering Atrial Pacemaker', category: 'Arrhythmia' },
  { name: 'Multifocal Atrial Tachycardia', category: 'Arrhythmia' },
  { name: 'Junctional Escape Rhythm', category: 'Arrhythmia' },
  { name: 'Accelerated Junctional Rhythm', category: 'Arrhythmia' },
  { name: 'Idioventricular Rhythm', category: 'Arrhythmia' },
  { name: 'Accelerated Idioventricular Rhythm', category: 'Arrhythmia' },
  { name: 'Epsilon Wave', category: 'Cardiomyopathy' },
  { name: 'Osborn Wave', category: 'Metabolic' },
  { name: 'Delta Wave', category: 'Accessory Pathway' },
  { name: 'Brugada Pattern Type 1', category: 'Channelopathy' },
  { name: 'Brugada Pattern Type 2', category: 'Channelopathy' },
  { name: 'Long QT Syndrome Pattern', category: 'Channelopathy' },
  { name: 'Short QT Syndrome Pattern', category: 'Channelopathy' },
  { name: 'Digitalis Effect', category: 'Drug Effect' },
  { name: 'Digitalis Toxicity', category: 'Drug Effect' },
  { name: 'Wellens Syndrome', category: 'Ischemia' },
  { name: 'De Winter T Waves', category: 'Ischemia' },
  { name: 'Left Posterior Fascicular Block', category: 'Conduction' },
  { name: 'Left Anterior Fascicular Block', category: 'Conduction' },
  { name: 'Bifascicular Block', category: 'Conduction' },
  { name: 'Trifascicular Block', category: 'Conduction' },
  { name: 'Sgarbossa Criteria Pattern', category: 'Ischemia' },
  { name: 'Wenckebach Pattern', category: 'Conduction' },
  { name: 'Mobitz Type II', category: 'Conduction' },
  { name: 'Complete Heart Block', category: 'Conduction' },
  { name: 'Pericarditis ECG Changes', category: 'Pericardial' },
  { name: 'Electrical Alternans', category: 'Pericardial' },
  { name: 'Low Voltage QRS', category: 'Other' },
  { name: 'Right Ventricular Strain Pattern', category: 'Hypertrophy' },
  { name: 'Left Ventricular Strain Pattern', category: 'Hypertrophy' },
];

// Schema for Gemini response - matches Prisma ECGPattern model exactly
const ecgPatternSchema = {
  type: SchemaType.OBJECT,
  properties: {
    displayName: { type: SchemaType.STRING },
    aliases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    subcategory: { type: SchemaType.STRING },
    panceYield: { type: SchemaType.NUMBER },
    isHighYield: { type: SchemaType.BOOLEAN },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    isEmergency: { type: SchemaType.BOOLEAN },
    rate: { type: SchemaType.STRING },
    rhythm: { type: SchemaType.STRING },
    pWave: { type: SchemaType.STRING },
    prInterval: { type: SchemaType.STRING },
    qrsComplex: { type: SchemaType.STRING },
    qtInterval: { type: SchemaType.STRING },
    stSegment: { type: SchemaType.STRING },
    tWave: { type: SchemaType.STRING },
    diagnosticCriteria: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    pathognomonic: { type: SchemaType.STRING },
    etiology: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    symptoms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    hemodynamicEffect: { type: SchemaType.STRING },
    associatedConditions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    acuteManagement: { type: SchemaType.STRING },
    medications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    cardioversion: { type: SchemaType.STRING },
    pacing: { type: SchemaType.STRING },
    referral: { type: SchemaType.STRING },
    mimics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonMistakes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    testQuestionTips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['diagnosticCriteria', 'rate', 'rhythm', 'clinicalPearls', 'boardYieldFacts'],
};

interface ECGPatternData {
  displayName?: string;
  aliases?: string[];
  subcategory?: string;
  panceYield?: number;
  isHighYield?: boolean;
  boardYieldFacts?: string[];
  isEmergency?: boolean;
  rate?: string;
  rhythm?: string;
  pWave?: string;
  prInterval?: string;
  qrsComplex?: string;
  qtInterval?: string;
  stSegment?: string;
  tWave?: string;
  diagnosticCriteria?: string[];
  pathognomonic?: string;
  etiology?: string[];
  symptoms?: string[];
  hemodynamicEffect?: string;
  associatedConditions?: string[];
  acuteManagement?: string;
  medications?: string[];
  cardioversion?: string;
  pacing?: string;
  referral?: string;
  mimics?: string[];
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

async function generateECGPatternData(name: string, category: string): Promise<ECGPatternData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive ECG pattern information for: ${name}

Category: ${category}

Provide accurate, PANCE/board-focused data including:
- ECG characteristics (rate, rhythm, P wave, PR interval, QRS, ST segment, T wave, QT interval)
- Diagnostic criteria
- Etiology and associated conditions
- Symptoms and hemodynamic effects
- Management (acute, medications, cardioversion, pacing)
- Mimics and distinguishing features
- Clinical pearls, common mistakes, test question tips, mnemonics
- Whether this is high-yield for PANCE (panceYield 1-10, isHighYield boolean)
- Whether this is an emergency

Return as JSON matching this structure exactly.`;

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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          ECG PATTERN ENTRY GENERATOR v2                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.eCGPattern.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const missing = PANCE_ECG_PATTERNS.filter(
      (pattern) => !existingNames.has(pattern.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All ECG patterns already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const pattern = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${pattern.name}`);

      try {
        const data = await generateECGPatternData(pattern.name, pattern.category);

        await prisma.eCGPattern.create({
          data: {
            id: randomUUID(),
            name: pattern.name,
            displayName: ensureString(data.displayName),
            aliases: ensureArray(data.aliases),
            category: pattern.category,
            subcategory: ensureString(data.subcategory),
            panceYield: ensureInt(data.panceYield),
            isHighYield: ensureBool(data.isHighYield),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            isEmergency: ensureBool(data.isEmergency),
            rate: ensureString(data.rate),
            rhythm: ensureString(data.rhythm),
            pWave: ensureString(data.pWave),
            prInterval: ensureString(data.prInterval),
            qrsComplex: ensureString(data.qrsComplex),
            qtInterval: ensureString(data.qtInterval),
            stSegment: ensureString(data.stSegment),
            tWave: ensureString(data.tWave),
            diagnosticCriteria: ensureArray(data.diagnosticCriteria),
            pathognomonic: ensureString(data.pathognomonic),
            etiology: ensureArray(data.etiology),
            symptoms: ensureArray(data.symptoms),
            hemodynamicEffect: ensureString(data.hemodynamicEffect),
            associatedConditions: ensureArray(data.associatedConditions),
            acuteManagement: ensureString(data.acuteManagement),
            medications: ensureArray(data.medications),
            cardioversion: ensureString(data.cardioversion),
            pacing: ensureString(data.pacing),
            referral: ensureString(data.referral),
            mimics: ensureArray(data.mimics),
            clinicalPearls: ensureArray(data.clinicalPearls),
            commonMistakes: ensureArray(data.commonMistakes),
            testQuestionTips: ensureArray(data.testQuestionTips),
            mnemonics: ensureArray(data.mnemonics),
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
    console.log(`Total ECG patterns now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
