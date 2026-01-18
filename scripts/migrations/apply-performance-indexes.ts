/**
 * Apply Performance Indexes
 * Run with: npx tsx scripts/migrations/apply-performance-indexes.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function applyIndexes() {
  console.log('📊 Applying performance indexes...\n');

  const sqlPath = path.join(
    __dirname,
    '../../prisma/migrations/20260105_add_performance_indexes/migration.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      // Remove comments and empty lines
      const lines = s.split('\n').filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });
      return lines.length > 0;
    })
    .map((s) => {
      // Remove comments from multi-line statements
      return s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
    });

  let successCount = 0;
  let skipCount = 0;

  for (const statement of statements) {
    if (statement.length === 0) continue;

    try {
      await prisma.$executeRawUnsafe(statement);

      // Extract operation type
      if (statement.toUpperCase().includes('CREATE INDEX')) {
        const indexName = statement.match(/"([^"]+)"_idx/)?.[1] || 'index';
        console.log(`  ✅ Created index: ${indexName}_idx`);
      } else if (statement.toUpperCase().includes('CREATE EXTENSION')) {
        console.log(`  ✅ Enabled extension: pg_trgm`);
      } else if (statement.toUpperCase().startsWith('ANALYZE')) {
        const tableName = statement.match(/ANALYZE\s+"?([^"\s]+)"?/i)?.[1];
        console.log(`  ✅ Analyzed: ${tableName}`);
      }
      successCount++;
    } catch (error: any) {
      if (error.code === 'P2010' && error.meta?.message?.includes('already exists')) {
        skipCount++;
      } else if (error.meta?.code === '42P07') {
        // Index already exists
        skipCount++;
      } else if (error.meta?.code === '42710') {
        // Extension already exists
        skipCount++;
      } else {
        console.error(`  ❌ Error:`, error.meta?.message || error.message);
      }
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`  ✅ Successfully applied: ${successCount}`);
  console.log(`  ⏭️  Skipped (exists): ${skipCount}`);
  console.log(`\n✨ Performance optimization complete!`);
}

applyIndexes()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
