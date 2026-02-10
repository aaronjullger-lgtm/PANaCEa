#!/usr/bin/env npx tsx
/**
 * Board Yield Facts Filler - Add high-yield board exam facts
 *
 * Tables with missing boardYieldFacts:
 *   - PhysiologyConcept: 36 missing (112/148 = 76%)
 *   - AnatomyStructure: 36 missing (264/300 = 88%)
 *   - PhysicalExamFinding: 45 missing (191/236 = 81%)
 *   - Procedure: 10 missing (188/198 = 95%)
 *
 * Also fills related fields that may be empty:
 *   - testQuestionTips
 *   - commonMistakes
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/board-facts-filler.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/board-facts-filler.ts --table=PhysiologyConcept
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/board-facts-filler.ts --table=all --batch=25
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

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

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface BoardFactsResult {
  boardYieldFacts: string[];
  testQuestionTips: string[];
  commonMistakes: string[];
}

async function generateBoardFacts(tableName: string, record: any): Promise<BoardFactsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.acquire();

  let context = '';

  switch (tableName) {
    case 'PhysiologyConcept':
      context = `Physiology Concept: ${record.name}
System: ${record.system}
Mechanism: ${record.mechanism || ''}
Clinical Significance: ${record.clinicalSignificance || ''}
Related Conditions: ${(record.relatedConditions || []).join(', ')}
Related Drugs: ${(record.relatedDrugs || []).join(', ')}`;
      break;

    case 'AnatomyStructure':
      context = `Anatomy Structure: ${record.name}
System: ${record.system}
Function: ${record.function || ''}
Innervation: ${record.innervation || ''}
Blood Supply: ${record.bloodSupply || ''}
Clinical Significance: ${record.clinicalSignificance || ''}`;
      break;

    case 'PhysicalExamFinding':
      context = `Physical Exam Finding: ${record.name}
System: ${record.system}
Description: ${record.description || ''}
How to Elicit: ${record.howToElicit || ''}
Positive Indicates: ${(record.positiveIndicates || []).join(', ')}
Clinical Significance: ${record.clinicalSignificance || ''}`;
      break;

    case 'Procedure':
      context = `Procedure: ${record.name}
Category: ${record.category || ''}
System: ${record.system || ''}
Description: ${record.description || ''}
Indications: ${(record.indications || []).join(', ')}
Technique: ${record.technique || ''}
Complications: ${(record.complications || []).join(', ')}`;
      break;

    case 'HistoryComponent':
      context = `History Component: ${record.name}
Type: ${record.type || ''}
System: ${record.system || ''}
Description: ${record.description || ''}
Assessment Techniques: ${(record.assessmentTechniques || []).join(', ')}
Clinical Significance: ${record.clinicalSignificance || ''}
Red Flags: ${(record.redFlags || []).join(', ')}`;
      break;
  }

  const prompt = `Generate high-yield board exam content for PANCE/medical board preparation:

${context}

You are a medical educator specializing in PANCE board preparation.
Generate content that is:
1. Directly relevant to what appears on PANCE exams
2. Focused on clinical decision-making
3. Highlighting commonly tested concepts

Return a JSON object:
{
  "boardYieldFacts": [
    "High-yield fact 1 - something frequently tested on boards",
    "High-yield fact 2 - clinical pearl for board questions",
    "High-yield fact 3 - key concept students commonly miss",
    "High-yield fact 4 - pathognomonic or buzzword association",
    // 4-6 facts total
  ],
  "testQuestionTips": [
    "How this appears in board vignettes - what to look for",
    "Key phrase or buzzword that should trigger this answer",
    "Common distractor patterns to avoid",
    // 3-4 tips
  ],
  "commonMistakes": [
    "Common error 1 - what students get wrong",
    "Common error 2 - incorrect assumption or confusion",
    "Common error 3 - technique or application error",
    // 3-4 mistakes
  ]
}

Make these clinically practical and board-focused.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse board facts for ${record.name}`);
  }
}

async function processPhysiologyConcept(
  batchSize: number,
  dryRun: boolean
): Promise<{ success: number; failed: number }> {
  console.log('\n⚡ Processing PhysiologyConcept...');

  const records = await prisma.physiologyConcept.findMany({
    where: {
      boardYieldFacts: { isEmpty: true },
    },
    take: batchSize,
  });

  console.log(`  Found ${records.length} records missing boardYieldFacts`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const data = await generateBoardFacts('PhysiologyConcept', record);

      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${data.boardYieldFacts.length} facts`);
      } else {
        const updateData: any = {
          boardYieldFacts: data.boardYieldFacts,
        };

        // Only update if currently empty
        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = data.testQuestionTips;
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = data.commonMistakes;
        }

        await prisma.physiologyConcept.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { success, failed };
}

async function processAnatomyStructure(
  batchSize: number,
  dryRun: boolean
): Promise<{ success: number; failed: number }> {
  console.log('\n🦴 Processing AnatomyStructure...');

  const records = await prisma.anatomyStructure.findMany({
    where: {
      boardYieldFacts: { isEmpty: true },
    },
    take: batchSize,
  });

  console.log(`  Found ${records.length} records missing boardYieldFacts`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const data = await generateBoardFacts('AnatomyStructure', record);

      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${data.boardYieldFacts.length} facts`);
      } else {
        const updateData: any = {
          boardYieldFacts: data.boardYieldFacts,
        };

        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = data.testQuestionTips;
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = data.commonMistakes;
        }

        await prisma.anatomyStructure.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { success, failed };
}

async function processPhysicalExamFinding(
  batchSize: number,
  dryRun: boolean
): Promise<{ success: number; failed: number }> {
  console.log('\n🩺 Processing PhysicalExamFinding...');

  const records = await prisma.physicalExamFinding.findMany({
    where: {
      boardYieldFacts: { isEmpty: true },
    },
    take: batchSize,
  });

  console.log(`  Found ${records.length} records missing boardYieldFacts`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const data = await generateBoardFacts('PhysicalExamFinding', record);

      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${data.boardYieldFacts.length} facts`);
      } else {
        const updateData: any = {
          boardYieldFacts: data.boardYieldFacts,
        };

        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = data.testQuestionTips;
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = data.commonMistakes;
        }

        await prisma.physicalExamFinding.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { success, failed };
}

async function processProcedure(
  batchSize: number,
  dryRun: boolean
): Promise<{ success: number; failed: number }> {
  console.log('\n🔧 Processing Procedure...');

  const records = await prisma.procedure.findMany({
    where: {
      boardYieldFacts: { isEmpty: true },
    },
    take: batchSize,
  });

  console.log(`  Found ${records.length} records missing boardYieldFacts`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const data = await generateBoardFacts('Procedure', record);

      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${data.boardYieldFacts.length} facts`);
      } else {
        const updateData: any = {
          boardYieldFacts: data.boardYieldFacts,
        };

        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = data.testQuestionTips;
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = data.commonMistakes;
        }

        await prisma.procedure.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { success, failed };
}

async function processHistoryComponent(
  batchSize: number,
  dryRun: boolean
): Promise<{ success: number; failed: number }> {
  console.log('\n📋 Processing HistoryComponent...');

  const records = await prisma.historyComponent.findMany({
    where: {
      boardYieldFacts: { isEmpty: true },
    },
    take: batchSize,
  });

  console.log(`  Found ${records.length} records missing boardYieldFacts`);

  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const data = await generateBoardFacts('HistoryComponent', record);

      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${data.boardYieldFacts.length} facts`);
      } else {
        const updateData: any = {
          boardYieldFacts: data.boardYieldFacts,
        };

        if (!record.testQuestionTips || record.testQuestionTips.length === 0) {
          updateData.testQuestionTips = data.testQuestionTips;
        }
        if (!record.commonMistakes || record.commonMistakes.length === 0) {
          updateData.commonMistakes = data.commonMistakes;
        }

        await prisma.historyComponent.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { success, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tableArg = args.find((a) => a.startsWith('--table='));
  const tableName = tableArg ? tableArg.split('=')[1] : 'all';
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 25;

  console.log('📚 Board Yield Facts Filler');
  console.log('============================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Table: ${tableName}`);
  console.log(`Batch size: ${batchSize}`);

  const results: Record<string, { success: number; failed: number }> = {};

  try {
    if (tableName === 'all' || tableName === 'PhysiologyConcept') {
      results.PhysiologyConcept = await processPhysiologyConcept(batchSize, dryRun);
    }

    if (tableName === 'all' || tableName === 'AnatomyStructure') {
      results.AnatomyStructure = await processAnatomyStructure(batchSize, dryRun);
    }

    if (tableName === 'all' || tableName === 'PhysicalExamFinding') {
      results.PhysicalExamFinding = await processPhysicalExamFinding(batchSize, dryRun);
    }

    if (tableName === 'all' || tableName === 'Procedure') {
      results.Procedure = await processProcedure(batchSize, dryRun);
    }

    if (tableName === 'all' || tableName === 'HistoryComponent') {
      results.HistoryComponent = await processHistoryComponent(batchSize, dryRun);
    }

    console.log('\n============================');
    console.log('Summary:');
    for (const [table, { success, failed }] of Object.entries(results)) {
      console.log(`  ${table}: ✅ ${success} | ❌ ${failed}`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
