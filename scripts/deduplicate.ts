#!/usr/bin/env tsx
/**
 * Deduplication and Merge Tool
 * Finds duplicate conditions and optionally merges them
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface DuplicateGroup {
  canonicalName: string;
  records: Array<{
    id: string;
    conditionId: string;
    condition: string;
    system: string;
    status: string;
    completeness: number;
  }>;
  similarity: number;
}

function calculateCompleteness(record: any): number {
  const fields = [
    'overview',
    'pathophysiology',
    'etiology',
    'epidemiology',
    'symptoms',
    'physicalExam',
    'diagnostics',
    'differentialDiagnosis',
    'treatment',
    'complications',
    'prognosis',
    'riskFactors',
    'buzzwords',
  ];

  let filledFields = 0;
  for (const field of fields) {
    const value = record[field];
    if (
      value &&
      ((typeof value === 'string' && value.trim().length > 50) ||
        (Array.isArray(value) && value.length > 0))
    ) {
      filledFields++;
    }
  }

  return (filledFields / fields.length) * 100;
}

function normalizeConditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeConditionName(name1);
  const normalized2 = normalizeConditionName(name2);

  // Exact match after normalization
  if (normalized1 === normalized2) return 1.0;

  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }

  // Calculate word overlap
  const words1 = new Set(normalized1.split(' '));
  const words2 = new Set(normalized2.split(' '));
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const jaccardSimilarity = intersection.size / union.size;
  return jaccardSimilarity;
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log('🔍 Searching for duplicate conditions...\n');

  const records = await prisma.medicalContent.findMany({
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      status: true,
      overview: true,
      pathophysiology: true,
      etiology: true,
      epidemiology: true,
      symptoms: true,
      physicalExam: true,
      diagnostics: true,
      differentialDiagnosis: true,
      treatment: true,
      complications: true,
      prognosis: true,
      riskFactors: true,
      buzzwords: true,
    },
  });

  console.log(`   Analyzing ${records.length} records...`);

  const duplicateGroups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const recI = records[i];
    if (!recI || processed.has(recI.id)) continue;

    const group: DuplicateGroup = {
      canonicalName: recI.condition,
      records: [],
      similarity: 1.0,
    };

    const completeness1 = calculateCompleteness(recI);
    group.records.push({
      id: recI.id,
      conditionId: recI.conditionId,
      condition: recI.condition,
      system: recI.system,
      status: recI.status,
      completeness: completeness1,
    });

    // Compare with all other records
    for (let j = i + 1; j < records.length; j++) {
      const recJ = records[j];
      if (!recJ || processed.has(recJ.id)) continue;

      const similarity = calculateSimilarity(recI.condition, recJ.condition);

      // Consider duplicates if similarity > 0.7 and same system
      if (similarity > 0.7 && recI.system === recJ.system) {
        const completeness2 = calculateCompleteness(recJ);
        group.records.push({
          id: recJ.id,
          conditionId: recJ.conditionId,
          condition: recJ.condition,
          system: recJ.system,
          status: recJ.status,
          completeness: completeness2,
        });
        group.similarity = Math.min(group.similarity, similarity);
        processed.add(recJ.id);
      }
    }

    if (group.records.length > 1) {
      // Sort by completeness (highest first)
      group.records.sort((a, b) => b.completeness - a.completeness);
      duplicateGroups.push(group);
      processed.add(recI.id);
    }
  }

  // Sort groups by number of duplicates
  duplicateGroups.sort((a, b) => b.records.length - a.records.length);

  console.log(`   Found ${duplicateGroups.length} duplicate groups\n`);
  return duplicateGroups;
}

async function mergeRecords(keepId: string, deleteIds: string[], dryRun: boolean = true) {
  console.log(`${dryRun ? '🔍' : '🔧'} Merging records...`);
  console.log(`   Keep: ${keepId}`);
  console.log(`   Delete: ${deleteIds.join(', ')}`);

  if (dryRun) {
    console.log('   (Dry run - no changes made)');
    return;
  }

  try {
    // TODO: Update any foreign key references to point to keepId
    // This would require checking all tables that reference MedicalContent

    // Delete duplicate records
    await prisma.medicalContent.deleteMany({
      where: {
        id: {
          in: deleteIds,
        },
      },
    });

    console.log(`   ✅ Merged successfully`);
  } catch (error: unknown) {
    console.error(`   ❌ Merge failed:`, error instanceof Error ? error.message : String(error));
  }
}

async function generateDuplicateReport(duplicates: DuplicateGroup[]) {
  console.log('\n📊 Generating Duplicate Report...\n');

  console.log('='.repeat(80));
  console.log('DUPLICATE CONDITIONS REPORT');
  console.log('='.repeat(80));
  console.log(`Total Duplicate Groups: ${duplicates.length}`);
  console.log('='.repeat(80));

  if (duplicates.length === 0) {
    console.log('\n✅ No duplicates found!\n');
    return;
  }

  for (let i = 0; i < Math.min(duplicates.length, 20); i++) {
    const group = duplicates[i];
    if (!group) continue;
    console.log(
      `\nGroup ${i + 1}: ${group.canonicalName} (${group.records.length} variants, ${(group.similarity * 100).toFixed(0)}% similar)`
    );
    console.log('-'.repeat(80));

    for (const record of group.records) {
      const badge = record.completeness > 80 ? '🟢' : record.completeness > 50 ? '🟡' : '🔴';
      console.log(`  ${badge} ${record.condition}`);
      console.log(
        `     ID: ${record.id.substring(0, 8)}... | System: ${record.system} | Status: ${record.status} | Complete: ${record.completeness.toFixed(0)}%`
      );
    }

    const bestRecord = group.records[0];
    if (bestRecord) {
      console.log(
        `\n  💡 Suggested action: Keep "${bestRecord.condition}" (${bestRecord.completeness.toFixed(0)}% complete)`
      );
    }
  }

  if (duplicates.length > 20) {
    console.log(`\n... and ${duplicates.length - 20} more duplicate groups`);
  }

  console.log('\n' + '='.repeat(80));

  // Save detailed report
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `duplicates-report-${timestamp}.json`);

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalGroups: duplicates.length,
          totalDuplicates: duplicates.reduce((sum, g) => sum + g.records.length - 1, 0),
        },
        groups: duplicates,
      },
      null,
      2
    )
  );

  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  // Generate merge script
  const mergeScriptPath = path.join(reportDir, `merge-duplicates-${timestamp}.sh`);
  let mergeScript =
    '#!/bin/bash\n# Auto-generated merge script\n# Review carefully before executing!\n\n';

  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    const firstRecord = group?.records[0];
    if (!group || !firstRecord) continue;
    const keepId = firstRecord.id;
    const deleteIds = group.records.slice(1).map((r) => r.id);

    mergeScript += `# Group ${i + 1}: ${group.canonicalName}\n`;
    mergeScript += `# Keep: ${firstRecord.condition} (${firstRecord.completeness.toFixed(0)}% complete)\n`;
    mergeScript += `# Delete: ${group.records
      .slice(1)
      .map((r) => r.condition)
      .join(', ')}\n`;
    mergeScript += `# npx tsx scripts/deduplicate.ts --merge --keep=${keepId} --delete=${deleteIds.join(',')}\n\n`;
  }

  fs.writeFileSync(mergeScriptPath, mergeScript);
  fs.chmodSync(mergeScriptPath, '755');
  console.log(`📝 Merge script saved to: ${mergeScriptPath}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const merge = args.includes('--merge');
  const keepArg = args.find((arg) => arg.startsWith('--keep='));
  const deleteArg = args.find((arg) => arg.startsWith('--delete='));
  const dryRun = args.includes('--dry-run') || !merge;

  console.log('🔍 Starting Deduplication Check...\n');

  try {
    if (merge && keepArg && deleteArg) {
      // Merge specific records
      const keepId = keepArg.split('=')[1] ?? '';
      const deleteIdsRaw = deleteArg.split('=')[1];
      const deleteIds = (deleteIdsRaw ?? '').split(',').filter(Boolean);
      if (keepId) await mergeRecords(keepId, deleteIds, dryRun);
    } else {
      // Find and report duplicates
      const duplicates = await findDuplicates();
      await generateDuplicateReport(duplicates);
    }
  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
