#!/usr/bin/env npx tsx
/**
 * Analyze condition names to identify non-conditions
 */

import { prisma } from './helpers/prisma-client';

async function analyzeConditionNames() {
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true, subcategory: true }
  });
  
  // Pattern matching for non-conditions
  const screeningPattern = /screening|screen|prophylaxis/i;
  const guidelinePattern = /guideline|protocol|management|approach/i;
  const therapyPattern = /therapy|treatment|management\s*$/i;
  const normalPattern = /^normal\s/i;
  
  const suspicious = {
    screenings: conditions.filter(c => screeningPattern.test(c.name)),
    guidelines: conditions.filter(c => guidelinePattern.test(c.name) && !screeningPattern.test(c.name)),
    therapies: conditions.filter(c => therapyPattern.test(c.name)),
    normals: conditions.filter(c => normalPattern.test(c.name)),
  };
  
  console.log('🔍 Suspicious Condition Names:\n');
  console.log(`📋 Screenings (${suspicious.screenings.length}):`);
  suspicious.screenings.forEach(c => console.log(`  • ${c.name} (${c.system})`));
  
  console.log(`\n📖 Guidelines/Protocols (${suspicious.guidelines.length}):`);
  suspicious.guidelines.forEach(c => console.log(`  • ${c.name} (${c.system})`));
  
  console.log(`\n💊 Therapy/Management (${suspicious.therapies.length}):`);
  suspicious.therapies.forEach(c => console.log(`  • ${c.name} (${c.system})`));
  
  console.log(`\n✅ Normal/Baseline (${suspicious.normals.length}):`);
  suspicious.normals.forEach(c => console.log(`  • ${c.name} (${c.system})`));
}

analyzeConditionNames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
