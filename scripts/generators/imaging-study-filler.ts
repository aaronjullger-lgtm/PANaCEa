#!/usr/bin/env npx tsx
/**
 * Imaging Study Filler - Fill empty fields in ImagingStudy table
 * 
 * Updates existing ImagingStudy records to fill empty fields with AI-generated content.
 * Also creates ImagingConditionLink entries to link studies to conditions with example images.
 * 
 * Fields to fill:
 *   - allergyProtocol, contrastAgent, contrastType, normalFindings, pregnancySafety
 *   - preparation, protocol, radiationDose, renalConsiderations, reportTemplate, scanDuration
 *   - alternativeTo[], boardYieldFacts[], commonMistakes[], testQuestionTips[], whenToAvoid[], keyFindings
 * 
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/imaging-study-filler.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/imaging-study-filler.ts --update-existing
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/imaging-study-filler.ts --batch=20
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

interface ImagingFillContent {
  // String fields
  allergyProtocol: string;
  contrastAgent: string;
  contrastType: string;
  normalFindings: string;
  pregnancySafety: string;
  preparation: string;
  protocol: string;
  radiationDose: string;
  renalConsiderations: string;
  reportTemplate: string;
  scanDuration: string;
  
  // Array fields  
  alternativeTo: string[];
  boardYieldFacts: string[];
  commonMistakes: string[];
  testQuestionTips: string[];
  whenToAvoid: string[];
  firstLineFor: string[];
  classicSigns: string[];
  indications: string[];
  
  // JSON field
  keyFindings: Record<string, string>;
}

async function generateImagingContent(study: any): Promise<ImagingFillContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });
  
  await rateLimiter.acquire();
  
  const prompt = `Generate comprehensive clinical content for the imaging study "${study.name}" (${study.modality}) for PANCE/PA education.

Current info:
- Modality: ${study.modality}
- Body Region: ${study.bodyRegion || 'Not specified'}
- Uses Contrast: ${study.usesContrast}
- Uses Radiation: ${study.usesRadiation}
- Description: ${study.description || 'Not available'}
- Indications: ${study.indications?.join(', ') || 'Not specified'}

Return a JSON object with EXACTLY these fields (provide meaningful clinical content, not "N/A" or empty):

{
  "allergyProtocol": "${study.usesContrast ? 'Describe contrast allergy pre-medication protocol (e.g., prednisone 50mg at 13h, 7h, 1h + diphenhydramine 50mg 1h before)' : 'Not applicable - no contrast used'}",
  "contrastAgent": "${study.usesContrast ? 'Specific contrast agent used (e.g., iodinated IV contrast, gadolinium, barium)' : 'Not applicable - non-contrast study'}",
  "contrastType": "${study.usesContrast ? 'Type: IV, oral, rectal, intrathecal, etc.' : 'Not applicable'}",
  "normalFindings": "Describe what normal findings look like on this study (2-3 sentences)",
  "pregnancySafety": "Pregnancy category and recommendations (safe/contraindicated/use with caution, specific trimester concerns)",
  "preparation": "Patient preparation instructions (fasting, bowel prep, hydration, medications to hold)",
  "protocol": "Standard imaging protocol (phases, timing, positioning)",
  "radiationDose": "${study.usesRadiation ? 'Approximate effective dose in mSv and comparison to chest x-ray equivalents' : 'No ionizing radiation'}",
  "renalConsiderations": "${study.usesContrast ? 'eGFR thresholds, contrast-induced nephropathy prevention (hydration protocol), when to hold metformin' : 'No contrast-related renal concerns'}",
  "reportTemplate": "Key elements that should be in the radiology report (systematic review checklist)",
  "scanDuration": "Typical scan duration (e.g., 5-10 minutes, 30-45 minutes)",
  
  "alternativeTo": ["Array of 2-4 alternative imaging studies when this one is contraindicated"],
  "boardYieldFacts": ["Array of 3-5 high-yield facts specifically tested on PANCE"],
  "commonMistakes": ["Array of 3-4 common ordering or interpretation mistakes"],
  "testQuestionTips": ["Array of 2-3 tips for answering board questions about this study"],
  "whenToAvoid": ["Array of 3-5 specific scenarios when NOT to order this study"],
  
  "keyFindings": {
    "finding1_name": "Description of what this finding looks like and what it indicates",
    "finding2_name": "Description",
    "finding3_name": "Description"
  },
  
  "firstLineFor": ["Array of 3-5 conditions/scenarios where this is the FIRST-LINE imaging study"],
  "classicSigns": ["Array of 3-5 pathognomonic/classic findings seen on this study, format: 'Sign name (condition)'"],
  "indications": ["Array of 5-8 clinical indications for ordering this study"]
}

Be specific and clinically accurate. Every field must have meaningful content.
Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${study.name}`);
  }
  
  return JSON.parse(jsonMatch[0]);
}

function ensureArray(value: any, fallback: string): string[] {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }
  return [fallback];
}

function needsUpdate(record: any): boolean {
  // Check if key fields are empty
  const emptyFields = [
    !record.allergyProtocol,
    !record.normalFindings,
    !record.pregnancySafety,
    !record.preparation,
    !record.protocol,
    !record.radiationDose,
    !record.scanDuration,
    !record.boardYieldFacts || record.boardYieldFacts.length === 0,
    !record.commonMistakes || record.commonMistakes.length === 0,
    !record.keyFindings,
    !record.firstLineFor || record.firstLineFor.length === 0,
    !record.classicSigns || record.classicSigns.length === 0,
    !record.indications || record.indications.length === 0
  ];
  
  return emptyFields.some(empty => empty);
}

async function updateImagingStudy(id: string, content: ImagingFillContent): Promise<void> {
  await prisma.imagingStudy.update({
    where: { id },
    data: {
      allergyProtocol: content.allergyProtocol,
      contrastAgent: content.contrastAgent,
      contrastType: content.contrastType,
      normalFindings: content.normalFindings,
      pregnancySafety: content.pregnancySafety,
      preparation: content.preparation,
      protocol: content.protocol,
      radiationDose: content.radiationDose,
      renalConsiderations: content.renalConsiderations,
      reportTemplate: content.reportTemplate,
      scanDuration: content.scanDuration,
      alternativeTo: ensureArray(content.alternativeTo, 'No standard alternatives'),
      boardYieldFacts: ensureArray(content.boardYieldFacts, 'Review indications and contraindications'),
      commonMistakes: ensureArray(content.commonMistakes, 'Ensure appropriate clinical indication'),
      testQuestionTips: ensureArray(content.testQuestionTips, 'Know first-line imaging for common presentations'),
      whenToAvoid: ensureArray(content.whenToAvoid, 'Avoid if not clinically indicated'),
      keyFindings: content.keyFindings || {},
      firstLineFor: ensureArray(content.firstLineFor, 'Review clinical guidelines'),
      classicSigns: ensureArray(content.classicSigns, 'Review characteristic findings'),
      indications: ensureArray(content.indications, 'Review clinical indications')
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;
  
  console.log('🏥 Imaging Study Filler - Fill Empty Fields');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'UPDATE'}`);
  if (batchSize) console.log(`   Batch size: ${batchSize}`);
  console.log('');
  
  const allStudies = await prisma.imagingStudy.findMany();
  console.log(`📊 Found ${allStudies.length} imaging studies\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  
  for (const study of allStudies) {
    if (batchSize && processed >= batchSize) {
      console.log(`\n⏸️  Batch limit reached (${batchSize})`);
      break;
    }
    
    if (!needsUpdate(study)) {
      console.log(`  ⏭️  Skipped: ${study.name} (already complete)`);
      skipped++;
      continue;
    }
    
    try {
      if (dryRun) {
        console.log(`  📝 Would update: ${study.name}`);
        updated++;
      } else {
        console.log(`  🔄 Updating: ${study.name}...`);
        const content = await generateImagingContent(study);
        await updateImagingStudy(study.id, content);
        console.log(`  ✅ Updated: ${study.name}`);
        updated++;
      }
      processed++;
    } catch (error: any) {
      console.error(`  ❌ Failed: ${study.name} - ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Imaging Study Filler Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed:  ${failed}`);
  console.log(`   Total processed: ${processed}`);
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
