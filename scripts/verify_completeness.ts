import fs from 'fs';
import path from 'path';
import { CONDITION_REGISTRY } from '../config/conditionRegistry';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONTENT_FILE = path.join(process.cwd(), 'data', 'conditionContent.clean.json');

const REQUIRED_SECTIONS = [
  'overview',
  'etiology',
  'pathophysiology',
  'epidemiology',
  'symptoms',
  'physical_exam',
  'diagnostics',
  'treatment',
  'prognosis',
  'differential_diagnosis',
  'risk_factors',
  'complications',
  'buzzwords',
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function verifyCompleteness() {
  console.log('--- Verifying Condition Completeness (Clean JSON) ---');

  if (!fs.existsSync(CONTENT_FILE)) {
    console.error(`❌ Clean content file not found: ${CONTENT_FILE}`);
    console.error('   Run "npx tsx scripts/normalizeContent.ts" first.');
    return;
  }

  // 1. Load Registry
  const registryConditions = new Set(CONDITION_REGISTRY.map((c) => c.condition));
  const registryNorm = new Set(CONDITION_REGISTRY.map((c) => normalize(c.condition)));
  console.log(`Registry count: ${registryConditions.size}`);

  // 2. Load Content File
  const contentList: any[] = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf-8'));
  console.log(`Content file count: ${contentList.length}`);

  // 3. Check for Content in File NOT in Registry
  // Build a map of Registry ID -> Condition Name
  const registryIdMap = new Set<string>();

  CONDITION_REGISTRY.forEach((c) => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    const id = `${c.system}__${norm(c.subcategory)}__${norm(c.condition)}`;
    registryIdMap.add(id);
  });

  const orphanedContent: string[] = [];
  const missingSectionsMap: Record<string, string[]> = {};

  contentList.forEach((item) => {
    // Check Registry Match
    if (!registryIdMap.has(item.conditionId)) {
      orphanedContent.push(item.conditionName || item.conditionId);
    }

    // Check Missing Sections
    const missing: string[] = [];
    for (const section of REQUIRED_SECTIONS) {
      if (
        !item.content[section] ||
        (Array.isArray(item.content[section]) && item.content[section].length === 0)
      ) {
        missing.push(section);
      }
    }
    if (missing.length > 0) {
      missingSectionsMap[item.conditionName] = missing;
    }
  });

  console.log(`\n🔍 Orphaned Content (In JSON but not Registry): ${orphanedContent.length}`);
  if (orphanedContent.length > 0) {
    console.log(orphanedContent.join(', '));
  }

  console.log(`\n🔍 Conditions with Missing Sections: ${Object.keys(missingSectionsMap).length}`);
  Object.entries(missingSectionsMap).forEach(([name, missing]) => {
    console.log(`  - ${name}: Missing [${missing.join(', ')}]`);
  });

  // 4. Check for Registry items NOT in Content
  const contentIdSet = new Set(contentList.map((c) => c.conditionId));
  const missingContent: string[] = [];

  CONDITION_REGISTRY.forEach((c) => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    const id = `${c.system}__${norm(c.subcategory)}__${norm(c.condition)}`;
    if (!contentIdSet.has(id)) {
      missingContent.push(c.condition);
    }
  });

  console.log(`\n🔍 Missing Content (In Registry but not JSON): ${missingContent.length}`);
  // console.log(missingContent.join(', ')); // Too many likely
}

verifyCompleteness().catch(console.error);
