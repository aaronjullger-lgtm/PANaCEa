#!/usr/bin/env npx tsx
/**
 * Buzzword Cleanup - Remove non-pathognomonic buzzwords
 * 
 * Evaluates existing buzzwords and removes ones that are:
 * - Too generic (could apply to many conditions)
 * - Lab values without specific patterns
 * - Common symptoms like "fever", "pain", "fatigue"
 * 
 * Usage:
 *   npx tsx scripts/generators/buzzword-cleanup.ts --dry-run    # Preview deletions
 *   npx tsx scripts/generators/buzzword-cleanup.ts              # Actually delete
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
  
  constructor(private capacity: number, private refillRate: number) {
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

// Obviously bad patterns - delete without AI
const DEFINITELY_BAD_PATTERNS = [
  /^fever$/i,
  /^pain$/i,
  /^fatigue$/i,
  /^weakness$/i,
  /^nausea$/i,
  /^vomiting$/i,
  /^diarrhea$/i,
  /^headache$/i,
  /^cough$/i,
  /^rash$/i,
  /^swelling$/i,
  /^inflammation$/i,
  /^infection$/i,
  /hyponatremia.*hyperkalemia/i,
  /hyperkalemia.*hyponatremia/i,
  /^elevated.*levels?$/i,
  /^low.*levels?$/i,
  /^abnormal.*$/i,
  /^positive.*test$/i,
  /^negative.*test$/i,
];

// Good pathognomonic examples to keep
const DEFINITELY_GOOD_PATTERNS = [
  /kayser.?fleischer/i,
  /target.?lesion/i,
  /bull.?s?.?eye/i,
  /currant.?jelly/i,
  /cobblestone/i,
  /skip.?lesion/i,
  /café.?au.?lait/i,
  /reed.?sternberg/i,
  /philadelphia.?chromosome/i,
  /cullen.?sign/i,
  /grey.?turner/i,
  /murphy.?s?.?sign/i,
  /mcburney/i,
  /rovsing/i,
  /kernig/i,
  /brudzinski/i,
  /osler.?node/i,
  /janeway/i,
  /negri.?bod/i,
  /ghon.?complex/i,
  /arachnodactyly/i,
  /pseudomembrane/i,
  /sandpaper.?rash/i,
  /strawberry.?tongue/i,
  /ascending.?paralysis/i,
  /descending.?paralysis/i,
  /pill.?rolling/i,
  /cogwheel/i,
  /moon.?fac/i,
  /buffalo.?hump/i,
  /exophthalmos/i,
  /birefringent/i,
  /boot.?shaped/i,
  /sawtooth/i,
  /delta.?wave/i,
  /s1q3t3/i,
  /hampton.?s?.?hump/i,
  /westermark/i,
  /beck.?s?.?triad/i,
  /pulsus.?paradoxus/i,
];

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

interface BuzzwordEvaluation {
  buzzword: string;
  condition: string;
  keep: boolean;
  reason: string;
}

async function evaluateBuzzwordsWithAI(
  buzzwords: { id: string; buzzword: string; condition: string }[]
): Promise<BuzzwordEvaluation[]> {
  const ai = getAI();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  });

  const prompt = `You are a PANCE exam expert evaluating buzzwords for pathognomonic specificity.

A GOOD pathognomonic buzzword is:
- Highly specific to ONE condition (when you see it, you immediately think of that ONE disease)
- A classic sign, named finding, or unique presentation
- Examples: "Kayser-Fleischer rings" (Wilson's), "currant jelly stool" (intussusception), "medial malleolus ulcer" (venous ulcer)

A BAD buzzword is:
- Generic lab findings that occur in many conditions (e.g., "hyponatremia", "elevated WBC")
- Common symptoms (e.g., "fever", "pain", "fatigue")  
- Non-specific findings (e.g., "inflammation", "infection")
- Combined findings that aren't uniquely diagnostic (e.g., "hyponatremia, hyperkalemia")

For each buzzword, decide if it's pathognomonic (1:1 with the condition) or too generic.

Return JSON array:
[
  {"buzzword": "example", "condition": "Disease", "keep": true, "reason": "Classic pathognomonic sign"},
  {"buzzword": "fever", "condition": "Disease", "keep": false, "reason": "Too generic, occurs in many conditions"}
]

Evaluate these buzzwords:
${JSON.stringify(buzzwords.map(b => ({ buzzword: b.buzzword, condition: b.condition })), null, 2)}`;

  await rateLimiter.acquire();
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse AI response:', text);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           🧹 BUZZWORD CLEANUP - Remove Non-Pathognomonic       ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}${' '.repeat(dryRun ? 35 : 40)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    // Get all buzzwords
    const allBuzzwords = await prisma.buzzword.findMany({
      orderBy: { condition: 'asc' },
    });
    
    console.log(`\n📊 Total buzzwords to evaluate: ${allBuzzwords.length}`);
    
    const toDelete: string[] = [];
    const toKeep: string[] = [];
    const needsAIEval: typeof allBuzzwords = [];
    
    // Phase 1: Pattern-based filtering
    console.log('\n🔍 Phase 1: Pattern-based filtering...\n');
    
    for (const bw of allBuzzwords) {
      // Check if definitely bad
      const isBad = DEFINITELY_BAD_PATTERNS.some(p => p.test(bw.buzzword));
      if (isBad) {
        toDelete.push(bw.id);
        console.log(`  ❌ DELETE (pattern): "${bw.buzzword}" → ${bw.condition}`);
        continue;
      }
      
      // Check if definitely good
      const isGood = DEFINITELY_GOOD_PATTERNS.some(p => p.test(bw.buzzword));
      if (isGood) {
        toKeep.push(bw.id);
        console.log(`  ✅ KEEP (pattern): "${bw.buzzword}" → ${bw.condition}`);
        continue;
      }
      
      // Needs AI evaluation
      needsAIEval.push(bw);
    }
    
    console.log(`\n  Pattern results: ${toDelete.length} to delete, ${toKeep.length} to keep, ${needsAIEval.length} need AI eval`);
    
    // Phase 2: AI evaluation for uncertain ones
    console.log('\n🤖 Phase 2: AI evaluation...\n');
    
    const batchSize = 30;
    for (let i = 0; i < needsAIEval.length; i += batchSize) {
      const batch = needsAIEval.slice(i, i + batchSize);
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(needsAIEval.length / batchSize)}...`);
      
      try {
        const evaluations = await evaluateBuzzwordsWithAI(batch);
        
        for (const evaluation of evaluations) {
          const original = batch.find(b => 
            b.buzzword.toLowerCase() === evaluation.buzzword.toLowerCase() &&
            b.condition === evaluation.condition
          );
          
          if (!original) continue;
          
          if (evaluation.keep) {
            toKeep.push(original.id);
            console.log(`    ✅ KEEP: "${evaluation.buzzword}" → ${evaluation.condition} (${evaluation.reason})`);
          } else {
            toDelete.push(original.id);
            console.log(`    ❌ DELETE: "${evaluation.buzzword}" → ${evaluation.condition} (${evaluation.reason})`);
          }
        }
      } catch (e) {
        console.error(`    Error processing batch:`, e);
        // Keep uncertain ones by default
        for (const bw of batch) {
          toKeep.push(bw.id);
        }
      }
      
      // Rate limit between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Phase 3: Execute deletions
    console.log('\n📊 Summary:');
    console.log(`  To keep: ${toKeep.length}`);
    console.log(`  To delete: ${toDelete.length}`);
    
    if (toDelete.length > 0) {
      if (dryRun) {
        console.log('\n  [DRY RUN] Would delete these buzzwords:');
        const toDeleteBuzzwords = allBuzzwords.filter(b => toDelete.includes(b.id));
        for (const bw of toDeleteBuzzwords.slice(0, 20)) {
          console.log(`    - "${bw.buzzword}" → ${bw.condition}`);
        }
        if (toDeleteBuzzwords.length > 20) {
          console.log(`    ... and ${toDeleteBuzzwords.length - 20} more`);
        }
      } else {
        console.log('\n🗑️ Deleting non-pathognomonic buzzwords...');
        const deleted = await prisma.buzzword.deleteMany({
          where: { id: { in: toDelete } },
        });
        console.log(`  Deleted ${deleted.count} buzzwords`);
      }
    }
    
    // Final count
    const finalCount = await prisma.buzzword.count();
    console.log(`\n✅ Final buzzword count: ${finalCount}`);
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
