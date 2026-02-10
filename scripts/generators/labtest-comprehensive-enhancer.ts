/**
 * Comprehensive LabTest Enhancer
 *
 * Fills ALL missing fields for incomplete LabTest records using Gemini 2.5 Flash.
 * Works on complete records one at a time - no partial filling.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';

class TokenBucket {
  private tokens: number = 5;
  private lastRequest: number = 0;

  async acquire(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 2000 - timeSinceLastRequest));
    }

    this.lastRequest = Date.now();
  }
}

const rateLimiter = new TokenBucket();

interface LabTestEnhancement {
  conventionalRange: string;
  siRange: string;
  units: string;
  siUnits: string;
  collectionTube: string;
  sampleType: string;
  interpretationSteps: string;
  falsePosNeg: string;
  boardYieldFacts: string[];
  testQuestionTips: string[];
  commonMistakes: string[];
  clinicalPearls: string[];
  whenToOrder: string[];
  interferingFactors: string[];
  increaseIndicates: string[];
  decreaseIndicates: string[];
}

async function enhanceLabTest(labTest: any): Promise<LabTestEnhancement> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.acquire();

  const prompt = `You are a medical laboratory specialist creating comprehensive lab test information for PANCE board preparation.

Lab Test: ${labTest.name}
Category: ${labTest.category}
Typical Use: ${labTest.typicalUse || 'General laboratory testing'}
Common Abnormalities: ${labTest.commonAbnormalities?.join(', ') || 'Various'}

Generate complete lab test information. Be SPECIFIC with ranges - use actual numeric values with units.

Return JSON:
{
  "conventionalRange": "Normal adult range with units (e.g., '70-100 mg/dL', '135-145 mEq/L')",
  "siRange": "SI unit range (e.g., '3.9-5.6 mmol/L', '135-145 mmol/L')",
  "units": "Conventional units (e.g., 'mg/dL', 'mEq/L', 'g/dL')",
  "siUnits": "SI units (e.g., 'mmol/L', 'g/L')",
  "collectionTube": "Tube color/type (e.g., 'Red top (no additive)', 'Lavender top (EDTA)', 'Green top (heparin)')",
  "sampleType": "Sample type (e.g., 'Serum', 'Plasma', 'Whole blood', 'Urine')",
  "interpretationSteps": "How to interpret results systematically (2-3 sentences)",
  "falsePosNeg": "Common false positive/negative causes (2-3 sentences)",
  "boardYieldFacts": [
    "High-yield board fact 1 - include specific values/associations",
    "High-yield board fact 2 - mention specific conditions",
    "High-yield board fact 3 - key clinical correlation",
    "High-yield board fact 4"
  ],
  "testQuestionTips": [
    "How this appears on board exams - buzzwords/presentations",
    "Key differentiating features for test questions",
    "Common distractors to avoid"
  ],
  "commonMistakes": [
    "Common interpretation error or pitfall",
    "Frequently confused with what",
    "Key mistake to avoid in clinical context"
  ],
  "clinicalPearls": [
    "Clinical pearl 1 - actionable clinical tip",
    "Clinical pearl 2 - diagnostic correlation",
    "Clinical pearl 3 - management implication"
  ],
  "whenToOrder": [
    "Clinical indication 1 - specific presentation",
    "Clinical indication 2 - screening scenario",
    "Clinical indication 3 - monitoring situation"
  ],
  "interferingFactors": [
    "Factor that affects results 1",
    "Factor that affects results 2",
    "Factor that affects results 3"
  ],
  "increaseIndicates": [
    "Condition/scenario causing elevation 1",
    "Condition/scenario causing elevation 2",
    "Condition/scenario causing elevation 3"
  ],
  "decreaseIndicates": [
    "Condition/scenario causing decrease 1",
    "Condition/scenario causing decrease 2",
    "Condition/scenario causing decrease 3"
  ]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed: LabTestEnhancement = JSON.parse(text);
    return parsed;
  } catch (e) {
    throw new Error(
      `JSON parse error for ${labTest.name}: ${e}. Response: ${text.substring(0, 200)}`
    );
  }
}

async function main() {
  console.log('\n🧪 Comprehensive LabTest Enhancer');
  console.log('============================================================\n');

  const args = process.argv.slice(2);
  const batchArg = args.find((arg) => arg.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 10;

  // Find incomplete LabTest records
  const incompleteLabTests = await prisma.labTest.findMany({
    where: { boardYieldFacts: { isEmpty: true } },
    take: batchSize,
  });

  console.log(`Found ${incompleteLabTests.length} incomplete LabTest records`);
  console.log(`Processing batch of ${Math.min(batchSize, incompleteLabTests.length)}...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const labTest of incompleteLabTests) {
    try {
      console.log(`\n🔬 Processing: ${labTest.name}`);

      const enhancement = await enhanceLabTest(labTest);

      await prisma.labTest.update({
        where: { id: labTest.id },
        data: {
          conventionalRange: enhancement.conventionalRange,
          siRange: enhancement.siRange,
          units: enhancement.units,
          siUnits: enhancement.siUnits,
          collectionTube: enhancement.collectionTube,
          sampleType: enhancement.sampleType,
          interpretationSteps: enhancement.interpretationSteps,
          falsePosNeg: enhancement.falsePosNeg,
          boardYieldFacts: enhancement.boardYieldFacts,
          testQuestionTips: enhancement.testQuestionTips,
          commonMistakes: enhancement.commonMistakes,
          clinicalPearls: enhancement.clinicalPearls,
          whenToOrder: enhancement.whenToOrder,
          interferingFactors: enhancement.interferingFactors,
          increaseIndicates: enhancement.increaseIndicates,
          decreaseIndicates: enhancement.decreaseIndicates,
        },
      });

      console.log(`✅ Enhanced with:`);
      console.log(`   Range: ${enhancement.conventionalRange}`);
      console.log(`   Collection: ${enhancement.collectionTube}`);
      console.log(`   Board facts: ${enhancement.boardYieldFacts.length}`);
      console.log(`   Clinical pearls: ${enhancement.clinicalPearls.length}`);

      successCount++;
    } catch (error) {
      console.error(`❌ Error enhancing ${labTest.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n============================================================');
  console.log(`✅ Successfully enhanced: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(
    `📊 Completion rate: ${((successCount / incompleteLabTests.length) * 100).toFixed(1)}%`
  );
  console.log(`\n💡 Remaining incomplete: ${116 - successCount}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
