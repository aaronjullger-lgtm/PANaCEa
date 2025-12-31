#!/usr/bin/env npx tsx
/**
 * Sensitivity/Specificity Filler - Add diagnostic accuracy data
 * 
 * Tables with missing sens/spec:
 *   - PhysicalExamFinding: 161 missing (75/236 = 32%)
 *   - SpecialTest: 70 missing (372/442 = 84%)
 * 
 * Also fills related diagnostic utility fields:
 *   - Positive/Negative Likelihood Ratios (LR+/LR-)
 *   - Negative indicates (for PE findings)
 *   - Board yield facts
 * 
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/sensitivity-specificity-filler.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/sensitivity-specificity-filler.ts --table=PhysicalExamFinding
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/sensitivity-specificity-filler.ts --table=SpecialTest --batch=30
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
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface DiagnosticAccuracyResult {
  sensitivity: number | null;
  specificity: number | null;
  positiveLR: number | null;
  negativeLR: number | null;
  evidenceQuality: string;
  negativeIndicates?: string[];
  boardYieldFacts?: string[];
  source?: string;
}

async function generateDiagnosticAccuracy(
  tableName: 'PhysicalExamFinding' | 'SpecialTest',
  record: any
): Promise<DiagnosticAccuracyResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });
  
  await rateLimiter.acquire();
  
  let context = '';
  
  if (tableName === 'PhysicalExamFinding') {
    context = `Physical Exam Finding: ${record.name}
System: ${record.system}
Description: ${record.description || ''}
How to Elicit: ${record.howToElicit || ''}
Positive Indicates: ${(record.positiveIndicates || []).join(', ')}
Clinical Significance: ${record.clinicalSignificance || ''}`;
  } else {
    context = `Special Test: ${record.name}
System: ${record.system}
Region: ${record.region || ''}
Description: ${record.description || ''}
Technique: ${record.technique || ''}
Positive Test: ${record.positiveTest || ''}
Interpretation: ${record.interpretation || ''}`;
  }
  
  const prompt = `Provide evidence-based diagnostic accuracy data for this clinical finding/test for PANCE board preparation:

${context}

You are a clinical epidemiologist. Provide the best available evidence on diagnostic accuracy.
If exact values are unknown, provide reasonable estimates based on similar tests and mark evidence quality accordingly.

Return a JSON object:
{
  "sensitivity": <number 0-100 representing %, or null if truly unknown>,
  "specificity": <number 0-100 representing %, or null if truly unknown>,
  "positiveLR": <positive likelihood ratio as decimal, e.g., 5.2, or null>,
  "negativeLR": <negative likelihood ratio as decimal, e.g., 0.2, or null>,
  "evidenceQuality": "high|moderate|low|very-low|estimated",
  ${tableName === 'PhysicalExamFinding' ? `"negativeIndicates": [
    "What a NEGATIVE finding suggests - condition 1",
    "What a NEGATIVE finding suggests - condition 2",
    // 3-5 items
  ],` : ''}
  "boardYieldFacts": [
    "High-yield board fact about this test's utility",
    "Another clinically important fact",
    // 3-4 facts for board prep
  ],
  "source": "Brief note on evidence source (e.g., 'Meta-analysis', 'Single study', 'Expert consensus')"
}

Important:
- Sensitivity/specificity should be numbers 0-100 (percentages)
- LR values should be decimals (e.g., 5.2 not 520%)
- Mark evidenceQuality as "estimated" if you're inferring from similar tests
- For well-studied tests (Lachman, McMurray, etc.), use published values
- For less studied findings, provide reasonable clinical estimates`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse diagnostic accuracy for ${record.name}`);
  }
}

async function processPhysicalExamFindings(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n🩺 Processing PhysicalExamFinding...');
  
  const records = await prisma.physicalExamFinding.findMany({
    where: {
      OR: [
        { sensitivity: null },
        { specificity: null }
      ]
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing sensitivity/specificity`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const data = await generateDiagnosticAccuracy('PhysicalExamFinding', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}:`);
        console.log(`    Sens: ${data.sensitivity}% | Spec: ${data.specificity}%`);
        console.log(`    LR+: ${data.positiveLR} | LR-: ${data.negativeLR}`);
        console.log(`    Evidence: ${data.evidenceQuality}`);
      } else {
        const updateData: any = {
          evidenceQuality: data.evidenceQuality,
        };
        
        if (data.sensitivity !== null) {
          updateData.sensitivity = data.sensitivity;
        }
        if (data.specificity !== null) {
          updateData.specificity = data.specificity;
        }
        if (data.positiveLR !== null) {
          updateData.positiveLR = data.positiveLR;
        }
        if (data.negativeLR !== null) {
          updateData.negativeLR = data.negativeLR;
        }
        if (data.negativeIndicates && data.negativeIndicates.length > 0) {
          updateData.negativeIndicates = data.negativeIndicates;
        }
        if (data.boardYieldFacts && data.boardYieldFacts.length > 0) {
          // Only update if empty
          if (!record.boardYieldFacts || record.boardYieldFacts.length === 0) {
            updateData.boardYieldFacts = data.boardYieldFacts;
          }
        }
        
        await prisma.physicalExamFinding.update({
          where: { id: record.id },
          data: updateData
        });
        
        console.log(`  ✅ ${record.name}: ${data.sensitivity}% / ${data.specificity}%`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 400));
  }
  
  return { success, failed };
}

async function processSpecialTests(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n🔬 Processing SpecialTest...');
  
  const records = await prisma.specialTest.findMany({
    where: {
      OR: [
        { sensitivity: null },
        { specificity: null }
      ]
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing sensitivity/specificity`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const data = await generateDiagnosticAccuracy('SpecialTest', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}:`);
        console.log(`    Sens: ${data.sensitivity}% | Spec: ${data.specificity}%`);
        console.log(`    Evidence: ${data.evidenceQuality}`);
      } else {
        const updateData: any = {};
        
        if (data.sensitivity !== null) {
          updateData.sensitivity = data.sensitivity;
        }
        if (data.specificity !== null) {
          updateData.specificity = data.specificity;
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.specialTest.update({
            where: { id: record.id },
            data: updateData
          });
        }
        
        console.log(`  ✅ ${record.name}: ${data.sensitivity}% / ${data.specificity}%`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 400));
  }
  
  return { success, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tableArg = args.find(a => a.startsWith('--table='));
  const tableName = tableArg ? tableArg.split('=')[1] : 'all';
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 30;
  
  console.log('📊 Sensitivity/Specificity Filler');
  console.log('==================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Table: ${tableName}`);
  console.log(`Batch size: ${batchSize}`);
  
  const results: Record<string, { success: number; failed: number }> = {};
  
  try {
    if (tableName === 'all' || tableName === 'PhysicalExamFinding') {
      results.PhysicalExamFinding = await processPhysicalExamFindings(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'SpecialTest') {
      results.SpecialTest = await processSpecialTests(batchSize, dryRun);
    }
    
    console.log('\n==================================');
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
