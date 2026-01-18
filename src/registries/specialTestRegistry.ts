// specialTestRegistry.ts
/**
 * Special Test Registry - Source of Truth for Physical Exam Special Tests
 *
 * This registry defines all special physical exam tests (orthopedic, neurologic, etc.)
 * Add tests here, then run `npm run sync:special-tests` to populate the SpecialTest table.
 * Automation will then generate detailed content (technique, sensitivity, specificity, etc.)
 */

export interface SpecialTestMeta {
  name: string;
  displayName?: string; // Clean display name (if different from name)
  aliases?: string[]; // Alternative names for search
  system: string; // MSK, NEURO, CV, etc.
  region?: string; // Knee, Shoulder, Lumbar Spine, etc.
  description?: string;

  // Test characteristics (can be filled by automation)
  sensitivity?: number; // 0-100
  specificity?: number; // 0-100

  // Optional: Manual override
  technique?: string;
  positiveTest?: string;
  interpretation?: string;

  // Related conditions this test helps diagnose
  relatedConditions?: string[]; // Condition IDs from conditionRegistry
}

// =============================================================================
// MUSCULOSKELETAL - KNEE
// =============================================================================

export const SPECIAL_TEST_REGISTRY_KNEE: SpecialTestMeta[] = [
  {
    name: 'Lachman Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for anterior cruciate ligament (ACL) tear',
    sensitivity: 85,
    specificity: 94,
    relatedConditions: ['MSK__knee__anterior_cruciate_ligament_tear'],
  },
  {
    name: 'Anterior Drawer Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for ACL integrity',
    sensitivity: 62,
    specificity: 67,
    relatedConditions: ['MSK__knee__anterior_cruciate_ligament_tear'],
  },
  {
    name: 'Posterior Drawer Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for posterior cruciate ligament (PCL) tear',
    sensitivity: 90,
    specificity: 99,
    relatedConditions: ['MSK__knee__posterior_cruciate_ligament_tear'],
  },
  {
    name: 'McMurray Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for meniscal tear',
    sensitivity: 70,
    specificity: 71,
    relatedConditions: ['MSK__knee__medial_meniscus_tear', 'MSK__knee__lateral_meniscus_tear'],
  },
  {
    name: 'Thessaly Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for meniscal tear',
    sensitivity: 89,
    specificity: 97,
    relatedConditions: ['MSK__knee__medial_meniscus_tear', 'MSK__knee__lateral_meniscus_tear'],
  },
  {
    name: 'Valgus Stress Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for medial collateral ligament (MCL) injury',
    sensitivity: 86,
    specificity: 86,
    relatedConditions: ['MSK__knee__medial_collateral_ligament_tear'],
  },
  {
    name: 'Varus Stress Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for lateral collateral ligament (LCL) injury',
    sensitivity: 25,
    specificity: 92,
    relatedConditions: ['MSK__knee__lateral_collateral_ligament_tear'],
  },
  {
    name: 'Patellar Apprehension Test',
    system: 'MSK',
    region: 'Knee',
    description: 'Tests for patellar instability/dislocation',
    relatedConditions: ['MSK__knee__patellar_dislocation'],
  },
];

// =============================================================================
// MUSCULOSKELETAL - SHOULDER
// =============================================================================

export const SPECIAL_TEST_REGISTRY_SHOULDER: SpecialTestMeta[] = [
  {
    name: "Empty Can Test (Jobe's Test)",
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for supraspinatus tear or impingement',
    sensitivity: 89,
    specificity: 50,
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Drop Arm Test',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for full-thickness rotator cuff tear',
    sensitivity: 35,
    specificity: 88,
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Hawkins-Kennedy Test',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for subacromial impingement',
    sensitivity: 79,
    specificity: 59,
    relatedConditions: ['MSK__shoulder__subacromial_impingement'],
  },
  {
    name: 'Neer Test',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for subacromial impingement',
    sensitivity: 79,
    specificity: 53,
    relatedConditions: ['MSK__shoulder__subacromial_impingement'],
  },
  {
    name: 'Apprehension Test',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for anterior shoulder instability',
    sensitivity: 72,
    specificity: 96,
    relatedConditions: ['MSK__shoulder__anterior_dislocation'],
  },
  {
    name: 'Relocation Test (Jobe Relocation)',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for anterior shoulder instability',
    sensitivity: 81,
    specificity: 92,
    relatedConditions: ['MSK__shoulder__anterior_dislocation'],
  },
  {
    name: "O'Brien Test (Active Compression)",
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for labral tear (SLAP lesion)',
    sensitivity: 100,
    specificity: 98,
    relatedConditions: ['MSK__shoulder__slap_lesion'],
  },
  {
    name: "Speed's Test",
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for biceps tendinitis',
    sensitivity: 32,
    specificity: 75,
    relatedConditions: ['MSK__shoulder__biceps_tendinitis'],
  },
  {
    name: 'Yergason Test',
    system: 'MSK',
    region: 'Shoulder',
    description: 'Tests for biceps tendinitis or instability',
    sensitivity: 43,
    specificity: 79,
    relatedConditions: ['MSK__shoulder__biceps_tendinitis'],
  },
];

// =============================================================================
// MUSCULOSKELETAL - SPINE
// =============================================================================

export const SPECIAL_TEST_REGISTRY_SPINE: SpecialTestMeta[] = [
  {
    name: 'Straight Leg Raise (Lasègue Test)',
    system: 'MSK',
    region: 'Lumbar Spine',
    description: 'Tests for lumbar radiculopathy (L4-S1)',
    sensitivity: 91,
    specificity: 26,
    relatedConditions: ['MSK__spine__lumbar_disc_herniation'],
  },
  {
    name: 'Crossed Straight Leg Raise',
    system: 'MSK',
    region: 'Lumbar Spine',
    description: 'Tests for lumbar disc herniation',
    sensitivity: 29,
    specificity: 88,
    relatedConditions: ['MSK__spine__lumbar_disc_herniation'],
  },
  {
    name: 'Spurling Test',
    system: 'MSK',
    region: 'Cervical Spine',
    description: 'Tests for cervical radiculopathy',
    sensitivity: 50,
    specificity: 86,
    relatedConditions: ['MSK__spine__cervical_radiculopathy'],
  },
  {
    name: 'Patrick Test (FABER)',
    system: 'MSK',
    region: 'Hip/SI Joint',
    description: 'Tests for hip pathology or sacroiliac joint dysfunction',
    relatedConditions: ['MSK__hip__osteoarthritis', 'MSK__spine__sacroiliac_joint_dysfunction'],
  },
];

// =============================================================================
// NEUROLOGIC
// =============================================================================

export const SPECIAL_TEST_REGISTRY_NEURO: SpecialTestMeta[] = [
  {
    name: 'Romberg Test',
    system: 'NEURO',
    region: 'Balance',
    description: 'Tests for proprioceptive or vestibular dysfunction',
    relatedConditions: ['NEURO__peripheral_neuropathy', 'NEURO__vestibular_dysfunction'],
  },
  {
    name: 'Babinski Sign',
    system: 'NEURO',
    region: 'Reflexes',
    description: 'Tests for upper motor neuron lesion',
    relatedConditions: ['NEURO__stroke', 'NEURO__spinal_cord_injury'],
  },
  {
    name: 'Brudzinski Sign',
    system: 'NEURO',
    region: 'Meningeal',
    description: 'Tests for meningeal irritation',
    sensitivity: 5,
    specificity: 95,
    relatedConditions: ['NEURO__meningitis'],
  },
  {
    name: 'Kernig Sign',
    system: 'NEURO',
    region: 'Meningeal',
    description: 'Tests for meningeal irritation',
    sensitivity: 5,
    specificity: 95,
    relatedConditions: ['NEURO__meningitis'],
  },
  {
    name: 'Hoffman Sign',
    system: 'NEURO',
    region: 'Reflexes',
    description: 'Tests for upper motor neuron lesion or cervical myelopathy',
    relatedConditions: ['MSK__spine__cervical_myelopathy'],
  },
  {
    name: 'Phalen Test',
    system: 'NEURO',
    region: 'Wrist',
    description: 'Tests for carpal tunnel syndrome',
    sensitivity: 75,
    specificity: 47,
    relatedConditions: ['MSK__wrist__carpal_tunnel_syndrome'],
  },
  {
    name: 'Tinel Sign (Wrist)',
    system: 'NEURO',
    region: 'Wrist',
    description: 'Tests for carpal tunnel syndrome',
    sensitivity: 50,
    specificity: 77,
    relatedConditions: ['MSK__wrist__carpal_tunnel_syndrome'],
  },
];

// =============================================================================
// CARDIOVASCULAR
// =============================================================================

export const SPECIAL_TEST_REGISTRY_CV: SpecialTestMeta[] = [
  {
    name: 'Orthostatic Vital Signs',
    system: 'CV',
    description: 'Tests for orthostatic hypotension or hypovolemia',
    relatedConditions: ['CV__blood_pressure__orthostatic_hypotension'],
  },
  {
    name: 'Valsalva Maneuver',
    system: 'CV',
    description: 'Tests for autonomic function and heart murmurs',
    relatedConditions: ['CV__arrhythmia__supraventricular_tachycardia'],
  },
  {
    name: 'Allen Test',
    system: 'CV',
    region: 'Hand',
    description: 'Tests for patency of radial and ulnar arteries',
    relatedConditions: ['CV__vascular__arterial_insufficiency'],
  },
];

// =============================================================================
// ABDOMINAL
// =============================================================================

export const SPECIAL_TEST_REGISTRY_ABDOMINAL: SpecialTestMeta[] = [
  {
    name: 'Murphy Sign',
    system: 'GI',
    region: 'Abdomen',
    description: 'Tests for acute cholecystitis',
    sensitivity: 65,
    specificity: 87,
    relatedConditions: ['GI__biliary__acute_cholecystitis'],
  },
  {
    name: 'McBurney Point Tenderness',
    system: 'GI',
    region: 'Abdomen',
    description: 'Tests for appendicitis',
    sensitivity: 50,
    specificity: 80,
    relatedConditions: ['GI__appendix__acute_appendicitis'],
  },
  {
    name: 'Rovsing Sign',
    system: 'GI',
    region: 'Abdomen',
    description: 'Tests for appendicitis',
    sensitivity: 22,
    specificity: 96,
    relatedConditions: ['GI__appendix__acute_appendicitis'],
  },
  {
    name: 'Psoas Sign',
    system: 'GI',
    region: 'Abdomen',
    description: 'Tests for appendicitis or psoas abscess',
    sensitivity: 16,
    specificity: 95,
    relatedConditions: ['GI__appendix__acute_appendicitis'],
  },
  {
    name: 'Obturator Sign',
    system: 'GI',
    region: 'Abdomen',
    description: 'Tests for appendicitis or pelvic abscess',
    sensitivity: 8,
    specificity: 94,
    relatedConditions: ['GI__appendix__acute_appendicitis'],
  },
  {
    name: 'Carnett Sign',
    system: 'GI',
    region: 'Abdomen',
    description: 'Differentiates abdominal wall pain from visceral pain',
  },
];

// =============================================================================
// EXPORT ALL TESTS
// =============================================================================

export const SPECIAL_TEST_REGISTRY: SpecialTestMeta[] = [
  ...SPECIAL_TEST_REGISTRY_KNEE,
  ...SPECIAL_TEST_REGISTRY_SHOULDER,
  ...SPECIAL_TEST_REGISTRY_SPINE,
  ...SPECIAL_TEST_REGISTRY_NEURO,
  ...SPECIAL_TEST_REGISTRY_CV,
  ...SPECIAL_TEST_REGISTRY_ABDOMINAL,
];

export function buildSpecialTestId(test: SpecialTestMeta): string {
  return test.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
