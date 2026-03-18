/**
 * TASK 2: Root Cause Diagnosis - DIC Display Bug
 * 
 * Investigate why DIC was showing as a buzzword on digoxin toxicity questions.
 * This is a DISPLAY BUG - wrong buzzwords being rendered for a question.
 * 
 * Hypotheses:
 * H1: A question with digoxin conditionId has DIC in its own buzzwords/explanation
 * H2: Wrong content record is being joined/looked up
 * H3: Rendering component falls back to different condition's buzzwords
 * H4: Buzzwords assigned at seed time by wrong condition reference
 */

import { prisma, disconnect } from './_shared/db';

async function diagnoseDisplayBug() {

  try {
    console.log('🔍 TASK 2: ROOT CAUSE ANALYSIS\n');
    console.log('='.repeat(70));

    // H1: Questions with digoxin conditionId that contain DIC
    console.log('\n📌 HYPOTHESIS 1: Question with digoxin condition has DIC in explanation\n');

    const questionsWithDigoxin = await (prisma as any).question.findMany({
      where: {
        conditionId: {
          contains: 'digoxin',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        conditionId: true,
        question: true,
        explanation: true,
      },
      take: 50,
    });

    if (questionsWithDigoxin.length > 0) {
      console.log(`Found ${questionsWithDigoxin.length} question(s) with digoxin conditionId:\n`);
      for (const q of questionsWithDigoxin) {
        const hasDIC = (q.explanation || '').toLowerCase().includes('dic');
        console.log(`  - ID: ${q.id}`);
        console.log(`    Condition: ${q.conditionId}`);
        if (hasDIC) console.log(`    ⚠️  DIC mention found in explanation`);
        console.log(`    Question preview: ${(q.question || '').substring(0, 80)}...`);
      }
    } else {
      console.log('No questions found with "digoxin" in conditionId');
    }

    // H2: Check MedicalContent joins - is digoxin content linked to DIC?
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 HYPOTHESIS 2: Wrong content record linked via condition mapping\n');

    const digoxinContent = await (prisma as any).medicalContent.findFirst({
      where: {
        id: 'CV__ecg__digoxin_toxicity_content',
      },
      select: {
        id: true,
        condition: true,
        system: true,
        buzzwords: true,
      },
    });

    const dicContent = await (prisma as any).medicalContent.findFirst({
      where: {
        condition: {
          contains: 'DIC',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        condition: true,
        system: true,
        buzzwords: true,
      },
    });

    console.log('Digoxin Content:');
    if (digoxinContent) {
      console.log(`  ID: ${digoxinContent.id}`);
      console.log(`  Condition: ${digoxinContent.condition}`);
      console.log(`  System: ${digoxinContent.system}`);
      console.log(`  Buzzwords (${digoxinContent.buzzwords?.length || 0}): ${JSON.stringify(digoxinContent.buzzwords)}`);
    }

    console.log('\nDIC Content:');
    if (dicContent) {
      console.log(`  ID: ${dicContent.id}`);
      console.log(`  Condition: ${dicContent.condition}`);
      console.log(`  System: ${dicContent.system}`);
      console.log(`  Buzzwords (${dicContent.buzzwords?.length || 0}): ${JSON.stringify(dicContent.buzzwords)}`);
    }

    // H3: Check buzzword lookup behavior
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 HYPOTHESIS 3: Buzzword rendering falls back to wrong condition\n');

    // Look for any question that points to digoxin but whose content lookup returns DIC
    const allDigoxinQuestions = await (prisma as any).question.findMany({
      where: {
        conditionId: {
          contains: 'digoxin',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        conditionId: true,
        question: true,
      },
      take: 20,
    });

    console.log(`Checking ${allDigoxinQuestions.length} digoxin questions for content lookup issues...\n`);

    for (const q of allDigoxinQuestions.slice(0, 5)) {
      // Try to replicate any content lookup
      const content = await (prisma as any).medicalContent.findFirst({
        where: {
          OR: [
            { id: q.conditionId },
            { condition: { contains: q.conditionId.replace(/CV__ecg__/, '').replace(/_/g, ' '), mode: 'insensitive' } },
          ],
        },
        select: { id: true, condition: true, buzzwords: true },
      });

      console.log(`  Q: ${q.id.slice(0, 40)}...`);
      console.log(`    ConditionId: ${q.conditionId}`);
      if (content) {
        const hasDIC = content.buzzwords?.some(
          (bw: string) => bw.toLowerCase().includes('dic') || bw.toLowerCase().includes('disseminated')
        );
        console.log(`    Resolved Content: ${content.condition}`);
        console.log(`    Has DIC: ${hasDIC ? '⚠️  YES' : 'No'}`);
      } else {
        console.log(`    Resolved Content: NONE (no match)`);
      }
    }

    // H4: Seeding pipeline - check for buzzword assignments
    console.log('\n' + '='.repeat(70));
    console.log('\n📌 HYPOTHESIS 4: Seeding pipeline assigned buzzwords incorrectly\n');

    // Check if there are any hematology/DIC-related buzzwords on CV questions
    const cvContentWithDIC = await (prisma as any).medicalContent.findMany({
      where: {
        system: 'CV',
        buzzwords: {
          hasSome: ['Disseminated Intravascular Coagulation (DIC)', 'DIC'],
        },
      },
      select: {
        id: true,
        condition: true,
        buzzwords: true,
      },
    });

    if (cvContentWithDIC.length > 0) {
      console.log(`⚠️  Found ${cvContentWithDIC.length} CV content record(s) with DIC buzzword:\n`);
      for (const record of cvContentWithDIC) {
        console.log(`  - ${record.condition} (${record.id})`);
        console.log(`    DIC buzzword present: ${JSON.stringify(record.buzzwords)}`);
      }
    } else {
      console.log('✅ No CV content records have DIC buzzword (good)');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 SUMMARY\n');
    console.log('Questions with digoxin: ' + questionsWithDigoxin.length);
    console.log('Digoxin content found: ' + (digoxinContent ? 'Yes' : 'No'));
    console.log('DIC content found: ' + (dicContent ? 'Yes' : 'No'));
    console.log('CV content with DIC buzzword: ' + cvContentWithDIC.length);

    console.log('\n' + '='.repeat(70));
    console.log('🔍 DIAGNOSIS COMPLETE - Check findings above');
  } finally {
    await disconnect();
  }
}

diagnoseDisplayBug().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
