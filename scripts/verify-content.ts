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
  console.log('  • classic_patient:', content.classic_patient);
  console.log('  • pance_yield:', content.pance_yield);
  console.log('  • differentials:', JSON.stringify(content.differentials));
  console.log('  • best_initial_test:', content.best_initial_test);
  console.log('  • rx_mechanism:', content.rx_mechanism);
  console.log('  • rx_side_effects:', content.rx_side_effects);
  console.log('  • age_demographic:', JSON.stringify(content.age_demographic));
  console.log('  • gender_bias:', content.gender_bias);
  console.log('  • patient_education:', content.patient_education);
  console.log('  • disposition:', content.disposition);
  console.log('  • prevention:', content.prevention);
  console.log('  • mnemonic:', content.mnemonic);
  console.log('  • guidelines:', content.guidelines);
  console.log('  • image_query:', content.image_query);

  console.log('\n🎯 HIGH-YIELD FIELDS:');
  console.log('  • buzzwords:', JSON.stringify(content.buzzwords));
  console.log('  • classic_triad:', JSON.stringify(content.classic_triad));
  console.log('  • clinical_pearls:', JSON.stringify(content.clinical_pearls?.slice(0, 2)));
  console.log('  • gold_standard_dx:', content.gold_standard_dx);
  console.log('  • first_line_rx:', content.first_line_rx);

  console.log('\n📝 PROSE FIELDS (with markdown):');
  console.log('  • symptoms (first 200 chars):', content.symptoms?.substring(0, 200));
  console.log('  • treatment (first 200 chars):', content.treatment?.substring(0, 200));

  await prisma.$disconnect();
  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
