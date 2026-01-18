/**
 * ECGPattern Entry Generator
 * Creates missing ECG patterns for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant ECG patterns
const PANCE_ECG_PATTERNS = [
  // Arrhythmias
  {
    name: 'Atrial Flutter',
    category: 'Arrhythmias',
    clinicalContext: 'Regular narrow complex tachycardia with sawtooth pattern',
  },
  {
    name: 'Atrial Fibrillation',
    category: 'Arrhythmias',
    clinicalContext: 'Irregularly irregular rhythm, absent P waves',
  },
  {
    name: 'Multifocal Atrial Tachycardia',
    category: 'Arrhythmias',
    clinicalContext: '3+ P wave morphologies, COPD association',
  },
  {
    name: 'Supraventricular Tachycardia',
    category: 'Arrhythmias',
    clinicalContext: 'Regular narrow complex tachycardia',
  },
  { name: 'AVNRT', category: 'Arrhythmias', clinicalContext: 'AV nodal reentrant tachycardia' },
  {
    name: 'WPW Pattern',
    category: 'Arrhythmias',
    clinicalContext: 'Short PR, delta wave, pre-excitation',
  },
  {
    name: 'Ventricular Tachycardia',
    category: 'Arrhythmias',
    clinicalContext: 'Wide complex tachycardia',
  },
  {
    name: 'Torsades de Pointes',
    category: 'Arrhythmias',
    clinicalContext: 'Polymorphic VT with twisting QRS',
  },
  {
    name: 'Ventricular Fibrillation',
    category: 'Arrhythmias',
    clinicalContext: 'Chaotic, no organized rhythm',
  },
  {
    name: 'Sick Sinus Syndrome',
    category: 'Arrhythmias',
    clinicalContext: 'Bradycardia-tachycardia syndrome',
  },
  {
    name: 'Junctional Rhythm',
    category: 'Arrhythmias',
    clinicalContext: 'Narrow QRS with absent/inverted P waves',
  },

  // Conduction Abnormalities
  { name: 'First Degree AV Block', category: 'Conduction', clinicalContext: 'PR interval > 200ms' },
  {
    name: 'Second Degree AV Block Type I',
    category: 'Conduction',
    clinicalContext: 'Wenckebach - progressive PR prolongation',
  },
  {
    name: 'Second Degree AV Block Type II',
    category: 'Conduction',
    clinicalContext: 'Mobitz II - sudden dropped beats',
  },
  {
    name: 'Third Degree AV Block',
    category: 'Conduction',
    clinicalContext: 'Complete heart block - AV dissociation',
  },
  {
    name: 'Right Bundle Branch Block',
    category: 'Conduction',
    clinicalContext: "RSR' in V1, wide QRS",
  },
  {
    name: 'Left Bundle Branch Block',
    category: 'Conduction',
    clinicalContext: 'Wide QRS, notched R in lateral leads',
  },
  {
    name: 'Left Anterior Fascicular Block',
    category: 'Conduction',
    clinicalContext: 'Left axis deviation',
  },
  {
    name: 'Left Posterior Fascicular Block',
    category: 'Conduction',
    clinicalContext: 'Right axis deviation',
  },
  { name: 'Bifascicular Block', category: 'Conduction', clinicalContext: 'RBBB + LAFB or LPFB' },
  {
    name: 'Trifascicular Block',
    category: 'Conduction',
    clinicalContext: 'Bifascicular + 1st degree AV block',
  },

  // Ischemia/Infarction
  {
    name: 'Anterior STEMI',
    category: 'Ischemia',
    clinicalContext: 'ST elevation V1-V4, LAD occlusion',
  },
  {
    name: 'Inferior STEMI',
    category: 'Ischemia',
    clinicalContext: 'ST elevation II, III, aVF, RCA/LCx occlusion',
  },
  { name: 'Lateral STEMI', category: 'Ischemia', clinicalContext: 'ST elevation I, aVL, V5-V6' },
  {
    name: 'Posterior STEMI',
    category: 'Ischemia',
    clinicalContext: 'ST depression V1-V3, tall R waves',
  },
  {
    name: 'Right Ventricular MI',
    category: 'Ischemia',
    clinicalContext: 'ST elevation V4R, inferior MI association',
  },
  { name: 'NSTEMI', category: 'Ischemia', clinicalContext: 'ST depression, T wave inversions' },
  {
    name: 'Wellens Syndrome',
    category: 'Ischemia',
    clinicalContext: 'Biphasic/deeply inverted T waves V2-V3',
  },
  {
    name: 'de Winter T Waves',
    category: 'Ischemia',
    clinicalContext: 'ST depression + hyperacute T waves',
  },
  { name: 'Sgarbossa Criteria', category: 'Ischemia', clinicalContext: 'STEMI diagnosis in LBBB' },

  // Chamber Abnormalities
  {
    name: 'Left Ventricular Hypertrophy',
    category: 'Hypertrophy',
    clinicalContext: 'High voltage, strain pattern',
  },
  {
    name: 'Right Ventricular Hypertrophy',
    category: 'Hypertrophy',
    clinicalContext: 'Right axis, tall R in V1',
  },
  {
    name: 'Left Atrial Enlargement',
    category: 'Hypertrophy',
    clinicalContext: 'P mitrale, notched P waves',
  },
  {
    name: 'Right Atrial Enlargement',
    category: 'Hypertrophy',
    clinicalContext: 'P pulmonale, tall peaked P waves',
  },
  {
    name: 'Biventricular Hypertrophy',
    category: 'Hypertrophy',
    clinicalContext: 'Combined LVH + RVH criteria',
  },

  // Electrolyte Abnormalities
  {
    name: 'Hyperkalemia',
    category: 'Electrolyte',
    clinicalContext: 'Peaked T waves, widened QRS, sine wave',
  },
  {
    name: 'Hypokalemia',
    category: 'Electrolyte',
    clinicalContext: 'U waves, flattened T waves, ST depression',
  },
  { name: 'Hypercalcemia', category: 'Electrolyte', clinicalContext: 'Shortened QT interval' },
  { name: 'Hypocalcemia', category: 'Electrolyte', clinicalContext: 'Prolonged QT interval' },
  {
    name: 'Hypomagnesemia',
    category: 'Electrolyte',
    clinicalContext: 'Similar to hypokalemia, U waves',
  },

  // Other Patterns
  {
    name: 'Pericarditis',
    category: 'Other',
    clinicalContext: 'Diffuse ST elevation, PR depression',
  },
  { name: 'Brugada Pattern', category: 'Other', clinicalContext: 'Coved ST elevation V1-V2' },
  {
    name: 'Long QT Syndrome',
    category: 'Other',
    clinicalContext: 'Prolonged QTc > 470ms male, >480ms female',
  },
  { name: 'Short QT Syndrome', category: 'Other', clinicalContext: 'QTc < 330ms' },
  {
    name: 'Early Repolarization',
    category: 'Other',
    clinicalContext: 'J point elevation, benign vs malignant',
  },
  {
    name: 'Digoxin Effect',
    category: 'Drug Effect',
    clinicalContext: 'Scooped ST depression, short QT',
  },
  {
    name: 'Digitalis Toxicity',
    category: 'Drug Effect',
    clinicalContext: 'Arrhythmias, bidirectional VT',
  },
  {
    name: 'Pulmonary Embolism',
    category: 'Other',
    clinicalContext: 'S1Q3T3, sinus tachycardia, RBBB',
  },
  { name: 'Hypothermia', category: 'Other', clinicalContext: 'Osborn (J) waves, bradycardia' },
  {
    name: 'Takotsubo Cardiomyopathy',
    category: 'Other',
    clinicalContext: 'Deep T wave inversions, QT prolongation',
  },
];

// Schema for Gemini response
const ecgPatternSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    diagnosticCriteria: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    keyFeatures: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    rate: { type: SchemaType.STRING },
    rhythm: { type: SchemaType.STRING },
    pWave: { type: SchemaType.STRING },
    prInterval: { type: SchemaType.STRING },
    qrsComplex: { type: SchemaType.STRING },
    stSegment: { type: SchemaType.STRING },
    tWave: { type: SchemaType.STRING },
    qtInterval: { type: SchemaType.STRING },
    associatedConditions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    differentialDiagnosis: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    management: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    'description',
    'diagnosticCriteria',
    'keyFeatures',
    'clinicalPearls',
    'boardYieldFacts',
  ],
};

interface ECGPatternData {
  description?: string;
  diagnosticCriteria?: string[];
  keyFeatures?: string[];
  rate?: string;
  rhythm?: string;
  pWave?: string;
  prInterval?: string;
  qrsComplex?: string;
  stSegment?: string;
  tWave?: string;
  qtInterval?: string;
  associatedConditions?: string[];
  differentialDiagnosis?: string[];
  management?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
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

async function generateECGPatternData(
  name: string,
  category: string,
  clinicalContext: string
): Promise<ECGPatternData> {
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
Clinical Context: ${clinicalContext}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the ECG pattern (2-3 sentences)",
  "diagnosticCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "keyFeatures": ["Feature 1", "Feature 2"],
  "rate": "Typical rate or range",
  "rhythm": "Rhythm description",
  "pWave": "P wave characteristics",
  "prInterval": "PR interval characteristics",
  "qrsComplex": "QRS characteristics",
  "stSegment": "ST segment characteristics",
  "tWave": "T wave characteristics",
  "qtInterval": "QT interval if relevant",
  "associatedConditions": ["Condition 1", "Condition 2"],
  "differentialDiagnosis": ["DDx 1", "DDx 2"],
  "management": ["Management step 1", "Management step 2"],
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "mnemonics": ["Memory aid if applicable"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as ECGPatternData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ECGPatternData;
    }
    throw new Error(`Failed to parse response for ${name}`);
  }
}

const ensureString = (val: any): string => {
  if (Array.isArray(val)) return val.join('. ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val || '');
};

const ensureArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === 'string') return val.split('. ').filter((s) => s.trim());
  return [];
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          ECG PATTERN ENTRY GENERATOR                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing patterns
    const existing = await prisma.eCGPattern.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

    // Filter out patterns that already exist
    const toCreate = PANCE_ECG_PATTERNS.filter((p) => !existingNames.has(p.name.toLowerCase()));

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All ECG patterns already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const pattern = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${pattern.name}`);

      try {
        const data = await generateECGPatternData(
          pattern.name,
          pattern.category,
          pattern.clinicalContext
        );

        await prisma.eCGPattern.create({
          data: {
            id: randomUUID(),
            name: pattern.name,
            displayName: pattern.name,
            category: pattern.category,
            pathognomonic: ensureString(data.description),
            diagnosticCriteria: ensureArray(data.diagnosticCriteria),
            etiology: ensureArray(data.keyFeatures),
            rate: ensureString(data.rate),
            rhythm: ensureString(data.rhythm),
            pWave: ensureString(data.pWave),
            prInterval: ensureString(data.prInterval),
            qrsComplex: ensureString(data.qrsComplex),
            stSegment: ensureString(data.stSegment),
            tWave: ensureString(data.tWave),
            qtInterval: ensureString(data.qtInterval),
            associatedConditions: ensureArray(data.associatedConditions),
            mimics: ensureArray(data.differentialDiagnosis),
            acuteManagement: ensureArray(data.management).join('; '),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
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
