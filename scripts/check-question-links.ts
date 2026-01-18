import { prisma, disconnectPrisma } from './helpers/prisma-client.js';

async function check() {
  const q = await prisma.question.findFirst({
    where: { conditionId: { not: null } },
    select: { id: true, conditionId: true, medicalContentId: true, system: true },
  });
  console.log('Sample question with conditionId:', JSON.stringify(q, null, 2));

  const count = await prisma.question.count({ where: { medicalContentId: { not: null } } });
  console.log(`\nQuestions with medicalContentId: ${count}`);

  await disconnectPrisma();
}

check();
