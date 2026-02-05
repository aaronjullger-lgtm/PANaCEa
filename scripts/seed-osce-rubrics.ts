/**
 * Seed CaseRubric for OSCE Patient Encounter cases that don't have one.
 * Builds checklist from essentialQuestions and idealWorkup (workup steps as red-flag items).
 *
 * Run: npx ts-node scripts/seed-osce-rubrics.ts
 * Or: npm run db:seed (if wired in package.json)
 *
 * Grading still works without rubrics via the API fallback (essentialQuestions + idealWorkup).
 * This script creates explicit CaseRubric rows for more consistent rubric-based grading.
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

type ChecklistItem = { item: string; isRedFlag?: boolean };

async function main() {
  console.log('Seeding OSCE Case Rubrics...\n');

  const casesWithoutRubric = await prisma.patientEncounterCase.findMany({
    where: { CaseRubric: null },
    select: {
      id: true,
      patientName: true,
      chiefComplaint: true,
      essentialQuestions: true,
      idealWorkup: true,
    },
  });

  if (casesWithoutRubric.length === 0) {
    console.log('No cases without a rubric. Exiting.');
    return;
  }

  console.log(`Found ${casesWithoutRubric.length} case(s) without a CaseRubric.\n`);

  for (const c of casesWithoutRubric) {
    const essential = Array.isArray(c.essentialQuestions) ? c.essentialQuestions : [];
    const workup = Array.isArray(c.idealWorkup) ? c.idealWorkup : [];

    const checklist: ChecklistItem[] = [
      ...essential.map((q) => ({ item: typeof q === 'string' ? q : String(q), isRedFlag: false })),
      ...workup.map((w) => ({ item: typeof w === 'string' ? w : String(w), isRedFlag: true })),
    ];

    if (checklist.length === 0) {
      checklist.push(
        { item: 'Obtain relevant history', isRedFlag: false },
        { item: 'Perform focused physical exam', isRedFlag: false },
        { item: 'Order appropriate workup', isRedFlag: true },
        { item: 'Document diagnosis and plan', isRedFlag: false }
      );
    }

    await prisma.caseRubric.upsert({
      where: { caseId: c.id },
      update: { checklist: checklist as object },
      create: {
        caseId: c.id,
        checklist: checklist as object,
      },
    });

    console.log(`✓ Rubric created/updated for: ${c.patientName} (${c.chiefComplaint.slice(0, 40)}...)`);
  }

  console.log(`\n✅ Seeded ${casesWithoutRubric.length} CaseRubric(s).`);
}

main()
  .catch((e) => {
    console.error('Error seeding OSCE rubrics:', e);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
