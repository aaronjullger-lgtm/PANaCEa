/**
 * SpecialTest Entry Generator v2
 * Creates missing special tests for PANCE coverage
 * Fixed to match Prisma schema exactly
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant special tests organized by system
const PANCE_SPECIAL_TESTS = [
  // Orthopedic - Shoulder
  { name: 'Speed Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Yergason Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: "O'Brien Test", system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Sulcus Sign', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Apprehension Test (Shoulder)', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Relocation Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Cross-Body Adduction Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Lift-Off Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'Belly Press Test', system: 'Musculoskeletal', region: 'Shoulder' },
  { name: 'External Rotation Lag Sign', system: 'Musculoskeletal', region: 'Shoulder' },

  // Orthopedic - Elbow/Wrist/Hand
  { name: 'Cozen Test', system: 'Musculoskeletal', region: 'Elbow' },
  { name: 'Mill Test', system: 'Musculoskeletal', region: 'Elbow' },
  { name: "Golfer's Elbow Test", system: 'Musculoskeletal', region: 'Elbow' },
  { name: 'Valgus Stress Test (Elbow)', system: 'Musculoskeletal', region: 'Elbow' },
  { name: 'Watson Test', system: 'Musculoskeletal', region: 'Wrist' },
  { name: 'Grind Test', system: 'Musculoskeletal', region: 'Hand' },
  { name: 'Allen Test', system: 'Cardiovascular', region: 'Hand' },

  // Orthopedic - Hip
  { name: 'Trendelenburg Test', system: 'Musculoskeletal', region: 'Hip' },
  { name: 'Ober Test', system: 'Musculoskeletal', region: 'Hip' },
  { name: 'FADIR Test', system: 'Musculoskeletal', region: 'Hip' },
  { name: 'Log Roll Test', system: 'Musculoskeletal', region: 'Hip' },
  { name: 'Piriformis Test', system: 'Musculoskeletal', region: 'Hip' },

  // Orthopedic - Knee
  { name: 'Pivot Shift Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Thessaly Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Apley Compression Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Apley Distraction Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Patellar Apprehension Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Ballottement Test', system: 'Musculoskeletal', region: 'Knee' },
  { name: 'Dial Test', system: 'Musculoskeletal', region: 'Knee' },

  // Orthopedic - Ankle/Foot
  { name: 'Talar Tilt Test', system: 'Musculoskeletal', region: 'Ankle' },
  { name: 'Squeeze Test (Fibula)', system: 'Musculoskeletal', region: 'Ankle' },
  { name: 'External Rotation Stress Test', system: 'Musculoskeletal', region: 'Ankle' },
  { name: 'Mulder Click', system: 'Musculoskeletal', region: 'Foot' },

  // Spine
  { name: 'Slump Test', system: 'Neurological', region: 'Spine' },
  { name: 'Femoral Nerve Stretch Test', system: 'Neurological', region: 'Lumbar Spine' },
  { name: 'Spurling Test', system: 'Neurological', region: 'Cervical Spine' },
  { name: 'Distraction Test', system: 'Neurological', region: 'Cervical Spine' },
  { name: 'Compression Test (Spine)', system: 'Neurological', region: 'Cervical Spine' },
  { name: 'Gaenslen Test', system: 'Musculoskeletal', region: 'SI Joint' },
  { name: 'Sacral Thrust Test', system: 'Musculoskeletal', region: 'SI Joint' },
  { name: 'Stork Test', system: 'Musculoskeletal', region: 'Lumbar Spine' },

  // Neurological
  { name: 'Adson Test', system: 'Cardiovascular', region: 'Upper Extremity' },
  { name: 'Roos Test', system: 'Cardiovascular', region: 'Upper Extremity' },
  { name: 'Wright Test', system: 'Cardiovascular', region: 'Upper Extremity' },
  { name: 'Tinel Sign (Elbow)', system: 'Neurological', region: 'Elbow' },

  // Vascular
  { name: 'Ankle-Brachial Index', system: 'Cardiovascular', region: 'Lower Extremity' },
  { name: 'Buerger Test', system: 'Cardiovascular', region: 'Lower Extremity' },
  { name: 'Homan Sign', system: 'Cardiovascular', region: 'Lower Extremity' },

  // Vestibular
  { name: 'Dix-Hallpike Test', system: 'EENT', region: 'Vestibular' },
  { name: 'Head Impulse Test', system: 'EENT', region: 'Vestibular' },
  { name: 'HINTS Exam', system: 'Neurological', region: 'Vestibular' },
];

// Schema for Gemini response - matches Prisma SpecialTest model
const specialTestSchema = {
  type: SchemaType.OBJECT,
  properties: {
    displayName: { type: SchemaType.STRING },
    aliases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    description: { type: SchemaType.STRING },
    sensitivity: { type: SchemaType.NUMBER }, // Float in Prisma
    specificity: { type: SchemaType.NUMBER }, // Float in Prisma
    technique: { type: SchemaType.STRING },
    positiveTest: { type: SchemaType.STRING }, // Schema uses positiveTest not positiveResult
    interpretation: { type: SchemaType.STRING },
  },
  required: ['description', 'technique', 'positiveTest', 'interpretation'],
};

interface SpecialTestData {
  displayName?: string;
  aliases?: string[];
  description?: string;
  sensitivity?: number;
  specificity?: number;
  technique?: string;
  positiveTest?: string;
  interpretation?: string;
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
  system: string,
  region: string
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

System: ${system}
Body Region: ${region}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "displayName": "User-friendly display name for the test",
  "aliases": ["Alternative names for this test"],
  "description": "Brief description of the test (2-3 sentences)",
  "technique": "Step-by-step technique to perform the test",
  "positiveTest": "What finding constitutes a positive test result",
  "interpretation": "What a positive result indicates clinically",
  "sensitivity": <number 0-100 or null if unknown>,
  "specificity": <number 0-100 or null if unknown>
}

IMPORTANT: sensitivity and specificity must be numbers (0-100) or null, NOT strings.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  // Extract JSON from response
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

function ensureFloat(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val / 100; // Convert percentage to decimal
  if (typeof val === 'string') {
    const num = parseFloat(val.replace('%', ''));
    if (!isNaN(num)) return num / 100;
  }
  return null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          SPECIAL TEST ENTRY GENERATOR v2                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.specialTest.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const missing = PANCE_SPECIAL_TESTS.filter(
      (test) => !existingNames.has(test.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All special tests already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const test = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${test.name}`);

      try {
        const data = await generateSpecialTestData(test.name, test.system, test.region);

        await prisma.specialTest.create({
          data: {
            id: randomUUID(),
            name: test.name,
            displayName: ensureString(data.displayName),
            aliases: ensureArray(data.aliases),
            system: test.system,
            region: test.region,
            description: ensureString(data.description),
            sensitivity: ensureFloat(data.sensitivity),
            specificity: ensureFloat(data.specificity),
            technique: ensureString(data.technique),
            positiveTest: ensureString(data.positiveTest),
            interpretation: ensureString(data.interpretation),
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
