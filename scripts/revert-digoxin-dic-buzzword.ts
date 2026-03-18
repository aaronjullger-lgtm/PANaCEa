/**
 * TASK 1: Revert DIC Buzzword from Digoxin Toxicity
 * 
 * This script reverts the change made to CV__ecg__digoxin_toxicity_content.
 * Removes "Disseminated Intravascular Coagulation (DIC)" from the buzzwords array.
 * Restores exactly these 5 buzzwords:
 *   - Salvador Dali mustache
 *   - Atrial Tachycardia with AV Block
 *   - Xanthopsia (yellow-green halos)
 *   - Bidirectional Ventricular Tachycardia
 *   - DigiFab/Digibind
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function revertDigoxinDICBuzzword() {
  // Get database URL
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create PrismaClient with proper Prisma 7 configuration
  let prisma: PrismaClient;
  const isAccelerateUrl = databaseUrl.startsWith('prisma') && !databaseUrl.startsWith('postgresql');

  if (isAccelerateUrl) {
    prisma = new PrismaClient({
      accelerateUrl: databaseUrl,
    });
    prisma = prisma.$extends(withAccelerate());
  } else {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  try {
    console.log('🔄 Reverting DIC buzzword from Digoxin Toxicity...\n');

    // Step 1: Find the content
    const digoxinContent = await prisma.medicalContent.findFirst({
      where: {
        id: 'CV__ecg__digoxin_toxicity_content',
      },
    });

    if (!digoxinContent) {
      console.log('❌ Content not found with ID: CV__ecg__digoxin_toxicity_content');
      return;
    }

    console.log(`✅ Found content: ${digoxinContent.condition}`);
    console.log(`   Current buzzwords (${digoxinContent.buzzwords?.length || 0} total):`);
    (digoxinContent.buzzwords || []).forEach((bw) => console.log(`   - ${bw}`));
    console.log('');

    // Step 2: Define the correct buzzwords (without DIC)
    const correctBuzzwords = [
      'Salvador Dali mustache',
      'Atrial Tachycardia with AV Block',
      'Xanthopsia (yellow-green halos)',
      'Bidirectional Ventricular Tachycardia',
      'DigiFab/Digibind',
    ];

    // Step 3: Check if revert is needed
    const currentBuzzwords = digoxinContent.buzzwords || [];
    const hasDIC = currentBuzzwords.some(
      (bw) =>
        bw.toLowerCase().includes('dic') ||
        bw.toLowerCase().includes('disseminated intravascular coagulation')
    );

    if (!hasDIC) {
      console.log('✅ DIC buzzword not found — no revert needed.');
      console.log('   Current state matches expected state.');
      return;
    }

    // Step 4: Perform the revert
    console.log('🔄 Reverting to correct buzzwords...');
    const updated = await prisma.medicalContent.update({
      where: { id: digoxinContent.id },
      data: {
        buzzwords: correctBuzzwords,
      },
    });

    console.log(`\n✅ Revert successful!`);
    console.log(`📝 Restored Buzzwords (${correctBuzzwords.length} total):`);
    correctBuzzwords.forEach((bw) => console.log(`   - ${bw}`));

    // Step 5: Verification read
    console.log('\n🔍 Verification: Reading back from database...');
    const verified = await prisma.medicalContent.findFirst({
      where: { id: 'CV__ecg__digoxin_toxicity_content' },
    });

    if (
      verified &&
      JSON.stringify(verified.buzzwords) === JSON.stringify(correctBuzzwords)
    ) {
      console.log('✅ VERIFIED: Database state matches expected state.');
      console.log(`\n📊 Final State:`);
      console.log(`   Condition: ${verified.condition}`);
      console.log(`   Buzzwords: ${verified.buzzwords?.length || 0} items`);
      verified.buzzwords?.forEach((bw) => console.log(`   - ${bw}`));
      console.log(`\n✅ TASK 1 COMPLETE: Revert confirmed.`);
    } else {
      console.log('❌ VERIFICATION FAILED: Database state does not match expected.');
      console.log('   This should not happen. Please investigate.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
revertDigoxinDICBuzzword().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
