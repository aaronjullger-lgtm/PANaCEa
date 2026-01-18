/**
 * SpecialTest Entry Generator
 * Creates missing special tests for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant special tests organized by system
const PANCE_SPECIAL_TESTS = [
  // Orthopedic - Shoulder
  {
    name: 'Speed Test',
    category: 'Orthopedic - Shoulder',
    purpose: 'Biceps tendinopathy evaluation',
  },
  {
    name: 'Yergason Test',
    category: 'Orthopedic - Shoulder',
    purpose: 'Biceps tendon instability',
  },
  { name: "O'Brien Test", category: 'Orthopedic - Shoulder', purpose: 'SLAP lesion evaluation' },
  {
    name: 'Sulcus Sign',
    category: 'Orthopedic - Shoulder',
    purpose: 'Inferior shoulder instability',
  },
  {
    name: 'Apprehension Test (Shoulder)',
    category: 'Orthopedic - Shoulder',
    purpose: 'Anterior shoulder instability',
  },
  {
    name: 'Relocation Test',
    category: 'Orthopedic - Shoulder',
    purpose: 'Anterior shoulder instability confirmation',
  },
  {
    name: 'Cross-Body Adduction Test',
    category: 'Orthopedic - Shoulder',
    purpose: 'AC joint pathology',
  },
  { name: 'Lift-Off Test', category: 'Orthopedic - Shoulder', purpose: 'Subscapularis tear' },
  {
    name: 'Belly Press Test',
    category: 'Orthopedic - Shoulder',
    purpose: 'Subscapularis function',
  },
  {
    name: 'External Rotation Lag Sign',
    category: 'Orthopedic - Shoulder',
    purpose: 'Infraspinatus tear',
  },

  // Orthopedic - Elbow/Wrist/Hand
  {
    name: 'Cozen Test',
    category: 'Orthopedic - Elbow',
    purpose: 'Lateral epicondylitis (tennis elbow)',
  },
  { name: 'Mill Test', category: 'Orthopedic - Elbow', purpose: 'Lateral epicondylitis' },
  { name: "Golfer's Elbow Test", category: 'Orthopedic - Elbow', purpose: 'Medial epicondylitis' },
  { name: 'Valgus Stress Test (Elbow)', category: 'Orthopedic - Elbow', purpose: 'UCL injury' },
  { name: 'Watson Test', category: 'Orthopedic - Wrist', purpose: 'Scapholunate instability' },
  { name: 'Grind Test', category: 'Orthopedic - Hand', purpose: 'CMC arthritis of thumb' },
  { name: 'Allen Test', category: 'Vascular - Hand', purpose: 'Arterial patency of hand' },

  // Orthopedic - Hip
  { name: 'Trendelenburg Test', category: 'Orthopedic - Hip', purpose: 'Hip abductor weakness' },
  { name: 'Ober Test', category: 'Orthopedic - Hip', purpose: 'IT band tightness' },
  { name: 'FADIR Test', category: 'Orthopedic - Hip', purpose: 'Femoral acetabular impingement' },
  { name: 'Log Roll Test', category: 'Orthopedic - Hip', purpose: 'Hip joint pathology' },
  { name: 'Piriformis Test', category: 'Orthopedic - Hip', purpose: 'Piriformis syndrome' },

  // Orthopedic - Knee
  { name: 'Pivot Shift Test', category: 'Orthopedic - Knee', purpose: 'ACL insufficiency' },
  { name: 'Thessaly Test', category: 'Orthopedic - Knee', purpose: 'Meniscal pathology' },
  { name: 'Apley Compression Test', category: 'Orthopedic - Knee', purpose: 'Meniscal tear' },
  {
    name: 'Apley Distraction Test',
    category: 'Orthopedic - Knee',
    purpose: 'Ligament vs meniscal injury differentiation',
  },
  {
    name: 'Patellar Apprehension Test',
    category: 'Orthopedic - Knee',
    purpose: 'Patellar instability',
  },
  { name: 'Ballottement Test', category: 'Orthopedic - Knee', purpose: 'Knee effusion' },
  { name: 'Dial Test', category: 'Orthopedic - Knee', purpose: 'Posterolateral corner injury' },

  // Orthopedic - Ankle/Foot
  { name: 'Talar Tilt Test', category: 'Orthopedic - Ankle', purpose: 'CFL injury' },
  { name: 'Squeeze Test (Fibula)', category: 'Orthopedic - Ankle', purpose: 'Syndesmosis injury' },
  {
    name: 'External Rotation Stress Test',
    category: 'Orthopedic - Ankle',
    purpose: 'Syndesmosis injury',
  },
  { name: 'Mulder Click', category: 'Orthopedic - Foot', purpose: 'Morton neuroma' },

  // Spine
  {
    name: 'Slump Test',
    category: 'Orthopedic - Spine',
    purpose: 'Neural tension, disc herniation',
  },
  {
    name: 'Femoral Nerve Stretch Test',
    category: 'Orthopedic - Spine',
    purpose: 'Upper lumbar radiculopathy',
  },
  { name: 'Spurling Test', category: 'Orthopedic - Spine', purpose: 'Cervical radiculopathy' },
  { name: 'Distraction Test', category: 'Orthopedic - Spine', purpose: 'Cervical radiculopathy' },
  {
    name: 'Compression Test (Spine)',
    category: 'Orthopedic - Spine',
    purpose: 'Cervical nerve root impingement',
  },
  { name: 'Gaenslen Test', category: 'Orthopedic - Spine', purpose: 'SI joint dysfunction' },
  { name: 'Sacral Thrust Test', category: 'Orthopedic - Spine', purpose: 'SI joint dysfunction' },
  { name: 'Stork Test', category: 'Orthopedic - Spine', purpose: 'Spondylolisthesis, pars defect' },

  // Neurological
  { name: 'Spurling Test', category: 'Neurological', purpose: 'Cervical nerve root compression' },
  { name: 'Adson Test', category: 'Vascular - Neurological', purpose: 'Thoracic outlet syndrome' },
  { name: 'Roos Test', category: 'Vascular - Neurological', purpose: 'Thoracic outlet syndrome' },
  { name: 'Wright Test', category: 'Vascular - Neurological', purpose: 'Thoracic outlet syndrome' },
  { name: 'Tinel Sign (Elbow)', category: 'Neurological', purpose: 'Cubital tunnel syndrome' },

  // Vascular
  {
    name: 'Ankle-Brachial Index',
    category: 'Vascular',
    purpose: 'Peripheral arterial disease screening',
  },
  {
    name: 'Buerger Test',
    category: 'Vascular',
    purpose: 'Arterial insufficiency of lower extremity',
  },
  { name: 'Homan Sign', category: 'Vascular', purpose: 'DVT screening (low specificity)' },

  // Vestibular
  { name: 'Dix-Hallpike Test', category: 'Vestibular', purpose: 'BPPV diagnosis' },
  { name: 'Head Impulse Test', category: 'Vestibular', purpose: 'Vestibular function' },
  { name: 'HINTS Exam', category: 'Vestibular', purpose: 'Central vs peripheral vertigo' },
];

// Schema for Gemini response
const specialTestSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    technique: { type: SchemaType.STRING },
    positiveResult: { type: SchemaType.STRING },
    negativeResult: { type: SchemaType.STRING },
    interpretation: { type: SchemaType.STRING },
    sensitivity: { type: SchemaType.STRING },
    specificity: { type: SchemaType.STRING },
    positiveLR: { type: SchemaType.NUMBER },
    negativeLR: { type: SchemaType.NUMBER },
    indicatedFor: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    contraindications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonPitfalls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    relatedTests: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    alternativeNames: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['description', 'technique', 'interpretation', 'clinicalPearls', 'boardYieldFacts'],
};

interface SpecialTestData {
  description?: string;
  technique?: string;
  positiveResult?: string;
  negativeResult?: string;
  interpretation?: string;
  sensitivity?: string;
  specificity?: string;
  positiveLR?: number;
  negativeLR?: number;
  indicatedFor?: string[];
  contraindications?: string[];
  commonPitfalls?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  relatedTests?: string[];
  alternativeNames?: string[];
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

async function generateSpecialTestData(
  name: string,
  category: string,
  purpose: string
): Promise<SpecialTestData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive special test information for: ${name}

Category: ${category}
Purpose: ${purpose}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the test (2-3 sentences)",
  "technique": "Step-by-step technique to perform the test",
  "positiveResult": "What constitutes a positive test",
  "negativeResult": "What constitutes a negative test",
  "interpretation": "What a positive result indicates clinically",
  "sensitivity": "Percentage or range (e.g., '70-85%')",
  "specificity": "Percentage or range",
  "positiveLR": 5.0,
  "negativeLR": 0.2,
  "indicatedFor": ["Condition 1", "Condition 2"],
  "contraindications": ["Contraindication 1", "Contraindication 2"],
  "commonPitfalls": ["Pitfall 1", "Pitfall 2"],
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "relatedTests": ["Related test 1", "Related test 2"],
  "alternativeNames": ["Other name 1"]
}

For likelihood ratios, use reasonable estimates based on literature. If unknown, use null.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as SpecialTestData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as SpecialTestData;
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
  console.log('║          SPECIAL TEST ENTRY GENERATOR                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing tests
    const existing = await prisma.specialTest.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

    // Filter out tests that already exist
    const toCreate = PANCE_SPECIAL_TESTS.filter((t) => !existingNames.has(t.name.toLowerCase()));

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All special tests already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const test = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${test.name}`);

      try {
        const data = await generateSpecialTestData(test.name, test.category, test.purpose);

        await prisma.specialTest.create({
          data: {
            id: randomUUID(),
            name: test.name,
            displayName: test.name,
            aliases: ensureArray(data.alternativeNames),
            system: test.category,
            region: null,
            description: ensureString(data.description),
            technique: ensureString(data.technique),
            positiveTest: ensureString(data.positiveResult),
            interpretation: ensureString(data.interpretation),
            sensitivity: typeof data.sensitivity === 'number' ? data.sensitivity : null,
            specificity: typeof data.specificity === 'number' ? data.specificity : null,
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
    console.log(`Total special tests now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
