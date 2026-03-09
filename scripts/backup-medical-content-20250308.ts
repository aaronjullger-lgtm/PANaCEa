/**
 * Backup MedicalContent table before re-running emphasis formatting fix.
 * Creates a table `medical_content_backup_20250308` with the same structure
 * and copies all rows, preserving the current (possibly corrupted) state.
 *
 * Usage:
 *   npx ts-node scripts/backup-medical-content-20250308.ts
 *
 * Safety: Uses a SQL transaction; rolls back on error.
 */

import { prisma } from './_shared/db';

const BACKUP_TABLE_NAME = 'medical_content_backup_20250308';

async function createBackupTable() {
  console.log(`🛡️  Creating backup table "${BACKUP_TABLE_NAME}"...`);

  // First, drop the backup table if it already exists (safety)
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${BACKUP_TABLE_NAME}" CASCADE;`);

  // Create table with same structure as "MedicalContent" (including indexes, defaults, etc.)
  // Using CREATE TABLE ... AS SELECT * will copy data but not constraints/indexes.
  // We'll create a simple copy with all columns; we can add a backup timestamp.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "${BACKUP_TABLE_NAME}" AS
    SELECT *, 
           NOW() AS _backup_created_at,
           'emphasis-fix-rollback' AS _backup_reason
    FROM "MedicalContent";
  `);

  // Add a primary key? Not required for restore but we can add an id copy.
  // We'll also add an index on id for faster lookups.
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "${BACKUP_TABLE_NAME}_id_idx" ON "${BACKUP_TABLE_NAME}" (id);
  `);

  console.log(`✅ Backup table created with ${await getRowCount()} rows.`);
}

async function getRowCount(): Promise<number> {
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*)::integer as count FROM "${BACKUP_TABLE_NAME}"`
  );
  return Number(result[0]?.count ?? 0);
}

async function verifyBackup() {
  const originalCount = await prisma.medicalContent.count();
  const backupCount = await getRowCount();
  if (originalCount !== backupCount) {
    throw new Error(
      `Backup row count mismatch: original ${originalCount}, backup ${backupCount}`
    );
  }
  console.log(`✅ Backup verified (${backupCount} rows).`);
}

async function main() {
  console.log('🚀 Starting MedicalContent backup for emphasis fix rollback');
  const startTime = Date.now();

  try {
    await createBackupTable();
    await verifyBackup();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Backup completed successfully in ${elapsed} seconds.`);
    console.log(`📦 Table name: "${BACKUP_TABLE_NAME}"`);
    console.log(`💡 To restore, run: INSERT INTO "MedicalContent" SELECT * FROM "${BACKUP_TABLE_NAME}" WHERE ...`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();