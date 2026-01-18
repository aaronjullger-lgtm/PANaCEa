#!/usr/bin/env npx tsx
/**
 * COMPREHENSIVE PANCE Image Gap Analysis
 *
 * Analyzes ALL conditions in the database against:
 * 1. NCCPA PANCE Blueprint weights (2024)
 * 2. Visual presentation importance
 * 3. Current image coverage
 *
 * Generates prioritized acquisition list for medical education images
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// NCCPA PANCE Blueprint 2024 - System Weights
const PANCE_BLUEPRINT_WEIGHTS = {
  CV: { weight: 16, name: 'Cardiovascular System', visual_importance: 'HIGH' },
  PULM: { weight: 12, name: 'Pulmonary System', visual_importance: 'MEDIUM' },
  GI: { weight: 10, name: 'Gastrointestinal/Nutritional', visual_importance: 'HIGH' },
  MSK: { weight: 10, name: 'Musculoskeletal', visual_importance: 'HIGH' },
  HEENT: { weight: 9, name: 'Eyes, Ears, Nose, Throat', visual_importance: 'CRITICAL' },
  REPRO: { weight: 8, name: 'Reproductive System', visual_importance: 'MEDIUM' },
  NEURO: { weight: 6, name: 'Neurologic System', visual_importance: 'HIGH' },
  PSYCH: { weight: 6, name: 'Psychiatry/Behavioral', visual_importance: 'LOW' },
  ENDO: { weight: 6, name: 'Endocrine System', visual_importance: 'MEDIUM' },
  GU: { weight: 6, name: 'Genitourinary System', visual_importance: 'MEDIUM' },
  DERM: { weight: 5, name: 'Dermatologic System', visual_importance: 'CRITICAL' },
  HEME: { weight: 3, name: 'Hematologic System', visual_importance: 'HIGH' },
  ID: { weight: 3, name: 'Infectious Disease', visual_importance: 'HIGH' },
  RENAL: { weight: 3, name: 'Renal System', visual_importance: 'MEDIUM' },
  OTHER: { weight: 3, name: 'Other/Pediatrics', visual_importance: 'MEDIUM' },
  PEDS: { weight: 2, name: 'Pediatrics', visual_importance: 'MEDIUM' },
  OB: { weight: 2, name: 'Obstetrics', visual_importance: 'MEDIUM' },
};

// Conditions that REQUIRE visual recognition for diagnosis
const VISUALLY_CRITICAL_CONDITIONS = new Set([
  // DERM - ALL dermatologic conditions are visual
  'psoriasis',
  'melanoma',
  'basal_cell',
  'squamous_cell',
  'actinic_keratosis',
  'seborrheic_keratosis',
  'tinea',
  'candidiasis',
  'scabies',
  'impetigo',
  'cellulitis',
  'erythema_multiforme',
  'stevens_johnson',
  'pemphigus',
  'bullous_pemphigoid',
  'dermatitis',
  'eczema',
  'urticaria',
  'angioedema',
  'vitiligo',
  'acanthosis',
  'rosacea',
  'acne',
  'alopecia',
  'herpes',
  'varicella',
  'shingles',
  'measles',
  'scarlet_fever',
  'erythema_nodosum',
  'erythema_migrans',
  'lichen_planus',
  'pityriasis',

  // HEENT - Eyes
  'diabetic_retinopathy',
  'hypertensive_retinopathy',
  'glaucoma',
  'cataract',
  'retinal_detachment',
  'macular_degeneration',
  'papilledema',
  'conjunctivitis',
  'keratitis',
  'corneal_ulcer',
  'corneal_foreign_body',
  'hyphema',
  'hypopyon',
  'pterygium',
  'pinguecula',
  'blepharitis',
  'chalazion',
  'hordeolum',
  'stye',
  'orbital_cellulitis',
  'periorbital_cellulitis',
  'subconjunctival_hemorrhage',

  // HEENT - Ear
  'otitis_externa',
  'otitis_media',
  'mastoiditis',
  'cholesteatoma',
  'tympanic_membrane_perforation',
  'auricular_hematoma',

  // HEENT - Oral
  'thrush',
  'leukoplakia',
  'aphthous',
  'gingivitis',
  'geographic_tongue',
  'black_hairy_tongue',
  'oral_candidiasis',
  'herpes_labialis',

  // MSK - Fractures & imaging
  'fracture',
  'dislocation',
  'osteomyelitis',
  'osteosarcoma',
  'ewing_sarcoma',
  'gout',
  'pseudogout',
  'rheumatoid',
  'osteoarthritis',
  'ankylosing',
  'dupuytren',
  'ganglion',
  'carpal_tunnel',
  'scoliosis',
  'kyphosis',

  // CV - ECG patterns & imaging
  'atrial_fibrillation',
  'atrial_flutter',
  'stemi',
  'bundle_branch_block',
  'av_block',
  'wpw',
  'brugada',
  'pericarditis',
  'aortic_dissection',
  'dvt',
  'pulmonary_embolism',
  'endocarditis',
  'cardiomegaly',

  // NEURO - Imaging & physical findings
  'stroke',
  'hemorrhage',
  'epidural',
  'subdural',
  'subarachnoid',
  'brain_tumor',
  'hydrocephalus',
  'multiple_sclerosis',
  'bell_palsy',
  'horner',
  'myasthenia',
  'parkinson',
  'meningitis',
  'encephalitis',

  // GI - Imaging
  'intussusception',
  'volvulus',
  'bowel_obstruction',
  'appendicitis',
  'diverticulitis',
  'cholelithiasis',
  'cholecystitis',
  'pancreatitis',
  'cirrhosis',
  'ascites',
  'varices',
  'hemorrhoid',
  'anal_fissure',

  // HEME - Blood smear
  'sickle_cell',
  'thalassemia',
  'spherocytosis',
  'leukemia',
  'lymphoma',
  'multiple_myeloma',
  'g6pd',
  'iron_deficiency',
  'b12_deficiency',

  // ID - Rashes & manifestations
  'lyme',
  'rocky_mountain',
  'meningococcemia',
  'necrotizing_fasciitis',
  'gas_gangrene',
  'tetanus',
  'botulism',

  // PEDS/Genetic - Dysmorphic features
  'down_syndrome',
  'turner',
  'klinefelter',
  'marfan',
  'neurofibromatosis',
  'fetal_alcohol',
  'kawasaki',
  'henoch_schonlein',
]);

// High-yield PANCE conditions that MUST have images
const HIGH_YIELD_PANCE_CONDITIONS = new Set([
  // Per NCCPA blueprint - most tested conditions
  'DERM__papulosquamous__plaque_psoriasis',
  'DERM__oncology__melanoma',
  'DERM__oncology__basal_cell_carcinoma',
  'DERM__oncology__squamous_cell_carcinoma',
  'DERM__infectious__tinea_corporis_ringworm',
  'DERM__infectious__scabies',
  'DERM__acneiform__acne_vulgaris',
  'DERM__acneiform__rosacea',
  'DERM__dermatitis__eczema__atopic_dermatitis',
  'DERM__dermatitis__eczema__contact_dermatitis_irritantallergic',
  'DERM__reactive__hypersensitivity__urticaria',
  'DERM__drug_eruptions__scars__stevensjohnson_syndrome_sjs',
  'HEENT__eye__retina__diabetic_retinopathy',
  'HEENT__eye__glaucoma__acute_angleclosure_glaucoma',
  'HEENT__eye__cornea__anterior_segment__corneal_foreign_body',
  'HEENT__eye__retina__retinal_detachment',
  'HEENT__ear__middle__acute_otitis_media',
  'HEENT__ear__external__otitis_externa',
  'CV__ecg__atrial_fibrillation',
  'CV__ischemic_heart_disease__stemi',
  'CV__ecg__ventricular_tachycardia',
  'CV__conduction_disorders__left_bundle_branch_block',
  'CV__conduction_disorders__right_bundle_branch_block',
  'MSK__traumafracture__colles_fracture',
  'MSK__arthritis__gout',
  'MSK__arthritis__rheumatoid_arthritis',
  'MSK__arthritis__osteoarthritis',
  'NEURO__trauma__epidural_hematoma',
  'NEURO__trauma__subdural_hematoma',
  'NEURO__cerebrovascular__ischemic_stroke',
  'NEURO__demyelinating__multiple_sclerosis',
  'GI__esophagus__achalasia',
  'GI__colon__diverticulitis',
  'GI__liver__cirrhosis',
  'HEME__anemia__iron_deficiency_anemia',
  'HEME__hemoglobinopathy__sickle_cell_disease',
  'ID__bacterial__impetigo',
  'ID__viral__varicella_chickenpox',
  'ID__viral__herpes_zoster_shingles',
  'ID__viral__measles',
  'ID__tickborne__lyme_disease',
]);

interface ConditionAnalysis {
  id: string;
  name: string;
  system: string;
  imageCount: number;
  panceWeight: number;
  visualImportance: string;
  isHighYield: boolean;
  isVisuallyCritical: boolean;
  priorityScore: number;
  recommendation: string;
  imageSource: string;
}

function getSystemFromId(id: string): string {
  const parts = id.split('__');
  return parts[0] || 'OTHER';
}

function isConditionVisuallyCritical(id: string, name: string): boolean {
  const searchTerms = id.toLowerCase() + ' ' + name.toLowerCase();
  for (const term of VISUALLY_CRITICAL_CONDITIONS) {
    if (searchTerms.includes(term)) {
      return true;
    }
  }
  return false;
}

function calculatePriorityScore(
  panceWeight: number,
  visualImportance: string,
  imageCount: number,
  isHighYield: boolean,
  isVisuallyCritical: boolean
): number {
  let score = 0;

  // Base score from PANCE weight (0-16)
  score += panceWeight * 10;

  // Visual importance multiplier
  const visualMultiplier = {
    CRITICAL: 50,
    HIGH: 30,
    MEDIUM: 15,
    LOW: 5,
  };
  score += visualMultiplier[visualImportance as keyof typeof visualMultiplier] || 10;

  // High-yield bonus
  if (isHighYield) score += 100;

  // Visually critical bonus
  if (isVisuallyCritical) score += 75;

  // Penalty for existing images (diminishing returns)
  if (imageCount > 0) {
    score -= Math.min(imageCount * 10, 50);
  } else {
    // Bonus for NO images
    score += 50;
  }

  return score;
}

function determineImageSource(
  id: string,
  visualImportance: string,
  isVisuallyCritical: boolean
): string {
  const system = getSystemFromId(id);

  // ECG patterns
  if (
    id.includes('ecg__') ||
    id.includes('_ecg') ||
    id.includes('fibrillation') ||
    id.includes('flutter') ||
    id.includes('block') ||
    id.includes('rhythm')
  ) {
    return 'ECG_DATABASE';
  }

  // Radiology/imaging
  if (
    id.includes('fracture') ||
    id.includes('hematoma') ||
    id.includes('hemorrhage') ||
    id.includes('stroke') ||
    id.includes('tumor') ||
    id.includes('pneumonia') ||
    id.includes('abscess') ||
    id.includes('obstruction') ||
    id.includes('dissection')
  ) {
    return 'RADIOLOGY_ATLAS';
  }

  // Blood smears
  if (
    system === 'HEME' ||
    id.includes('anemia') ||
    id.includes('leukemia') ||
    id.includes('lymphoma') ||
    id.includes('myeloma')
  ) {
    return 'PATHOLOGY_SLIDES';
  }

  // Dermatology
  if (system === 'DERM' || isVisuallyCritical) {
    return 'DERMNET_NZ';
  }

  // Ophthalmology
  if (
    id.includes('eye__') ||
    id.includes('retina') ||
    id.includes('cornea') ||
    id.includes('glaucoma') ||
    id.includes('cataract')
  ) {
    return 'OPHTHO_ATLAS';
  }

  // Otoscopy
  if (id.includes('ear__') || id.includes('otitis') || id.includes('tympanic')) {
    return 'OTOSCOPY_DATABASE';
  }

  // Fundoscopy
  if (id.includes('retinopathy') || id.includes('papilledema')) {
    return 'FUNDOSCOPY_ATLAS';
  }

  return 'MEDICAL_ATLAS';
}

function generateRecommendation(
  imageCount: number,
  isHighYield: boolean,
  isVisuallyCritical: boolean,
  visualImportance: string,
  panceWeight: number
): string {
  if (imageCount === 0) {
    if (isHighYield || isVisuallyCritical) {
      return '🔴 CRITICAL: High-yield visual condition with NO images - URGENT acquisition needed';
    } else if (panceWeight >= 10) {
      return '🟠 HIGH PRIORITY: Major system condition needs images';
    } else if (visualImportance === 'CRITICAL' || visualImportance === 'HIGH') {
      return '🟡 IMPORTANT: Visual diagnosis condition needs images';
    } else {
      return '⚪ Consider: Add images when available';
    }
  } else if (imageCount < 3) {
    if (isHighYield) {
      return '🟡 ENHANCE: High-yield needs more variety (target: 5-10)';
    }
    return '🔵 ADEQUATE: Could benefit from more variety';
  } else if (imageCount < 5) {
    return '🟢 GOOD: Sufficient coverage';
  } else {
    return '✅ EXCELLENT: Comprehensive coverage';
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE PANCE IMAGE GAP ANALYSIS - TRULY COMPLETE         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Get all conditions with image counts
  const conditions = await prisma.condition.findMany({
    include: {
      _count: {
        select: { MediaAsset: true },
      },
    },
  });

  console.log(`📊 Total Conditions in Database: ${conditions.length}\n`);

  const analysis: ConditionAnalysis[] = [];

  for (const condition of conditions) {
    const system = getSystemFromId(condition.id);
    const blueprintData = PANCE_BLUEPRINT_WEIGHTS[
      system as keyof typeof PANCE_BLUEPRINT_WEIGHTS
    ] || { weight: 1, name: 'Unknown', visual_importance: 'MEDIUM' };

    const imageCount = condition._count.MediaAsset;
    const isHighYield = HIGH_YIELD_PANCE_CONDITIONS.has(condition.id);
    const isVisuallyCritical = isConditionVisuallyCritical(condition.id, condition.name);

    const priorityScore = calculatePriorityScore(
      blueprintData.weight,
      blueprintData.visual_importance,
      imageCount,
      isHighYield,
      isVisuallyCritical
    );

    analysis.push({
      id: condition.id,
      name: condition.name,
      system,
      imageCount,
      panceWeight: blueprintData.weight,
      visualImportance: blueprintData.visual_importance,
      isHighYield,
      isVisuallyCritical,
      priorityScore,
      recommendation: generateRecommendation(
        imageCount,
        isHighYield,
        isVisuallyCritical,
        blueprintData.visual_importance,
        blueprintData.weight
      ),
      imageSource: determineImageSource(
        condition.id,
        blueprintData.visual_importance,
        isVisuallyCritical
      ),
    });
  }

  // Sort by priority score (highest first)
  analysis.sort((a, b) => b.priorityScore - a.priorityScore);

  // Summary statistics
  const noImages = analysis.filter((a) => a.imageCount === 0);
  const fewImages = analysis.filter((a) => a.imageCount > 0 && a.imageCount < 3);
  const adequate = analysis.filter((a) => a.imageCount >= 3 && a.imageCount < 5);
  const good = analysis.filter((a) => a.imageCount >= 5);

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                       COVERAGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`🔴 NO Images (0):        ${noImages.length} conditions`);
  console.log(`🟡 Few Images (1-2):     ${fewImages.length} conditions`);
  console.log(`🔵 Adequate (3-4):       ${adequate.length} conditions`);
  console.log(`🟢 Good (5+):            ${good.length} conditions`);
  console.log(`📊 TOTAL:                ${analysis.length} conditions`);
  console.log(
    `📷 Coverage Rate:        ${(((good.length + adequate.length) / analysis.length) * 100).toFixed(1)}%\n`
  );

  // Group by system and show gaps
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    GAP ANALYSIS BY SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const systemGroups: Record<string, ConditionAnalysis[]> = {};
  for (const item of analysis) {
    if (!systemGroups[item.system]) {
      systemGroups[item.system] = [];
    }
    systemGroups[item.system].push(item);
  }

  // Sort systems by PANCE weight
  const sortedSystems = Object.keys(systemGroups).sort((a, b) => {
    const weightA = PANCE_BLUEPRINT_WEIGHTS[a as keyof typeof PANCE_BLUEPRINT_WEIGHTS]?.weight || 0;
    const weightB = PANCE_BLUEPRINT_WEIGHTS[b as keyof typeof PANCE_BLUEPRINT_WEIGHTS]?.weight || 0;
    return weightB - weightA;
  });

  for (const system of sortedSystems) {
    const items = systemGroups[system];
    const noImg = items.filter((i) => i.imageCount === 0).length;
    const total = items.length;
    const coverage = (((total - noImg) / total) * 100).toFixed(0);
    const blueprintData = PANCE_BLUEPRINT_WEIGHTS[system as keyof typeof PANCE_BLUEPRINT_WEIGHTS];

    console.log(
      `\n📋 ${system} - ${blueprintData?.name || 'Unknown'} (${blueprintData?.weight || 0}% PANCE)`
    );
    console.log(`   Coverage: ${coverage}% (${total - noImg}/${total} conditions have images)`);
    console.log(`   Missing: ${noImg} conditions need images`);

    // Show top 5 priority gaps for each system
    const systemGaps = items.filter((i) => i.imageCount === 0).slice(0, 5);
    if (systemGaps.length > 0) {
      console.log('   Top Priority Gaps:');
      for (const gap of systemGaps) {
        const marker = gap.isHighYield ? '🎯' : gap.isVisuallyCritical ? '👁️' : '•';
        console.log(`     ${marker} ${gap.name} [${gap.imageSource}]`);
      }
    }
  }

  // CRITICAL: High-yield conditions without images
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('            🚨 CRITICAL: HIGH-YIELD CONDITIONS MISSING IMAGES');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const criticalGaps = analysis
    .filter(
      (a) => a.imageCount === 0 && (a.isHighYield || a.isVisuallyCritical || a.panceWeight >= 10)
    )
    .slice(0, 50);

  for (const gap of criticalGaps) {
    const markers = [];
    if (gap.isHighYield) markers.push('🎯HY');
    if (gap.isVisuallyCritical) markers.push('👁️VIS');
    if (gap.panceWeight >= 10) markers.push(`📊${gap.panceWeight}%`);

    console.log(`${markers.join(' ')} | ${gap.name}`);
    console.log(`   ID: ${gap.id}`);
    console.log(`   Source: ${gap.imageSource}`);
    console.log('');
  }

  // Generate acquisition strategy by source
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('               IMAGE ACQUISITION STRATEGY BY SOURCE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const sourceGroups: Record<string, ConditionAnalysis[]> = {};
  for (const item of noImages) {
    if (!sourceGroups[item.imageSource]) {
      sourceGroups[item.imageSource] = [];
    }
    sourceGroups[item.imageSource].push(item);
  }

  const sourcePriority = [
    'DERMNET_NZ',
    'ECG_DATABASE',
    'RADIOLOGY_ATLAS',
    'OPHTHO_ATLAS',
    'OTOSCOPY_DATABASE',
    'PATHOLOGY_SLIDES',
    'FUNDOSCOPY_ATLAS',
    'MEDICAL_ATLAS',
  ];

  for (const source of sourcePriority) {
    const items = sourceGroups[source];
    if (!items || items.length === 0) continue;

    console.log(`\n📦 ${source} - ${items.length} conditions needed`);
    console.log('─'.repeat(60));

    // Show all conditions for this source (up to 20)
    const topItems = items.slice(0, 20);
    for (const item of topItems) {
      const priority = item.isHighYield ? '🔴' : item.isVisuallyCritical ? '🟠' : '🟡';
      console.log(`   ${priority} ${item.name}`);
    }
    if (items.length > 20) {
      console.log(`   ... and ${items.length - 20} more`);
    }
  }

  // Export data for further processing
  const exportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalConditions: analysis.length,
      noImages: noImages.length,
      fewImages: fewImages.length,
      adequate: adequate.length,
      good: good.length,
      coverageRate: (((good.length + adequate.length) / analysis.length) * 100).toFixed(1) + '%',
    },
    criticalGaps: criticalGaps.map((g) => ({
      id: g.id,
      name: g.name,
      system: g.system,
      source: g.imageSource,
      isHighYield: g.isHighYield,
      isVisuallyCritical: g.isVisuallyCritical,
      panceWeight: g.panceWeight,
    })),
    allGaps: noImages.map((g) => ({
      id: g.id,
      name: g.name,
      system: g.system,
      source: g.imageSource,
      priorityScore: g.priorityScore,
    })),
    bySource: Object.fromEntries(
      Object.entries(sourceGroups).map(([source, items]) => [
        source,
        items.map((i) => ({ id: i.id, name: i.name })),
      ])
    ),
    bySystem: Object.fromEntries(
      Object.entries(systemGroups).map(([system, items]) => [
        system,
        {
          total: items.length,
          withImages: items.filter((i) => i.imageCount > 0).length,
          missing: items.filter((i) => i.imageCount === 0).map((i) => ({ id: i.id, name: i.name })),
        },
      ])
    ),
  };

  // Write JSON export
  const fs = await import('fs');
  const exportPath =
    '/Users/aaronullger/Documents/GitHub/StudyPANaCEa/data/exports/pance-image-gap-analysis.json';
  await fs.promises.mkdir('/Users/aaronullger/Documents/GitHub/StudyPANaCEa/data/exports', {
    recursive: true,
  });
  await fs.promises.writeFile(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ Full analysis exported to: ${exportPath}`);

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                        EXECUTIVE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`
📊 Database Status:
   • Total Conditions: ${analysis.length}
   • Conditions WITH Images: ${analysis.length - noImages.length} (${(((analysis.length - noImages.length) / analysis.length) * 100).toFixed(1)}%)
   • Conditions WITHOUT Images: ${noImages.length} (${((noImages.length / analysis.length) * 100).toFixed(1)}%)

🎯 High-Priority Gaps:
   • Critical/High-Yield Missing: ${criticalGaps.length}
   • Dermatology Gaps: ${(sourceGroups['DERMNET_NZ'] || []).length}
   • ECG Pattern Gaps: ${(sourceGroups['ECG_DATABASE'] || []).length}
   • Radiology Gaps: ${(sourceGroups['RADIOLOGY_ATLAS'] || []).length}
   • Ophthalmology Gaps: ${(sourceGroups['OPHTHO_ATLAS'] || []).length}

📝 Recommended Actions:
   1. Prioritize DERMNET_NZ scraping for dermatologic conditions
   2. Acquire ECG patterns from educational databases
   3. Gather radiology images for fractures/trauma
   4. Fill ophthalmology gaps (fundoscopy, slit lamp)
   5. Add pathology slides for hematologic conditions
`);

  await prisma.$disconnect();
}

main().catch(console.error);
