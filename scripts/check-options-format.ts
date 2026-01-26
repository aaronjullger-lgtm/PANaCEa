import { prisma } from './_shared/db';

async function check() {
  // Check main Question table raw data
  const mainQuestions = await prisma.question.findMany({
    take: 5,
    select: { id: true, question: true, options: true, correctAnswer: true }
  });
  
  console.log('=== MAIN QUESTION TABLE RAW OPTIONS ===');
  for (const q of mainQuestions) {
    console.log('\n--- Question', q.id, '---');
    console.log('Options type:', typeof q.options);
    console.log('Options value:', JSON.stringify(q.options));
    console.log('Is array:', Array.isArray(q.options));
    console.log('Correct answer:', q.correctAnswer);
  }
  
  // Try to find a question with valid string array options
  const allQuestions = await prisma.question.findMany({
    take: 50,
    select: { id: true, options: true }
  });
  
  let withValidOptions = 0;
  let withObjectOptions = 0;
  let withStringOptions = 0;
  
  for (const q of allQuestions) {
    if (Array.isArray(q.options) && q.options.length > 0 && typeof q.options[0] === 'string') {
      withValidOptions++;
    } else if (typeof q.options === 'object' && q.options !== null) {
      withObjectOptions++;
    } else if (typeof q.options === 'string') {
      withStringOptions++;
    }
  }
  
  console.log('\n=== OPTIONS FORMAT BREAKDOWN ===');
  console.log('Valid string arrays:', withValidOptions);
  console.log('Objects:', withObjectOptions);
  console.log('Strings:', withStringOptions);
  
  await prisma.$disconnect();
}

check().catch(console.error);
