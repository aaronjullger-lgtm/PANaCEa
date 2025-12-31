#!/usr/bin/env npx tsx
/**
 * Mnemonic Generator - Fill missing mnemonics across multiple tables
 * 
 * Tables with missing mnemonics:
 *   - DifferentialDiagnosis: 81 missing (151/232 = 65%)
 *   - AnatomyStructure: 67 missing (233/300 = 78%)
 *   - PhysicalExamFinding: 55 missing (181/236 = 77%)
 *   - MedicalContent: 21 missing (1106/1127 = 98%)
 *   - PhysiologyConcept: 14 missing (134/148 = 91%)
 * 
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/mnemonic-generator.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/mnemonic-generator.ts --table=DifferentialDiagnosis
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/mnemonic-generator.ts --table=all --batch=20
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

type TableName = 'DifferentialDiagnosis' | 'AnatomyStructure' | 'PhysicalExamFinding' | 'MedicalContent' | 'PhysiologyConcept';

interface MnemonicResult {
  mnemonics: string[];
}

async function generateMnemonics(
  tableName: TableName, 
  record: any
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  });
  
  await rateLimiter.acquire();
  
  let context = '';
  let itemName = '';
  
  switch (tableName) {
    case 'DifferentialDiagnosis':
      itemName = record.presentingComplaint;
      context = `Presenting Complaint: ${record.presentingComplaint}
Differential List: ${(record.differentialList || []).join(', ')}
Must Not Miss: ${(record.mustNotMiss || []).join(', ')}
Most Common: ${(record.mostCommon || []).join(', ')}`;
      break;
      
    case 'AnatomyStructure':
      itemName = record.name;
      context = `Structure: ${record.name}
System: ${record.system}
Function: ${record.function || 'Not specified'}
Innervation: ${record.innervation || 'Not specified'}
Blood Supply: ${record.bloodSupply || 'Not specified'}
Clinical Significance: ${record.clinicalSignificance || 'Not specified'}`;
      break;
      
    case 'PhysicalExamFinding':
      itemName = record.name;
      context = `Finding: ${record.name}
System: ${record.system}
Description: ${record.description || 'Not specified'}
How to Elicit: ${record.howToElicit || 'Not specified'}
Positive Indicates: ${(record.positiveIndicates || []).join(', ')}`;
      break;
      
    case 'MedicalContent':
      itemName = record.name;
      context = `Condition: ${record.name}
Overview: ${(record.overview || '').substring(0, 200)}
Key Symptoms: ${(record.symptoms || '').substring(0, 200)}
Gold Standard Dx: ${record.goldStandardDx || 'Not specified'}
First Line Rx: ${record.firstLineRx || 'Not specified'}`;
      break;
      
    case 'PhysiologyConcept':
      itemName = record.name;
      context = `Concept: ${record.name}
System: ${record.system}
Mechanism: ${record.mechanism || 'Not specified'}
Clinical Significance: ${record.clinicalSignificance || 'Not specified'}`;
      break;
      
    case 'Procedure':
      itemName = record.name;
      context = `Procedure: ${record.name}
Category: ${record.category || 'Not specified'}
System: ${record.system || 'Not specified'}
Description: ${record.description || 'Not specified'}
Indications: ${(record.indications || []).join(', ')}
Contraindications: ${(record.contraindications || []).join(', ')}
Key Steps: ${(record.keySteps || []).join(', ')}`;
      break;
  }
  
  const prompt = `Generate 2-4 memorable, medically accurate mnemonics for PA/medical students to remember key facts about:

${context}

Requirements:
1. Each mnemonic should be clinically useful and help recall important facts
2. Use acronyms, phrases, or visual associations
3. Make them memorable but appropriate for medical education
4. Focus on board-relevant/high-yield information

Return a JSON object:
{
  "mnemonics": [
    "MNEMONIC_1: Explanation of what each letter stands for",
    "MNEMONIC_2: Another helpful memory aid",
    // 2-4 mnemonics total
  ]
}

Be creative but clinically accurate. These are for PANCE board prep.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const parsed = JSON.parse(text) as MnemonicResult;
    return parsed.mnemonics || [];
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as MnemonicResult;
      return parsed.mnemonics || [];
    }
    throw new Error(`Failed to parse mnemonics for ${itemName}`);
  }
}

async function processDifferentialDiagnosis(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n📋 Processing DifferentialDiagnosis...');
  
  const records = await prisma.differentialDiagnosis.findMany({
    where: {
      mnemonics: { isEmpty: true }
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonics`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('DifferentialDiagnosis', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.presentingComplaint}: ${mnemonics.length} mnemonics`);
      } else {
        await prisma.differentialDiagnosis.update({
          where: { id: record.id },
          data: { mnemonics }
        });
        console.log(`  ✅ ${record.presentingComplaint}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.presentingComplaint}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function processAnatomyStructure(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n🦴 Processing AnatomyStructure...');
  
  const records = await prisma.anatomyStructure.findMany({
    where: {
      mnemonics: { isEmpty: true }
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonics`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('AnatomyStructure', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${mnemonics.length} mnemonics`);
      } else {
        await prisma.anatomyStructure.update({
          where: { id: record.id },
          data: { mnemonics }
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function processPhysicalExamFinding(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n🩺 Processing PhysicalExamFinding...');
  
  const records = await prisma.physicalExamFinding.findMany({
    where: {
      mnemonics: { isEmpty: true }
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonics`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('PhysicalExamFinding', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${mnemonics.length} mnemonics`);
      } else {
        await prisma.physicalExamFinding.update({
          where: { id: record.id },
          data: { mnemonics }
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function processProcedure(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n🔧 Processing Procedure...');
  
  const records = await prisma.procedure.findMany({
    where: {
      mnemonics: { isEmpty: true }
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonics`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('Procedure', record);
      console.log(`  ✅ ${record.name}: Generated ${mnemonics.length} mnemonics`);
      
      if (!dryRun) {
        await prisma.procedure.update({
          where: { id: record.id },
          data: { mnemonics }
        });
      }
      
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function processMedicalContent(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n📚 Processing MedicalContent...');
  
  const records = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { mnemonic: null },
        { mnemonic: '' }
      ]
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonic`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('MedicalContent', record);
      const mnemonic = mnemonics.join('\n\n');
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${mnemonics.length} mnemonics`);
      } else {
        await prisma.medicalContent.update({
          where: { id: record.id },
          data: { mnemonic }
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function processPhysiologyConcept(batchSize: number, dryRun: boolean): Promise<{ success: number; failed: number }> {
  console.log('\n⚡ Processing PhysiologyConcept...');
  
  const records = await prisma.physiologyConcept.findMany({
    where: {
      mnemonics: { isEmpty: true }
    },
    take: batchSize
  });
  
  console.log(`  Found ${records.length} records missing mnemonics`);
  
  let success = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      const mnemonics = await generateMnemonics('PhysiologyConcept', record);
      
      if (dryRun) {
        console.log(`  [DRY RUN] ${record.name}: ${mnemonics.length} mnemonics`);
      } else {
        await prisma.physiologyConcept.update({
          where: { id: record.id },
          data: { mnemonics }
        });
        console.log(`  ✅ ${record.name}`);
      }
      success++;
    } catch (e) {
      console.log(`  ❌ ${record.name}: ${e}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  return { success, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tableArg = args.find(a => a.startsWith('--table='));
  const tableName = tableArg ? tableArg.split('=')[1] : 'all';
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 20;
  
  console.log('🧠 Mnemonic Generator - Fill Missing Mnemonics');
  console.log('==============================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Table: ${tableName}`);
  console.log(`Batch size: ${batchSize}`);
  
  const results: Record<string, { success: number; failed: number }> = {};
  
  try {
    if (tableName === 'all' || tableName === 'DifferentialDiagnosis') {
      results.DifferentialDiagnosis = await processDifferentialDiagnosis(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'AnatomyStructure') {
      results.AnatomyStructure = await processAnatomyStructure(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'PhysicalExamFinding') {
      results.PhysicalExamFinding = await processPhysicalExamFinding(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'MedicalContent') {
      results.MedicalContent = await processMedicalContent(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'PhysiologyConcept') {
      results.PhysiologyConcept = await processPhysiologyConcept(batchSize, dryRun);
    }
    
    if (tableName === 'all' || tableName === 'Procedure') {
      results.Procedure = await processProcedure(batchSize, dryRun);
    }
    
    console.log('\n==============================================');
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
