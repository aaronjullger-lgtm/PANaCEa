/**
 * Procedure Gap Filler
 * 25-27 records need anatomicLandmarks, absoluteContraindications
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
  async consume(): Promise<void> {
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

const rateLimiter = new TokenBucket(5, 0.5);

interface ProcedureContent {
  anatomicLandmarks: string[];
  absoluteContraindications: string[];
}

async function generateContent(procedure: any): Promise<ProcedureContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant content for the medical procedure "${procedure.name}" (category: ${procedure.category}, system: ${procedure.system || 'various'}).

Current data:
- Description: ${procedure.description || 'none'}
- Indications: ${procedure.indications?.join(', ') || 'none'}
- Technique: ${procedure.technique || 'none'}

Provide the following in JSON format:
{
  "anatomicLandmarks": ["Array of 3-6 key anatomic landmarks used for this procedure, e.g., 'Anterior superior iliac spine', 'Medial malleolus', 'Sternocleidomastoid muscle'"],
  "absoluteContraindications": ["Array of 3-5 absolute contraindications where this procedure should NEVER be performed, e.g., 'Active skin infection at insertion site', 'Uncorrected coagulopathy'"]
}

Be specific and clinically accurate. If the procedure doesn't use specific landmarks (e.g., medication administration), provide ["No specific anatomic landmarks required"].`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${procedure.name}:`, error);
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
  console.log('PROCEDURE GAP FILLER');
  console.log('='.repeat(60));

  // Find procedures with gaps
  const allProcedures = await prisma.procedure.findMany();
  const proceduresWithGaps = allProcedures.filter((p) => {
    return (
      !p.anatomicLandmarks ||
      p.anatomicLandmarks.length === 0 ||
      !p.absoluteContraindications ||
      p.absoluteContraindications.length === 0
    );
  });

  console.log(`Found ${proceduresWithGaps.length} procedures with gaps\n`);

  let filled = 0;
  let failed = 0;

  for (const procedure of proceduresWithGaps) {
    console.log(
      `Processing [${filled + failed + 1}/${proceduresWithGaps.length}]: ${procedure.name}`
    );

    const content = await generateContent(procedure);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing
    const updateData: any = {};
    if (!procedure.anatomicLandmarks || procedure.anatomicLandmarks.length === 0) {
      updateData.anatomicLandmarks = ensureArray(content.anatomicLandmarks);
    }
    if (!procedure.absoluteContraindications || procedure.absoluteContraindications.length === 0) {
      updateData.absoluteContraindications = ensureArray(content.absoluteContraindications);
    }

    try {
      await prisma.procedure.update({
        where: { id: procedure.id },
        data: updateData,
      });
      console.log(`  ✅ Updated`);
      filled++;
    } catch (error) {
      console.error(`  ❌ DB error:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${proceduresWithGaps.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
