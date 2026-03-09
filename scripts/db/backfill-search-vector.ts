#!/usr/bin/env tsx
/**
 * Backfill MedicalContent.search_vector for rows where it is NULL.
 * Uses the same expression as the trigger in prisma/migrations/20260204120002_baseline_loose_sql/migration.sql.
 *
 * Usage:
 *   npx tsx scripts/db/backfill-search-vector.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

const BACKFILL_SQL = `
UPDATE "MedicalContent" SET search_vector =
  setweight(to_tsvector('english', COALESCE(condition, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(buzzwords, ' '), '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(classic_patient, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(symptoms, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(gold_standard_dx, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(first_line_rx, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(overview, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(diagnostics, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(treatment, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(pathophysiology, '')), 'D') ||
  setweight(to_tsvector('english', COALESCE(etiology, '')), 'D')
WHERE search_vector IS NULL
`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('MedicalContent search_vector backfill\n');

  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "MedicalContent" WHERE search_vector IS NULL
  `;
  const nullCount = Number(countResult[0].count);

  if (nullCount === 0) {
    console.log('No rows with NULL search_vector. Nothing to do.');
    return;
  }

  console.log(`Found ${nullCount} row(s) with NULL search_vector.`);

  if (dryRun) {
    console.log('Dry run: not applying UPDATE. Run without --dry-run to backfill.');
    return;
  }

  const result = await prisma.$executeRawUnsafe(BACKFILL_SQL);
  console.log(`Updated ${result} row(s).`);

  const afterResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "MedicalContent" WHERE search_vector IS NULL
  `;
  const remaining = Number(afterResult[0].count);
  if (remaining > 0) {
    console.warn(`Warning: ${remaining} row(s) still have NULL search_vector.`);
  } else {
    console.log('All rows now have search_vector set.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
