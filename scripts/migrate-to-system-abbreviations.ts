import { prisma, disconnectPrisma } from './helpers/prisma-client';

// Map from full system names to abbreviations (matches constants.ts)
const SYSTEM_NAME_TO_ABBREVIATION: Record<string, string> = {
  'Cardiovascular System': 'CV',
  'Dermatologic System': 'DERM',
  'Endocrine System': 'ENDO',
  'Eyes, Ears, Nose, and Throat': 'HEENT',
  'Gastrointestinal System/Nutrition': 'GI',
  'Genitourinary System': 'GU',
  'Hematologic System': 'HEME',
  'Infectious Diseases': 'ID',
  'Musculoskeletal System': 'MSK',
  'Neurologic System': 'NEURO',
  'Psychiatry/Behavioral Science': 'PSYCH',
  'Pulmonary System': 'PULM',
  'Renal System': 'RENAL',
  'Reproductive System': 'REPRO',
  'Professional Practice': 'PRO',
};

async function migrateSystemsToAbbreviations() {
  console.log('🔄 Starting migration to system abbreviations...\n');

  try {
    // Step 1: Check current state
    console.log('📊 Current system distribution in Condition table:');
    const currentSystems = await prisma.condition.groupBy({
      by: ['system'],
      _count: true,
    });
    currentSystems.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count} conditions`);
    });

    console.log('\n📊 Current system distribution in MedicalContent table:');
    const currentContentSystems = await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: true,
    });
    currentContentSystems.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count} records`);
    });

    // Step 2: Verify all systems have mappings
    console.log('\n✅ Verifying system mappings:');
    const unmappedConditionSystems = currentSystems.filter(
      ({ system }) => !SYSTEM_NAME_TO_ABBREVIATION[system]
    );
    const unmappedContentSystems = currentContentSystems.filter(
      ({ system }) => !SYSTEM_NAME_TO_ABBREVIATION[system]
    );

    if (unmappedConditionSystems.length > 0 || unmappedContentSystems.length > 0) {
      console.error('❌ Found unmapped systems:');
      unmappedConditionSystems.forEach(({ system }) => {
        console.error(`  Condition: ${system}`);
      });
      unmappedContentSystems.forEach(({ system }) => {
        console.error(`  MedicalContent: ${system}`);
      });
      throw new Error('Cannot proceed - unmapped systems found');
    }
    console.log('  All systems have valid abbreviation mappings');

    // Step 3: Migrate Condition table
    console.log('\n🔧 Migrating Condition table:');
    let totalConditionsUpdated = 0;

    for (const [fullName, abbreviation] of Object.entries(SYSTEM_NAME_TO_ABBREVIATION)) {
      const count = await prisma.condition.updateMany({
        where: { system: fullName },
        data: { system: abbreviation },
      });

      if (count.count > 0) {
        console.log(`  ✓ ${fullName} → ${abbreviation}: ${count.count} conditions`);
        totalConditionsUpdated += count.count;
      }
    }

    // Step 4: Migrate MedicalContent table
    console.log('\n🔧 Migrating MedicalContent table:');
    let totalContentUpdated = 0;

    for (const [fullName, abbreviation] of Object.entries(SYSTEM_NAME_TO_ABBREVIATION)) {
      const count = await prisma.medicalContent.updateMany({
        where: { system: fullName },
        data: { system: abbreviation },
      });

      if (count.count > 0) {
        console.log(`  ✓ ${fullName} → ${abbreviation}: ${count.count} records`);
        totalContentUpdated += count.count;
      }
    }

    // Step 5: Verify migration
    console.log('\n📊 Post-migration system distribution in Condition table:');
    const newSystems = await prisma.condition.groupBy({
      by: ['system'],
      _count: true,
    });
    newSystems.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count} conditions`);
    });

    console.log('\n📊 Post-migration system distribution in MedicalContent table:');
    const newContentSystems = await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: true,
    });
    newContentSystems.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count} records`);
    });

    // Summary
    console.log('\n✅ Migration completed successfully!');
    console.log(`   - Condition table: ${totalConditionsUpdated} records updated`);
    console.log(`   - MedicalContent table: ${totalContentUpdated} records updated`);
    console.log(`   - All systems now use abbreviations (CV, HEENT, etc.)`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Run the migration
migrateSystemsToAbbreviations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
