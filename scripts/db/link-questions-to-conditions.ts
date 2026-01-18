/**
 * Step 3: Question-to-Condition Linkage System
 *
 * This script:
 * 1. Audits questions without condition links
 * 2. Analyzes question text to infer the condition being tested
 * 3. Backfills conditionId and medicalContentId for existing questions
 * 4. Reports on linkage quality and orphaned questions
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

interface QuestionLinkageReport {
  totalQuestions: number;
  totalPreGenerated: number;
  totalQuestionAttempts: number;

  questionsWithCondition: number;
  questionsWithMedicalContent: number;
  questionsWithBoth: number;
  questionsOrphaned: number;

  preGenWithCondition: number;
  preGenWithMedicalContent: number;
  preGenWithBoth: number;
  preGenOrphaned: number;

  attemptsWithCondition: number;
  attemptsOrphaned: number;

  orphanedQuestions: Array<{
    id: string;
    system: string;
    question: string;
    tags?: any;
  }>;

  orphanedPreGen: Array<{
    id: string;
    system: string | null;
    questionType: string;
  }>;
}

async function auditQuestionLinkage(): Promise<QuestionLinkageReport> {
  try {
    console.log('🔍 Starting Question → Condition linkage audit...\n');

    // Get all questions
    const allQuestions = await prisma.question.findMany({
      select: {
        id: true,
        system: true,
        question: true,
        tags: true,
        conditionId: true,
        medicalContentId: true,
      },
    });

    // Get all pre-generated questions
    const allPreGen = await prisma.preGeneratedQuestion.findMany({
      select: {
        id: true,
        system: true,
        questionType: true,
        conditionId: true,
        medicalContentId: true,
      },
    });

    // Get question attempts
    const allAttempts = await prisma.questionAttempt.findMany({
      select: {
        id: true,
        conditionId: true,
      },
    });

    // Calculate statistics
    const questionsWithCondition = allQuestions.filter((q) => q.conditionId).length;
    const questionsWithMedicalContent = allQuestions.filter((q) => q.medicalContentId).length;
    const questionsWithBoth = allQuestions.filter(
      (q) => q.conditionId && q.medicalContentId
    ).length;
    const questionsOrphaned = allQuestions.filter(
      (q) => !q.conditionId && !q.medicalContentId
    ).length;

    const preGenWithCondition = allPreGen.filter((q) => q.conditionId).length;
    const preGenWithMedicalContent = allPreGen.filter((q) => q.medicalContentId).length;
    const preGenWithBoth = allPreGen.filter((q) => q.conditionId && q.medicalContentId).length;
    const preGenOrphaned = allPreGen.filter((q) => !q.conditionId && !q.medicalContentId).length;

    const attemptsWithCondition = allAttempts.filter((a) => a.conditionId).length;
    const attemptsOrphaned = allAttempts.filter((a) => !a.conditionId).length;

    // Get orphaned question details
    const orphanedQuestions = allQuestions
      .filter((q) => !q.conditionId && !q.medicalContentId)
      .slice(0, 20)
      .map((q) => ({
        id: q.id,
        system: q.system,
        question: q.question.substring(0, 100),
        tags: q.tags,
      }));

    const orphanedPreGen = allPreGen
      .filter((q) => !q.conditionId && !q.medicalContentId)
      .slice(0, 20)
      .map((q) => ({
        id: q.id,
        system: q.system,
        questionType: q.questionType,
      }));

    const report: QuestionLinkageReport = {
      totalQuestions: allQuestions.length,
      totalPreGenerated: allPreGen.length,
      totalQuestionAttempts: allAttempts.length,
      questionsWithCondition,
      questionsWithMedicalContent,
      questionsWithBoth,
      questionsOrphaned,
      preGenWithCondition,
      preGenWithMedicalContent,
      preGenWithBoth,
      preGenOrphaned,
      attemptsWithCondition,
      attemptsOrphaned,
      orphanedQuestions,
      orphanedPreGen,
    };

    return report;
  } catch (error) {
    console.error('Error in audit:', error);
    throw error;
  }
}

/**
 * Infer condition ID from question tags or system
 * Enhanced version with better tag parsing and fuzzy matching
 */
function inferConditionFromQuestion(
  question: any,
  conditions: Array<{ id: string; name: string; system: string; aliases: string[] }>
): string | null {
  // Parse tags if it's a JSON string
  let tags: any = question.tags;
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = null;
    }
  }

  // Try to match from tags first
  if (tags) {
    // If tags is an array, look for condition names
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        const tagLower = String(tag).toLowerCase();
        const match = conditions.find(
          (c) =>
            c.name.toLowerCase() === tagLower ||
            c.aliases.some((alias) => alias.toLowerCase() === tagLower)
        );
        if (match) return match.id;
      }
    } else if (typeof tags === 'object') {
      // If tags is an object, check for condition or conditionId
      const conditionTag = tags.condition || tags.conditionId;
      if (conditionTag) {
        const match = conditions.find(
          (c) =>
            c.id === conditionTag || c.name.toLowerCase() === String(conditionTag).toLowerCase()
        );
        if (match) return match.id;
      }
    }
  }

  // Try to match from question text (vignette + question)
  const questionText = ((question.vignette || '') + ' ' + (question.question || '')).toLowerCase();

  // Look for exact condition name matches (prioritize same system)
  const sameSystemConditions = conditions.filter((c) => c.system === question.system);
  const otherConditions = conditions.filter((c) => c.system !== question.system);

  // Try same system first
  for (const condition of sameSystemConditions) {
    const conditionName = condition.name.toLowerCase();
    if (questionText.includes(conditionName)) {
      return condition.id;
    }
    // Try aliases
    for (const alias of condition.aliases) {
      if (questionText.includes(alias.toLowerCase())) {
        return condition.id;
      }
    }
  }

  // Then try other systems
  for (const condition of otherConditions) {
    const conditionName = condition.name.toLowerCase();
    if (questionText.includes(conditionName)) {
      return condition.id;
    }
  }

  return null;
}

async function linkQuestionsToConditions(dryRun: boolean = true): Promise<number> {
  try {
    console.log(`\n🔗 Linking questions to conditions (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`);

    // Get all conditions for matching
    const allConditions = await prisma.condition.findMany({
      select: { id: true, name: true, system: true, aliases: true },
    });

    // Get all orphaned questions (no conditionId) OR questions with conditionId but no medicalContentId
    const orphanedQuestions = await prisma.question.findMany({
      where: {
        OR: [
          {
            AND: [{ conditionId: null }, { medicalContentId: null }],
          },
          {
            AND: [{ conditionId: { not: null } }, { medicalContentId: null }],
          },
        ],
      },
      select: {
        id: true,
        system: true,
        question: true,
        vignette: true,
        tags: true,
        conditionId: true,
      },
    });

    let linked = 0;
    const updates: Array<{ id: string; conditionId: string }> = [];

    for (const question of orphanedQuestions) {
      // If question already has conditionId, just find the medicalContentId
      let conditionId = question.conditionId;

      // If no conditionId, try to infer it
      if (!conditionId) {
        conditionId = inferConditionFromQuestion(question, allConditions);
      }

      if (conditionId) {
        const condition = allConditions.find((c) => c.id === conditionId);
        console.log(`✓ ${question.id} → ${condition?.name}`);
        updates.push({ id: question.id, conditionId });
        linked++;
      }
    }

    if (!dryRun && updates.length > 0) {
      console.log(`\n💾 Applying ${updates.length} updates...`);

      for (const update of updates) {
        // Find MedicalContent by conditionId and get its id (UUID)
        const medicalContent = await prisma.medicalContent.findUnique({
          where: { conditionId: update.conditionId },
          select: { id: true },
        });

        await prisma.question.update({
          where: { id: update.id },
          data: {
            conditionId: update.conditionId,
            // Use MedicalContent.id (UUID), not conditionId
            medicalContentId: medicalContent ? medicalContent.id : null,
          },
        });
      }
    }

    console.log(`\n📊 Summary: ${linked} questions can be linked`);
    if (dryRun) {
      console.log('   Run with --apply to make changes');
    }

    return linked;
  } catch (error) {
    console.error('Error linking questions:', error);
    throw error;
  }
}

async function linkPreGeneratedQuestions(dryRun: boolean = true): Promise<number> {
  try {
    console.log(`\n🔗 Linking pre-generated questions (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`);

    // Get orphaned pre-generated questions
    const orphanedPreGen = await prisma.preGeneratedQuestion.findMany({
      where: {
        AND: [{ conditionId: null }, { medicalContentId: null }],
      },
      select: {
        id: true,
        system: true,
        questionData: true,
      },
    });

    let linked = 0;

    // For PreGeneratedQuestion, we need to look at the questionData JSON
    for (const preGen of orphanedPreGen) {
      const questionData = preGen.questionData as any;

      // Try to extract condition from questionData
      if (questionData.conditionId) {
        const conditionExists = await prisma.condition.findUnique({
          where: { id: questionData.conditionId },
        });

        if (conditionExists) {
          if (!dryRun) {
            await prisma.preGeneratedQuestion.update({
              where: { id: preGen.id },
              data: {
                conditionId: questionData.conditionId,
                medicalContentId: questionData.conditionId,
              },
            });
          }
          console.log(`✓ PreGen ${preGen.id} → ${questionData.conditionId}`);
          linked++;
        }
      }
    }

    console.log(`\n📊 Summary: ${linked} pre-generated questions can be linked`);
    return linked;
  } catch (error) {
    console.error('Error linking pre-generated questions:', error);
    throw error;
  }
}

function printReport(report: QuestionLinkageReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 QUESTION → CONDITION LINKAGE REPORT');
  console.log('='.repeat(60));

  console.log(`\n📝 Question Table:`);
  console.log(`  Total:                     ${report.totalQuestions}`);
  console.log(
    `  With conditionId:          ${report.questionsWithCondition} (${Math.round((report.questionsWithCondition / report.totalQuestions) * 100)}%)`
  );
  console.log(
    `  With medicalContentId:     ${report.questionsWithMedicalContent} (${Math.round((report.questionsWithMedicalContent / report.totalQuestions) * 100)}%)`
  );
  console.log(
    `  With both:                 ${report.questionsWithBoth} (${Math.round((report.questionsWithBoth / report.totalQuestions) * 100)}%)`
  );
  console.log(
    `  🔴 Orphaned (no links):    ${report.questionsOrphaned} (${Math.round((report.questionsOrphaned / report.totalQuestions) * 100)}%)`
  );

  console.log(`\n🎯 PreGeneratedQuestion Table:`);
  console.log(`  Total:                     ${report.totalPreGenerated}`);
  console.log(
    `  With conditionId:          ${report.preGenWithCondition} (${Math.round((report.preGenWithCondition / report.totalPreGenerated) * 100)}%)`
  );
  console.log(
    `  With medicalContentId:     ${report.preGenWithMedicalContent} (${Math.round((report.preGenWithMedicalContent / report.totalPreGenerated) * 100)}%)`
  );
  console.log(
    `  With both:                 ${report.preGenWithBoth} (${Math.round((report.preGenWithBoth / report.totalPreGenerated) * 100)}%)`
  );
  console.log(
    `  🔴 Orphaned (no links):    ${report.preGenOrphaned} (${Math.round((report.preGenOrphaned / report.totalPreGenerated) * 100)}%)`
  );

  console.log(`\n📊 QuestionAttempt Table:`);
  console.log(`  Total:                     ${report.totalQuestionAttempts}`);
  console.log(
    `  With conditionId:          ${report.attemptsWithCondition} (${Math.round((report.attemptsWithCondition / report.totalQuestionAttempts) * 100)}%)`
  );
  console.log(
    `  🔴 Orphaned (no links):    ${report.attemptsOrphaned} (${Math.round((report.attemptsOrphaned / report.totalQuestionAttempts) * 100)}%)`
  );

  if (report.orphanedQuestions.length > 0) {
    console.log(`\n⚠️  Sample orphaned questions (showing first 10):`);
    report.orphanedQuestions.slice(0, 10).forEach((q, i) => {
      console.log(`  ${i + 1}. [${q.system}] ${q.question}`);
      if (q.tags) {
        console.log(`     Tags: ${JSON.stringify(q.tags)}`);
      }
    });
  }

  if (report.orphanedPreGen.length > 0) {
    console.log(`\n⚠️  Sample orphaned pre-generated (showing first 10):`);
    report.orphanedPreGen.slice(0, 10).forEach((q, i) => {
      console.log(`  ${i + 1}. [${q.system || 'N/A'}] ${q.questionType} - ${q.id}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const auditOnly = args.includes('--audit-only');
  const apply = args.includes('--apply');
  const linkQuestions = args.includes('--link-questions');
  const linkPreGen = args.includes('--link-pregen');

  console.log('🏥 PANaCEa Database: Question → Condition Linkage System\n');

  // Step 1: Run audit
  const report = await auditQuestionLinkage();
  printReport(report);

  if (auditOnly) {
    console.log('ℹ️  Audit-only mode.\n');
    console.log('   Use --link-questions to link Question table');
    console.log('   Use --link-pregen to link PreGeneratedQuestion table');
    console.log('   Add --apply to make changes (default is dry run)\n');
    return;
  }

  // Step 2: Link questions
  if (linkQuestions) {
    const linked = await linkQuestionsToConditions(!apply);
    console.log(`✅ ${linked} questions ready to be linked`);
  }

  if (linkPreGen) {
    const linked = await linkPreGeneratedQuestions(!apply);
    console.log(`✅ ${linked} pre-generated questions ready to be linked`);
  }

  if (!linkQuestions && !linkPreGen) {
    console.log('ℹ️  Use --link-questions or --link-pregen to start linking');
    console.log('   Add --apply to make changes (default is dry run)\n');
  }

  // Step 3: Re-audit
  if (apply && (linkQuestions || linkPreGen)) {
    console.log('\n🔄 Running verification audit...');
    const verifyReport = await auditQuestionLinkage();
    printReport(verifyReport);
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
