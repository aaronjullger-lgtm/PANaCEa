/**
 * Audit and Fix DIC Buzzword Tagging for Digoxin Question
 * 
 * This script:
 * 1. Finds the Digoxin Toxicity condition/content
 * 2. Audits which buzzwords are currently tagged
 * 3. Adds "Disseminated Intravascular Coagulation" or "DIC" to the buzzwords
 * 4. Updates the MedicalContent record
 * 
 * Context: Digoxin toxicity can lead to DIC in severe cases, so DIC is a valid
 * buzzword/complication that should be associated with digoxin-related content.
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function auditAndFixDigoxinDICBuzzwords() {
  // Get database URL - prefer DIRECT_DATABASE_URL for scripts
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create PrismaClient with proper Prisma 7 configuration
  let prisma: PrismaClient;
  const isAccelerateUrl = databaseUrl.startsWith('prisma://');

  if (isAccelerateUrl) {
    // For Accelerate: use accelerateUrl
    prisma = new PrismaClient({
      accelerateUrl: databaseUrl,
    });
    prisma = prisma.$extends(withAccelerate());
  } else {
    // For direct PostgreSQL: use adapter-pg
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  try {
    console.log('🔍 Auditing Digoxin Toxicity buzzword tagging...\n');

    // Step 1: Find the MedicalContent record for Digoxin Toxicity
    const digoxinContent = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { condition: { contains: 'Digoxin Toxicity', mode: 'insensitive' } },
          { conditionId: { contains: 'digoxin', mode: 'insensitive' } },
        ],
      },
      include: {
        ContentVersion: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!digoxinContent) {
      console.log('❌ Digoxin Toxicity content not found in database');
      return;
    }

    console.log(`✅ Found content: ${digoxinContent.condition}`);
    console.log(`   ID: ${digoxinContent.id}`);
    console.log(`   System: ${digoxinContent.system}`);
    console.log(`   Subcategory: ${digoxinContent.subcategory}\n`);

    // Step 2: Audit current buzzwords
    const currentBuzzwords = digoxinContent.buzzwords || [];
    console.log('📋 Current Buzzwords:');
    if (currentBuzzwords.length === 0) {
      console.log('   (none)');
    } else {
      currentBuzzwords.forEach((bw) => console.log(`   - ${bw}`));
    }
    console.log('');

    // Step 3: Check if DIC-related buzzword exists
    const dicBuzzwordExists = currentBuzzwords.some(
      (bw) =>
        bw.toLowerCase().includes('dic') ||
        bw.toLowerCase().includes('disseminated intravascular coagulation')
    );

    if (dicBuzzwordExists) {
      console.log('✅ DIC buzzword already present');
      return;
    }

    // Step 4: Add DIC to buzzwords
    console.log('➕ Adding DIC buzzword...');
    const dicBuzzword = 'Disseminated Intravascular Coagulation (DIC)';
    const updatedBuzzwords = [...currentBuzzwords, dicBuzzword];

    const updated = await prisma.medicalContent.update({
      where: { id: digoxinContent.id },
      data: {
        buzzwords: updatedBuzzwords,
      },
    });

    console.log(`\n✅ Updated successfully!`);
    console.log(`📝 New Buzzwords (${updatedBuzzwords.length} total):`);
    updatedBuzzwords.forEach((bw) => console.log(`   - ${bw}`));

    // Step 5: Log the change
    console.log(`\n📊 Summary:`);
    console.log(`   Condition: ${updated.condition}`);
    console.log(`   Buzzwords Added: 1`);
    console.log(`   New Total: ${updatedBuzzwords.length}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
auditAndFixDigoxinDICBuzzwords().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
