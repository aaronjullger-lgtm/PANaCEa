/**
 * PhysiologyConcept Gap Filler
 * Fills: drugTargets, aliases, compensatoryMechanisms, associatedLabs, decompensationSigns, etc.
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

interface PhysiologyContent {
  displayName: string;
  drugTargets: string[];
  aliases: string[];
  compensatoryMechanisms: string[];
  associatedLabs: string[];
  decompensationSigns: string[];
  curveDescription: string;
  curveType: string;
  feedbackLoops: string;
  regulatoryFactors: string[];
}

async function generateContent(concept: any): Promise<PhysiologyContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant content for the physiology concept "${concept.name}" (category: ${concept.category}, system: ${concept.system || 'general'}).

Current data:
- Description: ${concept.description || 'none'}
- Mechanism: ${concept.mechanism || 'none'}
- Clinical Significance: ${concept.clinicalSignificance || 'none'}

Provide the following in JSON format:
{
  "displayName": "Full descriptive name of this concept",
  "drugTargets": ["Array of drugs that target this physiological pathway/receptor"],
  "aliases": ["Array of alternative names or related terms"],
  "compensatoryMechanisms": ["Array of compensatory responses when this system is stressed/fails"],
  "associatedLabs": ["Array of lab tests that assess this physiological process"],
  "decompensationSigns": ["Array of clinical signs indicating system failure"],
  "curveDescription": "Description of relevant physiological curve (e.g., Frank-Starling, oxygen-hemoglobin dissociation) or 'Not applicable'",
  "curveType": "Type of curve: 'sigmoidal', 'linear', 'exponential', 'parabolic', or 'Not applicable'",
  "feedbackLoops": "Description of feedback regulation (positive/negative loops involved)",
  "regulatoryFactors": ["Array of factors that regulate this physiological process"]
}

Be clinically accurate and PANCE exam-focused.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${concept.name}:`, error);
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
  console.log('PHYSIOLOGY CONCEPT GAP FILLER');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 50;

  // Find concepts with gaps
  const allConcepts = await prisma.physiologyConcept.findMany();
  const conceptsWithGaps = allConcepts.filter((c) => {
    return (
      !c.drugTargets ||
      c.drugTargets.length === 0 ||
      !c.aliases ||
      c.aliases.length === 0 ||
      !c.compensatoryMechanisms ||
      c.compensatoryMechanisms.length === 0 ||
      !c.associatedLabs ||
      c.associatedLabs.length === 0 ||
      !c.decompensationSigns ||
      c.decompensationSigns.length === 0 ||
      !c.displayName
    );
  });

  const toProcess = conceptsWithGaps.slice(0, batchSize);
  console.log(
    `Found ${conceptsWithGaps.length} concepts with gaps, processing ${toProcess.length}\n`
  );

  let filled = 0;
  let failed = 0;

  for (const concept of toProcess) {
    console.log(`Processing [${filled + failed + 1}/${toProcess.length}]: ${concept.name}`);

    const content = await generateContent(concept);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing
    const updateData: any = {};
    if (!concept.displayName && content.displayName) {
      updateData.displayName = content.displayName;
    }
    if (!concept.drugTargets || concept.drugTargets.length === 0) {
      updateData.drugTargets = ensureArray(content.drugTargets);
    }
    if (!concept.aliases || concept.aliases.length === 0) {
      updateData.aliases = ensureArray(content.aliases);
    }
    if (!concept.compensatoryMechanisms || concept.compensatoryMechanisms.length === 0) {
      updateData.compensatoryMechanisms = ensureArray(content.compensatoryMechanisms);
    }
    if (!concept.associatedLabs || concept.associatedLabs.length === 0) {
      updateData.associatedLabs = ensureArray(content.associatedLabs);
    }
    if (!concept.decompensationSigns || concept.decompensationSigns.length === 0) {
      updateData.decompensationSigns = ensureArray(content.decompensationSigns);
    }
    if (!concept.curveDescription && content.curveDescription) {
      updateData.curveDescription = content.curveDescription;
    }
    if (!concept.curveType && content.curveType) {
      updateData.curveType = content.curveType;
    }
    if (!concept.feedbackLoops && content.feedbackLoops) {
      updateData.feedbackLoops = content.feedbackLoops;
    }
    if (!concept.regulatoryFactors || concept.regulatoryFactors.length === 0) {
      updateData.regulatoryFactors = ensureArray(content.regulatoryFactors);
    }

    try {
      await prisma.physiologyConcept.update({
        where: { id: concept.id },
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
  console.log(`Total processed: ${toProcess.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining: ${conceptsWithGaps.length - toProcess.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
