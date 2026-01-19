/**
 * Drug mechanismDetailed Gap Filler
 * 157 records need mechanismDetailed field
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

async function generateMechanismDetailed(drug: any): Promise<string | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate a detailed mechanism of action for the drug "${drug.genericName}" (class: ${drug.drugClass?.join(', ') || 'unknown'}).

Current brief mechanism: ${drug.mechanismOfAction || 'none'}

Provide a JSON response:
{
  "mechanismDetailed": "A comprehensive 3-5 sentence explanation of the drug's mechanism of action at the molecular/receptor level. Include: 1) The specific target (receptor, enzyme, channel, etc.), 2) What happens when the drug binds/acts, 3) The downstream physiological effects, 4) Why this leads to the therapeutic effect. Be PANCE exam-focused and clinically relevant."
}

Example for Metoprolol:
"Metoprolol is a selective beta-1 adrenergic receptor blocker that competitively inhibits catecholamine binding at cardiac beta-1 receptors. This blockade decreases cAMP production via adenylyl cyclase inhibition, resulting in reduced sinoatrial node automaticity and atrioventricular node conduction velocity. The negative chronotropic and inotropic effects decrease myocardial oxygen demand while prolonging diastolic filling time for improved coronary perfusion. At higher doses, selectivity is lost and beta-2 blockade may occur, potentially causing bronchospasm."`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return parsed.mechanismDetailed || null;
  } catch (error) {
    console.error(`Error generating for ${drug.genericName}:`, error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DRUG MECHANISM DETAILED FILLER');
  console.log('='.repeat(60));

  // Find drugs missing mechanismDetailed
  const drugs = await prisma.drug.findMany({
    where: {
      OR: [{ mechanismDetailed: null }, { mechanismDetailed: '' }],
    },
    take: 200, // Process in batches
  });

  console.log(`Found ${drugs.length} drugs missing mechanismDetailed\n`);

  let filled = 0;
  let failed = 0;

  for (const drug of drugs) {
    console.log(`Processing [${filled + failed + 1}/${drugs.length}]: ${drug.genericName}`);

    const mechanismDetailed = await generateMechanismDetailed(drug);
    if (!mechanismDetailed) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    try {
      await prisma.drug.update({
        where: { id: drug.id },
        data: {
          mechanismDetailed,
        },
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
  console.log(`Total processed: ${drugs.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
