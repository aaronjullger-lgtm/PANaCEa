/**
 * Rollback MedicalContent table from backup created by backup-medical-content-20250308.ts.
 * This script copies all rows from the backup table back to MedicalContent,
 * overwriting existing rows (by deleting and reinserting).
 *
 * WARNING: This will overwrite any changes made to MedicalContent after the backup.
 * Use only if the emphasis formatting update introduced errors.
 *
 * Usage:
 *   npx tsx scripts/rollback-medical-content-from-backup.ts
 *
 * Safety: Uses a SQL transaction; rolls back on error.
 */

import { prisma } from './_shared/db';

const BACKUP_TABLE_NAME = 'medical_content_backup_20250308';

async function checkBackupExists(): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = $1
     )`,
    BACKUP_TABLE_NAME
  );
  return result[0]?.exists ?? false;
}

async function getBackupColumns(): Promise<string[]> {
  // Get column names excluding added backup metadata columns
  const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name NOT IN ('_backup_created_at', '_backup_reason')
     ORDER BY ordinal_position`,
    BACKUP_TABLE_NAME
  );
  return result.map(row => row.column_name);
}

async function rollback() {
  console.log(`🛡️  Starting rollback from backup table "${BACKUP_TABLE_NAME}"...`);

  const backupExists = await checkBackupExists();
  if (!backupExists) {
    throw new Error(`Backup table "${BACKUP_TABLE_NAME}" does not exist.`);
  }

  const columns = await getBackupColumns();
  if (columns.length === 0) {
    throw new Error('No columns found in backup table (excluding metadata).');
  }
  console.log(`📋 Found ${columns.length} columns to copy.`);

  const columnsQuoted = columns.map(col => `"${col}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Begin transaction
  await prisma.$executeRawUnsafe('BEGIN');

  try {
    // Delete all rows from MedicalContent (optional: we could upsert)
    console.log('🗑️  Clearing current MedicalContent rows...');
    await prisma.$executeRawUnsafe('DELETE FROM "MedicalContent"');

    // Insert from backup
    console.log(`📥 Inserting rows from backup...`);
    const insertSql = `
      INSERT INTO "MedicalContent" (${columnsQuoted})
      SELECT ${columnsQuoted} FROM "${BACKUP_TABLE_NAME}"
    `;
    await prisma.$executeRawUnsafe(insertSql);

    // Commit transaction
    await prisma.$executeRawUnsafe('COMMIT');
    console.log('✅ Rollback transaction committed.');

    // Verify counts
    const backupCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*)::integer as count FROM "${BACKUP_TABLE_NAME}"`
    );
    const medicalCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*)::integer as count FROM "MedicalContent"`
    );
    console.log(`📊 Backup row count: ${backupCount[0].count}`);
    console.log(`📊 MedicalContent row count: ${medicalCount[0].count}`);
    if (backupCount[0].count !== medicalCount[0].count) {
      console.warn('⚠️  Row count mismatch after rollback!');
    } else {
      console.log('✅ Row counts match.');
    }
  } catch (error) {
    await prisma.$executeRawUnsafe('ROLLBACK');
    console.error('❌ Rollback failed, transaction rolled back.');
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting MedicalContent rollback from backup');
  const startTime = Date.now();

  try {
    await rollback();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Rollback completed successfully in ${elapsed} seconds.`);
    console.log(`💡 Backup table "${BACKUP_TABLE_NAME}" remains unchanged.`);
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();