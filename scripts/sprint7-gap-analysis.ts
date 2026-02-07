#!/usr/bin/env tsx
/**
 * SPRINT 7: Gap Analysis
 *
 * Compares existing database conditions against PANCE blueprint to identify:
 * 1. Conditions in blueprint but not in database (missing)
 * 2. Conditions in database but not in blueprint (extra/granular)
 * 3. Coverage statistics by system
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';
import fs from 'fs';
import path from 'path';

interface BlueprintCondition {
  system: string;
  subcategory: string;
  parentCategory?: string;
  condition: string;
  level: number; // 2=system→subcategory, 3=system→parent→subcategory, 4=nested
}

function parseBlueprint(blueprintPath: string): BlueprintCondition[] {
  const content = fs.readFileSync(blueprintPath, 'utf-8');
  const lines = content.split('\n');

  const conditions: BlueprintCondition[] = [];
  let currentSystem = '';
  let currentSubcategory = '';
  let currentParentCategory = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // System header (## Cardiovascular System)
    if (trimmed.startsWith('## ') && trimmed.includes('System')) {
      currentSystem = trimmed
        .replace('##', '')
        .trim()
        .replace(/\s*\(\d+%\)/, '');
      currentSubcategory = '';
      currentParentCategory = '';
      continue;
    }

    // Subcategory header (### Cardiomyopathy)
    if (trimmed.startsWith('### ')) {
      currentSubcategory = trimmed.replace('###', '').trim();
      currentParentCategory = '';
      continue;
    }

    // Parent category (*   **Acute Coronary Syndrome**)
    if (trimmed.startsWith('*   **') && trimmed.endsWith('**')) {
      const match = trimmed.match(/\*\s+\*\*([^*]+)\*\*/);
      if (match && match[1]) {
        currentParentCategory = match[1].trim();
      }
      continue;
    }

    // Nested condition (    *   STEMI) - 4 spaces + *
    if (line.startsWith('    *   ') && currentParentCategory) {
      const condition = line.replace('    *   ', '').trim();
      if (condition && currentSystem && currentSubcategory) {
        conditions.push({
          system: currentSystem,
          subcategory: currentParentCategory, // The **nested** category
          parentCategory: currentSubcategory, // The top-level category
          condition,
          level: 4,
        });
      }
      continue;
    }

    // Top-level condition (*   Condition Name)
    if (trimmed.startsWith('*   ') && !trimmed.includes('**')) {
      const condition = trimmed.replace('*   ', '').trim();

      // Skip if this looks like metadata or notes
      if (condition.startsWith('(') || condition.startsWith('e.g.')) {
        continue;
      }

      if (condition && currentSystem && currentSubcategory) {
        conditions.push({
          system: currentSystem,
          subcategory: currentSubcategory,
          parentCategory: currentParentCategory || undefined,
          condition,
          level: currentParentCategory ? 3 : 2,
        });
      }

      // Reset parent category after top-level condition (not nested anymore)
      if (!line.startsWith('    ')) {
        currentParentCategory = '';
      }
    }
  }

  return conditions;
}

function normalizeConditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function fuzzyMatch(dbName: string, blueprintName: string): boolean {
  const dbNorm = normalizeConditionName(dbName);
  const bpNorm = normalizeConditionName(blueprintName);

  // Exact match
  if (dbNorm === bpNorm) return true;

  // One contains the other
  if (dbNorm.includes(bpNorm) || bpNorm.includes(dbNorm)) return true;

  // Common abbreviations and variations
  const variations: Record<string, string[]> = {
    mi: ['myocardial infarction'],
    stemi: ['st segment elevation myocardial infarction', 'st elevation mi'],
    nstemi: ['non st segment elevation myocardial infarction', 'non st elevation mi'],
    copd: ['chronic obstructive pulmonary disease'],
    gerd: ['gastroesophageal reflux disease'],
    uti: ['urinary tract infection'],
    dvt: ['deep venous thrombosis', 'deep vein thrombosis'],
    pe: ['pulmonary embolism'],
    cva: ['cerebrovascular accident', 'stroke'],
    tia: ['transient ischemic attack'],
  };

  for (const [abbr, fullForms] of Object.entries(variations)) {
    if (
      (dbNorm.includes(abbr) || bpNorm.includes(abbr)) &&
      fullForms.some((form) => dbNorm.includes(form) || bpNorm.includes(form))
    ) {
      return true;
    }
  }

  return false;
}

async function performGapAnalysis() {
  console.log('🔍 SPRINT 7: Gap Analysis\n');

  // Parse blueprint
  const blueprintPath = path.join(process.cwd(), 'panceblueprint.md');
  const blueprintConditions = parseBlueprint(blueprintPath);

  console.log(`📋 Blueprint: ${blueprintConditions.length} conditions\n`);

  // Get database conditions
  const dbConditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      subcategory: true,
      parent_category: true,
    },
  });

  console.log(`💾 Database: ${dbConditions.length} conditions\n`);

  // Find missing conditions (in blueprint but not in DB)
  const missing: BlueprintCondition[] = [];
  const matched: BlueprintCondition[] = [];

  for (const bpCond of blueprintConditions) {
    const found = dbConditions.some(
      (dbCond) => dbCond.system === bpCond.system && fuzzyMatch(dbCond.name, bpCond.condition)
    );

    if (found) {
      matched.push(bpCond);
    } else {
      missing.push(bpCond);
    }
  }

  // Find extra conditions (in DB but not in blueprint)
  const extra = dbConditions.filter(
    (dbCond) =>
      !blueprintConditions.some(
        (bpCond) => bpCond.system === dbCond.system && fuzzyMatch(dbCond.name, bpCond.condition)
      )
  );

  console.log('📊 Gap Analysis Results:\n');
  console.log(
    `  ✅ Matched: ${matched.length} conditions (${((matched.length / blueprintConditions.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ❌ Missing: ${missing.length} conditions (${((missing.length / blueprintConditions.length) * 100).toFixed(1)}%)`
  );
  console.log(`  ➕ Extra (granular): ${extra.length} conditions\n`);

  // Coverage by system
  const systemCoverage: Record<string, { total: number; matched: number; missing: number }> = {};

  for (const bpCond of blueprintConditions) {
    if (!systemCoverage[bpCond.system]) {
      systemCoverage[bpCond.system] = { total: 0, matched: 0, missing: 0 };
    }
    const entry = systemCoverage[bpCond.system];
    if (entry) {
      entry.total++;
      if (matched.includes(bpCond)) {
        entry.matched++;
      } else {
        entry.missing++;
      }
    }
  }

  console.log('📈 Coverage by System:\n');
  const sortedSystems = Object.entries(systemCoverage).sort(
    (a, b) => b[1].matched / b[1].total - a[1].matched / a[1].total
  );

  for (const [system, stats] of sortedSystems) {
    if (!stats) continue;
    const coverage = ((stats.matched / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor((stats.matched / stats.total) * 20));
    console.log(`  ${system}`);
    console.log(`    ${bar} ${coverage}% (${stats.matched}/${stats.total})`);
  }

  console.log('\n');

  // Group missing by system
  const missingBySystem: Record<string, BlueprintCondition[]> = {};
  for (const m of missing) {
    if (!missingBySystem[m.system]) {
      missingBySystem[m.system] = [];
    }
    missingBySystem[m.system].push(m);
  }

  // Show top missing conditions per system
  console.log('🎯 Top Missing Conditions by System:\n');

  for (const [system, conditions] of Object.entries(missingBySystem).sort(
    (a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0)
  )) {
    if (!conditions || conditions.length === 0) continue;
    console.log(`  ${system} (${conditions.length} missing):`);
    conditions.slice(0, 5).forEach((c) => {
      console.log(`    - ${c.condition} (${c.subcategory})`);
    });
    if (conditions.length > 5) {
      console.log(`    ... and ${conditions.length - 5} more`);
    }
    console.log();
  }

  // Export missing conditions to JSON
  const outputPath = path.join(process.cwd(), 'data', 'missing-conditions.json');
  fs.writeFileSync(outputPath, JSON.stringify(missing, null, 2));
  console.log(`📄 Exported missing conditions to: ${outputPath}\n`);

  // Export extra conditions to JSON
  const extraOutputPath = path.join(process.cwd(), 'data', 'extra-conditions.json');
  fs.writeFileSync(
    extraOutputPath,
    JSON.stringify(
      extra.map((e) => ({
        id: e.id,
        name: e.name,
        system: e.system,
        subcategory: e.subcategory,
      })),
      null,
      2
    )
  );
  console.log(`📄 Exported extra conditions to: ${extraOutputPath}\n`);

  console.log('📋 Next Steps:');
  console.log('  1. Review missing-conditions.json');
  console.log('  2. Determine which missing conditions to add (Sprint 8)');
  console.log('  3. Extra conditions represent granular coverage (keep as-is)\n');
}

async function main() {
  try {
    await performGapAnalysis();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

main().catch(console.error);
