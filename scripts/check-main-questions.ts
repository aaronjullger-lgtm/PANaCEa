import { prisma } from './_shared/db';
import type { PrismaClient } from '@prisma/client';

async function check() {
  const db = prisma as PrismaClient;
  // Check main Question table
  const mainQuestions = await db.question.findMany({
    take: 10,
    select: { id: true, question: true, options: true, correctAnswer: true },
  });

  console.log('=== MAIN QUESTION TABLE SAMPLE ===');
  for (const q of mainQuestions) {
    const opts = q.options as unknown as string[] | null | undefined;
    console.log({
      id: q.id,
      hasQuestion: !!q.question,
      optionsCount: Array.isArray(opts) ? opts.length : 0,
      hasCorrectAnswer: !!q.correctAnswer,
      sampleOption: Array.isArray(opts) && opts[0] ? String(opts[0]).slice(0, 50) : undefined,
    });
  }

  const totalMain = await db.question.count();
  console.log('\nTotal in Question table:', totalMain);

  // Check if any questions have empty options arrays
  const emptyOptionsMain = await db.question.count({
    where: { options: { equals: [] } },
  });
  console.log('Main questions with empty options:', emptyOptionsMain);

  await db.$disconnect();
}

check().catch(console.error);
