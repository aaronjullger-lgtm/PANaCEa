import { prisma, disconnectPrisma } from './helpers/prisma-client';

async function clearIncorrectParents() {
  try {
    // Find all conditions with incorrect parent_category assignments
    const toFix = await prisma.condition.findMany({
      where: {
        AND: [
          { system: { not: 'CV' } },
          { parent_category: 'Coronary Artery Disease' }
        ]
      },
      select: { id: true, name: true, system: true, parent_category: true }
    });
    
    console.log(`Found ${toFix.length} conditions to fix`);
    console.log('Sample:', toFix.slice(0, 5).map(c => `${c.name} (${c.system})`));
    
    // Clear parent_category in Condition table
    const conditionResult = await prisma.condition.updateMany({
      where: {
        AND: [
          { system: { not: 'CV' } },
          { parent_category: 'Coronary Artery Disease' }
        ]
      },
      data: { parent_category: null }
    });
    
    console.log(`✅ Cleared ${conditionResult.count} parent_category values in Condition table`);
    
    // Clear parent_category in MedicalContent table
    const contentResult = await prisma.medicalContent.updateMany({
      where: {
        AND: [
          { system: { not: 'CV' } },
          { parent_category: 'Coronary Artery Disease' }
        ]
      },
      data: { parent_category: null }
    });
    
    console.log(`✅ Cleared ${contentResult.count} parent_category values in MedicalContent table`);
    
    // Verify no cross-system contamination remains
    const remaining = await prisma.condition.count({
      where: {
        AND: [
          { system: { not: 'CV' } },
          { parent_category: 'Coronary Artery Disease' }
        ]
      }
    });
    
    if (remaining === 0) {
      console.log('✅ All incorrect parent categories cleared');
    } else {
      console.log(`⚠️  ${remaining} conditions still have incorrect parent categories`);
    }
    
  } finally {
    await disconnectPrisma();
  }
}

clearIncorrectParents().catch(console.error);
