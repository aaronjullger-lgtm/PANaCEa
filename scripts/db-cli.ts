/**
 * Database CLI - Consolidated Database Operations
 * 
 * A single entry point for all database health, analysis, and maintenance operations.
 * Replaces dozens of scattered scripts with a unified CLI.
 * 
 * Usage:
 *   npx tsx scripts/db-cli.ts health        # Full health check
 *   npx tsx scripts/db-cli.ts gaps          # Gap analysis
 *   npx tsx scripts/db-cli.ts format        # Formatting verification
 *   npx tsx scripts/db-cli.ts format --fix  # Fix formatting issues
 *   npx tsx scripts/db-cli.ts stats         # Database statistics
 *   npx tsx scripts/db-cli.ts all           # Run all checks
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

// ============== HEALTH CHECK ==============
async function runHealthCheck() {
  log.header('DATABASE HEALTH CHECK');
  
  const results: { table: string; count: number; status: string }[] = [];
  
  // Check each main table
  const tables = [
    { name: 'MedicalContent', model: prisma.medicalContent },
    { name: 'Question', model: prisma.question },
    { name: 'User', model: prisma.user },
    { name: 'UserProgress', model: prisma.userProgress },
    { name: 'LabTest', model: prisma.labTest },
    { name: 'Drug', model: prisma.drug },
    { name: 'ImagingStudy', model: prisma.imagingStudy },
    { name: 'Condition', model: prisma.condition },
    { name: 'PhysicalExamFinding', model: prisma.physicalExamFinding },
  ];
  
  for (const table of tables) {
    try {
      const count = await (table.model as any).count();
      const status = count > 0 ? 'OK' : 'EMPTY';
      results.push({ table: table.name, count, status });
      
      if (count > 0) {
        log.success(`${table.name}: ${count} records`);
      } else {
        log.warn(`${table.name}: EMPTY`);
      }
    } catch (e) {
      log.error(`${table.name}: ERROR - ${(e as Error).message}`);
      results.push({ table: table.name, count: -1, status: 'ERROR' });
    }
  }
  
  // Summary
  const healthy = results.filter(r => r.status === 'OK').length;
  const empty = results.filter(r => r.status === 'EMPTY').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log('\n─────────────────────────────────────');
  console.log(`Summary: ${healthy} healthy, ${empty} empty, ${errors} errors`);
  
  return results;
}

// ============== GAP ANALYSIS ==============
interface GapResult {
  field: string;
  filled: number;
  missing: number;
  total: number;
  percent: string;
  status: 'complete' | 'partial' | 'critical' | 'empty';
}

// Helper to determine field type and count missing appropriately
async function countMissingForField(
  model: any,
  field: string,
  total: number
): Promise<{ missing: number; fieldType: string }> {
  // Try array check first (isEmpty works for array fields)
  try {
    const emptyArrayCount = await model.count({
      where: { [field]: { isEmpty: true } },
    });
    return { missing: emptyArrayCount, fieldType: 'array' };
  } catch {
    // Not an array field, continue
  }
  
  // Try null check for nullable string/text/json fields
  let nullCount = 0;
  let emptyStringCount = 0;
  
  try {
    nullCount = await model.count({
      where: { [field]: null },
    });
  } catch {
    // Field might not support null check
  }
  
  // Try empty string check for string fields
  try {
    emptyStringCount = await model.count({
      where: { [field]: '' },
    });
  } catch {
    // Field doesn't support empty string check
  }
  
  return { 
    missing: nullCount + emptyStringCount, 
    fieldType: emptyStringCount > 0 || nullCount > 0 ? 'string/nullable' : 'unknown'
  };
}

async function analyzeTableGaps(
  tableName: string,
  model: any,
  fields: string[]
): Promise<GapResult[]> {
  const total = await model.count();
  if (total === 0) {
    log.warn(`${tableName}: No records to analyze`);
    return [];
  }
  
  const results: GapResult[] = [];
  
  for (const field of fields) {
    try {
      const { missing } = await countMissingForField(model, field, total);
      
      const filled = total - missing;
      const filledPercent = ((filled / total) * 100).toFixed(1);
      const missingPercent = ((missing / total) * 100).toFixed(1);
      
      let status: GapResult['status'];
      if (missing === 0) {
        status = 'complete';
      } else if (missing === total) {
        status = 'empty';
      } else if (parseFloat(missingPercent) > 50) {
        status = 'critical';
      } else {
        status = 'partial';
      }
      
      results.push({ 
        field, 
        filled,
        missing, 
        total, 
        percent: `${filledPercent}% filled`,
        status 
      });
      
      // Visual output based on status
      if (status === 'complete') {
        log.success(`  ${field}: ${filled}/${total} (${filledPercent}% filled) ✓`);
      } else if (status === 'empty') {
        log.error(`  ${field}: 0/${total} (0% filled) - EMPTY`);
      } else if (status === 'critical') {
        log.error(`  ${field}: ${filled}/${total} (${filledPercent}% filled) - CRITICAL GAP`);
      } else {
        log.warn(`  ${field}: ${filled}/${total} (${filledPercent}% filled)`);
      }
    } catch (e) {
      // Field might not exist on this model
      log.info(`  ${field}: (field not found or unsupported)`);
    }
  }
  
  return results;
}

async function runGapAnalysis() {
  log.header('DATABASE GAP ANALYSIS');
  
  const allGaps: Record<string, GapResult[]> = {};
  
  // MedicalContent - Most important table
  console.log('\n📋 MedicalContent Table:');
  const medicalContentTotal = await prisma.medicalContent.count();
  console.log(`   Total records: ${medicalContentTotal}`);
  
  if (medicalContentTotal > 0) {
    allGaps['MedicalContent'] = await analyzeTableGaps(
      'MedicalContent',
      prisma.medicalContent,
      [
        'overview',
        'pathophysiology',
        'epidemiology',
        'etiology',
        'symptoms',
        'physicalExam',
        'diagnostics',
        'treatment',
        'complications',
        'prognosis',
        'riskFactors',
        'differentialDiagnosis',
        'classic_patient',
        'gold_standard_dx',
        'first_line_rx',
        'buzzwords',
        'clinical_pearls',
        'classic_triad',
      ]
    );
  }
  
  // LabTest
  console.log('\n🔬 LabTest Table:');
  const labTestTotal = await prisma.labTest.count();
  console.log(`   Total records: ${labTestTotal}`);
  
  if (labTestTotal > 0) {
    allGaps['LabTest'] = await analyzeTableGaps(
      'LabTest',
      prisma.labTest,
      [
        'conventionalRange',
        'clinicalPearls',
        'boardYieldFacts',
        'commonMistakes',
        'mnemonics',
      ]
    );
  }
  
  // Drug
  console.log('\n💊 Drug Table:');
  const drugTotal = await prisma.drug.count();
  console.log(`   Total records: ${drugTotal}`);
  
  if (drugTotal > 0) {
    allGaps['Drug'] = await analyzeTableGaps(
      'Drug',
      prisma.drug,
      [
        'mechanismOfAction',   // String (nullable)
        'indications',         // String[]
        'contraindications',   // String[]
        'sideEffects',         // String[]
        'blackBoxWarnings',    // String[]
        'interactions',        // String[]
        'clinicalPearls',      // String[]
        'boardYieldFacts',     // String[]
        'dosing',              // String (nullable)
      ]
    );
  }
  
  // Question
  console.log('\n❓ Question Table:');
  const questionTotal = await prisma.question.count();
  console.log(`   Total records: ${questionTotal}`);
  
  if (questionTotal > 0) {
    allGaps['Question'] = await analyzeTableGaps(
      'Question',
      prisma.question,
      ['explanation', 'difficulty', 'tags'],
    );
  }
  
  // Summary
  log.header('GAP ANALYSIS SUMMARY');
  
  let criticalGaps: GapResult[] = [];
  let emptyFields: GapResult[] = [];
  let partialFields: GapResult[] = [];
  let completeFields: GapResult[] = [];
  
  for (const [table, gaps] of Object.entries(allGaps)) {
    for (const g of gaps) {
      const tableField = { ...g, table };
      if (g.status === 'empty') {
        emptyFields.push(g);
      } else if (g.status === 'critical') {
        criticalGaps.push(g);
      } else if (g.status === 'partial') {
        partialFields.push(g);
      } else {
        completeFields.push(g);
      }
    }
  }
  
  // Report by category
  if (emptyFields.length > 0) {
    console.log(`\n${colors.red}${colors.bright}🚨 EMPTY FIELDS (0% filled):${colors.reset}`);
    for (const [table, gaps] of Object.entries(allGaps)) {
      const tableEmpty = gaps.filter(g => g.status === 'empty');
      if (tableEmpty.length > 0) {
        console.log(`  ${colors.yellow}${table}:${colors.reset}`);
        tableEmpty.forEach(g => {
          console.log(`    • ${g.field}`);
        });
      }
    }
  }
  
  if (criticalGaps.length > 0) {
    console.log(`\n${colors.red}⚠️  CRITICAL GAPS (<50% filled):${colors.reset}`);
    for (const [table, gaps] of Object.entries(allGaps)) {
      const tableCritical = gaps.filter(g => g.status === 'critical');
      if (tableCritical.length > 0) {
        console.log(`  ${colors.yellow}${table}:${colors.reset}`);
        tableCritical.forEach(g => {
          const filledPct = ((g.filled / g.total) * 100).toFixed(1);
          console.log(`    • ${g.field}: ${g.filled}/${g.total} (${filledPct}% filled)`);
        });
      }
    }
  }
  
  if (partialFields.length > 0) {
    console.log(`\n${colors.yellow}📊 PARTIAL COVERAGE (50-99% filled):${colors.reset}`);
    for (const [table, gaps] of Object.entries(allGaps)) {
      const tablePartial = gaps.filter(g => g.status === 'partial');
      if (tablePartial.length > 0) {
        console.log(`  ${colors.cyan}${table}:${colors.reset}`);
        tablePartial.forEach(g => {
          const filledPct = ((g.filled / g.total) * 100).toFixed(1);
          console.log(`    • ${g.field}: ${g.filled}/${g.total} (${filledPct}% filled)`);
        });
      }
    }
  }
  
  // Final summary
  console.log('\n─────────────────────────────────────');
  const totalFields = emptyFields.length + criticalGaps.length + partialFields.length + completeFields.length;
  console.log(`${colors.bright}Field Coverage Summary:${colors.reset}`);
  console.log(`  ${colors.green}✓ Complete (100%):${colors.reset} ${completeFields.length} fields`);
  console.log(`  ${colors.yellow}◐ Partial (50-99%):${colors.reset} ${partialFields.length} fields`);
  console.log(`  ${colors.red}⚠ Critical (<50%):${colors.reset} ${criticalGaps.length} fields`);
  console.log(`  ${colors.red}✗ Empty (0%):${colors.reset} ${emptyFields.length} fields`);
  console.log('─────────────────────────────────────');
  
  if (criticalGaps.length === 0 && emptyFields.length === 0) {
    log.success('All fields have at least 50% coverage!');
  } else {
    log.error(`Found ${criticalGaps.length + emptyFields.length} field(s) requiring attention`);
  }
  
  return allGaps;
}

// ============== FORMATTING CHECK ==============
async function runFormattingCheck(fix = false) {
  log.header('FORMATTING VERIFICATION');
  
  const issues: { table: string; field: string; count: number }[] = [];
  
  // Check MedicalContent for formatting issues
  console.log('Checking MedicalContent formatting...');
  
  // Find records with "None" string that should be null
  const noneValues = await prisma.medicalContent.count({
    where: {
      OR: [
        { overview: 'None' },
        { treatment: 'None' },
        { pathophysiology: 'None' },
        { etiology: 'None' },
        { symptoms: 'None' },
        { complications: 'None' },
        { prognosis: 'None' },
      ],
    },
  });
  
  if (noneValues > 0) {
    log.warn(`Found ${noneValues} records with "None" string values`);
    issues.push({ table: 'MedicalContent', field: 'various', count: noneValues });
    
    if (fix) {
      log.info('Fixing "None" values...');
      // Fix each field
      for (const field of ['overview', 'treatment', 'pathophysiology', 'etiology', 'symptoms', 'complications', 'prognosis']) {
        await prisma.medicalContent.updateMany({
          where: { [field]: 'None' },
          data: { [field]: null },
        });
      }
      log.success('Fixed "None" values');
    }
  }
  
  // Check for HTML entities that weren't decoded
  const htmlEntities = await prisma.medicalContent.count({
    where: {
      OR: [
        { overview: { contains: '&lt;' } },
        { overview: { contains: '&gt;' } },
        { overview: { contains: '&amp;' } },
        { treatment: { contains: '&lt;' } },
        { treatment: { contains: '&gt;' } },
      ],
    },
  });
  
  if (htmlEntities > 0) {
    log.warn(`Found ${htmlEntities} records with HTML entities`);
    issues.push({ table: 'MedicalContent', field: 'HTML entities', count: htmlEntities });
  }
  
  // Summary
  if (issues.length === 0) {
    log.success('No formatting issues found');
  } else {
    log.warn(`Found ${issues.length} formatting issue types`);
    if (!fix) {
      log.info('Run with --fix flag to auto-correct issues');
    }
  }
  
  return issues;
}

// ============== STATISTICS ==============
async function runStatistics() {
  log.header('DATABASE STATISTICS');
  
  // MedicalContent breakdown by system
  console.log('\n📊 MedicalContent by System:');
  const systemCounts = await prisma.medicalContent.groupBy({
    by: ['system'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  
  for (const sys of systemCounts.slice(0, 15)) {
    console.log(`   ${sys.system || 'Unknown'}: ${sys._count.id}`);
  }
  if (systemCounts.length > 15) {
    console.log(`   ... and ${systemCounts.length - 15} more systems`);
  }
  
  // High yield content
  const highYield = await prisma.medicalContent.count({
    where: { pance_yield: { gte: 3 } },
  });
  const total = await prisma.medicalContent.count();
  console.log(`\n⭐ High Yield Content: ${highYield}/${total} (${((highYield/total)*100).toFixed(1)}%)`);
  
  // Questions by difficulty
  console.log('\n❓ Questions by Difficulty:');
  const diffCounts = await prisma.question.groupBy({
    by: ['difficulty'],
    _count: { id: true },
  });
  for (const d of diffCounts) {
    console.log(`   ${d.difficulty || 'Unknown'}: ${d._count.id}`);
  }
  
  // User activity
  const userCount = await prisma.user.count();
  const activeUsers = await prisma.userProgress.groupBy({
    by: ['userId'],
    having: { userId: { _count: { gt: 0 } } },
  });
  console.log(`\n👥 Users: ${userCount} total, ${activeUsers.length} with progress data`);
  
  return { systemCounts, highYield, total, diffCounts, userCount };
}

// ============== MAIN ==============
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const flags = args.slice(1);
  
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔══════════════════════════════════════╗');
  console.log('║     PANaCEa Database CLI v1.0        ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(colors.reset);
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    switch (command) {
      case 'health':
        await runHealthCheck();
        break;
        
      case 'gaps':
        await runGapAnalysis();
        break;
        
      case 'format':
        await runFormattingCheck(flags.includes('--fix'));
        break;
        
      case 'stats':
        await runStatistics();
        break;
        
      case 'all':
        await runHealthCheck();
        await runGapAnalysis();
        await runFormattingCheck(flags.includes('--fix'));
        await runStatistics();
        break;
        
      case 'help':
      default:
        console.log(`
${colors.bright}Available Commands:${colors.reset}

  ${colors.cyan}health${colors.reset}        Run database health check
  ${colors.cyan}gaps${colors.reset}          Analyze content gaps
  ${colors.cyan}format${colors.reset}        Check formatting issues
  ${colors.cyan}format --fix${colors.reset}  Fix formatting issues
  ${colors.cyan}stats${colors.reset}         Show database statistics
  ${colors.cyan}all${colors.reset}           Run all checks

${colors.bright}Usage:${colors.reset}
  npx tsx scripts/db-cli.ts <command>
  npm run db:health    # Alias for health command
  npm run db:gaps      # Alias for gaps command
        `);
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch(console.error);
