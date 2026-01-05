/**
 * SpecialTest Aliases Filler
 * 398 records need aliases
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number, private refillRate: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async consume(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(r => setTimeout(r, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

async function generateAliases(test: any): Promise<string[] | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate alternative names/aliases for the special physical examination test "${test.name}" (system: ${test.system || 'orthopedic'}, region: ${test.region || 'various'}).

Current data:
- Description: ${test.description || 'none'}
- Positive Test: ${test.positiveTest || 'none'}

Provide a JSON response:
{
  "aliases": ["Array of 2-5 alternative names for this test, including eponymous names, descriptive names, and common variations. If no common aliases exist, provide descriptive alternatives."]
}

Examples:
- "Lachman Test" → ["Lachman's Test", "ACL Laxity Test", "Anterior Drawer Variant"]
- "Phalen's Test" → ["Phalen Test", "Wrist Flexion Test", "Carpal Tunnel Provocative Test"]
- "Straight Leg Raise" → ["SLR", "Lasègue Test", "Lasègue's Sign"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return parsed.aliases || null;
  } catch (error) {
    console.error(`Error generating for ${test.name}:`, error);
    return null;
  }
}

function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [];
}

async function main() {
  console.log('='.repeat(60));
  console.log('SPECIAL TEST ALIASES FILLER');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;

  // Find tests missing aliases
  const testsWithGaps = await prisma.specialTest.findMany({
    where: {
      OR: [
        { aliases: { isEmpty: true } },
        { aliases: { equals: [] } }
      ]
    },
    ...(batchSize ? { take: batchSize } : {})
  });

  console.log(`Found ${testsWithGaps.length} tests to process\n`);

  let filled = 0;
  let failed = 0;

  for (const test of testsWithGaps) {
    console.log(`Processing [${filled + failed + 1}/${testsWithGaps.length}]: ${test.name}`);

    const aliases = await generateAliases(test);
    if (!aliases || aliases.length === 0) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    try {
      await prisma.specialTest.update({
        where: { id: test.id },
        data: {
          updatedAt: new Date(),
          aliases: ensureArray(aliases),
        },
      });
      console.log(`  ✅ Updated (${aliases.length} aliases)`);
      filled++;
    } catch (error) {
      console.error(`  ❌ DB error:`, error);
      failed++;
    }
  }

  // Count remaining
  const remaining = await prisma.specialTest.count({
    where: {
      OR: [
        { aliases: { isEmpty: true } },
        { aliases: { equals: [] } }
      ]
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${testsWithGaps.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(console.error);
