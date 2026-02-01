import { prisma } from './_shared/db';

async function check() {
  const questions = await prisma.preGeneratedQuestion.findMany({
    take: 50,
    select: { id: true, questionData: true, conditionId: true, system: true, difficulty: true },
  });

  let withOptions = 0;
  let withoutOptions = 0;
  const missingExamples: any[] = [];
  const validExamples: any[] = [];

  for (const q of questions) {
    const data = q.questionData as any;
    if (data?.options && Array.isArray(data.options) && data.options.length > 0) {
      withOptions++;
      if (validExamples.length < 2) {
        validExamples.push({
          id: q.id,
          system: q.system,
          keys: Object.keys(data || {}),
          optionsCount: data.options.length,
          hasCorrectAnswer: 'correctAnswer' in data,
          hasCorrectAnswerIndex: 'correctAnswerIndex' in data,
          correctAnswerValue: data.correctAnswer ?? data.correctAnswerIndex,
        });
      }
    } else {
      withoutOptions++;
      missingExamples.push({
        id: q.id,
        system: q.system,
        conditionId: q.conditionId,
        hasOptions: !!data?.options,
        optionsValue: data?.options,
        keys: Object.keys(data || {}),
        sampleData: JSON.stringify(data).slice(0, 300),
      });
    }
  }

  console.log('=== QUESTION DATA ANALYSIS ===');
  console.log(`Sample of 50 questions:`);
  console.log(`With valid options: ${withOptions}`);
  console.log(`Without options: ${withoutOptions}`);

  console.log('\n=== VALID QUESTION EXAMPLES ===');
  console.log(JSON.stringify(validExamples, null, 2));

  console.log('\n=== MISSING OPTIONS EXAMPLES ===');
  console.log(JSON.stringify(missingExamples.slice(0, 5), null, 2));

  // Check total count
  const total = await prisma.preGeneratedQuestion.count();
  console.log(`\nTotal questions in DB: ${total}`);

  await prisma.$disconnect();
}

check().catch(console.error);
