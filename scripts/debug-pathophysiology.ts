import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

config();

function createPrismaClient() {
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL required');
  const isAccelerateUrl = databaseUrl.startsWith('prisma://');
  if (isAccelerateUrl) {
    const client = new PrismaClient({ accelerateUrl: databaseUrl });
    return client.$extends(withAccelerate());
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return client;
}

const prisma = createPrismaClient();

async function main() {
  const row = await prisma.medicalContent.findFirst({
    where: { condition: { contains: 'Acute Kidney Injury' } },
    select: { condition: true, pathophysiology: true },
  });
  if (!row || !row.pathophysiology) {
    console.log('No pathophysiology found');
    return;
  }
  console.log(`Condition: ${row.condition}`);
  console.log('='.repeat(80));
  const lines = row.pathophysiology.split('\n');
  lines.forEach((line, idx) => {
    console.log(`${idx + 1}: ${JSON.stringify(line)}`);
  });
  await prisma.$disconnect();
}

main().catch(console.error);