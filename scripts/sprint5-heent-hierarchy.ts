#!/usr/bin/env tsx
/**
 * SPRINT 5: HEENT 4-Level Hierarchy Implementation
 *
 * Implements nested subcategories for Eyes, Ears, Nose, and Throat system:
 * - Eye Disorders → Conjunctiva, Cornea, Inflammatory, Lacrimal, Lid, Neuro-ophthalmologic, Orbital, Retinal, Vision Abnormalities
 * - Ear Disorders → External Ear, Inner Ear, Middle Ear, Hearing Impairment, Other
 * - Nose/Sinus Disorders
 * - Oropharyngeal Disorders → Infectious/Inflammatory, Salivary, Other
 * - Trauma (HEENT)
 * - Neoplasms (HEENT)
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

// HEENT 4-level hierarchy mapping
const HEENT_HIERARCHY: Record<string, { parent: string; keywords: string[] }> = {
  // Eye Disorders subcategories
  'Eye - Conjunctiva': {
    parent: 'Eye Disorders',
    keywords: ['conjunctivitis', 'conjunctiva'],
  },
  'Eye - Cornea': {
    parent: 'Eye Disorders',
    keywords: ['cataract', 'corneal', 'keratitis', 'pterygium'],
  },
  'Eye - Inflammatory': {
    parent: 'Eye Disorders',
    keywords: ['iritis', 'scleritis', 'uveitis'],
  },
  'Eye - Lacrimal': {
    parent: 'Eye Disorders',
    keywords: [
      'dacryoadenitis',
      'dacryocystitis',
      'dacryostenosis',
      'keratoconjunctivitis sicca',
      'dry eye',
    ],
  },
  'Eye - Lid': {
    parent: 'Eye Disorders',
    keywords: ['blepharitis', 'chalazion', 'ectropion', 'entropion', 'hordeolum', 'stye', 'eyelid'],
  },
  'Eye - Neuro-ophthalmologic': {
    parent: 'Eye Disorders',
    keywords: ['nystagmus', 'optic neuritis', 'papilledema'],
  },
  'Eye - Orbital': {
    parent: 'Eye Disorders',
    keywords: ['orbital cellulitis', 'periorbital cellulitis', 'preseptal cellulitis'],
  },
  'Eye - Retinal': {
    parent: 'Eye Disorders',
    keywords: [
      'macular degeneration',
      'retinal detachment',
      'retinopathy',
      'retinal vascular occlusion',
      'retina',
    ],
  },
  'Eye - Vision Abnormalities': {
    parent: 'Eye Disorders',
    keywords: ['amaurosis fugax', 'amblyopia', 'glaucoma', 'strabismus', 'presbyopia', 'vision'],
  },

  // Ear Disorders subcategories
  'Ear - External': {
    parent: 'Ear Disorders',
    keywords: ['cerumen impaction', 'otitis externa', "swimmer's ear", 'external ear'],
  },
  'Ear - Inner': {
    parent: 'Ear Disorders',
    keywords: ['acoustic neuroma', 'eustachian tube', 'labyrinthitis', 'vertigo', 'inner ear'],
  },
  'Ear - Middle': {
    parent: 'Ear Disorders',
    keywords: [
      'cholesteatoma',
      'otitis media',
      'otosclerosis',
      'tympanic membrane perforation',
      'middle ear',
    ],
  },
  'Ear - Hearing Impairment': {
    parent: 'Ear Disorders',
    keywords: [
      'conductive hearing loss',
      'sensorineural hearing loss',
      'hearing loss',
      'hearing impairment',
    ],
  },
  'Ear - Other': {
    parent: 'Ear Disorders',
    keywords: ['mastoiditis', 'meniere disease', 'tinnitus'],
  },

  // Oropharyngeal Disorders subcategories
  'Oropharyngeal - Infectious/Inflammatory': {
    parent: 'Oropharyngeal Disorders',
    keywords: [
      'angioedema',
      'aphthous ulcer',
      'candidiasis',
      'thrush',
      'deep neck infection',
      'dental abscess',
      'dental caries',
      'epiglottitis',
      'gingivitis',
      'laryngitis',
      'peritonsillar abscess',
      'pharyngitis',
      'tonsillitis',
      'throat',
    ],
  },
  'Oropharyngeal - Salivary': {
    parent: 'Oropharyngeal Disorders',
    keywords: ['parotitis', 'sialadenitis', 'salivary'],
  },
  'Oropharyngeal - Other': {
    parent: 'Oropharyngeal Disorders',
    keywords: ['leukoplakia'],
  },
};

// Top-level HEENT subcategories (level 2)
const TOP_LEVEL_HEENT = [
  'Eye Disorders',
  'Ear Disorders',
  'Nose/Sinus Disorders',
  'Oropharyngeal Disorders',
  'Trauma (HEENT)',
  'Neoplasms (HEENT)',
];

interface ConditionUpdate {
  id: string;
  name: string;
  currentSubcategory: string | null;
  newSubcategory: string;
  newParentCategory: string;
}

async function categorizeHEENTConditions() {
  console.log('🔍 SPRINT 5: HEENT 4-Level Hierarchy\n');

  // Get all HEENT conditions
  const heentConditions = await prisma.condition.findMany({
    where: {
      system: 'HEENT',
    },
    select: {
      id: true,
      name: true,
      subcategory: true,
      parent_category: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${heentConditions.length} HEENT conditions\n`);

  const updates: ConditionUpdate[] = [];
  const stats = {
    eye: 0,
    ear: 0,
    nose: 0,
    oropharyngeal: 0,
    trauma: 0,
    neoplasm: 0,
    uncategorized: 0,
  };

  for (const condition of heentConditions) {
    const nameLower = condition.name.toLowerCase();
    let matched = false;

    // Check for 4-level hierarchy matches (Eye - Cornea, Ear - Middle, etc.)
    for (const [subcategory, config] of Object.entries(HEENT_HIERARCHY)) {
      for (const keyword of config.keywords) {
        if (nameLower.includes(keyword.toLowerCase())) {
          // Only update if not already correctly categorized
          if (
            condition.subcategory !== subcategory ||
            condition.parent_category !== config.parent
          ) {
            updates.push({
              id: condition.id,
              name: condition.name,
              currentSubcategory: condition.subcategory,
              newSubcategory: subcategory,
              newParentCategory: config.parent,
            });
          }

          if (subcategory.startsWith('Eye')) stats.eye++;
          else if (subcategory.startsWith('Ear')) stats.ear++;
          else if (subcategory.startsWith('Oropharyngeal')) stats.oropharyngeal++;

          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // Check for top-level matches (no 4-level nesting)
    if (!matched) {
      if (
        nameLower.includes('nose') ||
        nameLower.includes('sinus') ||
        nameLower.includes('epistaxis') ||
        nameLower.includes('nasal') ||
        nameLower.includes('rhinitis')
      ) {
        if (condition.subcategory !== 'Nose/Sinus Disorders') {
          updates.push({
            id: condition.id,
            name: condition.name,
            currentSubcategory: condition.subcategory,
            newSubcategory: 'Nose/Sinus Disorders',
            newParentCategory: null!,
          });
        }
        stats.nose++;
        matched = true;
      } else if (
        nameLower.includes('trauma') ||
        nameLower.includes('fracture') ||
        nameLower.includes('barotrauma') ||
        nameLower.includes('hyphema') ||
        nameLower.includes('globe rupture') ||
        nameLower.includes('foreign bod')
      ) {
        if (condition.subcategory !== 'Trauma (HEENT)') {
          updates.push({
            id: condition.id,
            name: condition.name,
            currentSubcategory: condition.subcategory,
            newSubcategory: 'Trauma (HEENT)',
            newParentCategory: null!,
          });
        }
        stats.trauma++;
        matched = true;
      } else if (
        nameLower.includes('neoplasm') ||
        nameLower.includes('tumor') ||
        nameLower.includes('cancer') ||
        nameLower.includes('carcinoma')
      ) {
        if (condition.subcategory !== 'Neoplasms (HEENT)') {
          updates.push({
            id: condition.id,
            name: condition.name,
            currentSubcategory: condition.subcategory,
            newSubcategory: 'Neoplasms (HEENT)',
            newParentCategory: null!,
          });
        }
        stats.neoplasm++;
        matched = true;
      }
    }

    if (!matched) {
      stats.uncategorized++;
    }
  }

  console.log('📊 Categorization Statistics:\n');
  console.log(`  Eye Disorders: ${stats.eye} conditions`);
  console.log(`  Ear Disorders: ${stats.ear} conditions`);
  console.log(`  Oropharyngeal Disorders: ${stats.oropharyngeal} conditions`);
  console.log(`  Nose/Sinus Disorders: ${stats.nose} conditions`);
  console.log(`  Trauma (HEENT): ${stats.trauma} conditions`);
  console.log(`  Neoplasms (HEENT): ${stats.neoplasm} conditions`);
  console.log(`  Uncategorized: ${stats.uncategorized} conditions\n`);

  console.log(`📝 Updates Needed: ${updates.length}\n`);

  if (updates.length > 0) {
    console.log('Sample Updates (first 10):');
    updates.slice(0, 10).forEach((u) => {
      console.log(`  ${u.name}`);
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
          parent_category: update.newParentCategory || null,
        },
      });

      await prisma.medicalContent.updateMany({
        where: { conditionId: update.id },
        data: {
          subcategory: update.newSubcategory,
          parent_category: update.newParentCategory || null,
        },
      });
    }

    console.log(`✅ Applied ${updates.length} updates\n`);
  } else {
    console.log('✅ All conditions already correctly categorized\n');
  }

  // Verification
  console.log('🔍 Verification:');
  const with4Level = await prisma.condition.count({
    where: {
      system: 'HEENT',
      parent_category: { not: null },
    },
  });

  const byParent = await prisma.condition.groupBy({
    by: ['parent_category', 'subcategory'],
    _count: { _all: true },
    where: {
      system: 'HEENT',
      parent_category: { not: null },
    },
  });

  console.log(`  Conditions with 4-level hierarchy: ${with4Level}`);
  console.log('  Distribution:');
  byParent.forEach((g) => {
    console.log(`    ${g.parent_category} → ${g.subcategory}: ${g._count._all} conditions`);
  });
}

async function main() {
  try {
    await categorizeHEENTConditions();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

main().catch(console.error);
