/**
 * LabTest Comprehensive Filler
 *
 * Fills ALL missing fields for incomplete LabTest records using Gemini AI.
 * Works record-by-record, filling all fields in one API call per record.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

// Rate limiter
class RateLimiter {
  private lastRequest = 0;
  private minInterval = 2000; // 2 seconds between requests

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minInterval) {
      await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

const rateLimiter = new RateLimiter();

interface LabTestData {
  conventionalRange: string;
  units: string;
  siRange: string;
  siUnits: string;
  sampleType: string;
  collectionTube: string;
  fastingRequired: boolean;
  turnaroundTime: string;
  stability: string;
  specialInstructions: string;
  interpretationSteps: string;
  falsePosNeg: string;
  increaseIndicates: string[];
  decreaseIndicates: string[];
  commonAbnormalities: string[];
  whenToOrder: string[];
  followUpTests: string[];
  relatedTests: string[];
  interferingFactors: string[];
  clinicalPearls: string[];
  boardYieldFacts: string[];
  testQuestionTips: string[];
  commonMistakes: string[];
  mnemonics: string[];
}

async function generateLabTestData(
  name: string,
  category: string,
  typicalUse: string | null
): Promise<LabTestData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.wait();

  const prompt = `You are a clinical laboratory expert and medical educator creating comprehensive content for PA/medical board exam preparation.

Generate complete lab test data for: ${name}
Category: ${category}
${typicalUse ? `Typical Use: ${typicalUse}` : ''}

Return a JSON object with ALL of these fields:
{
  "conventionalRange": "Normal range in conventional units (e.g., '70-100 mg/dL')",
  "units": "Conventional units (e.g., 'mg/dL')",
  "siRange": "Normal range in SI units (e.g., '3.9-5.6 mmol/L')",
  "siUnits": "SI units (e.g., 'mmol/L')",
  "sampleType": "Blood, Serum, Plasma, Urine, CSF, etc.",
  "collectionTube": "Red top, Lavender (EDTA), Green (heparin), etc.",
  "fastingRequired": true or false,
  "turnaroundTime": "Stat: 1 hour, Routine: 24 hours, etc.",
  "stability": "Room temp: 8 hours, Refrigerated: 72 hours, etc.",
  "specialInstructions": "Any special collection or handling requirements",
  "interpretationSteps": "Step-by-step guide to interpreting results",
  "falsePosNeg": "Common causes of false positives and false negatives",
  "increaseIndicates": ["condition1", "condition2", "condition3"],
  "decreaseIndicates": ["condition1", "condition2", "condition3"],
  "commonAbnormalities": ["Pattern 1 with clinical meaning", "Pattern 2 with clinical meaning"],
  "whenToOrder": ["Clinical scenario 1", "Clinical scenario 2"],
  "followUpTests": ["Test to order if abnormal", "Confirmatory test"],
  "relatedTests": ["Related test 1", "Related test 2"],
  "interferingFactors": ["Factor 1 that affects results", "Factor 2"],
  "clinicalPearls": ["High-yield clinical correlation 1", "Pearl 2", "Pearl 3"],
  "boardYieldFacts": ["Frequently tested fact 1", "Board buzzword association", "Key concept"],
  "testQuestionTips": ["How this appears in exam questions", "Key phrases to look for"],
  "commonMistakes": ["Mistake students make 1", "Mistake 2"],
  "mnemonics": ["Memory aid for interpretation", "Mnemonic for causes"]
}

Be accurate, clinically relevant, and focused on PANCE/board exam content.
For arrays, provide 3-5 items each.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as LabTestData;
  } catch (e) {
    // Try to extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as LabTestData;
    }
    throw new Error(`Failed to parse response for ${name}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 5;
  const skipArg = args.find((a) => a.startsWith('--skip='));
  const skip = skipArg ? parseInt(skipArg.split('=')[1]) : 0;

  console.log('🧪 LabTest Comprehensive Filler');
  console.log('============================================================');
  console.log(`Batch size: ${batchSize}, Skip: ${skip}\n`);

  try {
    // Find incomplete records
    const incompleteRecords = await prisma.labTest.findMany({
      where: {
        OR: [
          { boardYieldFacts: { isEmpty: true } },
          { clinicalPearls: { isEmpty: true } },
          { commonMistakes: { isEmpty: true } },
          { OR: [{ conventionalRange: null }, { conventionalRange: '' }] },
        ],
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: batchSize,
    });

    console.log(`Found ${incompleteRecords.length} incomplete records to process\n`);

    let success = 0;
    let failed = 0;

    for (const record of incompleteRecords) {
      try {
        console.log(`\n📋 Processing: ${record.name} (${record.category})`);

        const data = await generateLabTestData(record.name, record.category, record.typicalUse);

        // Build update object - only update fields that are empty
        const updateData: any = {};

        // Helper to ensure string fields are strings
        const ensureString = (val: any): string => {
          if (Array.isArray(val)) return val.join('. ');
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val || '');
        };

        // Helper to ensure array fields are arrays
        const ensureArray = (val: any): string[] => {
          if (Array.isArray(val)) return val.map((v) => String(v));
          if (typeof val === 'string') return val.split('. ').filter((s) => s.trim());
          return [];
        };

        if (!record.conventionalRange)
          updateData.conventionalRange = ensureString(data.conventionalRange);
        if (!record.units) updateData.units = ensureString(data.units);
        if (!record.siRange) updateData.siRange = ensureString(data.siRange);
        if (!record.siUnits) updateData.siUnits = ensureString(data.siUnits);
        if (!record.sampleType) updateData.sampleType = ensureString(data.sampleType);
        if (!record.collectionTube) updateData.collectionTube = ensureString(data.collectionTube);
        if (record.fastingRequired === false)
          updateData.fastingRequired = Boolean(data.fastingRequired);
        if (!record.turnaroundTime) updateData.turnaroundTime = ensureString(data.turnaroundTime);
        if (!record.stability) updateData.stability = ensureString(data.stability);
        if (!record.specialInstructions)
          updateData.specialInstructions = ensureString(data.specialInstructions);
        if (!record.interpretationSteps)
          updateData.interpretationSteps = ensureString(data.interpretationSteps);
        if (!record.falsePosNeg) updateData.falsePosNeg = ensureString(data.falsePosNeg);

        // Arrays - only update if empty
        if (!record.increaseIndicates || record.increaseIndicates.length === 0) {
          updateData.increaseIndicates = ensureArray(data.increaseIndicates);
        }
        if (!record.decreaseIndicates || record.decreaseIndicates.length === 0) {
          updateData.decreaseIndicates = ensureArray(data.decreaseIndicates);
        }
        if (!record.commonAbnormalities || record.commonAbnormalities.length === 0) {
          updateData.commonAbnormalities = ensureArray(data.commonAbnormalities);
        }
        if (!record.whenToOrder || record.whenToOrder.length === 0) {
          updateData.whenToOrder = ensureArray(data.whenToOrder);
        }
        if (!record.followUpTests || record.followUpTests.length === 0) {
          updateData.followUpTests = ensureArray(data.followUpTests);
        }
        if (!record.relatedTests || record.relatedTests.length === 0) {
          updateData.relatedTests = ensureArray(data.relatedTests);
        }
        if (!record.interferingFactors || record.interferingFactors.length === 0) {
          updateData.interferingFactors = ensureArray(data.interferingFactors);
        }
        if (!record.clinicalPearls || record.clinicalPearls.length === 0) {
          updateData.clinicalPearls = ensureArray(data.clinicalPearls);
        }
        if (!record.boardYieldFacts || record.boardYieldFacts.length === 0) {
          updateData.boardYieldFacts = ensureArray(data.boardYieldFacts);
        }
        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = ensureArray(data.testQuestionTips);
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = ensureArray(data.commonMistakes);
        }
        if (!record.mnemonics || record.mnemonics.length === 0) {
          updateData.mnemonics = ensureArray(data.mnemonics);
        }

        const fieldsUpdated = Object.keys(updateData).length;

        await prisma.labTest.update({
          where: { id: record.id },
          data: updateData,
        });

        console.log(`  ✅ Updated ${fieldsUpdated} fields`);
        console.log(`     Range: ${data.conventionalRange} ${data.units}`);
        console.log(`     Sample: ${data.sampleType}, Tube: ${data.collectionTube}`);
        success++;
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failed++;
      }
    }

    console.log('\n============================================================');
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Completion rate: ${((success / incompleteRecords.length) * 100).toFixed(1)}%`);

    // Show remaining
    const remaining = await prisma.labTest.count({
      where: {
        OR: [{ boardYieldFacts: { isEmpty: true } }, { clinicalPearls: { isEmpty: true } }],
      },
    });
    console.log(`\n📋 Remaining incomplete records: ${remaining}`);
    if (remaining > 0) {
      console.log(`   Run with --skip=${skip + batchSize} to continue`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
