/**
 * Example Usage: NCCPA Blueprint Weighting & Condition Resolution
 *
 * Demonstrates how to use the new utilities from Sprint A:
 * - lib/conditionResolver.ts (Step 1)
 * - lib/nccpa-question-weighting.ts (Step 2)
 */

import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { resolveConditionId, resolveConditionIdBatch } from '../lib/conditionResolver';
import {
  calculateSessionDistribution,
  selectWeightedSystems,
  getSystemWeight,
  getDistributionSummary,
  normalizeSystemCode,
} from '../lib/nccpa-question-weighting';

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function demonstrateConditionResolver() {
  console.log('\n📋 CONDITION RESOLVER DEMO');
  console.log('='.repeat(50));

  // Example 1: Single condition resolution
  console.log('\n1. Single Condition Resolution:');
  const match1 = await resolveConditionId(prisma, 'Atrial Fibrillation', 'CV');
  console.log(`   Input: "Atrial Fibrillation" (CV)`);
  console.log(`   → conditionId: ${match1?.conditionId}`);
  console.log(`   → name: ${match1?.name}`);
  console.log(`   → confidence: ${(match1?.confidence || 0).toFixed(2)}`);

  // Example 2: Fuzzy matching
  console.log('\n2. Fuzzy Matching:');
  const match2 = await resolveConditionId(prisma, 'A Fib', 'CV', 0.5);
  console.log(`   Input: "A Fib" (CV)`);
  console.log(`   → conditionId: ${match2?.conditionId}`);
  console.log(`   → name: ${match2?.name}`);
  console.log(`   → confidence: ${(match2?.confidence || 0).toFixed(2)}`);

  // Example 3: Batch resolution
  console.log('\n3. Batch Resolution:');
  const conditions = [
    { name: 'Diabetes', system: 'ENDO' },
    { name: 'Hypertension', system: 'CV' },
    { name: 'COPD', system: 'PULM' },
  ];

  const results = await resolveConditionIdBatch(prisma, conditions);
  conditions.forEach((c) => {
    const match = results.get(c.name);
    console.log(`   ${c.name} → ${match?.conditionId} (${(match?.confidence || 0).toFixed(2)})`);
  });
}

function demonstrateNCCPAWeighting() {
  console.log('\n\n🎓 NCCPA BLUEPRINT WEIGHTING DEMO');
  console.log('='.repeat(50));

  // Example 1: Session distribution
  console.log('\n1. Session Distribution (40 questions):');
  const distribution = calculateSessionDistribution(40);
  const sorted = Array.from(distribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8); // Top 8

  sorted.forEach(([system, count]) => {
    console.log(`   ${system.padEnd(10)} ${count} questions (${getSystemWeight(system)}%)`);
  });

  // Example 2: Weighted system selection
  console.log('\n2. Weighted Random Selection (10 systems):');
  const selected = selectWeightedSystems(10);
  console.log(`   Selected: ${selected.join(', ')}`);

  // Example 3: System normalization
  console.log('\n3. System Code Normalization:');
  const aliases = ['CARDIOVASCULAR', 'PULMONARY', 'GI', 'MUSCULOSKELETAL'];

  aliases.forEach((alias) => {
    const normalized = normalizeSystemCode(alias);
    const weight = getSystemWeight(normalized);
    console.log(`   ${alias.padEnd(18)} → ${normalized.padEnd(6)} (${weight}%)`);
  });

  // Example 4: Full distribution summary
  console.log('\n4. Complete Distribution Summary:');
  console.log(getDistributionSummary(40));
}

function demonstrateIntegration() {
  console.log('\n\n🔗 INTEGRATION EXAMPLE');
  console.log('='.repeat(50));
  console.log('\nHow to use in question generation:');
  console.log(`
// 1. Generate questions with NCCPA-weighted system selection
const sessionSize = 40;
const distribution = calculateSessionDistribution(sessionSize);

for (const [system, count] of distribution) {
  // Generate 'count' questions for this system
  const questions = await generateQuestionsForSystem(system, count);
  
  // 2. Resolve condition IDs for each question
  for (const question of questions) {
    const match = await resolveConditionId(
      prisma,
      question.conditionName,
      system,
      0.7  // 70% confidence threshold
    );
    
    if (match) {
      // Link to real database condition
      question.conditionId = match.conditionId;
      question.condition = match.name; // Use canonical name
    }
  }
}

// Result: Questions are properly distributed AND linked to database!
  `);
}

async function main() {
  console.log('🚀 QUESTION GENERATION SPRINT A DEMONSTRATION');
  console.log('='.repeat(50));
  console.log('Step 1: Fix conditionId Linking');
  console.log('Step 2: NCCPA Blueprint Weighting');

  try {
    await demonstrateConditionResolver();
    demonstrateNCCPAWeighting();
    demonstrateIntegration();

    console.log('\n\n✅ Sprint A Complete!');
    console.log('\nNext Steps (Sprint B):');
    console.log('  - Step 3: Question Deduplication');
    console.log('  - Step 4: Adaptive Difficulty');
    console.log('  - Step 5: Interleaved Sessions');
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
