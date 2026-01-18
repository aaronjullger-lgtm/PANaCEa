/**
 * Quick verification script to check Content Doctor output
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 Verifying latest Content Doctor output...\n');

  // Get the most recently updated content
  const content = await prisma.medicalContent.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!content) {
    console.log('❌ No content found for Transposition');
    process.exit(1);
  }

  console.log('📋 Condition:', content.condition);
  console.log('📅 Updated:', content.updatedAt);
  console.log('─'.repeat(60));

  // Check new fields
  console.log('\n🆕 NEW FIELDS:');
  console.log('  • synonyms:', JSON.stringify(content.synonyms));
  const data = content.content as any;
  console.log('  • classic_patient:', data.classic_patient);
  console.log('  • pance_yield:', data.pance_yield);
  console.log('  • differentials:', JSON.stringify(data.differentials));
  console.log('  • best_initial_test:', data.best_initial_test);
  console.log('  • rx_mechanism:', data.rx_mechanism);
  console.log('  • rx_side_effects:', data.rx_side_effects);
  console.log('  • age_demographic:', JSON.stringify(data.age_demographic));
  console.log('  • gender_bias:', data.gender_bias);
  console.log('  • patient_education:', data.patient_education);
  console.log('  • disposition:', data.disposition);
  console.log('  • prevention:', data.prevention);
  console.log('  • mnemonic:', content.mnemonic);
  console.log('  • guidelines:', content.guidelines);
  console.log('  • image_query:', content.image_query);

  console.log('\n🎯 HIGH-YIELD FIELDS:');
  console.log('  • buzzwords:', JSON.stringify(content.buzzwords));
  console.log('  • classic_triad:', JSON.stringify(content.classic_triad));
  console.log(
    '  • clinical_pearls:',
    JSON.stringify(
      Array.isArray(content.clinical_pearls)
        ? content.clinical_pearls.slice(0, 2)
        : content.clinical_pearls
    )
  );
  console.log('  • gold_standard_dx:', content.gold_standard_dx);
  console.log('  • first_line_rx:', content.first_line_rx);

  console.log('\n📝 PROSE FIELDS (with markdown):');
  console.log('  • symptoms (first 200 chars):', content.symptoms?.substring(0, 200));
  console.log('  • treatment (first 200 chars):', content.treatment?.substring(0, 200));

  await prisma.$disconnect();
  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
