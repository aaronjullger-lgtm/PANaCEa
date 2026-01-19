#!/usr/bin/env npx tsx
/**
 * Imaging Study Splitter - Separates combined contrast studies
 *
 * Splits "with and without contrast" entries into separate orderable tests.
 * This allows each test to be independently orderable in patient encounters.
 *
 * Usage:
 *   npx tsx scripts/generators/imaging-study-splitter.ts --dry-run
 *   npx tsx scripts/generators/imaging-study-splitter.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

interface ImagingStudy {
  id: string;
  name: string;
  modality: string;
  bodyRegion: string | null;
  usesContrast: boolean;
  usesRadiation: boolean;
  description: string | null;
  indications: string[];
  contraindications: string[];
  panceYield: number | null;
  isHighYield: boolean;
  firstLineFor: string[];
  advantages: string[];
  limitations: string[];
  classicSigns: string[];
  clinicalPearls: string[];
}

// Standard contrast-specific contraindications
const CONTRAST_CONTRAINDICATIONS = [
  'Contrast allergy (premedicate if necessary)',
  'Renal insufficiency (eGFR <30 - relative)',
  'Pregnancy (relative)',
];

// MRI-specific contraindications
const MRI_CONTRAINDICATIONS = [
  'Pacemaker/ICD (non-MRI compatible)',
  'Cochlear implant',
  'Metallic foreign body in eye',
  'Severe claustrophobia',
  'First trimester pregnancy (relative for contrast)',
];

async function splitCombinedStudies(isDryRun: boolean) {
  console.log('\n🔧 Imaging Study Splitter\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No database changes\n');
  }

  // Find all "with and without" studies
  const combinedStudies = await prisma.imagingStudy.findMany({
    where: {
      OR: [{ name: { contains: 'with and without' } }, { name: { contains: 'without and with' } }],
    },
  });

  console.log(`Found ${combinedStudies.length} combined studies to split:\n`);

  let created = 0;
  let deleted = 0;

  for (const study of combinedStudies) {
    console.log(`  Processing: ${study.name}`);

    // Parse the base name
    let baseName = study.name
      .replace(/\s*\(with and without contrast\)/i, '')
      .replace(/\s*with and without contrast/i, '')
      .replace(/\s*without and with contrast/i, '')
      .replace(/\s*\(without and with contrast\)/i, '')
      .trim();

    // Create "without contrast" version
    const withoutContrastName = `${baseName} without Contrast`;
    const withContrastName = `${baseName} with Contrast`;

    // Prepare without contrast study
    const withoutContrastData = {
      name: withoutContrastName,
      modality: study.modality,
      bodyRegion: study.bodyRegion,
      usesContrast: false,
      usesRadiation: study.usesRadiation,
      description: study.description
        ? study.description.replace(/with (and without )?contrast/gi, 'without contrast')
        : null,
      indications: study.indications.filter((i) => !i.toLowerCase().includes('contrast-enhanced')),
      contraindications:
        study.modality === 'MRI'
          ? MRI_CONTRAINDICATIONS.filter((c) => !c.includes('contrast'))
          : study.contraindications.filter(
              (c) => !c.toLowerCase().includes('contrast') && !c.toLowerCase().includes('renal')
            ),
      panceYield: study.panceYield,
      isHighYield: study.isHighYield,
      firstLineFor: study.firstLineFor,
      advantages: [...study.advantages, 'No contrast risk'],
      limitations: [
        ...study.limitations.filter((l) => !l.toLowerCase().includes('contrast')),
        'Limited soft tissue characterization without contrast',
      ],
      classicSigns: study.classicSigns,
      clinicalPearls: study.clinicalPearls,
    };

    // Prepare with contrast study
    const withContrastData = {
      name: withContrastName,
      modality: study.modality,
      bodyRegion: study.bodyRegion,
      usesContrast: true,
      usesRadiation: study.usesRadiation,
      description: study.description
        ? study.description.replace(/without (and with )?contrast/gi, 'with contrast')
        : null,
      indications: study.indications,
      contraindications:
        study.modality === 'MRI'
          ? [
              ...MRI_CONTRAINDICATIONS,
              'Gadolinium contrast allergy',
              'Severe renal insufficiency (NSF risk)',
            ]
          : [
              ...CONTRAST_CONTRAINDICATIONS,
              ...(study.modality === 'CT' ? ['Metformin (hold 48h post-contrast)'] : []),
            ],
      panceYield: study.panceYield,
      isHighYield: study.isHighYield,
      firstLineFor: study.firstLineFor,
      advantages: [
        ...study.advantages,
        'Enhanced soft tissue contrast',
        'Better lesion characterization',
      ],
      limitations: [
        ...study.limitations,
        'Contrast risks',
        study.modality === 'MRI'
          ? 'Gadolinium risk in renal failure'
          : 'Iodinated contrast allergy risk',
      ],
      classicSigns: study.classicSigns,
      clinicalPearls: [
        ...study.clinicalPearls,
        study.modality === 'MRI'
          ? 'Check renal function before gadolinium - NSF risk if eGFR <30'
          : 'Check renal function and allergies before contrast',
      ],
    };

    if (isDryRun) {
      console.log(`    Would create: ${withoutContrastName}`);
      console.log(`    Would create: ${withContrastName}`);
      console.log(`    Would delete: ${study.name}`);
      created += 2;
      deleted += 1;
    } else {
      // Create without contrast version
      try {
        await prisma.imagingStudy.upsert({
          where: { name: withoutContrastName },
          create: { id: uuidv4(), ...withoutContrastData } as any,
          update: withoutContrastData,
        });
        console.log(`    ✅ Created: ${withoutContrastName}`);
        created++;
      } catch (e: any) {
        console.log(`    ⚠️ Failed: ${withoutContrastName} - ${e.message}`);
      }

      // Create with contrast version
      try {
        await prisma.imagingStudy.upsert({
          where: { name: withContrastName },
          create: { id: uuidv4(), ...withContrastData } as any,
          update: withContrastData,
        });
        console.log(`    ✅ Created: ${withContrastName}`);
        created++;
      } catch (e: any) {
        console.log(`    ⚠️ Failed: ${withContrastName} - ${e.message}`);
      }

      // Delete the combined study
      try {
        await prisma.imagingStudy.delete({
          where: { id: study.id },
        });
        console.log(`    🗑️ Deleted: ${study.name}`);
        deleted++;
      } catch (e: any) {
        console.log(`    ⚠️ Delete failed: ${study.name} - ${e.message}`);
      }
    }

    console.log('');
  }

  console.log(`\n📊 Summary: ${created} created, ${deleted} deleted\n`);
}

async function addMissingContrastVariants(isDryRun: boolean) {
  console.log('\n🔧 Adding Missing Contrast Variants\n');

  // Studies that should have both with and without contrast versions
  const studiesNeedingVariants = [
    // CT studies
    {
      baseName: 'CT Abdomen/Pelvis',
      modality: 'CT',
      bodyRegion: 'Abdomen/Pelvis',
      usesRadiation: true,
    },
    { baseName: 'CT Chest', modality: 'CT', bodyRegion: 'Chest', usesRadiation: true },
    { baseName: 'CT Head', modality: 'CT', bodyRegion: 'Head', usesRadiation: true },
    { baseName: 'CT Neck', modality: 'CT', bodyRegion: 'Neck', usesRadiation: true },
    {
      baseName: 'CT Spine (Cervical)',
      modality: 'CT',
      bodyRegion: 'Cervical Spine',
      usesRadiation: true,
    },
    {
      baseName: 'CT Spine (Thoracic)',
      modality: 'CT',
      bodyRegion: 'Thoracic Spine',
      usesRadiation: true,
    },
    {
      baseName: 'CT Spine (Lumbar)',
      modality: 'CT',
      bodyRegion: 'Lumbar Spine',
      usesRadiation: true,
    },
    { baseName: 'CT Extremity', modality: 'CT', bodyRegion: 'Extremity', usesRadiation: true },
    { baseName: 'CT Pelvis', modality: 'CT', bodyRegion: 'Pelvis', usesRadiation: true },
    { baseName: 'CT Sinus', modality: 'CT', bodyRegion: 'Sinus', usesRadiation: true },
    { baseName: 'CT Orbits', modality: 'CT', bodyRegion: 'Orbits', usesRadiation: true },
    {
      baseName: 'CT Temporal Bones',
      modality: 'CT',
      bodyRegion: 'Temporal Bones',
      usesRadiation: true,
    },

    // MRI studies
    { baseName: 'MRI Brain', modality: 'MRI', bodyRegion: 'Head', usesRadiation: false },
    {
      baseName: 'MRI Cervical Spine',
      modality: 'MRI',
      bodyRegion: 'Cervical Spine',
      usesRadiation: false,
    },
    {
      baseName: 'MRI Thoracic Spine',
      modality: 'MRI',
      bodyRegion: 'Thoracic Spine',
      usesRadiation: false,
    },
    {
      baseName: 'MRI Lumbar Spine',
      modality: 'MRI',
      bodyRegion: 'Lumbar Spine',
      usesRadiation: false,
    },
    { baseName: 'MRI Pelvis', modality: 'MRI', bodyRegion: 'Pelvis', usesRadiation: false },
    { baseName: 'MRI Shoulder', modality: 'MRI', bodyRegion: 'Shoulder', usesRadiation: false },
    { baseName: 'MRI Knee', modality: 'MRI', bodyRegion: 'Knee', usesRadiation: false },
    { baseName: 'MRI Hip', modality: 'MRI', bodyRegion: 'Hip', usesRadiation: false },
    { baseName: 'MRI Ankle', modality: 'MRI', bodyRegion: 'Ankle', usesRadiation: false },
    { baseName: 'MRI Wrist', modality: 'MRI', bodyRegion: 'Wrist', usesRadiation: false },
    { baseName: 'MRI Elbow', modality: 'MRI', bodyRegion: 'Elbow', usesRadiation: false },
    { baseName: 'MRI Abdomen', modality: 'MRI', bodyRegion: 'Abdomen', usesRadiation: false },
    { baseName: 'MRI Liver', modality: 'MRI', bodyRegion: 'Liver', usesRadiation: false },
    { baseName: 'MRI Cardiac', modality: 'MRI', bodyRegion: 'Heart', usesRadiation: false },
    { baseName: 'MRI Breast', modality: 'MRI', bodyRegion: 'Breast', usesRadiation: false },
    { baseName: 'MRI Prostate', modality: 'MRI', bodyRegion: 'Prostate', usesRadiation: false },
  ];

  let created = 0;

  for (const study of studiesNeedingVariants) {
    const withoutName = `${study.baseName} without Contrast`;
    const withName = `${study.baseName} with Contrast`;

    // Check if without contrast version exists
    const existsWithout = await prisma.imagingStudy.findUnique({ where: { name: withoutName } });
    const existsWith = await prisma.imagingStudy.findUnique({ where: { name: withName } });

    if (!existsWithout) {
      const data = {
        name: withoutName,
        modality: study.modality,
        bodyRegion: study.bodyRegion,
        usesContrast: false,
        usesRadiation: study.usesRadiation,
        description: `${study.baseName} imaging study without contrast`,
        indications: [],
        contraindications:
          study.modality === 'MRI'
            ? MRI_CONTRAINDICATIONS.filter((c) => !c.includes('contrast'))
            : ['Pregnancy (relative)'],
        panceYield: 2,
        isHighYield: false,
        firstLineFor: [],
        advantages: [
          'No contrast risk',
          study.modality === 'MRI' ? 'No radiation' : 'Fast acquisition',
        ],
        limitations: ['Limited soft tissue characterization'],
        classicSigns: [],
        clinicalPearls: [],
      };

      if (isDryRun) {
        console.log(`  Would create: ${withoutName}`);
        created++;
      } else {
        try {
          await prisma.imagingStudy.create({
            data: { id: uuidv4(), ...data } as any,
          });
          console.log(`  ✅ Created: ${withoutName}`);
          created++;
        } catch (e: any) {
          if (!e.message.includes('Unique constraint')) {
            console.log(`  ⚠️ Failed: ${withoutName} - ${e.message}`);
          }
        }
      }
    }

    if (!existsWith) {
      const contrastAgent = study.modality === 'MRI' ? 'Gadolinium' : 'Iodinated';
      const data = {
        name: withName,
        modality: study.modality,
        bodyRegion: study.bodyRegion,
        usesContrast: true,
        usesRadiation: study.usesRadiation,
        description: `${study.baseName} imaging study with ${contrastAgent.toLowerCase()} contrast`,
        indications: [],
        contraindications:
          study.modality === 'MRI'
            ? [
                ...MRI_CONTRAINDICATIONS,
                'Gadolinium allergy',
                'Severe renal insufficiency (eGFR <30)',
              ]
            : [...CONTRAST_CONTRAINDICATIONS],
        panceYield: 2,
        isHighYield: false,
        firstLineFor: [],
        advantages: ['Enhanced soft tissue contrast', 'Better lesion characterization'],
        limitations: [`${contrastAgent} contrast risks`, 'Requires IV access'],
        classicSigns: [],
        clinicalPearls: [
          study.modality === 'MRI'
            ? 'Check renal function before gadolinium administration'
            : 'Check renal function and contrast allergies before ordering',
        ],
      };

      if (isDryRun) {
        console.log(`  Would create: ${withName}`);
        created++;
      } else {
        try {
          await prisma.imagingStudy.create({
            data: { id: uuidv4(), ...data } as any,
          });
          console.log(`  ✅ Created: ${withName}`);
          created++;
        } catch (e: any) {
          if (!e.message.includes('Unique constraint')) {
            console.log(`  ⚠️ Failed: ${withName} - ${e.message}`);
          }
        }
      }
    }
  }

  console.log(`\n📊 Summary: ${created} new studies created\n`);
}

async function analyzeState() {
  console.log('\n📊 Current Imaging Study State\n');

  const total = await prisma.imagingStudy.count();
  const withContrast = await prisma.imagingStudy.count({ where: { usesContrast: true } });
  const withoutContrast = await prisma.imagingStudy.count({ where: { usesContrast: false } });

  console.log(`  Total Studies: ${total}`);
  console.log(`  With Contrast: ${withContrast}`);
  console.log(`  Without Contrast: ${withoutContrast}`);

  const byModality = await prisma.imagingStudy.groupBy({
    by: ['modality'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n  By Modality:');
  for (const m of byModality) {
    console.log(`    ${m.modality}: ${m._count.id}`);
  }

  // Check for remaining combined studies
  const combined = await prisma.imagingStudy.count({
    where: {
      OR: [{ name: { contains: 'with and without' } }, { name: { contains: 'without and with' } }],
    },
  });

  if (combined > 0) {
    console.log(`\n  ⚠️ Combined studies remaining: ${combined}`);
  } else {
    console.log(`\n  ✅ All studies properly split into separate contrast variants`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze');
  const splitOnly = args.includes('--split-only');
  const addOnly = args.includes('--add-only');

  if (analyzeOnly) {
    await analyzeState();
    await prisma.$disconnect();
    return;
  }

  if (!splitOnly) {
    await splitCombinedStudies(isDryRun);
  }

  if (!addOnly) {
    await addMissingContrastVariants(isDryRun);
  }

  await analyzeState();
  await prisma.$disconnect();

  console.log('\n✨ Imaging Study Splitter complete!\n');
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
