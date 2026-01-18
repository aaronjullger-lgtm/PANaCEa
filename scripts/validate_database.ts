#!/usr/bin/env tsx
/**
 * Database Validation Script
 * Checks for missing fields, format issues, and data quality problems
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface ValidationIssue {
  table: string;
  id: string;
  condition?: string;
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
}

const issues: ValidationIssue[] = [];

function addIssue(
  table: string,
  id: string,
  field: string,
  issue: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  condition?: string
) {
  issues.push({ table, id, condition, field, issue, severity });
}

async function validateMedicalContent() {
  console.log('📋 Validating MedicalContent...');

  const records = await prisma.medicalContent.findMany();
  console.log(`   Found ${records.length} records`);

  const requiredStringFields = ['conditionId', 'system', 'condition', 'status'];
  const requiredArrayFields = ['buzzwords', 'symptoms', 'riskFactors', 'complications'];
  const requiredObjectFields = ['diagnostics', 'treatment', 'overview', 'pathophysiology'];

  for (const record of records) {
    // Check required string fields
    for (const field of requiredStringFields) {
      const value = record[field as keyof typeof record];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        addIssue(
          'MedicalContent',
          record.id,
          field,
          'Missing required field',
          'error',
          record.condition
        );
      }
    }

    // Check required array fields
    for (const field of requiredArrayFields) {
      const value = record[field as keyof typeof record];
      if (!Array.isArray(value)) {
        addIssue(
          'MedicalContent',
          record.id,
          field,
          'Field should be an array',
          'error',
          record.condition
        );
      } else if (value.length === 0) {
        addIssue(
          'MedicalContent',
          record.id,
          field,
          'Empty array - content missing',
          'warning',
          record.condition
        );
      }
    }

    // Check required content fields (strings that should have substantial content)
    for (const field of requiredObjectFields) {
      const value = record[field as keyof typeof record];
      if (!value || (typeof value === 'string' && value.trim().length < 50)) {
        addIssue(
          'MedicalContent',
          record.id,
          field,
          'Missing or insufficient content (< 50 chars)',
          'error',
          record.condition
        );
      }
    }

    // Check status enum
    const validStatuses = ['draft', 'pending_review', 'approved', 'published', 'archived'];
    if (!validStatuses.includes(record.status)) {
      addIssue(
        'MedicalContent',
        record.id,
        'status',
        `Invalid status: ${record.status}`,
        'error',
        record.condition
      );
    }

    // Check system is valid PANCE system
    const validSystems = [
      'CV',
      'PULM',
      'GI',
      'NEURO',
      'MSK',
      'DERM',
      'HEME',
      'ENDO',
      'HEENT',
      'RENAL',
      'REPRO',
      'PSYCH',
      'ID',
      'GU',
      'PRO',
    ];
    if (!validSystems.includes(record.system)) {
      addIssue(
        'MedicalContent',
        record.id,
        'system',
        `Invalid PANCE system: ${record.system}`,
        'error',
        record.condition
      );
    }

    // Check conditionId format (should be system__subcategory__condition)
    if (record.conditionId && !record.conditionId.includes('__')) {
      addIssue(
        'MedicalContent',
        record.id,
        'conditionId',
        'Invalid format - should use double underscore separator',
        'warning',
        record.condition
      );
    }

    // Check dates
    if (record.publishedAt && !record.publishedBy) {
      addIssue(
        'MedicalContent',
        record.id,
        'publishedBy',
        'Published date set but no publishedBy',
        'warning',
        record.condition
      );
    }

    if (record.approvedAt && !record.approvedBy) {
      addIssue(
        'MedicalContent',
        record.id,
        'approvedBy',
        'Approved date set but no approvedBy',
        'warning',
        record.condition
      );
    }
  }

  console.log(`   ✅ Validation complete`);
}

async function validateConditions() {
  console.log('📋 Validating Conditions...');

  const records = await prisma.condition.findMany();
  console.log(`   Found ${records.length} records`);

  for (const record of records) {
    const rec = record as any;
    const displayName = rec.displayName || rec.name;

    if (!displayName || (typeof displayName === 'string' && displayName.trim() === '')) {
      addIssue('Condition', rec.id, 'name', 'Missing required field', 'error');
    }

    if (!rec.system) {
      addIssue(
        'Condition',
        rec.id,
        'system',
        'Missing PANCE system classification',
        'error',
        displayName
      );
    }

    if (!rec.category && !rec.subcategory) {
      addIssue(
        'Condition',
        rec.id,
        'category',
        'Missing both category and subcategory',
        'warning',
        displayName
      );
    }
  }

  console.log(`   ✅ Validation complete`);
}

async function validateDrugs() {
  console.log('📋 Validating Drugs...');

  const records = await prisma.drug.findMany();
  console.log(`   Found ${records.length} records`);

  for (const record of records) {
    const rec = record as any;
    const displayName = rec.displayName || rec.genericName || rec.brandName;

    if (!displayName || (typeof displayName === 'string' && displayName.trim() === '')) {
      addIssue('Drug', rec.id, 'name', 'Missing required field', 'error');
    }

    if (!rec.drugClass || (Array.isArray(rec.drugClass) && rec.drugClass.length === 0)) {
      addIssue('Drug', rec.id, 'drugClass', 'Missing drug class', 'warning', displayName);
    }

    if (!rec.mechanism && !rec.moa && !rec.mechanismOfAction) {
      addIssue('Drug', rec.id, 'mechanism', 'Missing mechanism of action', 'warning', displayName);
    }

    if (!rec.indications || (Array.isArray(rec.indications) && rec.indications.length === 0)) {
      addIssue(
        'Drug',
        rec.id,
        'indications',
        'Missing or empty indications',
        'warning',
        displayName
      );
    }
  }

  console.log(`   ✅ Validation complete`);
}

async function validateLabTests() {
  console.log('📋 Validating LabTests...');

  const records = await prisma.labTest.findMany();
  console.log(`   Found ${records.length} records`);

  for (const record of records) {
    const rec = record as any;
    const displayName = rec.name || rec.displayName;

    if (!displayName || (typeof displayName === 'string' && displayName.trim() === '')) {
      addIssue('LabTest', rec.id, 'name', 'Missing required field', 'error');
    }

    if (!rec.normalRange && !rec.normalRangeText && !rec.typicalNormalRange) {
      addIssue(
        'LabTest',
        rec.id,
        'normalRange',
        'Missing normal range information',
        'warning',
        displayName
      );
    }

    if (!rec.category) {
      addIssue('LabTest', rec.id, 'category', 'Missing category', 'info', displayName);
    }
  }

  console.log(`   ✅ Validation complete`);
}

async function validateUsers() {
  console.log('📋 Validating Users...');

  const records = await prisma.user.findMany();
  console.log(`   Found ${records.length} records`);

  for (const record of records) {
    if (!record.clerkId || record.clerkId.trim() === '') {
      addIssue('User', record.id, 'clerkId', 'Missing Clerk authentication ID', 'error');
    }

    if (record.email && !record.email.includes('@')) {
      addIssue('User', record.id, 'email', 'Invalid email format', 'error');
    }
  }

  console.log(`   ✅ Validation complete`);
}

async function generateReport() {
  console.log('\n📊 Generating Validation Report...\n');

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  console.log('='.repeat(80));
  console.log('DATABASE VALIDATION REPORT');
  console.log('='.repeat(80));
  console.log(`Total Issues: ${issues.length}`);
  console.log(`  🔴 Errors: ${errorCount}`);
  console.log(`  🟡 Warnings: ${warningCount}`);
  console.log(`  🔵 Info: ${infoCount}`);
  console.log('='.repeat(80));

  if (issues.length === 0) {
    console.log('\n✅ No issues found! Database is valid.\n');
    return;
  }

  // Group by table and severity
  const byTable: {
    [key: string]: {
      errors: ValidationIssue[];
      warnings: ValidationIssue[];
      info: ValidationIssue[];
    };
  } = {};

  for (const issue of issues) {
    if (!byTable[issue.table]) {
      byTable[issue.table] = { errors: [], warnings: [], info: [] };
    }
    if (issue.severity === 'error') byTable[issue.table].errors.push(issue);
    else if (issue.severity === 'warning') byTable[issue.table].warnings.push(issue);
    else byTable[issue.table].info.push(issue);
  }

  // Print by table
  for (const [table, tableIssues] of Object.entries(byTable)) {
    if (tableIssues.errors.length + tableIssues.warnings.length + tableIssues.info.length === 0)
      continue;

    console.log(`\n${table}:`);
    console.log('-'.repeat(80));

    if (tableIssues.errors.length > 0) {
      console.log(`\n  🔴 ERRORS (${tableIssues.errors.length}):`);
      for (const issue of tableIssues.errors.slice(0, 10)) {
        const label = issue.condition ? `${issue.condition}` : issue.id.substring(0, 8);
        console.log(`     - ${label}: ${issue.field} - ${issue.issue}`);
      }
      if (tableIssues.errors.length > 10) {
        console.log(`     ... and ${tableIssues.errors.length - 10} more errors`);
      }
    }

    if (tableIssues.warnings.length > 0) {
      console.log(`\n  🟡 WARNINGS (${tableIssues.warnings.length}):`);
      for (const issue of tableIssues.warnings.slice(0, 10)) {
        const label = issue.condition ? `${issue.condition}` : issue.id.substring(0, 8);
        console.log(`     - ${label}: ${issue.field} - ${issue.issue}`);
      }
      if (tableIssues.warnings.length > 10) {
        console.log(`     ... and ${tableIssues.warnings.length - 10} more warnings`);
      }
    }

    if (tableIssues.info.length > 0) {
      console.log(`\n  🔵 INFO (${tableIssues.info.length}):`);
      for (const issue of tableIssues.info.slice(0, 5)) {
        const label = issue.condition ? `${issue.condition}` : issue.id.substring(0, 8);
        console.log(`     - ${label}: ${issue.field} - ${issue.issue}`);
      }
      if (tableIssues.info.length > 5) {
        console.log(`     ... and ${tableIssues.info.length - 5} more info items`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  // Save detailed report to file
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `validation-report-${timestamp}.json`);

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          total: issues.length,
          errors: errorCount,
          warnings: warningCount,
          info: infoCount,
        },
        issues: issues,
      },
      null,
      2
    )
  );

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);
}

async function main() {
  console.log('🔍 Starting Database Validation...\n');

  try {
    await validateMedicalContent();
    await validateConditions();
    await validateDrugs();
    await validateLabTests();
    await validateUsers();
    await generateReport();
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
