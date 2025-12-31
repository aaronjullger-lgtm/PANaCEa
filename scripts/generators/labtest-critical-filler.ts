/**
 * LabTest Critical Gaps Filler
 * Fills: clinicalScenarios, criticalValues, referenceRanges (171 records)
 * Plus remaining: increaseIndicates (3), decreaseIndicates (18)
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

interface GapContent {
  clinicalScenarios: string;
  criticalValues: string[];
  referenceRanges: Record<string, { low: string; high: string; unit: string }>;
  increaseIndicates: string[];
  decreaseIndicates: string[];
}

async function generateGapContent(labTest: any): Promise<GapContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant clinical content for the lab test "${labTest.name}" (category: ${labTest.category}).

Provide the following in JSON format:
{
  "clinicalScenarios": "2-3 clinical vignette snippets showing when this test is ordered and how results guide management (100-200 words)",
  "criticalValues": ["array of critical/panic values that require immediate notification, format: 'Value: X units - action required'"],
  "referenceRanges": {
    "Adult Male": { "low": "value", "high": "value", "unit": "units" },
    "Adult Female": { "low": "value", "high": "value", "unit": "units" },
    "Pediatric": { "low": "value", "high": "value", "unit": "units" },
    "Geriatric": { "low": "value", "high": "value", "unit": "units" }
  },
  "increaseIndicates": ["array of conditions/states indicated by ELEVATED values"],
  "decreaseIndicates": ["array of conditions/states indicated by DECREASED values"]
}

Rules:
- Be clinically accurate and PANCE exam-focused
- criticalValues should be specific values with units (or "N/A" array if not applicable)
- referenceRanges: provide ranges for populations where applicable, use "varies" if highly variable
- Include 3-5 items for increaseIndicates/decreaseIndicates
- If lab doesn't have directional interpretation (like some cultures), use ["Not applicable - qualitative test"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${labTest.name}:`, error);
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
  console.log('LABTEST CRITICAL GAP FILLER');
  console.log('='.repeat(60));

  // Find labs with critical gaps
  const allLabs = await prisma.labTest.findMany();
  
  const labsWithGaps = allLabs.filter(lab => {
    const scenarios = lab.clinicalScenarios;
    const hasClinicalScenariosGap = !scenarios || (typeof scenarios === 'string' && scenarios.trim() === '');
    const hasCriticalValuesGap = !lab.criticalValues || lab.criticalValues.length === 0;
    const hasReferenceRangesGap = !lab.referenceRanges;
    const hasIncreaseGap = !lab.increaseIndicates || lab.increaseIndicates.length === 0;
    const hasDecreaseGap = !lab.decreaseIndicates || lab.decreaseIndicates.length === 0;
    
    return hasClinicalScenariosGap || hasCriticalValuesGap || hasReferenceRangesGap || 
           hasIncreaseGap || hasDecreaseGap;
  });

  console.log(`Found ${labsWithGaps.length} labs with gaps to fill\n`);

  let filled = 0;
  let failed = 0;

  for (const lab of labsWithGaps) {
    console.log(`Processing [${filled + failed + 1}/${labsWithGaps.length}]: ${lab.name}`);

    const content = await generateGapContent(lab);
    if (!content) {
      console.log(`  ❌ Failed to generate content`);
      failed++;
      continue;
    }

    // Build update data - only update fields that are actually missing
    const updateData: any = { updatedAt: new Date() };

    const scenarios = lab.clinicalScenarios;
    if (!scenarios || (typeof scenarios === 'string' && scenarios.trim() === '')) {
      updateData.clinicalScenarios = content.clinicalScenarios || '';
    }
    if (!lab.criticalValues || lab.criticalValues.length === 0) {
      updateData.criticalValues = ensureArray(content.criticalValues);
    }
    if (!lab.referenceRanges) {
      updateData.referenceRanges = content.referenceRanges || {};
    }
    if (!lab.increaseIndicates || lab.increaseIndicates.length === 0) {
      updateData.increaseIndicates = ensureArray(content.increaseIndicates);
    }
    if (!lab.decreaseIndicates || lab.decreaseIndicates.length === 0) {
      updateData.decreaseIndicates = ensureArray(content.decreaseIndicates);
    }

    try {
      await prisma.labTest.update({
        where: { id: lab.id },
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
  console.log(`Total processed: ${labsWithGaps.length}`);
  console.log(`Successfully filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
