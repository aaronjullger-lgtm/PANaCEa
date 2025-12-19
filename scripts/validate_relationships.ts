#!/usr/bin/env tsx
/**
 * Relationship Validator
 * Checks foreign key references and data integrity across tables
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface RelationshipIssue {
  table: string;
  recordId: string;
  field: string;
  referencedTable: string;
  referencedId: string;
  issue: string;
  severity: 'error' | 'warning';
}

const issues: RelationshipIssue[] = [];

function addIssue(
  table: string,
  recordId: string,
  field: string,
  referencedTable: string,
  referencedId: string,
  issue: string,
  severity: 'error' | 'warning' = 'error'
) {
  issues.push({ table, recordId, field, referencedTable, referencedId, issue, severity });
}

async function validateUserReferences() {
  console.log('📋 Validating User references...');

  // Check PerformanceRecords
  const perfRecords = await prisma.performanceRecord.findMany() as any[];
  
  const users = await prisma.user.findMany() as any[];
  const userIds = new Set(users.map(u => u.id));

  let orphanCount = 0;
  for (const record of perfRecords) {
    if (!userIds.has(record.userId)) {
      addIssue('PerformanceRecord', record.id, 'userId', 'User', record.userId, 'References non-existent user');
      orphanCount++;
    }
  }

  // Check SRSItems
  const srsItems = await prisma.sRSItem.findMany() as any[];

  for (const item of srsItems) {
    if (!userIds.has(item.userId)) {
      addIssue('SRSItem', item.id, 'userId', 'User', item.userId, 'References non-existent user');
      orphanCount++;
    }
  }

  // Check SavedQuestions
  const savedQuestions = await prisma.savedQuestion.findMany() as any[];

  for (const sq of savedQuestions) {
    if (!userIds.has(sq.userId)) {
      addIssue('SavedQuestion', sq.id, 'userId', 'User', sq.userId, 'References non-existent user');
      orphanCount++;
    }
  }

  // Check QuestionAttempts
  const attempts = await prisma.questionAttempt.findMany() as any[];

  for (const attempt of attempts) {
    if (!userIds.has(attempt.userId)) {
      addIssue('QuestionAttempt', attempt.id, 'userId', 'User', attempt.userId, 'References non-existent user');
      orphanCount++;
    }
  }

  // Check UserSRSConfig
  const srsConfigs = await prisma.userSRSConfig.findMany() as any[];

  for (const config of srsConfigs) {
    if (!userIds.has(config.userId)) {
      addIssue('UserSRSConfig', config.userId, 'userId', 'User', config.userId, 'References non-existent user');
      orphanCount++;
    }
  }

  console.log(`   Found ${orphanCount} orphaned user references`);
}

async function validateConditionReferences() {
  console.log('📋 Validating Condition references...');

  // Get all conditions
  const conditions = await prisma.condition.findMany() as any[];
  const conditionIds = new Set(conditions.map(c => c.id));

  // Check PerformanceRecords
  const perfRecords = await prisma.performanceRecord.findMany() as any[];

  let orphanCount = 0;
  for (const record of perfRecords) {
    if (record.conditionId && !conditionIds.has(record.conditionId)) {
      addIssue('PerformanceRecord', record.id, 'conditionId', 'Condition', record.conditionId, 'References non-existent condition', 'warning');
      orphanCount++;
    }
  }

  // Check SRSItems
  const srsItems = await prisma.sRSItem.findMany() as any[];

  for (const item of srsItems) {
    if (item.conditionId && !conditionIds.has(item.conditionId)) {
      addIssue('SRSItem', item.id, 'conditionId', 'Condition', item.conditionId, 'References non-existent condition', 'warning');
      orphanCount++;
    }
  }

  console.log(`   Found ${orphanCount} orphaned condition references`);
}

async function validateQuestionReferences() {
  console.log('📋 Validating Question references...');

  // Check QuestionAttempts reference valid questions
  const attempts = await prisma.questionAttempt.findMany() as any[];

  // Since questions are dynamically generated, we can't validate against a table
  // But we can check for malformed IDs
  let malformedCount = 0;
  for (const attempt of attempts) {
    if (!attempt.questionId || attempt.questionId.trim() === '') {
      addIssue('QuestionAttempt', attempt.id, 'questionId', 'Question', attempt.questionId || 'null', 'Empty or null question ID');
      malformedCount++;
    }
  }

  console.log(`   Found ${malformedCount} malformed question IDs`);
}

async function validateMedicalContentConsistency() {
  console.log('📋 Validating MedicalContent consistency...');

  const medicalContent = await prisma.medicalContent.findMany() as any[];

  const conditions = await prisma.condition.findMany() as any[];

  // Create a map of conditionId to condition
  const conditionMap = new Map(conditions.map(c => [c.id, c]));

  let mismatchCount = 0;
  for (const mc of medicalContent) {
    const condition = conditionMap.get(mc.conditionId);
    
    if (!condition) {
      // MedicalContent references a conditionId that doesn't exist in Condition table
      addIssue('MedicalContent', mc.id, 'conditionId', 'Condition', mc.conditionId, 'References non-existent condition', 'warning');
      mismatchCount++;
    } else {
      // Check if names match
      const normalizedMcName = mc.condition.toLowerCase().trim();
      const normalizedCondName = condition.name.toLowerCase().trim();
      
      if (normalizedMcName !== normalizedCondName) {
        addIssue('MedicalContent', mc.id, 'condition', 'Condition', mc.conditionId, `Name mismatch: "${mc.condition}" vs "${condition.name}"`, 'warning');
        mismatchCount++;
      }

      // Check if systems match
      if (mc.system !== condition.system) {
        addIssue('MedicalContent', mc.id, 'system', 'Condition', mc.conditionId, `System mismatch: "${mc.system}" vs "${condition.system}"`, 'warning');
        mismatchCount++;
      }
    }
  }

  console.log(`   Found ${mismatchCount} consistency issues`);
}

async function validateDrugReferences() {
  console.log('📋 Validating Drug references...');

  const drugs = await prisma.drug.findMany() as any[];
  const drugIds = new Set(drugs.map(d => d.id));

  // Check if any tables reference drugs
  // Currently no direct foreign keys to Drug table in schema
  // But we could check content fields for drug mentions

  console.log('   No direct foreign key references to validate');
}

async function validateLabTestReferences() {
  console.log('📋 Validating LabTest references...');

  const labTests = await prisma.labTest.findMany() as any[];
  const labTestIds = new Set(labTests.map(l => l.id));

  // Check LabCase references
  const labCases = await prisma.labCase.findMany() as any[];

  let orphanCount = 0;
  for (const labCase of labCases) {
    if (!labTestIds.has(labCase.labTestId)) {
      addIssue('LabCase', labCase.id, 'labTestId', 'LabTest', labCase.labTestId, 'References non-existent lab test');
      orphanCount++;
    }
  }

  console.log(`   Found ${orphanCount} orphaned lab test references`);
}

async function findOrphanedRecords() {
  console.log('📋 Finding orphaned records...');

  // Find Conditions not referenced by MedicalContent
  const conditions = await prisma.condition.findMany() as any[];
  const medicalContent = await prisma.medicalContent.findMany() as any[];
  const referencedConditionIds = new Set(medicalContent.map(mc => mc.conditionId));

  const orphanedConditions = conditions.filter(c => !referencedConditionIds.has(c.id));
  console.log(`   Found ${orphanedConditions.length} conditions without MedicalContent`);

  // Find Drugs not referenced by any content
  const drugs = await prisma.drug.findMany() as any[];
  console.log(`   Found ${drugs.length} drugs (no content references to validate)`);

  // Find LabTests not referenced by LabCase
  const labTests = await prisma.labTest.findMany() as any[];
  const labCases = await prisma.labCase.findMany() as any[];
  const referencedLabTestIds = new Set(labCases.map(lc => lc.labTestId));

  const orphanedLabTests = labTests.filter(lt => !referencedLabTestIds.has(lt.id));
  console.log(`   Found ${orphanedLabTests.length} lab tests without cases`);
}

async function generateRelationshipReport() {
  console.log('\n📊 Generating Relationship Report...\n');

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  console.log('='.repeat(80));
  console.log('RELATIONSHIP VALIDATION REPORT');
  console.log('='.repeat(80));
  console.log(`Total Issues: ${issues.length}`);
  console.log(`  🔴 Errors: ${errorCount}`);
  console.log(`  🟡 Warnings: ${warningCount}`);
  console.log('='.repeat(80));

  if (issues.length === 0) {
    console.log('\n✅ All relationships are valid!\n');
    return;
  }

  // Group by table and severity
  const byTable: { [key: string]: { errors: RelationshipIssue[], warnings: RelationshipIssue[] } } = {};
  
  for (const issue of issues) {
    if (!byTable[issue.table]) {
      byTable[issue.table] = { errors: [], warnings: [] };
    }
    if (issue.severity === 'error') {
      byTable[issue.table].errors.push(issue);
    } else {
      byTable[issue.table].warnings.push(issue);
    }
  }

  // Print by table
  for (const [table, tableIssues] of Object.entries(byTable)) {
    if (tableIssues.errors.length + tableIssues.warnings.length === 0) continue;

    console.log(`\n${table}:`);
    console.log('-'.repeat(80));
    
    if (tableIssues.errors.length > 0) {
      console.log(`\n  🔴 ERRORS (${tableIssues.errors.length}):`);
      for (const issue of tableIssues.errors.slice(0, 10)) {
        console.log(`     - ${issue.recordId.substring(0, 8)}...: ${issue.field} -> ${issue.referencedTable} (${issue.referencedId.substring(0, 8)}...)`);
        console.log(`       ${issue.issue}`);
      }
      if (tableIssues.errors.length > 10) {
        console.log(`     ... and ${tableIssues.errors.length - 10} more errors`);
      }
    }

    if (tableIssues.warnings.length > 0) {
      console.log(`\n  🟡 WARNINGS (${tableIssues.warnings.length}):`);
      for (const issue of tableIssues.warnings.slice(0, 10)) {
        console.log(`     - ${issue.recordId.substring(0, 8)}...: ${issue.field} -> ${issue.referencedTable}`);
        console.log(`       ${issue.issue}`);
      }
      if (tableIssues.warnings.length > 10) {
        console.log(`     ... and ${tableIssues.warnings.length - 10} more warnings`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  // Save detailed report
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `relationships-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: issues.length, errors: errorCount, warnings: warningCount },
    issues: issues
  }, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);
}

async function main() {
  console.log('🔍 Starting Relationship Validation...\n');

  try {
    await validateUserReferences();
    await validateConditionReferences();
    await validateQuestionReferences();
    await validateMedicalContentConsistency();
    await validateDrugReferences();
    await validateLabTestReferences();
    await findOrphanedRecords();
    await generateRelationshipReport();
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
