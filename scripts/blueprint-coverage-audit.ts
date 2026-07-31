import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const accelerateUrl = process.env.DATABASE_URL;
if (!accelerateUrl) { console.error('DATABASE_URL not set'); process.exit(1); }
const PrismaAny = PrismaClient as any;
const prisma = new PrismaAny({ accelerateUrl }).$extends(withAccelerate());

async function main() {
  const bySystem = await prisma.question.groupBy({
    by: ['system'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  console.log('=== BY ORGAN SYSTEM (all) ===');
  for (const r of bySystem) {
    console.log(`${r.system || 'NULL'}: ${r._count.id}`);
  }

  const byCategory = await prisma.question.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  console.log('\n=== BY CATEGORY (all) ===');
  for (const r of byCategory) {
    console.log(`${r.category || 'NULL'}: ${r._count.id}`);
  }

  const byLifecycle = await prisma.question.groupBy({
    by: ['lifecycleStatus'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  console.log('\n=== BY LIFECYCLE STATUS ===');
  for (const r of byLifecycle) {
    console.log(`${r.lifecycleStatus}: ${r._count.id}`);
  }

  const total = await prisma.question.count();
  console.log(`\nTotal questions: ${total}`);
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
