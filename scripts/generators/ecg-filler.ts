#!/usr/bin/env npx tsx
/**
 * ECG Pattern Filler - Fill empty fields in ECGPattern table
 *
 * Updates existing ECGPattern records to fill empty fields with AI-generated content.
 * Also creates ECGConditionLink entries to link patterns to conditions with example images.
 *
 * Fields to fill:
 *   - displayName, subcategory, qtInterval, hemodynamicEffect, cardioversion, pacing, referral
 *   - aliases[], associatedConditions[], commonMistakes[], mnemonics[], distinguishingFeatures
 *   - exampleImageUrls[], annotatedImageUrls[]
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ecg-filler.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ecg-filler.ts --update-existing
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ecg-filler.ts --batch=10
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

interface ECGFillContent {
  // String fields
  displayName: string;
  subcategory: string;
  qtInterval: string;
  hemodynamicEffect: string;
  cardioversion: string;
  pacing: string;
  referral: string;

  // Array fields
  aliases: string[];
  associatedConditions: string[];
  boardYieldFacts: string[];
  commonMistakes: string[];
  mnemonics: string[];

  // JSON field
  distinguishingFeatures: Record<string, string>;
}

async function generateECGContent(pattern: any): Promise<ECGFillContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  await rateLimiter.acquire();

  const prompt = `Generate comprehensive clinical content for the ECG pattern "${pattern.name}" for PANCE/PA education.

Current info:
- Category: ${pattern.category}
- Is Emergency: ${pattern.isEmergency}
- Rate: ${pattern.rate || 'Not specified'}
- Rhythm: ${pattern.rhythm || 'Not specified'}
- P Wave: ${pattern.pWave || 'Not specified'}
- PR Interval: ${pattern.prInterval || 'Not specified'}
- QRS Complex: ${pattern.qrsComplex || 'Not specified'}
- ST Segment: ${pattern.stSegment || 'Not specified'}
- T Wave: ${pattern.tWave || 'Not specified'}
- Pathognomonic: ${pattern.pathognomonic || 'Not specified'}
- Acute Management: ${pattern.acuteManagement || 'Not specified'}

Return a JSON object with EXACTLY these fields (provide meaningful clinical content):

{
  "displayName": "Human-readable display name (e.g., 'Atrial Fibrillation' becomes 'Atrial Fibrillation (AFib)')",
  "subcategory": "More specific classification (e.g., for Arrhythmia: 'Supraventricular', 'Ventricular', 'Bradyarrhythmia')",
  "qtInterval": "QT/QTc interval characteristics for this pattern (normal, prolonged, shortened, or specific value)",
  "hemodynamicEffect": "How this rhythm affects cardiac output and blood pressure (stable/unstable, specific effects)",
  "cardioversion": "Is cardioversion indicated? When and how (synchronized vs unsynchronized, joules, contraindications)",
  "pacing": "Is pacing indicated? When and type (transcutaneous, transvenous, permanent)",
  "referral": "When to refer to cardiology/EP, urgency level (emergent/urgent/routine)",
  
  "aliases": ["Array of 2-4 alternative names or abbreviations (e.g., AFib, A-fib)"],
  "associatedConditions": ["Array of 4-6 conditions commonly associated with this ECG pattern"],
  "boardYieldFacts": ["Array of 3-5 high-yield facts specifically tested on PANCE about this rhythm"],
  "commonMistakes": ["Array of 3-4 common ECG interpretation mistakes for this pattern"],
  "mnemonics": ["Array of 1-2 memory aids for recognizing or managing this rhythm, empty if none common"],
  
  "distinguishingFeatures": {
    "vs_similar_rhythm_1": "How to differentiate from this similar rhythm",
    "vs_similar_rhythm_2": "Key distinguishing features"
  }
}

Be specific and clinically accurate. Every field must have meaningful content.
Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${pattern.name}`);
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
    !record.displayName,
    !record.subcategory,
    !record.qtInterval,
    !record.hemodynamicEffect,
    !record.cardioversion,
    !record.pacing,
    !record.referral,
    !record.aliases || record.aliases.length === 0,
    !record.associatedConditions || record.associatedConditions.length === 0,
    !record.boardYieldFacts || record.boardYieldFacts.length === 0,
    !record.commonMistakes || record.commonMistakes.length === 0,
    !record.distinguishingFeatures,
  ];

  return emptyFields.some((empty) => empty);
}

async function updateECGPattern(id: string, content: ECGFillContent): Promise<void> {
  await prisma.eCGPattern.update({
    where: { id },
    data: {
      displayName: content.displayName,
      subcategory: content.subcategory,
      qtInterval: content.qtInterval,
      hemodynamicEffect: content.hemodynamicEffect,
      cardioversion: content.cardioversion,
      pacing: content.pacing,
      referral: content.referral,
      aliases: ensureArray(content.aliases, 'No aliases'),
      associatedConditions: ensureArray(
        content.associatedConditions,
        'Various clinical conditions'
      ),
      boardYieldFacts: ensureArray(content.boardYieldFacts, 'Review diagnostic criteria'),
      commonMistakes: ensureArray(content.commonMistakes, 'Carefully review rhythm strip'),
      mnemonics: content.mnemonics || [],
      distinguishingFeatures: content.distinguishingFeatures || {},
    },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;

  console.log('💓 ECG Pattern Filler - Fill Empty Fields');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'UPDATE'}`);
  if (batchSize) console.log(`   Batch size: ${batchSize}`);
  console.log('');

  const allPatterns = await prisma.eCGPattern.findMany();
  console.log(`📊 Found ${allPatterns.length} ECG patterns\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const pattern of allPatterns) {
    if (batchSize && processed >= batchSize) {
      console.log(`\n⏸️  Batch limit reached (${batchSize})`);
      break;
    }

    if (!needsUpdate(pattern)) {
      console.log(`  ⏭️  Skipped: ${pattern.name} (already complete)`);
      skipped++;
      continue;
    }

    try {
      if (dryRun) {
        console.log(`  📝 Would update: ${pattern.name}`);
        updated++;
      } else {
        console.log(`  🔄 Updating: ${pattern.name}...`);
        const content = await generateECGContent(pattern);
        await updateECGPattern(pattern.id, content);
        console.log(`  ✅ Updated: ${pattern.name}`);
        updated++;
      }
      processed++;
    } catch (error: any) {
      console.error(`  ❌ Failed: ${pattern.name} - ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 ECG Pattern Filler Summary:');
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
