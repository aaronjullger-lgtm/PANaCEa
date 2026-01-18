import { prisma, disconnectPrisma } from './helpers/prisma-client';

async function getSubcategoriesBySystem() {
  const result = await prisma.condition.groupBy({
    by: ['system', 'subcategory'],
    _count: { _all: true },
    where: { subcategory: { not: null } },
    orderBy: { system: 'asc' },
  });

  const bySystem: Record<string, Set<string>> = {};

  for (const r of result) {
    if (!bySystem[r.system]) {
      bySystem[r.system] = new Set();
    }
    if (r.subcategory) {
      bySystem[r.system].add(r.subcategory);
    }
  }

  console.log('=== SUBCATEGORIES BY SYSTEM ===\n');

  for (const [system, subcatsSet] of Object.entries(bySystem).sort()) {
    const subcats = Array.from(subcatsSet).sort();
    console.log(`${system}:`);
    subcats.forEach((s) => console.log(`  - ${s}`));
    console.log();
  }

  await disconnectPrisma();
}

getSubcategoriesBySystem().catch(console.error);
