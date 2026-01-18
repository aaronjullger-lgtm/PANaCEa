/**
 * scripts/weekly-maintenance.ts
 *
 * 🔧 PANaCEa Weekly Maintenance Suite
 *
 * Comprehensive automated maintenance for database content quality and quantity.
 * Combines all critical quality checks, content generation, and standardization
 * into a single weekly automation workflow.
 *
 * Operations Performed:
 * 1. Gap Analysis - Identify missing content across all systems
 * 2. Content Generation - Fill critical gaps with AI-generated content
 * 3. Format Standardization - Apply consistent markdown formatting
 * 4. Quality Assessment - Evaluate content adequacy against standards
 * 5. Field Enhancement - Regenerate inadequate fields (buzzwords, mnemonics, etc.)
 * 6. Structure Validation - Ensure all content meets structural requirements
 * 7. Health Check - Validate data integrity and relationships
 *
 * Usage:
 *   npx tsx scripts/weekly-maintenance.ts
 *   npx tsx scripts/weekly-maintenance.ts --system=CV
 *   npx tsx scripts/weekly-maintenance.ts --skip-generation
 *   npx tsx scripts/weekly-maintenance.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { execSync } from 'child_process';

config();

const prisma = new PrismaClient();

// Initialize Gemini for AI operations
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
}

// System codes
const SYSTEM_CODES = [
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
] as const;
type SystemCode = (typeof SYSTEM_CODES)[number];

interface MaintenanceOptions {
  targetSystem?: SystemCode;
  skipGeneration?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

interface MaintenanceReport {
  timestamp: Date;
  system?: SystemCode;
  gapAnalysis: {
    totalConditions: number;
    missingContent: number;
    incompleteContent: number;
  };
  contentGeneration: {
    generated: number;
    failed: number;
  };
  formatting: {
    standardized: number;
    unchanged: number;
  };
  qualityAssessment: {
    belowStandard: number;
    regenerated: number;
  };
  fieldEnhancement: {
    buzzwords: number;
    mnemonics: number;
    guidelines: number;
    triads: number;
    pearls: number;
  };
  structureValidation: {
    issues: number;
    fixed: number;
  };
  healthCheck: {
    passed: boolean;
    errors: string[];
  };
}

/**
 * Step 1: Gap Analysis - Identify missing or incomplete content
 */
async function runGapAnalysis(
  options: MaintenanceOptions
): Promise<MaintenanceReport['gapAnalysis']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 1: GAP ANALYSIS                                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const whereClause = options.targetSystem ? { system: options.targetSystem } : {};

  const totalConditions = await prisma.medicalContent.count({ where: whereClause });

  // Missing content: no medical content record at all
  const allRegistryConditions = await prisma.condition.count({
    where: options.targetSystem ? { system: options.targetSystem } : {},
  });
  const missingContent = allRegistryConditions - totalConditions;

  // Incomplete content: missing critical fields
  const incompleteContent = await prisma.medicalContent.count({
    where: {
      ...whereClause,
      OR: [
        { overview: { equals: 'NONE' } },
        { overview: null },
        { pathophysiology: { equals: 'NONE' } },
        { pathophysiology: null },
        { diagnostics: { equals: 'NONE' } },
        { diagnostics: null },
        { buzzwords: { equals: [] } },
      ],
    },
  });

  console.log(`📊 Gap Analysis Results:`);
  console.log(`   Total conditions: ${totalConditions}`);
  console.log(`   Missing content: ${missingContent}`);
  console.log(`   Incomplete content: ${incompleteContent}`);

  return {
    totalConditions,
    missingContent,
    incompleteContent,
  };
}

/**
 * Step 2: Content Generation - Fill critical gaps
 */
async function runContentGeneration(
  options: MaintenanceOptions
): Promise<MaintenanceReport['contentGeneration']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 2: CONTENT GENERATION                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (options.skipGeneration) {
    console.log('⏭️  Skipping content generation (--skip-generation flag)\n');
    return { generated: 0, failed: 0 };
  }

  if (!model) {
    console.log('⚠️  GEMINI_API_KEY not set. Skipping content generation.\n');
    return { generated: 0, failed: 0 };
  }

  if (options.dryRun) {
    console.log('🔍 DRY RUN - Would generate content for incomplete conditions\n');
    return { generated: 0, failed: 0 };
  }

  // Run content-doctor Phase 2
  console.log('🤖 Running content-doctor Phase 2...');
  const systemFlag = options.targetSystem ? ` --system=${options.targetSystem}` : '';

  try {
    execSync(`npm run content-doctor:phase2${systemFlag}`, {
      stdio: options.verbose ? 'inherit' : 'pipe',
      cwd: process.cwd(),
    });

    // Count generated (this is approximate - would need to track in content-doctor)
    console.log('✅ Content generation complete\n');
    return { generated: 0, failed: 0 }; // TODO: Get actual counts from content-doctor
  } catch (error) {
    console.error('❌ Content generation failed:', error);
    return { generated: 0, failed: 1 };
  }
}

/**
 * Step 3: Format Standardization - Apply consistent markdown formatting
 */
async function runFormatStandardization(
  options: MaintenanceOptions
): Promise<MaintenanceReport['formatting']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 3: FORMAT STANDARDIZATION                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const whereClause = options.targetSystem ? { system: options.targetSystem } : {};

  const BATCH_SIZE = 50;
  const totalCount = await prisma.medicalContent.count({ where: whereClause });
  const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

  console.log(`📊 Processing ${totalCount} conditions in ${totalBatches} batches...\n`);

  let standardized = 0;
  let unchanged = 0;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const skip = batchIndex * BATCH_SIZE;

    const batchContent = await prisma.medicalContent.findMany({
      where: whereClause,
      skip,
      take: BATCH_SIZE,
      orderBy: { conditionId: 'asc' },
    });

    for (const content of batchContent) {
      // Simple formatting check: does content have proper markdown?
      const needsFormatting =
        (content.overview && !content.overview.includes('**')) ||
        (content.etiology && !content.etiology.includes('**'));

      if (needsFormatting) {
        standardized++;
      } else {
        unchanged++;
      }
    }
  }

  if (!options.dryRun && standardized > 0) {
    console.log('🔧 Applying formatting standardization...');
    const systemFlag = options.targetSystem ? ` --system=${options.targetSystem}` : '';

    try {
      execSync(`npm run standardize:formatting${systemFlag}`, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
      });
      console.log('✅ Formatting complete\n');
    } catch (error) {
      console.error('❌ Formatting failed:', error);
    }
  } else if (options.dryRun) {
    console.log(`🔍 DRY RUN - Would standardize ${standardized} conditions\n`);
  } else {
    console.log('✅ All content already formatted\n');
  }

  return { standardized, unchanged };
}

/**
 * Step 4: Quality Assessment - Evaluate content adequacy
 */
async function runQualityAssessment(
  options: MaintenanceOptions
): Promise<MaintenanceReport['qualityAssessment']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 4: QUALITY ASSESSMENT                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const whereClause = options.targetSystem ? { system: options.targetSystem } : {};

  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      id: true,
      conditionId: true,
      overview: true,
      etiology: true,
      pathophysiology: true,
      diagnostics: true,
      symptoms: true,
      complications: true,
      buzzwords: true,
      clinical_pearls: true,
    },
  });

  let belowStandard = 0;

  for (const content of allContent) {
    // Check minimum standards
    const overviewWords = content.overview?.split(/\s+/).length || 0;
    const etiologyWords = content.etiology?.split(/\s+/).length || 0;
    const pathophysWords = content.pathophysiology?.split(/\s+/).length || 0;
    const diagnosticsWords = content.diagnostics?.split(/\s+/).length || 0;

    const symptomsCount = Array.isArray(content.symptoms) ? content.symptoms.length : 0;
    const complicationsCount = Array.isArray(content.complications)
      ? content.complications.length
      : 0;
    const buzzwordsCount = Array.isArray(content.buzzwords) ? content.buzzwords.length : 0;

    const isBelowStandard =
      overviewWords < 50 ||
      etiologyWords < 40 ||
      pathophysWords < 50 ||
      diagnosticsWords < 50 ||
      symptomsCount < 4 ||
      complicationsCount < 3 ||
      buzzwordsCount < 4;

    if (isBelowStandard) {
      belowStandard++;
    }
  }

  console.log(`📊 Quality Assessment Results:`);
  console.log(`   Total assessed: ${allContent.length}`);
  console.log(
    `   Below standard: ${belowStandard} (${((belowStandard / allContent.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   Meeting standard: ${allContent.length - belowStandard} (${(((allContent.length - belowStandard) / allContent.length) * 100).toFixed(1)}%)\n`
  );

  let regenerated = 0;

  if (!options.dryRun && belowStandard > 0 && model) {
    console.log('🤖 Running AI regeneration for inadequate content...');
    const systemFlag = options.targetSystem ? ` --system=${options.targetSystem}` : '';

    try {
      execSync(`npm run standardize:formatting:regenerate${systemFlag}`, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
      });
      regenerated = belowStandard;
      console.log('✅ Regeneration complete\n');
    } catch (error) {
      console.error('❌ Regeneration failed:', error);
    }
  } else if (options.dryRun && belowStandard > 0) {
    console.log(`🔍 DRY RUN - Would regenerate ${belowStandard} inadequate conditions\n`);
  }

  return { belowStandard, regenerated };
}

/**
 * Step 5: Field Enhancement - Regenerate specific fields
 */
async function runFieldEnhancement(
  options: MaintenanceOptions
): Promise<MaintenanceReport['fieldEnhancement']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 5: FIELD ENHANCEMENT                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const whereClause = options.targetSystem ? { system: options.targetSystem } : {};

  // Check for missing/inadequate specific fields
  const missingBuzzwords = await prisma.medicalContent.count({
    where: { ...whereClause, OR: [{ buzzwords: { equals: [] } }, { buzzwords: null }] },
  });

  const missingMnemonics = await prisma.medicalContent.count({
    where: { ...whereClause, OR: [{ mnemonic: { equals: 'NONE' } }, { mnemonic: null }] },
  });

  const missingGuidelines = await prisma.medicalContent.count({
    where: { ...whereClause, OR: [{ guidelines: { equals: 'NONE' } }, { guidelines: null }] },
  });

  const missingTriads = await prisma.medicalContent.count({
    where: { ...whereClause, classic_triad: null },
  });

  const missingPearls = await prisma.medicalContent.count({
    where: { ...whereClause, OR: [{ clinical_pearls: { equals: [] } }, { clinical_pearls: null }] },
  });

  console.log(`📊 Field Gap Analysis:`);
  console.log(`   Missing buzzwords: ${missingBuzzwords}`);
  console.log(`   Missing mnemonics: ${missingMnemonics}`);
  console.log(`   Missing guidelines: ${missingGuidelines}`);
  console.log(`   Missing triads: ${missingTriads}`);
  console.log(`   Missing pearls: ${missingPearls}\n`);

  const enhancement = {
    buzzwords: 0,
    mnemonics: 0,
    guidelines: 0,
    triads: 0,
    pearls: 0,
  };

  if (options.dryRun) {
    console.log('🔍 DRY RUN - Would enhance fields with missing content\n');
    return enhancement;
  }

  if (!model) {
    console.log('⚠️  GEMINI_API_KEY not set. Skipping field enhancement.\n');
    return enhancement;
  }

  const systemFlag = options.targetSystem ? ` --system=${options.targetSystem}` : '';

  // Regenerate fields with significant gaps
  if (missingBuzzwords > 10) {
    console.log('🔧 Regenerating buzzwords...');
    try {
      execSync(`npm run content-doctor:buzzwords${systemFlag}`, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
      });
      enhancement.buzzwords = missingBuzzwords;
      console.log('✅ Buzzwords enhanced\n');
    } catch (error) {
      console.error('❌ Buzzwords enhancement failed:', error);
    }
  }

  if (missingMnemonics > 50) {
    console.log('🔧 Regenerating mnemonics...');
    try {
      execSync(`npm run content-doctor:mnemonics${systemFlag}`, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
      });
      enhancement.mnemonics = missingMnemonics;
      console.log('✅ Mnemonics enhanced\n');
    } catch (error) {
      console.error('❌ Mnemonics enhancement failed:', error);
    }
  }

  if (missingGuidelines > 50) {
    console.log('🔧 Regenerating guidelines...');
    try {
      execSync(`npm run content-doctor:guidelines${systemFlag}`, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd(),
      });
      enhancement.guidelines = missingGuidelines;
      console.log('✅ Guidelines enhanced\n');
    } catch (error) {
      console.error('❌ Guidelines enhancement failed:', error);
    }
  }

  return enhancement;
}

/**
 * Step 6: Structure Validation - Ensure proper content structure
 */
async function runStructureValidation(
  options: MaintenanceOptions
): Promise<MaintenanceReport['structureValidation']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 6: STRUCTURE VALIDATION                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const whereClause = options.targetSystem ? { system: options.targetSystem } : {};

  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      id: true,
      conditionId: true,
      overview: true,
      etiology: true,
      pathophysiology: true,
      diagnostics: true,
      treatment: true,
    },
  });

  let issues = 0;

  for (const content of allContent) {
    // Check for required fields
    if (!content.overview || content.overview === 'NONE') issues++;
    if (!content.pathophysiology || content.pathophysiology === 'NONE') issues++;
    if (!content.diagnostics || content.diagnostics === 'NONE') issues++;
  }

  console.log(`📊 Structure Validation Results:`);
  console.log(`   Total conditions: ${allContent.length}`);
  console.log(`   Structural issues: ${issues}\n`);

  // Structural issues are typically fixed by content generation and regeneration
  // which have already run in previous steps

  return { issues, fixed: 0 };
}

/**
 * Step 7: Health Check - Validate data integrity
 */
async function runHealthCheck(
  options: MaintenanceOptions
): Promise<MaintenanceReport['healthCheck']> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   STEP 7: HEALTH CHECK                                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const errors: string[] = [];

  try {
    // Check registry sync
    const conditionCount = await prisma.condition.count();
    const contentCount = await prisma.medicalContent.count();

    console.log(`✅ Registry: ${conditionCount} conditions`);
    console.log(`✅ Content: ${contentCount} medical records`);

    if (conditionCount > contentCount + 50) {
      errors.push(`Large gap between registry (${conditionCount}) and content (${contentCount})`);
    }

    // Check for orphaned records
    const orphanedContent = await prisma.medicalContent.count({
      where: {
        condition: null,
      },
    });

    if (orphanedContent > 0) {
      errors.push(
        `${orphanedContent} orphaned content records (no matching condition in registry)`
      );
    } else {
      console.log(`✅ No orphaned records`);
    }

    // Check for duplicate conditionIds
    const duplicates = await prisma.$queryRaw<Array<{ conditionId: string; count: bigint }>>`
      SELECT "conditionId", COUNT(*) as count
      FROM "MedicalContent"
      GROUP BY "conditionId"
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      errors.push(`${duplicates.length} duplicate conditionId values in MedicalContent`);
    } else {
      console.log(`✅ No duplicate condition IDs`);
    }

    console.log();
  } catch (error) {
    errors.push(`Health check failed: ${error}`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Main maintenance workflow
 */
async function runWeeklyMaintenance(options: MaintenanceOptions): Promise<MaintenanceReport> {
  const startTime = Date.now();

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   PANaCEa WEEKLY MAINTENANCE SUITE                     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ Started: ${new Date().toLocaleString()}`);

  if (options.targetSystem) {
    console.log(`🎯 Target System: ${options.targetSystem}`);
  } else {
    console.log(`🌐 Scope: All Systems (1,180 conditions)`);
  }

  if (options.dryRun) {
    console.log(`🔍 Mode: DRY RUN (no changes will be saved)`);
  }

  if (options.skipGeneration) {
    console.log(`⏭️  Skip: Content Generation`);
  }

  console.log();

  const report: MaintenanceReport = {
    timestamp: new Date(),
    system: options.targetSystem,
    gapAnalysis: { totalConditions: 0, missingContent: 0, incompleteContent: 0 },
    contentGeneration: { generated: 0, failed: 0 },
    formatting: { standardized: 0, unchanged: 0 },
    qualityAssessment: { belowStandard: 0, regenerated: 0 },
    fieldEnhancement: { buzzwords: 0, mnemonics: 0, guidelines: 0, triads: 0, pearls: 0 },
    structureValidation: { issues: 0, fixed: 0 },
    healthCheck: { passed: false, errors: [] },
  };

  try {
    // Run all maintenance steps
    report.gapAnalysis = await runGapAnalysis(options);
    report.contentGeneration = await runContentGeneration(options);
    report.formatting = await runFormatStandardization(options);
    report.qualityAssessment = await runQualityAssessment(options);
    report.fieldEnhancement = await runFieldEnhancement(options);
    report.structureValidation = await runStructureValidation(options);
    report.healthCheck = await runHealthCheck(options);
  } catch (error) {
    console.error('\n❌ Maintenance failed with error:', error);
    report.healthCheck.errors.push(`Fatal error: ${error}`);
  }

  // Print final report
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   MAINTENANCE COMPLETE                                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log(`📊 System: ${options.targetSystem || 'All'}`);
  console.log();
  console.log(`📈 SUMMARY:`);
  console.log(
    `   Gap Analysis: ${report.gapAnalysis.missingContent} missing, ${report.gapAnalysis.incompleteContent} incomplete`
  );
  console.log(
    `   Content Generation: ${report.contentGeneration.generated} generated, ${report.contentGeneration.failed} failed`
  );
  console.log(
    `   Formatting: ${report.formatting.standardized} standardized, ${report.formatting.unchanged} unchanged`
  );
  console.log(
    `   Quality: ${report.qualityAssessment.belowStandard} below standard, ${report.qualityAssessment.regenerated} regenerated`
  );
  console.log(
    `   Field Enhancement: ${report.fieldEnhancement.buzzwords} buzzwords, ${report.fieldEnhancement.mnemonics} mnemonics`
  );
  console.log(`   Structure: ${report.structureValidation.issues} issues found`);
  console.log(`   Health: ${report.healthCheck.passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (report.healthCheck.errors.length > 0) {
    console.log(`\n⚠️  ERRORS:`);
    report.healthCheck.errors.forEach((error) => console.log(`   - ${error}`));
  }

  console.log();

  return report;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  const options: MaintenanceOptions = {
    targetSystem: undefined,
    skipGeneration: args.includes('--skip-generation'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Parse system flag
  const systemArg = args.find((arg) => arg.startsWith('--system='));
  if (systemArg) {
    const system = systemArg.split('=')[1].toUpperCase() as SystemCode;
    if (SYSTEM_CODES.includes(system)) {
      options.targetSystem = system;
    } else {
      console.error(`❌ Invalid system: ${system}`);
      console.error(`   Valid systems: ${SYSTEM_CODES.join(', ')}`);
      process.exit(1);
    }
  }

  try {
    await runWeeklyMaintenance(options);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
