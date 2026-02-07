#!/usr/bin/env tsx
/**
 * Universal Auto-Author Script - Generate Missing Content for ALL Registries
 *
 * Identifies entities in the database that are missing core content
 * and generates it using AI in sequential stages to prevent overwhelm.
 *
 * Stages:
 *   1. Conditions (existing)
 *   2. Lab Tests
 *   3. Imaging Studies
 *   4. Treatments
 *   5. Physiology Concepts
 *
 * Usage:
 *   tsx scripts/generateMissingContent.ts [options]
 *
 * Options:
 *   --stage=N             Process only stage N (1-5)
 *   --max-per-stage=N     Process at most N entities per stage (default: 50)
 *   --delay=MS            Delay between API calls in milliseconds (default: 2000)
 *   --dry-run             Show what would be processed without making changes
 *   --extended            Include extended fields for conditions
 *
 * Environment Variables:
 *   GEMINI_API_KEY or GOOGLE_API_KEY - Required for AI generation
 *
 * Examples:
 *   npm run generate:missing-content
 *   tsx scripts/generateMissingContent.ts --stage=2 --max-per-stage=20
 *   tsx scripts/generateMissingContent.ts --dry-run
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import {
  generateConditionContent,
  generateLabContent,
  generateImagingContent,
  generateTreatmentContent,
  generatePhysiologyContent,
} from '../lib/services/autoAuthor/contentGenerator';
import {
  validateGeneratedContent,
  validateLabContent,
  validateImagingContent,
  validateTreatmentContent,
  validatePhysiologyContent,
} from '../lib/services/cms/contentValidator';

// Load environment variables
config();

const prisma = new PrismaClient();

interface StageStats {
  stageName: string;
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  validationFailed: number;
}

// ======================================================
// PARSE COMMAND LINE ARGUMENTS
// ======================================================
function parseArgs(): {
  stage: number | null;
  maxPerStage: number;
  delayMs: number;
  dryRun: boolean;
  includeExtendedFields: boolean;
} {
  const args = process.argv.slice(2);
  let stage: number | null = null;
  let maxPerStage = 50;
  let delayMs = 2000;
  let dryRun = false;
  let includeExtendedFields = false;

  for (const arg of args) {
    if (arg.startsWith('--stage=')) {
      stage = parseInt(arg.split('=')[1] ?? '', 10) || null;
    } else if (arg.startsWith('--max-per-stage=')) {
      maxPerStage = parseInt(arg.split('=')[1] ?? '50', 10) || 50;
    } else if (arg.startsWith('--delay=')) {
      delayMs = parseInt(arg.split('=')[1] ?? '2000', 10) || 2000;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--extended') {
      includeExtendedFields = true;
    }
  }

  return { stage, maxPerStage, delayMs, dryRun, includeExtendedFields };
}

// ======================================================
// STAGE 1: CONDITIONS
// ======================================================
async function processConditions(
  apiKey: string,
  maxEntities: number,
  delayMs: number,
  dryRun: boolean,
  includeExtendedFields: boolean
): Promise<StageStats> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         STAGE 1: Conditions                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: StageStats = {
    stageName: 'Conditions',
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
  };

  // Find conditions missing content
  const missingConditions = await prisma.medicalContent.findMany({
    where: {
      OR: [{ overview: null }, { symptoms: null }, { treatment: null }],
    },
    select: {
      id: true,
      condition: true,
      conditionId: true,
      system: true,
    },
    take: maxEntities,
  });

  stats.total = missingConditions.length;

  if (stats.total === 0) {
    console.log('✅ All conditions already have content!\n');
    return stats;
  }

  console.log(`Found ${stats.total} conditions missing content\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Would process:');
    missingConditions.forEach((c, i) => console.log(`   ${i + 1}. ${c.condition} (${c.system})`));
    console.log();
    return stats;
  }

  // Generate content for each
  for (let i = 0; i < missingConditions.length; i++) {
    const condition = missingConditions[i];
    if (!condition) continue;
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${condition.condition} (${condition.system})`);

    const result = await generateConditionContent(apiKey, {
      conditionName: condition.condition,
      system: condition.system,
      includeExtendedFields,
    });

    if (result.success && result.content) {
      const validation = validateGeneratedContent(result.content);

      if (!validation.isValid) {
        stats.validationFailed++;
        console.log(`   ❌ Quality validation failed`);
        validation.issues.forEach((issue) => console.log(`      - ${issue}`));
      } else {
        try {
          // Note: MedicalContent schema stores most fields as TEXT, not arrays
          // Convert arrays to bullet-point text format for storage
          const arrayToText = (arr: string[] | undefined): string | null => {
            if (!arr || arr.length === 0) return null;
            return arr.map((item) => `• ${item}`).join('\n');
          };

          await prisma.medicalContent.update({
            where: { id: condition.id },
            data: {
              overview: result.content.overview,
              symptoms: arrayToText(result.content.symptoms),
              riskFactors: arrayToText(result.content.riskFactors),
              diagnostics: result.content.diagnosis,
              treatment: result.content.treatment,
              buzzwords: result.content.clinicalPearls || [], // buzzwords is an array
              etiology: result.content.etiologyPathophysiology,
              epidemiology: result.content.epidemiology,
              physicalExam: arrayToText(result.content.examFindings),
              complications: arrayToText(result.content.complications),
              prognosis: result.content.prognosis,
              differentialDiagnosis: arrayToText(result.content.differentialDiagnosis),
            },
          });
          stats.generated++;
          console.log(`   ✅ Generated and saved`);
        } catch (err: unknown) {
          stats.failed++;
          console.log(`   ❌ Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      stats.failed++;
      console.log(`   ❌ Generation failed: ${result.error}`);
    }

    if (i < missingConditions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return stats;
}

// ======================================================
// STAGE 2: LAB TESTS
// ======================================================
async function processLabTests(
  apiKey: string,
  maxEntities: number,
  delayMs: number,
  dryRun: boolean
): Promise<StageStats> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         STAGE 2: Lab Tests                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: StageStats = {
    stageName: 'Lab Tests',
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
  };

  const missingLabs = await prisma.labTest.findMany({
    where: {
      OR: [{ typicalUse: null }, { commonAbnormalities: { isEmpty: true } }],
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
    take: maxEntities,
  });

  stats.total = missingLabs.length;

  if (stats.total === 0) {
    console.log('✅ All lab tests already have content!\n');
    return stats;
  }

  console.log(`Found ${stats.total} lab tests missing content\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Would process:');
    missingLabs.forEach((l, i) => console.log(`   ${i + 1}. ${l.name} (${l.category})`));
    console.log();
    return stats;
  }

  for (let i = 0; i < missingLabs.length; i++) {
    const lab = missingLabs[i];
    if (!lab) continue;
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${lab.name}`);

    const result = await generateLabContent(apiKey, lab.name);

    if (result.success && result.content) {
      const validation = validateLabContent(result.content);

      if (!validation.isValid) {
        stats.validationFailed++;
        console.log(`   ❌ Quality validation failed`);
        validation.issues.forEach((issue) => console.log(`      - ${issue}`));
      } else {
        try {
          await prisma.labTest.update({
            where: { id: lab.id },
            data: {
              typicalUse: result.content.description,
              commonAbnormalities: result.content.commonAbnormalities,
            },
          });
          stats.generated++;
          console.log(`   ✅ Generated and saved`);
        } catch (err: unknown) {
          stats.failed++;
          console.log(`   ❌ Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      stats.failed++;
      console.log(`   ❌ Generation failed: ${result.error}`);
    }

    if (i < missingLabs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return stats;
}

// ======================================================
// STAGE 3: IMAGING STUDIES
// ======================================================
async function processImagingStudies(
  apiKey: string,
  maxEntities: number,
  delayMs: number,
  dryRun: boolean
): Promise<StageStats> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         STAGE 3: Imaging Studies                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: StageStats = {
    stageName: 'Imaging Studies',
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
  };

  const missingImaging = await prisma.imagingStudy.findMany({
    where: {
      OR: [{ description: null }, { indications: { isEmpty: true } }],
    },
    select: {
      id: true,
      name: true,
      modality: true,
    },
    take: maxEntities,
  });

  stats.total = missingImaging.length;

  if (stats.total === 0) {
    console.log('✅ All imaging studies already have content!\n');
    return stats;
  }

  console.log(`Found ${stats.total} imaging studies missing content\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Would process:');
    missingImaging.forEach((img, i) => console.log(`   ${i + 1}. ${img.name} (${img.modality})`));
    console.log();
    return stats;
  }

  for (let i = 0; i < missingImaging.length; i++) {
    const imaging = missingImaging[i];
    if (!imaging) continue;
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${imaging.name}`);

    const result = await generateImagingContent(apiKey, imaging.name);

    if (result.success && result.content) {
      const validation = validateImagingContent(result.content);

      if (!validation.isValid) {
        stats.validationFailed++;
        console.log(`   ❌ Quality validation failed`);
        validation.issues.forEach((issue) => console.log(`      - ${issue}`));
      } else {
        try {
          await prisma.imagingStudy.update({
            where: { id: imaging.id },
            data: {
              description: result.content.description,
              indications: result.content.bestFor,
              contraindications: result.content.limitations,
            },
          });
          stats.generated++;
          console.log(`   ✅ Generated and saved`);
        } catch (err: unknown) {
          stats.failed++;
          console.log(`   ❌ Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      stats.failed++;
      console.log(`   ❌ Generation failed: ${result.error}`);
    }

    if (i < missingImaging.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return stats;
}

// ======================================================
// STAGE 4: TREATMENTS
// ======================================================
async function processTreatments(
  apiKey: string,
  maxEntities: number,
  delayMs: number,
  dryRun: boolean
): Promise<StageStats> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         STAGE 4: Treatments                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: StageStats = {
    stageName: 'Treatments',
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
  };

  const missingTreatments = await prisma.treatment.findMany({
    where: {
      OR: [
        { description: null },
        { indications: { isEmpty: true } },
        { clinicalPearls: { isEmpty: true } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
    take: maxEntities,
  });

  stats.total = missingTreatments.length;

  if (stats.total === 0) {
    console.log('✅ All treatments already have content!\n');
    return stats;
  }

  console.log(`Found ${stats.total} treatments missing content\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Would process:');
    missingTreatments.forEach((t, i) => console.log(`   ${i + 1}. ${t.name} (${t.category})`));
    console.log();
    return stats;
  }

  for (let i = 0; i < missingTreatments.length; i++) {
    const treatment = missingTreatments[i];
    if (!treatment) continue;
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${treatment.name}`);

    const result = await generateTreatmentContent(apiKey, treatment.name);

    if (result.success && result.content) {
      const validation = validateTreatmentContent(result.content);

      if (!validation.isValid) {
        stats.validationFailed++;
        console.log(`   ❌ Quality validation failed`);
        validation.issues.forEach((issue) => console.log(`      - ${issue}`));
      } else {
        try {
          await prisma.treatment.update({
            where: { id: treatment.id },
            data: {
              description: result.content.description,
              indications: result.content.commonIndications,
              clinicalPearls: result.content.seriousSideEffects,
              boardYieldFacts: result.content.mechanismOfAction
                ? [result.content.mechanismOfAction]
                : [],
            },
          });
          stats.generated++;
          console.log(`   ✅ Generated and saved`);
        } catch (err: unknown) {
          stats.failed++;
          console.log(`   ❌ Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      stats.failed++;
      console.log(`   ❌ Generation failed: ${result.error}`);
    }

    if (i < missingTreatments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return stats;
}

// ======================================================
// STAGE 5: PHYSIOLOGY CONCEPTS
// ======================================================
async function processPhysiology(
  apiKey: string,
  maxEntities: number,
  delayMs: number,
  dryRun: boolean
): Promise<StageStats> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         STAGE 5: Physiology Concepts                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const stats: StageStats = {
    stageName: 'Physiology Concepts',
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    validationFailed: 0,
  };

  const missingPhysiology = await prisma.physiologyConcept.findMany({
    where: {
      OR: [{ description: null }, { mechanism: null }, { clinicalSignificance: null }],
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
    take: maxEntities,
  });

  stats.total = missingPhysiology.length;

  if (stats.total === 0) {
    console.log('✅ All physiology concepts already have content!\n');
    return stats;
  }

  console.log(`Found ${stats.total} physiology concepts missing content\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Would process:');
    missingPhysiology.forEach((p, i) => console.log(`   ${i + 1}. ${p.name} (${p.category})`));
    console.log();
    return stats;
  }

  for (let i = 0; i < missingPhysiology.length; i++) {
    const concept = missingPhysiology[i];
    if (!concept) continue;
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} ${concept.name}`);

    const result = await generatePhysiologyContent(apiKey, concept.name);

    if (result.success && result.content) {
      const validation = validatePhysiologyContent(result.content);

      if (!validation.isValid) {
        stats.validationFailed++;
        console.log(`   ❌ Quality validation failed`);
        validation.issues.forEach((issue) => console.log(`      - ${issue}`));
      } else {
        try {
          await prisma.physiologyConcept.update({
            where: { id: concept.id },
            data: {
              description: result.content.description,
              mechanism: result.content.mechanism,
              clinicalSignificance: result.content.clinicalSignificance,
            },
          });
          stats.generated++;
          console.log(`   ✅ Generated and saved`);
        } catch (err: unknown) {
          stats.failed++;
          console.log(`   ❌ Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      stats.failed++;
      console.log(`   ❌ Generation failed: ${result.error}`);
    }

    if (i < missingPhysiology.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return stats;
}

// ======================================================
// MAIN EXECUTION
// ======================================================
async function main() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
    console.error('   Please set your API key:');
    console.error('   export GEMINI_API_KEY=your_key_here\n');
    process.exit(1);
  }

  const { stage, maxPerStage, delayMs, dryRun, includeExtendedFields } = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Universal Auto-Author: Multi-Registry Content Pipeline ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nConfiguration:`);
  console.log(`  Stage Filter: ${stage || 'All stages (1-5)'}`);
  console.log(`  Max Per Stage: ${maxPerStage}`);
  console.log(`  Delay (ms): ${delayMs}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Extended Fields (Conditions): ${includeExtendedFields}`);

  const allStats: StageStats[] = [];

  try {
    // Run stages
    if (!stage || stage === 1) {
      const s1 = await processConditions(
        apiKey,
        maxPerStage,
        delayMs,
        dryRun,
        includeExtendedFields
      );
      allStats.push(s1);
    }

    if (!stage || stage === 2) {
      const s2 = await processLabTests(apiKey, maxPerStage, delayMs, dryRun);
      allStats.push(s2);
    }

    if (!stage || stage === 3) {
      const s3 = await processImagingStudies(apiKey, maxPerStage, delayMs, dryRun);
      allStats.push(s3);
    }

    if (!stage || stage === 4) {
      const s4 = await processTreatments(apiKey, maxPerStage, delayMs, dryRun);
      allStats.push(s4);
    }

    if (!stage || stage === 5) {
      const s5 = await processPhysiology(apiKey, maxPerStage, delayMs, dryRun);
      allStats.push(s5);
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  Universal Auto-Author Summary             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let totalGenerated = 0;
    let totalFailed = 0;

    allStats.forEach((s) => {
      console.log(`${s.stageName}:`);
      console.log(`  Total: ${s.total}`);
      console.log(`  ✅ Generated: ${s.generated}`);
      console.log(`  🚫 Validation Failed: ${s.validationFailed}`);
      console.log(`  ❌ Generation Failed: ${s.failed}\n`);

      totalGenerated += s.generated;
      totalFailed += s.failed + s.validationFailed;
    });

    console.log(`Overall:`);
    console.log(`  ✅ Total Generated: ${totalGenerated}`);
    console.log(`  ❌ Total Failed: ${totalFailed}\n`);

    if (totalFailed > 0) {
      console.log('⚠️  Some entities failed. Re-run to retry or check errors above.\n');
      process.exit(1);
    } else {
      console.log('✅ Auto-author run completed successfully!\n');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
