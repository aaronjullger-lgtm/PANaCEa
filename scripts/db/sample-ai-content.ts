/**
 * Sample AI-Generated Content Quality Review
 * 
 * Displays a sample of AI-generated fields (mnemonics, guidelines, classic triads)
 * to assess medical accuracy and quality.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function sampleContent() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('║    AI-Generated Content Quality Sample                   ║');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Sample 10 mnemonics
  const mnemonics = await prisma.medicalContent.findMany({
    where: {
      mnemonic: { not: 'NONE' }
    },
    select: { conditionId: true, mnemonic: true },
    orderBy: { conditionId: 'asc' },
    take: 10
  });
  
  console.log('📝 MNEMONICS (10 samples):');
  mnemonics.forEach(m => console.log(`  • ${m.conditionId}: ${m.mnemonic}`));
  
  // Sample 10 guidelines
  const guidelines = await prisma.medicalContent.findMany({
    where: {
      guidelines: { not: 'NONE' }
    },
    select: { conditionId: true, guidelines: true },
    orderBy: { conditionId: 'asc' },
    take: 10
  });
  
  console.log('\n📋 GUIDELINES (10 samples):');
  guidelines.forEach(g => console.log(`  • ${g.conditionId}: ${g.guidelines}`));
  
  // Sample 10 classic triads
  const triads = await prisma.medicalContent.findMany({
    where: {
      classic_triad: { not: Prisma.DbNull }
    },
    select: { conditionId: true, classic_triad: true },
    orderBy: { conditionId: 'asc' },
    take: 10
  });
  
  console.log('\n🔺 CLASSIC TRIADS (10 samples):');
  triads.forEach(t => {
    const triadArray = Array.isArray(t.classic_triad) ? t.classic_triad : [];
    console.log(`  • ${t.conditionId}: [${triadArray.join(', ')}]`);
  });
  
  // Statistics
  const stats = await prisma.medicalContent.aggregate({
    _count: { conditionId: true }
  });
  
  const mnemonicCount = await prisma.medicalContent.count({
    where: { mnemonic: { not: 'NONE' } }
  });
  
  const guidelinesCount = await prisma.medicalContent.count({
    where: { guidelines: { not: 'NONE' } }
  });
  
  const triadCount = await prisma.medicalContent.count({
    where: { classic_triad: { not: Prisma.DbNull } }
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('║    Content Statistics                                    ║');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total records: ${stats._count.conditionId}`);
  console.log(`Mnemonics: ${mnemonicCount} (${Math.round(mnemonicCount / stats._count.conditionId * 100)}%)`);
  console.log(`Guidelines: ${guidelinesCount} (${Math.round(guidelinesCount / stats._count.conditionId * 100)}%)`);
  console.log(`Classic Triads: ${triadCount} (${Math.round(triadCount / stats._count.conditionId * 100)}%)`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  await prisma.$disconnect();
}

sampleContent().catch(console.error);
