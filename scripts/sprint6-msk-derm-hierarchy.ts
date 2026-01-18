#!/usr/bin/env tsx
/**
 * SPRINT 6: MSK & Dermatology 4-Level Hierarchy Implementation
 *
 * MSK: Anatomic region-based nested subcategories
 * - Chest/Rib Disorders
 * - Lower Extremity Disorders (hip, knee, ankle, foot)
 * - Spinal Disorders (cervical, thoracic, lumbar, sacral)
 * - Upper Extremity Disorders (shoulder, elbow, wrist, hand)
 *
 * Dermatology: Organism type-based nested subcategories
 * - Infectious Diseases → Bacterial, Fungal, Parasitic, Viral
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

// MSK 4-level hierarchy (anatomic regions)
const MSK_HIERARCHY: Record<string, { parent: string; keywords: string[] }> = {
  // Lower Extremity - specific regions
  'Lower Extremity - Hip': {
    parent: 'Lower Extremity Disorders',
    keywords: ['hip', 'femoral', 'acetabular', 'slipped capital femoral'],
  },
  'Lower Extremity - Knee': {
    parent: 'Lower Extremity Disorders',
    keywords: [
      'knee',
      'patella',
      'meniscus',
      'acl',
      'pcl',
      'mcl',
      'lcl',
      'osgood-schlatter',
      'extensor mechanism',
    ],
  },
  'Lower Extremity - Ankle/Foot': {
    parent: 'Lower Extremity Disorders',
    keywords: ['ankle', 'foot', 'tarsal', 'metatarsal', 'achilles', 'plantar'],
  },

  // Upper Extremity - specific regions
  'Upper Extremity - Shoulder': {
    parent: 'Upper Extremity Disorders',
    keywords: [
      'shoulder',
      'clavicle',
      'scapula',
      'acromioclavicular',
      'rotator cuff',
      'glenohumeral',
    ],
  },
  'Upper Extremity - Elbow': {
    parent: 'Upper Extremity Disorders',
    keywords: ['elbow', 'olecranon', 'epicondyle', 'tennis elbow', "golfer's elbow"],
  },
  'Upper Extremity - Wrist/Hand': {
    parent: 'Upper Extremity Disorders',
    keywords: [
      'wrist',
      'hand',
      'carpal',
      'metacarpal',
      'phalange',
      'finger',
      'thumb',
      'scaphoid',
      'boxer',
    ],
  },

  // Spinal - specific regions
  'Spinal - Cervical': {
    parent: 'Spinal Disorders',
    keywords: ['cervical', 'neck', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'torticollis'],
  },
  'Spinal - Thoracic': {
    parent: 'Spinal Disorders',
    keywords: [
      'thoracic spine',
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
      't8',
      't9',
      't10',
      't11',
      't12',
      'kyphosis',
    ],
  },
  'Spinal - Lumbar': {
    parent: 'Spinal Disorders',
    keywords: ['lumbar', 'l1', 'l2', 'l3', 'l4', 'l5', 'low back', 'spondylo'],
  },
  'Spinal - Sacral': {
    parent: 'Spinal Disorders',
    keywords: ['sacral', 'sacrum', 'coccyx', 's1', 's2', 's3', 's4', 's5'],
  },
};

// Dermatology 4-level hierarchy (organism types)
const DERM_HIERARCHY: Record<string, { parent: string; keywords: string[] }> = {
  'Infectious - Bacterial': {
    parent: 'Infectious Diseases',
    keywords: [
      'cellulitis',
      'erysipelas',
      'impetigo',
      'folliculitis',
      'furuncle',
      'carbuncle',
      'abscess',
      'bacterial',
    ],
  },
  'Infectious - Fungal': {
    parent: 'Infectious Diseases',
    keywords: ['candidiasis', 'dermatophyte', 'tinea', 'onychomycosis', 'fungal', 'yeast'],
  },
  'Infectious - Parasitic': {
    parent: 'Infectious Diseases',
    keywords: ['lice', 'scabies', 'pediculosis', 'parasitic'],
  },
  'Infectious - Viral': {
    parent: 'Infectious Diseases',
    keywords: [
      'condyloma',
      'exanthem',
      'hand-foot-and-mouth',
      'herpes',
      'molluscum',
      'varicella',
      'zoster',
      'verruca',
      'wart',
      'viral',
      'hpv',
    ],
  },
};

interface ConditionUpdate {
  id: string;
  name: string;
  system: string;
  currentSubcategory: string | null;
  newSubcategory: string;
  newParentCategory: string | null;
}

async function categorizeMSKDermConditions() {
  console.log('🔍 SPRINT 6: MSK & Dermatology 4-Level Hierarchy\n');

  // Get MSK and Derm conditions
  const conditions = await prisma.condition.findMany({
    where: {
      OR: [{ system: 'MSK' }, { system: 'DERM' }],
    },
    select: {
      id: true,
      name: true,
      system: true,
      subcategory: true,
      parent_category: true,
    },
    orderBy: [{ system: 'asc' }, { name: 'asc' }],
  });

  console.log(`Found ${conditions.length} conditions (MSK + Derm)\n`);

  const updates: ConditionUpdate[] = [];
  const stats = {
    msk: { lowerExt: 0, upperExt: 0, spinal: 0, chestRib: 0, other: 0 },
    derm: { bacterial: 0, fungal: 0, parasitic: 0, viral: 0 },
  };

  for (const condition of conditions) {
    const nameLower = condition.name.toLowerCase();
    let matched = false;

    if (condition.system === 'Musculoskeletal System') {
      // Check for MSK 4-level matches
      for (const [subcategory, config] of Object.entries(MSK_HIERARCHY)) {
        for (const keyword of config.keywords) {
          if (nameLower.includes(keyword.toLowerCase())) {
            if (
              condition.subcategory !== subcategory ||
              condition.parent_category !== config.parent
            ) {
              updates.push({
                id: condition.id,
                name: condition.name,
                system: condition.system,
                currentSubcategory: condition.subcategory,
                newSubcategory: subcategory,
                newParentCategory: config.parent,
              });
            }

            if (subcategory.includes('Lower Extremity')) stats.msk.lowerExt++;
            else if (subcategory.includes('Upper Extremity')) stats.msk.upperExt++;
            else if (subcategory.includes('Spinal')) stats.msk.spinal++;

            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      // Check for Chest/Rib
      if (
        !matched &&
        (nameLower.includes('chest') || nameLower.includes('rib') || nameLower.includes('sternum'))
      ) {
        if (condition.subcategory !== 'Chest/Rib Disorders') {
          updates.push({
            id: condition.id,
            name: condition.name,
            system: condition.system,
            currentSubcategory: condition.subcategory,
            newSubcategory: 'Chest/Rib Disorders',
            newParentCategory: null,
          });
        }
        stats.msk.chestRib++;
        matched = true;
      }

      if (!matched) stats.msk.other++;
    } else if (condition.system === 'Dermatologic System') {
      // Check for Derm 4-level matches
      for (const [subcategory, config] of Object.entries(DERM_HIERARCHY)) {
        for (const keyword of config.keywords) {
          if (nameLower.includes(keyword.toLowerCase())) {
            if (
              condition.subcategory !== subcategory ||
              condition.parent_category !== config.parent
            ) {
              updates.push({
                id: condition.id,
                name: condition.name,
                system: condition.system,
                currentSubcategory: condition.subcategory,
                newSubcategory: subcategory,
                newParentCategory: config.parent,
              });
            }

            if (subcategory.includes('Bacterial')) stats.derm.bacterial++;
            else if (subcategory.includes('Fungal')) stats.derm.fungal++;
            else if (subcategory.includes('Parasitic')) stats.derm.parasitic++;
            else if (subcategory.includes('Viral')) stats.derm.viral++;

            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }
  }

  console.log('📊 MSK Categorization:\n');
  console.log(`  Lower Extremity (detailed): ${stats.msk.lowerExt} conditions`);
  console.log(`  Upper Extremity (detailed): ${stats.msk.upperExt} conditions`);
  console.log(`  Spinal (detailed): ${stats.msk.spinal} conditions`);
  console.log(`  Chest/Rib: ${stats.msk.chestRib} conditions`);
  console.log(`  Other/Uncategorized: ${stats.msk.other} conditions\n`);

  console.log('📊 Dermatology Categorization:\n');
  console.log(`  Infectious - Bacterial: ${stats.derm.bacterial} conditions`);
  console.log(`  Infectious - Fungal: ${stats.derm.fungal} conditions`);
  console.log(`  Infectious - Parasitic: ${stats.derm.parasitic} conditions`);
  console.log(`  Infectious - Viral: ${stats.derm.viral} conditions\n`);

  console.log(`📝 Updates Needed: ${updates.length}\n`);

  if (updates.length > 0) {
    console.log('Sample Updates (first 15):');
    updates.slice(0, 15).forEach((u) => {
      console.log(`  ${u.name} (${u.system})`);
      console.log(`    Before: ${u.currentSubcategory || 'none'}`);
      console.log(
        `    After:  ${u.newParentCategory ? `${u.newParentCategory} → ` : ''}${u.newSubcategory}`
      );
    });
    console.log();

    // Apply updates
    console.log('🔄 Applying updates...');

    for (const update of updates) {
      await prisma.condition.update({
        where: { id: update.id },
        data: {
          subcategory: update.newSubcategory,
          parent_category: update.newParentCategory,
        },
      });

      await prisma.medicalContent.updateMany({
        where: { conditionId: update.id },
        data: {
          subcategory: update.newSubcategory,
          parent_category: update.newParentCategory,
        },
      });
    }

    console.log(`✅ Applied ${updates.length} updates\n`);
  } else {
    console.log('✅ All conditions already correctly categorized\n');
  }

  // Verification
  console.log('🔍 Verification:');

  const mskWith4Level = await prisma.condition.count({
    where: {
      system: 'MSK',
      parent_category: { not: null },
    },
  });

  const dermWith4Level = await prisma.condition.count({
    where: {
      system: 'DERM',
      parent_category: { not: null },
    },
  });

  console.log(`  MSK conditions with 4-level hierarchy: ${mskWith4Level}`);
  console.log(`  Derm conditions with 4-level hierarchy: ${dermWith4Level}\n`);

  const mskByParent = await prisma.condition.groupBy({
    by: ['parent_category', 'subcategory'],
    _count: { _all: true },
    where: {
      system: 'MSK',
      parent_category: { not: null },
    },
  });

  const dermByParent = await prisma.condition.groupBy({
    by: ['parent_category', 'subcategory'],
    _count: { _all: true },
    where: {
      system: 'DERM',
      parent_category: { not: null },
    },
  });

  if (mskByParent.length > 0) {
    console.log('  MSK Distribution:');
    mskByParent.forEach((g) => {
      console.log(`    ${g.parent_category} → ${g.subcategory}: ${g._count._all} conditions`);
    });
  }

  if (dermByParent.length > 0) {
    console.log('  Derm Distribution:');
    dermByParent.forEach((g) => {
      console.log(`    ${g.parent_category} → ${g.subcategory}: ${g._count._all} conditions`);
    });
  }
}

async function main() {
  try {
    await categorizeMSKDermConditions();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

main().catch(console.error);
