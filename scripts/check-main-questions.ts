import { prisma } from './_shared/db';

async function check() {
  // Check main Question table
  const mainQuestions = await prisma.question.findMany({
    take: 10,
    select: { id: true, question: true, options: true, correctAnswer: true }
  });
  
  console.log('=== MAIN QUESTION TABLE SAMPLE ===');
  for (const q of mainQuestions) {
    console.log({
      id: q.id,
      hasQuestion: !!q.question,
      optionsCount: q.options?.length || 0,
      hasCorrectAnswer: !!q.correctAnswer,
      sampleOption: q.options?.[0]?.slice(0, 50)
    });
  }
  
  const totalMain = await prisma.question.count();
  console.log('\nTotal in Question table:', totalMain);
  
  // Check if any questions have empty options arrays
  const emptyOptionsMain = await prisma.question.count({
    where: { options: { equals: [] } }
  });
  console.log('Main questions with empty options:', emptyOptionsMain);
  
  await prisma.$disconnect();
}

check().catch(console.error);
