import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('\n🔍 Verifying Data Normalization...\n');

  // Sample a few records to verify
  const samples = await prisma.medicalContent.findMany({
    take: 5,
    select: {
      conditionId: true,
      symptoms: true,
      complications: true,
      riskFactors: true,
    },
  });

  let successes = 0;
  let failures = 0;

  for (const record of samples) {
    console.log(`\n📋 ${record.conditionId}:`);

    for (const [field, value] of Object.entries(record)) {
      if (field === 'conditionId' || !value) continue;

      try {
        const parsed = JSON.parse(value as string);
        if (Array.isArray(parsed)) {
          console.log(`   ✅ ${field}: Valid JSON array (${parsed.length} items)`);
          successes++;
        } else {
          console.log(`   ⚠️  ${field}: Not an array`);
        }
      } catch (e) {
        console.log(`   ❌ ${field}: JSON.parse() failed`);
        console.log(`      First 50 chars: ${(value as string).substring(0, 50)}`);
        failures++;
      }
    }
  }

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   VERIFICATION SUMMARY                        ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`   ✅ Successful parses: ${successes}`);
  console.log(`   ❌ Failed parses: ${failures}`);
  console.log(
    `\n${failures === 0 ? '🎉 All data properly normalized!' : '⚠️  Some fields still need fixing'}\n`
  );

  await prisma.$disconnect();
}

verify().catch(console.error);
