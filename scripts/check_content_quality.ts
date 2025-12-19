#!/usr/bin/env tsx
/**
 * Content Quality Checker
 * Verifies that MedicalContent has all required sections with adequate detail
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface QualityIssue {
  id: string;
  conditionId: string;
  condition: string;
  section: string;
  issue: string;
  currentLength?: number;
  expectedMinLength?: number;
}

const qualityIssues: QualityIssue[] = [];

// Required sections with minimum content lengths
const REQUIRED_SECTIONS = {
  overview: 200,
  pathophysiology: 150,
  etiology: 100,
  epidemiology: 100,
  symptoms: 3, // array: minimum items
  physicalExam: 3, // array: minimum items
  diagnostics: 200,
  differentialDiagnosis: 3, // array: minimum items
  treatment: 300,
  complications: 2, // array: minimum items
  prognosis: 100,
  riskFactors: 2, // array: minimum items
  buzzwords: 3, // array: minimum items
};

function addQualityIssue(record: any, section: string, issue: string, currentLength?: number, expectedMinLength?: number) {
  qualityIssues.push({
    id: record.id,
    conditionId: record.conditionId,
    condition: record.condition,
    section,
    issue,
    currentLength,
    expectedMinLength
  });
}

function checkStringContent(record: any, fieldName: string, minLength: number): boolean {
  const value = record[fieldName];
  
  if (!value) {
    addQualityIssue(record, fieldName, 'Missing content', 0, minLength);
    return false;
  }

  const content = typeof value === 'string' ? value : JSON.stringify(value);
  const length = content.trim().length;

  if (length < minLength) {
    addQualityIssue(record, fieldName, 'Insufficient content detail', length, minLength);
    return false;
  }

  // Check for placeholder text
  const placeholders = ['TODO', 'TBD', 'Coming soon', 'N/A', 'Not available', '[placeholder]'];
  if (placeholders.some(p => content.includes(p))) {
    addQualityIssue(record, fieldName, 'Contains placeholder text', length, minLength);
    return false;
  }

  return true;
}

function checkArrayContent(record: any, fieldName: string, minItems: number): boolean {
  const value = record[fieldName];

  if (!Array.isArray(value)) {
    addQualityIssue(record, fieldName, 'Not an array', 0, minItems);
    return false;
  }

  if (value.length < minItems) {
    addQualityIssue(record, fieldName, 'Too few items', value.length, minItems);
    return false;
  }

  // Check that array items are substantive (not empty or too short)
  const emptyItems = value.filter(item => !item || item.trim().length < 10);
  if (emptyItems.length > 0) {
    addQualityIssue(record, fieldName, `Contains ${emptyItems.length} empty or very short items`, value.length, minItems);
    return false;
  }

  return true;
}

async function checkContentCompleteness() {
  console.log('📋 Checking MedicalContent quality...\n');

  const records = await prisma.medicalContent.findMany({
    where: {
      status: {
        in: ['published', 'approved']
      }
    }
  });

  console.log(`   Found ${records.length} published/approved records to check`);

  let completeCount = 0;
  let incompleteCount = 0;

  for (const record of records) {
    let hasIssues = false;

    // Check string sections
    for (const [field, minLength] of Object.entries(REQUIRED_SECTIONS)) {
      if (typeof minLength === 'number' && minLength > 50) {
        const isValid = checkStringContent(record, field, minLength);
        if (!isValid) hasIssues = true;
      }
    }

    // Check array sections
    for (const [field, minItems] of Object.entries(REQUIRED_SECTIONS)) {
      if (typeof minItems === 'number' && minItems < 50) {
        const isValid = checkArrayContent(record, field, minItems);
        if (!isValid) hasIssues = true;
      }
    }

    // Additional quality checks
    if (record.buzzwords && Array.isArray(record.buzzwords)) {
      const hasBoldText = record.buzzwords.some((bw: string) => bw.includes('**'));
      if (!hasBoldText) {
        addQualityIssue(record, 'buzzwords', 'No bold formatting (**text**) found in buzzwords');
        hasIssues = true;
      }
    }

    if (hasIssues) {
      incompleteCount++;
    } else {
      completeCount++;
    }
  }

  console.log(`   ✅ Complete: ${completeCount}`);
  console.log(`   ⚠️  Incomplete: ${incompleteCount}`);
  console.log(`   📊 Total Issues: ${qualityIssues.length}\n`);
}

async function findMissingContent() {
  console.log('📋 Finding records with missing content...\n');

  const allRecords = await prisma.medicalContent.findMany();
  const missingBySection: { [key: string]: string[] } = {};

  for (const record of allRecords) {
    for (const section of Object.keys(REQUIRED_SECTIONS)) {
      const value = record[section as keyof typeof record];
      
      if (!value || 
          (typeof value === 'string' && value.trim().length === 0) ||
          (Array.isArray(value) && value.length === 0)) {
        
        if (!missingBySection[section]) {
          missingBySection[section] = [];
        }
        missingBySection[section].push(`${record.condition} (${record.conditionId})`);
      }
    }
  }

  console.log('   Missing Content Summary:');
  console.log('   ' + '-'.repeat(60));
  
  for (const [section, conditions] of Object.entries(missingBySection)) {
    console.log(`   ${section}: ${conditions.length} records`);
  }

  return missingBySection;
}

async function generateQualityReport() {
  console.log('\n📊 Generating Quality Report...\n');

  console.log('=' .repeat(80));
  console.log('CONTENT QUALITY REPORT');
  console.log('=' .repeat(80));
  console.log(`Total Quality Issues: ${qualityIssues.length}`);
  console.log('=' .repeat(80));

  if (qualityIssues.length === 0) {
    console.log('\n✅ All content meets quality standards!\n');
    return;
  }

  // Group by section
  const bySection: { [key: string]: QualityIssue[] } = {};
  for (const issue of qualityIssues) {
    if (!bySection[issue.section]) {
      bySection[issue.section] = [];
    }
    bySection[issue.section].push(issue);
  }

  // Print summary
  console.log('\nIssues by Section:');
  console.log('-'.repeat(80));
  for (const [section, sectionIssues] of Object.entries(bySection)) {
    console.log(`\n${section} (${sectionIssues.length} issues):`);
    
    // Group by issue type
    const byIssueType: { [key: string]: QualityIssue[] } = {};
    for (const issue of sectionIssues) {
      if (!byIssueType[issue.issue]) {
        byIssueType[issue.issue] = [];
      }
      byIssueType[issue.issue].push(issue);
    }

    for (const [issueType, issues] of Object.entries(byIssueType)) {
      console.log(`  ${issueType}: ${issues.length} records`);
      // Show first 5 examples
      for (const example of issues.slice(0, 5)) {
        const lengthInfo = example.currentLength !== undefined && example.expectedMinLength !== undefined
          ? ` (${example.currentLength}/${example.expectedMinLength} chars)`
          : '';
        console.log(`    - ${example.condition}${lengthInfo}`);
      }
      if (issues.length > 5) {
        console.log(`    ... and ${issues.length - 5} more`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  // Find conditions needing the most work
  const conditionIssueCount: { [key: string]: number } = {};
  for (const issue of qualityIssues) {
    conditionIssueCount[issue.condition] = (conditionIssueCount[issue.condition] || 0) + 1;
  }

  const topNeedingWork = Object.entries(conditionIssueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\nTop 10 Conditions Needing Most Work:');
  console.log('-'.repeat(80));
  for (const [condition, count] of topNeedingWork) {
    console.log(`  ${condition}: ${count} issues`);
  }

  // Save detailed report
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `quality-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: qualityIssues.length,
      bySection: Object.fromEntries(
        Object.entries(bySection).map(([k, v]) => [k, v.length])
      )
    },
    issues: qualityIssues,
    topNeedingWork: topNeedingWork
  }, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}\n`);
}

async function main() {
  console.log('🔍 Starting Content Quality Check...\n');

  try {
    await checkContentCompleteness();
    await findMissingContent();
    await generateQualityReport();
  } catch (error) {
    console.error('❌ Quality check failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
