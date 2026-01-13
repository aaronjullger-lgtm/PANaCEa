import { prisma, disconnectPrisma } from './helpers/prisma-client';

/**
 * Simple fix: Clear "Acute Coronary Syndrome" subcategory from non-cardiovascular conditions
 * This is the main cross-contamination issue from the original bug
 */

async function clearACSFromNonCardiovascular() {
  try {
    // Find non-cardiovascular conditions with ACS subcategory
    const toFix = await prisma.condition.findMany({
      where: {
        AND: [
          { system: { not: 'Cardiovascular System' } },
          { subcategory: 'Acute Coronary Syndrome' }
        ]
      },
      select: { id: true, name: true, system: true }
    });
    
    console.log(`Found ${toFix.length} non-cardiovascular conditions with ACS subcategory`);
    console.log('Sample:', toFix.slice(0, 5).map(c => `${c.name} (${c.system})`));
    
    if (toFix.length > 0) {
      // Clear subcategory and parent_category
      await prisma.condition.updateMany({
        where: {
          AND: [
            { system: { not: 'Cardiovascular System' } },
            { subcategory: 'Acute Coronary Syndrome' }
          ]
        },
        data: {
          subcategory: null,
          parent_category: null
        }
      });
      
      await prisma.medicalContent.updateMany({
        where: {
          AND: [
            { system: { not: 'Cardiovascular System' } },
            { subcategory: 'Acute Coronary Syndrome' }
          ]
        },
        data: {
          subcategory: null,
          parent_category: null
        }
      });
      
      console.log(`✅ Cleared ACS subcategory from ${toFix.length} non-cardiovascular conditions`);
    }
    
  } finally {
    await disconnectPrisma();
  }
}

clearACSFromNonCardiovascular().catch(console.error);
