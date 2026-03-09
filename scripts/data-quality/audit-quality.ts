#!/usr/bin/env npx tsx
/**
 * Comprehensive Quality Audit for MedicalContent and Drug tables.
 * Identifies fields that are inadequate (empty, placeholder, invalid format, etc.)
 * Outputs a prioritized list for enhancement via library enrichment.
 *
 * Usage:
 *   npx tsx scripts/data-quality/audit-quality.ts
 *   npx tsx scripts/data-quality/audit-quality.ts --table=MedicalContent
 *   npx tsx scripts/data-quality/audit-quality.ts --table=Drug
 *   npx tsx scripts/data-quality/audit-quality.ts --output ./data/quality-priority.json
 */

import { prisma, disconnect } from '../_shared/db';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { findInadequateFields } from './validation-rules';

interface InadequateFieldRecord {
  entityType: 'Condition' | 'Drug' | 'Procedure' | 'AnatomyStructure' | 'Other';
  id: string;
  name: string;
  system?: string;
  panceYield: number | null;
  inadequateFields: Array<{
    field: string;
    value: any;
    reason: string;
  }>;
  existingValues: Record<string, any>;
}

async function auditMedicalContent(): Promise<InadequateFieldRecord[]> {
  console.log('🔍 Scanning MedicalContent records...');
  const allContent = await prisma.medicalContent.findMany({
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      pance_yield: true,
      // We'll fetch all fields later; but we need all fields for validation.
      // Using select: true would be huge; we can fetch all fields but limit to needed.
      // For simplicity, we'll fetch all fields but limit batch size.
    },
    take: process.env.LIMIT ? parseInt(process.env.LIMIT) : undefined,
  });

  const records: InadequateFieldRecord[] = [];
  for (const content of allContent) {
    // Fetch full record with all fields
    const fullContent = await prisma.medicalContent.findUnique({
      where: { id: content.id },
    });
    if (!fullContent) continue;

    const inadequate = findInadequateFields(fullContent);
    if (inadequate.length === 0) continue;

    records.push({
      entityType: 'Condition',
      id: content.id,
      name: content.condition,
      system: content.system,
      panceYield: content.pance_yield,
      inadequateFields: inadequate,
      existingValues: fullContent,
    });
  }

  console.log(`📊 Found ${records.length} MedicalContent records with inadequate fields.`);
  return records;
}

async function auditDrugs(): Promise<InadequateFieldRecord[]> {
  console.log('🔍 Scanning Drug records...');
  const allDrugs = await prisma.drug.findMany({
    select: {
      id: true,
      genericName: true,
      panceYield: true,
      // We'll fetch full record later
    },
    take: process.env.LIMIT ? parseInt(process.env.LIMIT) : undefined,
  });

  const records: InadequateFieldRecord[] = [];
  for (const drug of allDrugs) {
    const fullDrug = await prisma.drug.findUnique({
      where: { id: drug.id },
    });
    if (!fullDrug) continue;

    const inadequate = findInadequateFields(fullDrug);
    if (inadequate.length === 0) continue;

    records.push({
      entityType: 'Drug',
      id: drug.id,
      name: drug.genericName,
      system: undefined,
      panceYield: drug.panceYield,
      inadequateFields: inadequate,
      existingValues: fullDrug,
    });
  }

  console.log(`📊 Found ${records.length} Drug records with inadequate fields.`);
  return records;
}

async function auditConditions(): Promise<InadequateFieldRecord[]> {
  console.log('🔍 Scanning Condition records...');
  const allConditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      displayName: true,
    },
    take: process.env.LIMIT ? parseInt(process.env.LIMIT) : undefined,
  });

  const records: InadequateFieldRecord[] = [];
  for (const cond of allConditions) {
    const fullCondition = await prisma.condition.findUnique({
      where: { id: cond.id },
    });
    if (!fullCondition) continue;

    const inadequate = findInadequateFields(fullCondition);
    if (inadequate.length === 0) continue;

    records.push({
      entityType: 'Condition',
      id: cond.id,
      name: cond.name,
      system: cond.system,
      panceYield: null,
      inadequateFields: inadequate,
      existingValues: fullCondition,
    });
  }

  console.log(`📊 Found ${records.length} Condition records with inadequate fields.`);
  return records;
}

async function auditProcedures(): Promise<InadequateFieldRecord[]> {
  console.log('🔍 Scanning Procedure records...');
  const allProcedures = await prisma.procedure.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      panceYield: true,
      displayName: true,
    },
    take: process.env.LIMIT ? parseInt(process.env.LIMIT) : undefined,
  });

  const records: InadequateFieldRecord[] = [];
  for (const proc of allProcedures) {
    const fullProcedure = await prisma.procedure.findUnique({
      where: { id: proc.id },
    });
    if (!fullProcedure) continue;

    const inadequate = findInadequateFields(fullProcedure);
    if (inadequate.length === 0) continue;

    records.push({
      entityType: 'Procedure',
      id: proc.id,
      name: proc.name,
      system: proc.system,
      panceYield: proc.panceYield,
      inadequateFields: inadequate,
      existingValues: fullProcedure,
    });
  }

  console.log(`📊 Found ${records.length} Procedure records with inadequate fields.`);
  return records;
}

async function auditAnatomyStructures(): Promise<InadequateFieldRecord[]> {
  console.log('🔍 Scanning AnatomyStructure records...');
  const allAnatomy = await prisma.anatomyStructure.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      panceYield: true,
    },
    take: process.env.LIMIT ? parseInt(process.env.LIMIT) : undefined,
  });

  const records: InadequateFieldRecord[] = [];
  for (const anat of allAnatomy) {
    const fullAnatomy = await prisma.anatomyStructure.findUnique({
      where: { id: anat.id },
    });
    if (!fullAnatomy) continue;

    const inadequate = findInadequateFields(fullAnatomy);
    if (inadequate.length === 0) continue;

    records.push({
      entityType: 'AnatomyStructure',
      id: anat.id,
      name: anat.name,
      system: anat.system,
      panceYield: anat.panceYield,
      inadequateFields: inadequate,
      existingValues: fullAnatomy,
    });
  }

  console.log(`📊 Found ${records.length} AnatomyStructure records with inadequate fields.`);
  return records;
}

function prioritizeRecords(records: InadequateFieldRecord[]): InadequateFieldRecord[] {
  return records.sort((a, b) => {
    // Prioritize by number of inadequate fields (more fields = higher priority)
    const aScore = a.inadequateFields.length * 10 + (a.panceYield ?? 0);
    const bScore = b.inadequateFields.length * 10 + (b.panceYield ?? 0);
    return bScore - aScore; // descending
  });
}

async function main() {
  const args = process.argv.slice(2);
  const table = args.includes('--table=MedicalContent') ? 'MedicalContent' :
                args.includes('--table=Drug') ? 'Drug' :
                args.includes('--table=Condition') ? 'Condition' :
                args.includes('--table=Procedure') ? 'Procedure' :
                args.includes('--table=AnatomyStructure') ? 'AnatomyStructure' : 'all';
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : './data/quality-priority.json';

  mkdirSync(dirname(resolve(outputPath)), { recursive: true });

  let records: InadequateFieldRecord[] = [];
  if (table === 'MedicalContent' || table === 'all') {
    records.push(...await auditMedicalContent());
  }
  if (table === 'Drug' || table === 'all') {
    records.push(...await auditDrugs());
  }
  if (table === 'Condition' || table === 'all') {
    records.push(...await auditConditions());
  }
  if (table === 'Procedure' || table === 'all') {
    records.push(...await auditProcedures());
  }
  if (table === 'AnatomyStructure' || table === 'all') {
    records.push(...await auditAnatomyStructures());
  }

  const prioritized = prioritizeRecords(records);

  const output = {
    auditTimestamp: new Date().toISOString(),
    totalRecords: prioritized.length,
    records: prioritized,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`✅ Quality audit complete. Saved to ${outputPath}`);

  // Print summary
  const totalFields = prioritized.reduce((sum, rec) => sum + rec.inadequateFields.length, 0);
  console.log(`📈 Summary:`);
  console.log(`   - ${prioritized.length} records with inadequate fields`);
  console.log(`   - ${totalFields} inadequate fields total`);
  console.log(`   - Top 5 records:`);
  prioritized.slice(0, 5).forEach((rec, idx) => {
    console.log(`     ${idx + 1}. ${rec.name} (${rec.entityType}): ${rec.inadequateFields.length} fields`);
  });

  await disconnect();
}

main().catch((error) => {
  console.error('❌ Quality audit failed:', error);
  process.exit(1);
});