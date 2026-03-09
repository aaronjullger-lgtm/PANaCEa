#!/usr/bin/env npx tsx
/**
 * Missing Fields Audit for Library Enrichment
 *
 * Identifies MedicalContent and Drug records with missing fields and outputs
 * a prioritized JSON list for targeted RAG enrichment.
 *
 * Usage:
 *   npx tsx scripts/library-enrichment/audit.ts
 *   npx tsx scripts/library-enrichment/audit.ts --output ./data/priority.json
 */

import { prisma, disconnect } from '../_shared/db';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// Fields we consider "missing" if null/empty (based on V2 audit)
const MEDICAL_CONTENT_FIELDS = [
  'overview',
  'gold_standard_dx',
  'first_line_rx',
  'best_initial_test',
] as const;

const DRUG_FIELDS = [
  'mechanismOfAction',
  'dosing',
  'brandName',
  'sideEffects', // empty array counts as missing
  'indications', // empty array counts as missing
] as const;

// Adequacy standards adapted from scripts/content-enrichment.ts
const ADEQUACY_STANDARDS: Record<string, { minChars?: number; minItems?: number; type: string }> = {
  // MedicalContent fields
  overview: { minChars: 150, type: 'text' },
  gold_standard_dx: { minChars: 5, type: 'short' },
  first_line_rx: { minChars: 5, type: 'short' },
  best_initial_test: { minChars: 5, type: 'short' },
  // Drug fields
  mechanismOfAction: { minChars: 10, type: 'text' },
  dosing: { minChars: 10, type: 'text' },
  brandName: { minChars: 1, type: 'short' },
  sideEffects: { minItems: 1, type: 'array' },
  indications: { minItems: 1, type: 'array' },
};

type MissingFieldRecord = {
  entityType: 'Condition' | 'Drug';
  id: string;
  name: string;
  system?: string;
  panceYield: number | null;
  missingFields: string[];
  existingValues: Record<string, any>;
};

function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
    if (trimmed.includes('to be generated') || trimmed.includes('content needed')) return true;
    if (trimmed === 'n/a' || trimmed === 'na' || trimmed === 'none') return true;
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function isFieldAdequate(field: string, value: unknown): { adequate: boolean; reason?: string } {
  if (isFieldEmpty(value)) {
    return { adequate: false, reason: 'empty' };
  }

  const standard = ADEQUACY_STANDARDS[field];
  if (!standard) {
    return { adequate: true }; // No standard defined = adequate if not empty
  }

  // Check text/short fields for minimum length
  if (standard.type === 'text' || standard.type === 'short') {
    if (typeof value === 'string') {
      const len = value.trim().length;
      if (standard.minChars && len < standard.minChars) {
        return { adequate: false, reason: `too short (${len}/${standard.minChars} chars)` };
      }
    }
  }

  // Check array fields for minimum items
  if (standard.type === 'array') {
    if (Array.isArray(value)) {
      if (standard.minItems && value.length < standard.minItems) {
        return { adequate: false, reason: `too few items (${value.length}/${standard.minItems})` };
      }
    }
  }

  // JSON fields not needed for our fields
  return { adequate: true };
}

function isFieldMissing(field: string, value: unknown): boolean {
  const { adequate } = isFieldAdequate(field, value);
  return !adequate;
}

async function auditMedicalContent(): Promise<MissingFieldRecord[]> {
  const allContent = await prisma.medicalContent.findMany({
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      pance_yield: true,
      overview: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
    },
  });

  const records: MissingFieldRecord[] = [];

  for (const item of allContent) {
    const missing: string[] = [];
    const existing: Record<string, any> = {};

    for (const field of MEDICAL_CONTENT_FIELDS) {
      const value = item[field as keyof typeof item];
      existing[field] = value;
      if (isFieldMissing(field, value)) {
        missing.push(field);
      }
    }

    if (missing.length === 0) continue;

    records.push({
      entityType: 'Condition',
      id: item.conditionId,
      name: item.condition,
      system: item.system,
      panceYield: item.pance_yield,
      missingFields: missing,
      existingValues: existing,
    });
  }

  return records;
}

async function auditDrugs(): Promise<MissingFieldRecord[]> {
  const allDrugs = await prisma.drug.findMany({
    select: {
      id: true,
      genericName: true,
      panceYield: true,
      mechanismOfAction: true,
      dosing: true,
      brandName: true,
      sideEffects: true,
      indications: true,
    },
  });

  const records: MissingFieldRecord[] = [];

  for (const drug of allDrugs) {
    const missing: string[] = [];
    const existing: Record<string, any> = {};

    // Check each field
    if (isFieldMissing('mechanismOfAction', drug.mechanismOfAction)) missing.push('mechanismOfAction');
    if (isFieldMissing('dosing', drug.dosing)) missing.push('dosing');
    if (isFieldMissing('brandName', drug.brandName)) missing.push('brandName');
    if (isFieldMissing('sideEffects', drug.sideEffects)) missing.push('sideEffects');
    if (isFieldMissing('indications', drug.indications)) missing.push('indications');

    existing.mechanismOfAction = drug.mechanismOfAction;
    existing.dosing = drug.dosing;
    existing.brandName = drug.brandName;
    existing.sideEffects = drug.sideEffects;
    existing.indications = drug.indications;

    if (missing.length === 0) continue;

    records.push({
      entityType: 'Drug',
      id: drug.id,
      name: drug.genericName,
      panceYield: drug.panceYield,
      missingFields: missing,
      existingValues: existing,
    });
  }

  return records;
}

function prioritizeRecords(records: MissingFieldRecord[]): MissingFieldRecord[] {
  return records.sort((a, b) => {
    // First, sort by PANCE yield (higher yield first)
    const aYield = a.panceYield ?? 0;
    const bYield = b.panceYield ?? 0;
    if (aYield !== bYield) return bYield - aYield;

    // Then by number of missing fields (more missing first)
    if (a.missingFields.length !== b.missingFields.length) {
      return b.missingFields.length - a.missingFields.length;
    }

    // Then by entity type (Condition before Drug)
    if (a.entityType !== b.entityType) {
      return a.entityType === 'Condition' ? -1 : 1;
    }

    // Finally alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

async function main() {
  console.log('🔍 Auditing missing fields for MedicalContent...');
  const medicalRecords = await auditMedicalContent();
  console.log(`   Found ${medicalRecords.length} conditions with missing fields.`);

  console.log('💊 Auditing missing fields for Drug...');
  const drugRecords = await auditDrugs();
  console.log(`   Found ${drugRecords.length} drugs with missing fields.`);

  const allRecords = [...medicalRecords, ...drugRecords];
  console.log(`\n📊 Total records with missing fields: ${allRecords.length}`);

  const prioritized = prioritizeRecords(allRecords);
  console.log('🎯 Prioritization complete.');

  // Determine output path
  const outputArg = process.argv.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg
    ? resolve(process.cwd(), outputArg.split('=')[1])
    : resolve(process.cwd(), 'data/library-enrichment-priority.json');

  // Ensure directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Write JSON
  const output = {
    generatedAt: new Date().toISOString(),
    totalRecords: allRecords.length,
    priorityList: prioritized,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Output written to: ${outputPath}`);
  console.log(`   Conditions: ${medicalRecords.length}`);
  console.log(`   Drugs: ${drugRecords.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnect();
  });