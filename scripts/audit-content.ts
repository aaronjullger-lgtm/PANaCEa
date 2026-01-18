/**
 * Content Audit Script
 *
 * Comprehensive QA check across all content tables.
 * Run weekly or before major releases.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditResult {
  table: string;
  total: number;
  complete: number;
  incomplete: number;
  issues: string[];
}

// Required fields for each table
const REQUIRED_FIELDS: Record<string, string[]> = {
  Drug: ['genericName', 'drugClass', 'mechanismOfAction', 'indications'],
  LabTest: ['name', 'category', 'typicalUse'],
  ECGPattern: ['name', 'category', 'diagnosticCriteria', 'acuteManagement'],
  ScoringSystem: ['name', 'category', 'components', 'interpretation'],
  Procedure: ['name', 'category', 'indications', 'technique'],
  AnatomyStructure: ['name', 'system', 'function'],
  PhysiologyConcept: ['name', 'category', 'mechanism'],
  AntibioticGuideline: ['organism', 'class', 'effective'],
  PhysicalExamFinding: ['name', 'system', 'description'],
  DifferentialDiagnosis: ['presentingComplaint', 'differentialList', 'mustNotMiss'],
  MedicalContent: ['name', 'system', 'content'],
};

async function auditTable(tableName: string, requiredFields: string[]): Promise<AuditResult> {
  const issues: string[] = [];

  // Special handling for large tables
  const batchSize = tableName === 'MedicalContent' || tableName === 'Drug' ? 50 : 500;

  // @ts-ignore - dynamic table access
  const records = await prisma[tableName.charAt(0).toLowerCase() + tableName.slice(1)].findMany({
    take: batchSize,
    select: requiredFields.reduce((acc, f) => ({ ...acc, [f]: true }), { id: true, name: true }),
  });

  let complete = 0;
  let incomplete = 0;

  for (const record of records) {
    const missing = requiredFields.filter((f) => {
      const val = record[f];
      return (
        val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)
      );
    });

    if (missing.length === 0) {
      complete++;
    } else {
      incomplete++;
      if (incomplete <= 3) {
        issues.push(`${record.name || record.id}: missing ${missing.join(', ')}`);
      }
    }
  }

  return {
    table: tableName,
    total: records.length,
    complete,
    incomplete,
    issues,
  };
}

async function runFullAudit() {
  console.log('=== Content Quality Audit ===\n');

  const results: AuditResult[] = [];

  for (const [table, fields] of Object.entries(REQUIRED_FIELDS)) {
    try {
      const result = await auditTable(table, fields);
      results.push(result);

      const pct = result.total > 0 ? Math.round((result.complete / result.total) * 100) : 0;
      const icon = pct >= 90 ? '✅' : pct >= 70 ? '🟡' : '🔴';

      console.log(`${icon} ${table}: ${result.complete}/${result.total} complete (${pct}%)`);

      if (result.issues.length > 0) {
        result.issues.forEach((i) => console.log(`   └─ ${i}`));
      }
    } catch (err) {
      console.log(`⚠️  ${table}: Could not audit - ${err}`);
    }
  }

  // Summary
  const totalRecords = results.reduce((s, r) => s + r.total, 0);
  const totalComplete = results.reduce((s, r) => s + r.complete, 0);
  const overallPct = totalRecords > 0 ? Math.round((totalComplete / totalRecords) * 100) : 0;

  console.log(`\n=== Summary ===`);
  console.log(`Total Records: ${totalRecords}`);
  console.log(`Complete: ${totalComplete} (${overallPct}%)`);
  console.log(`Incomplete: ${totalRecords - totalComplete}`);

  await prisma.$disconnect();
}

runFullAudit();
