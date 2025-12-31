/**
 * Comprehensive Database Gap Analysis
 * Analyzes ALL tables for missing/empty fields
 * 
 * Usage:
 *   npx tsx scripts/analysis/database-gap-analysis.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeImagingStudy() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ImagingStudy Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.imagingStudy.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'ImagingStudy', total: 0, issues: ['Table is empty'] };
  }
  
  // Check key fields
  const checks = [
    { field: 'description', query: { OR: [{ description: null }, { description: '' }] } },
    { field: 'modality', query: { OR: [{ modality: null }, { modality: '' }] } },
    { field: 'indications', query: { indications: { isEmpty: true } } },
    { field: 'findings', query: { findings: { isEmpty: true } } },
    { field: 'clinicalPearls', query: { clinicalPearls: { isEmpty: true } } },
    { field: 'boardYieldFacts', query: { boardYieldFacts: { isEmpty: true } } },
    { field: 'contraindications', query: { contraindications: { isEmpty: true } } },
    { field: 'preparation', query: { OR: [{ preparation: null }, { preparation: '' }] } },
    { field: 'duration', query: { OR: [{ duration: null }, { duration: '' }] } },
    { field: 'radiation', query: { OR: [{ radiation: null }, { radiation: '' }] } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    const missing = await prisma.imagingStudy.count({ where: check.query as any });
    if (missing > 0) {
      const pct = ((missing / total) * 100).toFixed(1);
      console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
      issues.push(`${check.field}: ${missing} missing`);
    } else {
      console.log(`  ✅ ${check.field}: Complete`);
    }
  }
  
  return { table: 'ImagingStudy', total, issues };
}

async function analyzeCondition() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Condition Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.condition.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'Condition', total: 0, issues: ['Table is empty'] };
  }
  
  const checks = [
    { field: 'description', query: { OR: [{ description: null }, { description: '' }] } },
    { field: 'etiology', query: { OR: [{ etiology: null }, { etiology: '' }] } },
    { field: 'pathophysiology', query: { OR: [{ pathophysiology: null }, { pathophysiology: '' }] } },
    { field: 'clinicalFeatures', query: { clinicalFeatures: { isEmpty: true } } },
    { field: 'diagnosticCriteria', query: { diagnosticCriteria: { isEmpty: true } } },
    { field: 'treatment', query: { OR: [{ treatment: null }, { treatment: '' }] } },
    { field: 'complications', query: { complications: { isEmpty: true } } },
    { field: 'differentialDiagnosis', query: { differentialDiagnosis: { isEmpty: true } } },
    { field: 'clinicalPearls', query: { clinicalPearls: { isEmpty: true } } },
    { field: 'boardYieldFacts', query: { boardYieldFacts: { isEmpty: true } } },
    { field: 'mnemonics', query: { mnemonics: { isEmpty: true } } },
    { field: 'testQuestionTips', query: { testQuestionTips: { isEmpty: true } } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    try {
      const missing = await prisma.condition.count({ where: check.query as any });
      if (missing > 0) {
        const pct = ((missing / total) * 100).toFixed(1);
        console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
        issues.push(`${check.field}: ${missing} missing`);
      } else {
        console.log(`  ✅ ${check.field}: Complete`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${check.field}: Unable to check (field may not exist)`);
    }
  }
  
  return { table: 'Condition', total, issues };
}

async function analyzeDrug() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Drug Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.drug.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'Drug', total: 0, issues: ['Table is empty'] };
  }
  
  const checks = [
    { field: 'genericName', query: { OR: [{ genericName: null }, { genericName: '' }] } },
    { field: 'drugClass', query: { OR: [{ drugClass: null }, { drugClass: '' }] } },
    { field: 'mechanism', query: { OR: [{ mechanism: null }, { mechanism: '' }] } },
    { field: 'indications', query: { indications: { isEmpty: true } } },
    { field: 'contraindications', query: { contraindications: { isEmpty: true } } },
    { field: 'sideEffects', query: { sideEffects: { isEmpty: true } } },
    { field: 'blackBoxWarnings', query: { blackBoxWarnings: { isEmpty: true } } },
    { field: 'interactions', query: { interactions: { isEmpty: true } } },
    { field: 'clinicalPearls', query: { clinicalPearls: { isEmpty: true } } },
    { field: 'boardYieldFacts', query: { boardYieldFacts: { isEmpty: true } } },
    { field: 'mnemonics', query: { mnemonics: { isEmpty: true } } },
    { field: 'dosing', query: { OR: [{ dosing: null }, { dosing: '' }] } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    try {
      const missing = await prisma.drug.count({ where: check.query as any });
      if (missing > 0) {
        const pct = ((missing / total) * 100).toFixed(1);
        console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
        issues.push(`${check.field}: ${missing} missing`);
      } else {
        console.log(`  ✅ ${check.field}: Complete`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${check.field}: Unable to check (field may not exist)`);
    }
  }
  
  return { table: 'Drug', total, issues };
}

async function analyzeQuestion() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Question Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.question.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'Question', total: 0, issues: ['Table is empty'] };
  }
  
  const checks = [
    { field: 'stem', query: { OR: [{ stem: null }, { stem: '' }] } },
    { field: 'options', query: { options: { isEmpty: true } } },
    { field: 'correctAnswer', query: { OR: [{ correctAnswer: null }, { correctAnswer: '' }] } },
    { field: 'explanation', query: { OR: [{ explanation: null }, { explanation: '' }] } },
    { field: 'difficulty', query: { OR: [{ difficulty: null }, { difficulty: '' }] } },
    { field: 'conditionId', query: { OR: [{ conditionId: null }, { conditionId: '' }] } },
    { field: 'systemId', query: { OR: [{ systemId: null }, { systemId: '' }] } },
    { field: 'tags', query: { tags: { isEmpty: true } } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    try {
      const missing = await prisma.question.count({ where: check.query as any });
      if (missing > 0) {
        const pct = ((missing / total) * 100).toFixed(1);
        console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
        issues.push(`${check.field}: ${missing} missing`);
      } else {
        console.log(`  ✅ ${check.field}: Complete`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${check.field}: Unable to check (field may not exist)`);
    }
  }
  
  return { table: 'Question', total, issues };
}

async function analyzeOsceStation() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 OSCEStation Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.oSCEStation.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'OSCEStation', total: 0, issues: ['Table is empty'] };
  }
  
  const checks = [
    { field: 'title', query: { OR: [{ title: null }, { title: '' }] } },
    { field: 'description', query: { OR: [{ description: null }, { description: '' }] } },
    { field: 'patientScenario', query: { OR: [{ patientScenario: null }, { patientScenario: '' }] } },
    { field: 'objectives', query: { objectives: { isEmpty: true } } },
    { field: 'checklistItems', query: { checklistItems: { isEmpty: true } } },
    { field: 'expectedDuration', query: { expectedDuration: null } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    try {
      const missing = await prisma.oSCEStation.count({ where: check.query as any });
      if (missing > 0) {
        const pct = ((missing / total) * 100).toFixed(1);
        console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
        issues.push(`${check.field}: ${missing} missing`);
      } else {
        console.log(`  ✅ ${check.field}: Complete`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${check.field}: Unable to check (field may not exist)`);
    }
  }
  
  return { table: 'OSCEStation', total, issues };
}

async function analyzePhysicalExamFinding() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PhysicalExamFinding Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.physicalExamFinding.count();
  console.log('Total records:', total);
  
  if (total === 0) {
    console.log('⚠️ Table is empty!');
    return { table: 'PhysicalExamFinding', total: 0, issues: ['Table is empty'] };
  }
  
  const checks = [
    { field: 'name', query: { OR: [{ name: null }, { name: '' }] } },
    { field: 'description', query: { OR: [{ description: null }, { description: '' }] } },
    { field: 'technique', query: { OR: [{ technique: null }, { technique: '' }] } },
    { field: 'normalFindings', query: { OR: [{ normalFindings: null }, { normalFindings: '' }] } },
    { field: 'abnormalFindings', query: { abnormalFindings: { isEmpty: true } } },
    { field: 'associatedConditions', query: { associatedConditions: { isEmpty: true } } },
    { field: 'clinicalPearls', query: { clinicalPearls: { isEmpty: true } } },
    { field: 'boardYieldFacts', query: { boardYieldFacts: { isEmpty: true } } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    try {
      const missing = await prisma.physicalExamFinding.count({ where: check.query as any });
      if (missing > 0) {
        const pct = ((missing / total) * 100).toFixed(1);
        console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
        issues.push(`${check.field}: ${missing} missing`);
      } else {
        console.log(`  ✅ ${check.field}: Complete`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${check.field}: Unable to check (field may not exist)`);
    }
  }
  
  return { table: 'PhysicalExamFinding', total, issues };
}

async function analyzeLabTest() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LabTest Table Analysis');
  console.log('='.repeat(60));
  
  const total = await prisma.labTest.count();
  console.log('Total records:', total);
  
  const checks = [
    { field: 'conventionalRange', query: { OR: [{ conventionalRange: null }, { conventionalRange: '' }] } },
    { field: 'clinicalPearls', query: { clinicalPearls: { isEmpty: true } } },
    { field: 'boardYieldFacts', query: { boardYieldFacts: { isEmpty: true } } },
    { field: 'commonMistakes', query: { commonMistakes: { isEmpty: true } } },
    { field: 'mnemonics', query: { mnemonics: { isEmpty: true } } },
  ];
  
  const issues: string[] = [];
  
  for (const check of checks) {
    const missing = await prisma.labTest.count({ where: check.query as any });
    if (missing > 0) {
      const pct = ((missing / total) * 100).toFixed(1);
      console.log(`  ❌ ${check.field}: ${missing}/${total} missing (${pct}%)`);
      issues.push(`${check.field}: ${missing} missing`);
    } else {
      console.log(`  ✅ ${check.field}: Complete`);
    }
  }
  
  // Check condition links
  const orphaned = await prisma.labTest.count({
    where: { LabConditionLink: { none: {} } }
  });
  if (orphaned > 0) {
    const pct = ((orphaned / total) * 100).toFixed(1);
    console.log(`  ⚠️ No condition links: ${orphaned}/${total} (${pct}%)`);
    issues.push(`No condition links: ${orphaned}`);
  }
  
  return { table: 'LabTest', total, issues };
}

async function main() {
  console.log('🔍 Comprehensive Database Gap Analysis');
  console.log('='.repeat(60));
  console.log('Time:', new Date().toISOString());
  
  const results: { table: string; total: number; issues: string[] }[] = [];
  
  try {
    results.push(await analyzeLabTest());
    results.push(await analyzeImagingStudy());
    results.push(await analyzeCondition());
    results.push(await analyzeDrug());
    results.push(await analyzeQuestion());
    results.push(await analyzeOsceStation());
    results.push(await analyzePhysicalExamFinding());
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    let totalIssues = 0;
    for (const r of results) {
      const status = r.issues.length === 0 ? '✅' : '❌';
      console.log(`${status} ${r.table}: ${r.total} records, ${r.issues.length} issue types`);
      totalIssues += r.issues.length;
    }
    
    console.log('');
    console.log('Total tables analyzed:', results.length);
    console.log('Total issue types found:', totalIssues);
    
    if (totalIssues > 0) {
      console.log('\n⚡ Priority fixes needed:');
      for (const r of results.filter(r => r.issues.length > 0)) {
        console.log(`  ${r.table}:`);
        r.issues.slice(0, 3).forEach(i => console.log(`    - ${i}`));
        if (r.issues.length > 3) {
          console.log(`    ... and ${r.issues.length - 3} more`);
        }
      }
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

main();
