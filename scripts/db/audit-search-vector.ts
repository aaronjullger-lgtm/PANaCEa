#!/usr/bin/env tsx
/**
 * Audit MedicalContent.search_vector: count rows where search_vector IS NULL.
 * Use --fail to exit with code 1 when any nulls exist (e.g. in CI or pre-deploy).
 *
 * Usage:
 *   npx tsx scripts/db/audit-search-vector.ts
 *   npx tsx scripts/db/audit-search-vector.ts --fail
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

async function main() {
  const failOnNulls = process.argv.includes('--fail');

  const [nullResult, totalResult] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "MedicalContent" WHERE search_vector IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "MedicalContent"
    `,
  ]);

  const nullCount = Number(nullResult[0].count);
  const total = Number(totalResult[0].count);

  console.log(`MedicalContent: ${total} total, ${nullCount} with NULL search_vector`);

  if (nullCount > 0) {
    if (failOnNulls) {
      console.error('Failing: run scripts/db/backfill-search-vector.ts to backfill.');
      process.exit(1);
    }
    console.log('Run: npx tsx scripts/db/backfill-search-vector.ts');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
