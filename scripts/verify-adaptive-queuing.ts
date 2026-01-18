import { VariantQueueService } from '../services/variantQueueService';
import { prisma } from '../lib/prisma';

async function verifyAdaptiveQueuing() {
  console.log('🧪 Starting Adaptive Queuing Verification...');

  // 1. Setup a test user and question
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('❌ No user found for testing');
    return;
  }
  console.log(`👤 Using user: ${user.id}`);

  const question = await prisma.question.findFirst({
    where: { Condition: { isNot: null } },
    include: { Condition: true },
  });

  if (!question || !question.Condition) {
    console.error('❌ No suitable question found');
    return;
  }
  console.log(`❓ Using question: ${question.id} (Condition: ${question.Condition.name})`);

  // 2. Simulate WeaknessPattern
  console.log('💥 Simulating weakness pattern...');
  await prisma.weaknessPattern.create({
    data: {
      userId: user.id,
      conditionId: question.Condition.id,
      wasCorrect: false,
      consecutiveWrong: 3,
      timestamp: new Date(),
    },
  });

  // 3. Trigger Queue
  console.log('🚀 Triggering queueVariantForReview...');
  const service = new VariantQueueService();
  const variantId = await service.queueVariantForReview(user.id, question.id, 'spaced_repetition');

  if (variantId) {
    const variant = await prisma.questionVariant.findUnique({ where: { id: variantId } });
    console.log('✅ Variant generated:', variant?.id);
    console.log('   Type:', variant?.variantType);
    console.log('   Task:', variant?.taskType);

    if (variant?.variantType === 'decomposition') {
      console.log('🌟 SUCCESS: Adaptive logic correctly chose "decomposition" for weak area!');
      // Clean up
      await prisma.questionVariant.delete({ where: { id: variantId } });
    } else {
      console.warn(`⚠️ WARNING: Expected "decomposition", got "${variant?.variantType}"`);
    }
  } else {
    console.error('❌ Failed to generate variant');
  }

  // Clean up weakness
  await prisma.weaknessPattern.deleteMany({
    where: { userId: user.id, conditionId: question.Condition.id },
  });
}

verifyAdaptiveQueuing()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
