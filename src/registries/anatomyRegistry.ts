// anatomyRegistry.ts
/**
 * Anatomy Registry - Source of Truth for Anatomical Structures
 *
 * This registry defines all anatomical structures relevant to PA education.
 * Add structures here, then run `npm run sync:anatomy` to populate the AnatomyStructure table.
 * Automation will then generate detailed content (function, innervation, blood supply, etc.)
 */

export interface AnatomyMeta {
  name: string;
  system: string; // MSK, CV, PULM, GI, NEURO, etc.
  region?: string; // Knee, Heart, Lungs, etc.
  type?: string; // Muscle, Ligament, Bone, Organ, Vessel, Nerve
  description?: string;

  // Optional: Can be filled by automation
  function?: string;
  innervation?: string;
  bloodSupply?: string;
  clinicalSignificance?: string;

  // Related conditions affecting this structure
  relatedConditions?: string[]; // Condition IDs
}

// =============================================================================
// MUSCULOSKELETAL - KNEE
// =============================================================================

export const ANATOMY_REGISTRY_KNEE: AnatomyMeta[] = [
  {
    name: 'Anterior Cruciate Ligament',
    system: 'MSK',
    region: 'Knee',
    type: 'Ligament',
    description: 'Primary stabilizer preventing anterior tibial translation',
    relatedConditions: ['MSK__knee__anterior_cruciate_ligament_tear'],
  },
  {
    name: 'Posterior Cruciate Ligament',
    system: 'MSK',
    region: 'Knee',
    type: 'Ligament',
    description: 'Primary stabilizer preventing posterior tibial translation',
    relatedConditions: ['MSK__knee__posterior_cruciate_ligament_tear'],
  },
  {
    name: 'Medial Collateral Ligament',
    system: 'MSK',
    region: 'Knee',
    type: 'Ligament',
    description: 'Resists valgus stress and excessive external rotation',
    relatedConditions: ['MSK__knee__medial_collateral_ligament_tear'],
  },
  {
    name: 'Lateral Collateral Ligament',
    system: 'MSK',
    region: 'Knee',
    type: 'Ligament',
    description: 'Resists varus stress',
    relatedConditions: ['MSK__knee__lateral_collateral_ligament_tear'],
  },
  {
    name: 'Medial Meniscus',
    system: 'MSK',
    region: 'Knee',
    type: 'Cartilage',
    description: 'C-shaped fibrocartilage providing shock absorption and load distribution',
    relatedConditions: ['MSK__knee__medial_meniscus_tear'],
  },
  {
    name: 'Lateral Meniscus',
    system: 'MSK',
    region: 'Knee',
    type: 'Cartilage',
    description: 'O-shaped fibrocartilage providing shock absorption and load distribution',
    relatedConditions: ['MSK__knee__lateral_meniscus_tear'],
  },
  {
    name: 'Patellar Tendon',
    system: 'MSK',
    region: 'Knee',
    type: 'Tendon',
    description: 'Extension of quadriceps tendon connecting patella to tibial tuberosity',
    relatedConditions: ['MSK__knee__patellar_tendinitis'],
  },
  {
    name: 'Quadriceps Muscle Group',
    system: 'MSK',
    region: 'Thigh',
    type: 'Muscle',
    description:
      'Four muscles (rectus femoris, vastus lateralis, vastus medialis, vastus intermedius) that extend the knee',
    innervation: 'Femoral nerve (L2-L4)',
  },
];

// =============================================================================
// MUSCULOSKELETAL - SHOULDER
// =============================================================================

export const ANATOMY_REGISTRY_SHOULDER: AnatomyMeta[] = [
  {
    name: 'Supraspinatus',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Muscle',
    description: 'Rotator cuff muscle that initiates arm abduction',
    innervation: 'Suprascapular nerve (C5-C6)',
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Infraspinatus',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Muscle',
    description: 'Rotator cuff muscle that externally rotates the arm',
    innervation: 'Suprascapular nerve (C5-C6)',
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Teres Minor',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Muscle',
    description: 'Rotator cuff muscle that externally rotates the arm',
    innervation: 'Axillary nerve (C5-C6)',
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Subscapularis',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Muscle',
    description: 'Rotator cuff muscle that internally rotates the arm',
    innervation: 'Upper and lower subscapular nerves (C5-C6)',
    relatedConditions: ['MSK__shoulder__rotator_cuff_tear'],
  },
  {
    name: 'Long Head of Biceps Tendon',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Tendon',
    description: 'Travels through bicipital groove and attaches to superior glenoid labrum',
    relatedConditions: ['MSK__shoulder__biceps_tendinitis'],
  },
  {
    name: 'Glenoid Labrum',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Cartilage',
    description: 'Fibrocartilaginous rim that deepens the glenoid socket',
    relatedConditions: ['MSK__shoulder__slap_lesion'],
  },
  {
    name: 'Subacromial Bursa',
    system: 'MSK',
    region: 'Shoulder',
    type: 'Bursa',
    description: 'Reduces friction between rotator cuff and acromion',
    relatedConditions: ['MSK__shoulder__subacromial_bursitis'],
  },
];

// =============================================================================
// CARDIOVASCULAR - HEART
// =============================================================================

export const ANATOMY_REGISTRY_HEART: AnatomyMeta[] = [
  {
    name: 'Sinoatrial Node',
    system: 'CV',
    region: 'Heart',
    type: 'Conduction System',
    description: 'Primary pacemaker of the heart located in the right atrium',
    bloodSupply: 'Right coronary artery (60%) or left circumflex artery (40%)',
    clinicalSignificance: 'Dysfunction leads to sick sinus syndrome',
  },
  {
    name: 'Atrioventricular Node',
    system: 'CV',
    region: 'Heart',
    type: 'Conduction System',
    description: 'Delays electrical impulse before ventricular activation',
    bloodSupply: 'Right coronary artery (90%)',
    clinicalSignificance: 'Blocks can cause bradycardia',
  },
  {
    name: 'Bundle of His',
    system: 'CV',
    region: 'Heart',
    type: 'Conduction System',
    description: 'Transmits impulses from AV node to bundle branches',
    bloodSupply: 'Left anterior descending artery',
  },
  {
    name: 'Right Coronary Artery',
    system: 'CV',
    region: 'Heart',
    type: 'Vessel',
    description: 'Supplies right ventricle, inferior left ventricle, and SA/AV nodes',
    clinicalSignificance: 'Occlusion causes inferior MI',
    relatedConditions: ['CV__ischemic_heart_disease__stemi'],
  },
  {
    name: 'Left Anterior Descending Artery',
    system: 'CV',
    region: 'Heart',
    type: 'Vessel',
    description: 'Supplies anterior left ventricle and interventricular septum',
    clinicalSignificance: 'Occlusion causes anterior MI (widowmaker)',
    relatedConditions: ['CV__ischemic_heart_disease__stemi'],
  },
  {
    name: 'Left Circumflex Artery',
    system: 'CV',
    region: 'Heart',
    type: 'Vessel',
    description: 'Supplies lateral and posterior left ventricle',
    clinicalSignificance: 'Occlusion causes lateral MI',
    relatedConditions: ['CV__ischemic_heart_disease__stemi'],
  },
  {
    name: 'Mitral Valve',
    system: 'CV',
    region: 'Heart',
    type: 'Valve',
    description: 'Bicuspid valve between left atrium and left ventricle',
    relatedConditions: [
      'CV__valvular_disease__mitral_stenosis',
      'CV__valvular_disease__mitral_regurgitation',
    ],
  },
  {
    name: 'Aortic Valve',
    system: 'CV',
    region: 'Heart',
    type: 'Valve',
    description: 'Tricuspid semilunar valve between left ventricle and aorta',
    relatedConditions: [
      'CV__valvular_disease__aortic_stenosis',
      'CV__valvular_disease__aortic_regurgitation',
    ],
  },
];

// =============================================================================
// PULMONARY
// =============================================================================

export const ANATOMY_REGISTRY_PULM: AnatomyMeta[] = [
  {
    name: 'Right Main Bronchus',
    system: 'PULM',
    region: 'Lungs',
    type: 'Airway',
    description:
      'Wider, shorter, and more vertical than left; foreign bodies more likely to lodge here',
    clinicalSignificance: 'Aspiration typically affects right lower lobe',
  },
  {
    name: 'Left Main Bronchus',
    system: 'PULM',
    region: 'Lungs',
    type: 'Airway',
    description: 'Narrower and more horizontal than right',
  },
  {
    name: 'Alveoli',
    system: 'PULM',
    region: 'Lungs',
    type: 'Gas Exchange Unit',
    description: 'Tiny air sacs where gas exchange occurs',
    clinicalSignificance: 'Destroyed in emphysema, filled with fluid in pneumonia',
    relatedConditions: ['PULM__obstructive__emphysema', 'PULM__infectious__pneumonia'],
  },
  {
    name: 'Diaphragm',
    system: 'PULM',
    region: 'Thorax',
    type: 'Muscle',
    description: 'Primary muscle of respiration',
    innervation: 'Phrenic nerve (C3-C5)',
    clinicalSignificance: 'Paralysis causes respiratory compromise',
  },
  {
    name: 'Pleura',
    system: 'PULM',
    region: 'Thorax',
    type: 'Membrane',
    description: 'Double-layered membrane surrounding lungs',
    clinicalSignificance: 'Inflammation causes pleurisy; air in space causes pneumothorax',
    relatedConditions: ['PULM__pleural__pneumothorax', 'PULM__pleural__pleural_effusion'],
  },
];

// =============================================================================
// NEUROLOGIC
// =============================================================================

export const ANATOMY_REGISTRY_NEURO: AnatomyMeta[] = [
  {
    name: 'Median Nerve',
    system: 'NEURO',
    region: 'Upper Extremity',
    type: 'Nerve',
    description: 'Innervates flexors of forearm and thenar muscles',
    clinicalSignificance: 'Compression causes carpal tunnel syndrome',
    relatedConditions: ['MSK__wrist__carpal_tunnel_syndrome'],
  },
  {
    name: 'Ulnar Nerve',
    system: 'NEURO',
    region: 'Upper Extremity',
    type: 'Nerve',
    description: 'Innervates intrinsic hand muscles and medial forearm flexors',
    clinicalSignificance: 'Compression at elbow causes cubital tunnel syndrome',
  },
  {
    name: 'Radial Nerve',
    system: 'NEURO',
    region: 'Upper Extremity',
    type: 'Nerve',
    description: 'Innervates extensors of arm, forearm, and wrist',
    clinicalSignificance: 'Saturday night palsy from compression',
  },
  {
    name: 'Sciatic Nerve',
    system: 'NEURO',
    region: 'Lower Extremity',
    type: 'Nerve',
    description: 'Largest nerve in body; innervates posterior thigh and entire lower leg/foot',
    clinicalSignificance: 'Compression causes sciatica',
    relatedConditions: ['MSK__spine__lumbar_disc_herniation'],
  },
  {
    name: 'Common Peroneal Nerve',
    system: 'NEURO',
    region: 'Lower Extremity',
    type: 'Nerve',
    description: 'Branch of sciatic nerve; innervates dorsiflexors and evertors',
    clinicalSignificance: 'Injury causes foot drop',
  },
  {
    name: 'Circle of Willis',
    system: 'NEURO',
    region: 'Brain',
    type: 'Vascular',
    description: 'Arterial circle at base of brain providing collateral circulation',
    clinicalSignificance: 'Aneurysms commonly occur here',
    relatedConditions: ['NEURO__cerebrovascular__subarachnoid_hemorrhage'],
  },
];

// =============================================================================
// GASTROINTESTINAL
// =============================================================================

export const ANATOMY_REGISTRY_GI: AnatomyMeta[] = [
  {
    name: 'Esophagus',
    system: 'GI',
    region: 'Upper GI',
    type: 'Organ',
    description: 'Muscular tube connecting pharynx to stomach',
    bloodSupply:
      'Inferior thyroid artery (upper), bronchial arteries (middle), left gastric artery (lower)',
    relatedConditions: ['GI__esophagus__gerd', 'GI__esophagus__achalasia'],
  },
  {
    name: 'Stomach',
    system: 'GI',
    region: 'Upper GI',
    type: 'Organ',
    description: 'J-shaped organ for mechanical and chemical digestion',
    bloodSupply: 'Celiac trunk branches',
    relatedConditions: ['GI__stomach__peptic_ulcer_disease', 'GI__stomach__gastritis'],
  },
  {
    name: 'Appendix',
    system: 'GI',
    region: 'Lower GI',
    type: 'Organ',
    description: "Small pouch attached to cecum at McBurney's point",
    bloodSupply: 'Appendicular artery (branch of ileocolic artery)',
    relatedConditions: ['GI__appendix__acute_appendicitis'],
  },
  {
    name: 'Gallbladder',
    system: 'GI',
    region: 'Hepatobiliary',
    type: 'Organ',
    description: 'Pear-shaped organ storing and concentrating bile',
    bloodSupply: 'Cystic artery (from right hepatic artery)',
    relatedConditions: ['GI__biliary__acute_cholecystitis', 'GI__biliary__cholelithiasis'],
  },
  {
    name: 'Pancreas',
    system: 'GI',
    region: 'Hepatobiliary',
    type: 'Organ',
    description: 'Endocrine and exocrine gland',
    bloodSupply: 'Celiac and superior mesenteric arteries',
    relatedConditions: ['GI__pancreas__acute_pancreatitis', 'ENDO__diabetes__type_1_diabetes'],
  },
];

// =============================================================================
// EXPORT ALL ANATOMY
// =============================================================================

export const ANATOMY_REGISTRY: AnatomyMeta[] = [
  ...ANATOMY_REGISTRY_KNEE,
  ...ANATOMY_REGISTRY_SHOULDER,
  ...ANATOMY_REGISTRY_HEART,
  ...ANATOMY_REGISTRY_PULM,
  ...ANATOMY_REGISTRY_NEURO,
  ...ANATOMY_REGISTRY_GI,
];

export function buildAnatomyId(anatomy: AnatomyMeta): string {
  return anatomy.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
