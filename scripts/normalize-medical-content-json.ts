/**
 * Normalize MedicalContent JSON columns using lib/schemas/medicalContentFields
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/normalize-medical-content-json.ts
 * Requires DATABASE_URL in env.
 */

import { PrismaClient } from '@prisma/client';
import {
  classicTriadSchema,
  clinicalPearlsSchema,
  ageDemographicSchema,
  differentialsSchema,
  synonymsSchema,
  medicalContentContentSchema,
  parseMedicalContentField,
} from '../lib/schemas/medicalContentFields';

const prisma = new PrismaClient();

async function main() {
  const batchSize = 100;
  let updated = 0;
  let errors = 0;

  const total = await prisma.medicalContent.count();
  console.log(`Normalizing JSON fields for ${total} MedicalContent records...`);

  for (let skip = 0; skip < total; skip += batchSize) {
    const rows = await prisma.medicalContent.findMany({
      skip,
      take: batchSize,
      select: {
        id: true,
        conditionId: true,
        classic_triad: true,
        clinical_pearls: true,
        age_demographic: true,
        differentials: true,
        synonyms: true,
        content: true,
      },
    });

    for (const row of rows) {
      try {
        const classic_triad = parseMedicalContentField(
          row.classic_triad,
          classicTriadSchema,
          []
        ) as unknown as object;
        const clinical_pearls = parseMedicalContentField(
          row.clinical_pearls,
          clinicalPearlsSchema,
          []
        ) as unknown as object;
        const age_demographic = parseMedicalContentField(
          row.age_demographic,
          ageDemographicSchema,
          null
        ) as unknown as object | null;
        const differentials = parseMedicalContentField(
          row.differentials,
          differentialsSchema,
          []
        ) as unknown as object;
        const synonyms = parseMedicalContentField(
          row.synonyms,
          synonymsSchema,
          []
        ) as unknown as object;
        const content = row.content
          ? (medicalContentContentSchema.safeParse(row.content).success
              ? medicalContentContentSchema.parse(row.content)
              : row.content) as object
          : null;

        await prisma.medicalContent.update({
          where: { id: row.id },
          data: {
            classic_triad: classic_triad as any,
            clinical_pearls: clinical_pearls as any,
            age_demographic: age_demographic as any,
            differentials: differentials as any,
            synonyms: synonyms as any,
            content: content as any,
          },
        });
        updated++;
      } catch (e) {
        console.error(`Failed to normalize conditionId=${row.conditionId}:`, e);
        errors++;
      }
    }
  }

  console.log(`Done. Updated ${updated} records, ${errors} errors.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
