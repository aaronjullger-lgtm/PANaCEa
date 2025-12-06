/**
 * Organ Character System Configuration
 * 
 * Defines the organ-themed character collection for the PANaCEa gamification system.
 * Each body system has a base organ character with unlockable variants and accessories.
 */

import type { SystemCode } from '../types';

export type OrganVariantId = string; // e.g., "heart_base", "heart_boot_shaped", "lungs_pneumothorax"
export type OrganAccessoryId = string; // e.g., "stethoscope", "golden_stethoscope", "medical_cap"

export interface OrganVariant {
  id: OrganVariantId;
  name: string;
  description: string;
  system: SystemCode | 'SPECIAL'; // Special for easter egg characters
  isBase: boolean; // True for default unlocked versions
  unlockCondition: {
    type: 'default' | 'questions_answered' | 'accuracy_threshold' | 'specific_condition' | 'achievement' | 'easter_egg';
    value?: number;
    condition?: string; // Specific condition name or achievement ID
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string; // Emoji or icon identifier
  displayOrder: number;
}

export interface OrganAccessory {
  id: OrganAccessoryId;
  name: string;
  description: string;
  compatibleSystems: (SystemCode | 'SPECIAL' | 'ALL')[]; // Which characters can wear this
  unlockCondition: {
    type: 'streak' | 'total_questions' | 'achievement' | 'special_event';
    value?: number;
    achievementId?: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  displayOrder: number;
}

export interface OrganCharacter {
  system: SystemCode | 'SPECIAL';
  name: string;
  description: string;
  baseVariant: OrganVariantId;
  emoji: string; // Main emoji representation
}

/**
 * Base organ characters - one per body system
 */
export const ORGAN_CHARACTERS: OrganCharacter[] = [
  {
    system: 'CV',
    name: 'Heart',
    description: 'Cardiovascular System character',
    baseVariant: 'heart_base',
    emoji: '♥',
  },
  {
    system: 'PULM',
    name: 'Lungs',
    description: 'Pulmonary System character',
    baseVariant: 'lungs_base',
    emoji: '◉◉',
  },
  {
    system: 'GI',
    name: 'Stomach',
    description: 'Gastrointestinal System character',
    baseVariant: 'stomach_base',
    emoji: '◐',
  },
  {
    system: 'NEURO',
    name: 'Brain',
    description: 'Neurologic System character',
    baseVariant: 'brain_base',
    emoji: '⚡',
  },
  {
    system: 'MSK',
    name: 'Bone',
    description: 'Musculoskeletal System character',
    baseVariant: 'bone_base',
    emoji: '∥',
  },
  {
    system: 'RENAL',
    name: 'Kidney',
    description: 'Renal System character',
    baseVariant: 'kidney_base',
    emoji: '◈',
  },
  {
    system: 'ENDO',
    name: 'Thyroid',
    description: 'Endocrine System character',
    baseVariant: 'thyroid_base',
    emoji: '⚬',
  },
  {
    system: 'HEME',
    name: 'Blood Cell',
    description: 'Hematologic System character',
    baseVariant: 'blood_base',
    emoji: '●',
  },
  {
    system: 'DERM',
    name: 'Skin Cell',
    description: 'Dermatologic System character',
    baseVariant: 'skin_base',
    emoji: '▢',
  },
  {
    system: 'HEENT',
    name: 'Eye',
    description: 'Eyes, Ears, Nose, and Throat character',
    baseVariant: 'eye_base',
    emoji: '◉',
  },
  {
    system: 'GU',
    name: 'Bladder',
    description: 'Genitourinary System character',
    baseVariant: 'bladder_base',
    emoji: '◎',
  },
  {
    system: 'REPRO',
    name: 'Cell',
    description: 'Reproductive System character',
    baseVariant: 'repro_base',
    emoji: '✧',
  },
  {
    system: 'ID',
    name: 'Antibody',
    description: 'Infectious Diseases character',
    baseVariant: 'antibody_base',
    emoji: '◆',
  },
  {
    system: 'PSYCH',
    name: 'Neurotransmitter',
    description: 'Psychiatry/Behavioral Science character',
    baseVariant: 'neuro_transmitter_base',
    emoji: '◈',
  },
  {
    system: 'PRO',
    name: 'Stethoscope',
    description: 'Professional Practice character',
    baseVariant: 'stethoscope_base',
    emoji: '⊕',
  },
];

/**
 * Organ character variants with unlock conditions
 * Includes base variants, condition-specific variants, and easter eggs
 */
export const ORGAN_VARIANTS: OrganVariant[] = [
  // ==================== CARDIOVASCULAR ====================
  {
    id: 'heart_base',
    name: 'Healthy Heart',
    description: 'A happy, healthy heart pumping strong',
    system: 'CV',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '♥',
    displayOrder: 1,
  },
  {
    id: 'heart_boot_shaped',
    name: 'Boot-Shaped Heart',
    description: 'Classic sign of right ventricular hypertrophy',
    system: 'CV',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Tetralogy of Fallot'
    },
    rarity: 'uncommon',
    icon: '♥↗',
    displayOrder: 2,
  },
  {
    id: 'heart_athlete',
    name: 'Athletic Heart',
    description: 'Enlarged heart from years of endurance training',
    system: 'CV',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 100
    },
    rarity: 'uncommon',
    icon: '♥+',
    displayOrder: 3,
  },
  {
    id: 'heart_broken',
    name: 'Takotsubo Heart',
    description: 'Broken heart syndrome - stress cardiomyopathy',
    system: 'CV',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 3,
      condition: 'Takotsubo'
    },
    rarity: 'rare',
    icon: '♡',
    displayOrder: 4,
  },
  {
    id: 'heart_golden',
    name: 'Golden Heart',
    description: 'Master of cardiovascular medicine',
    system: 'CV',
    isBase: false,
    unlockCondition: { 
      type: 'accuracy_threshold', 
      value: 90
    },
    rarity: 'epic',
    icon: '♥*',
    displayOrder: 5,
  },

  // ==================== PULMONARY ====================
  {
    id: 'lungs_base',
    name: 'Healthy Lungs',
    description: 'Clear lungs breathing easy',
    system: 'PULM',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◉◉',
    displayOrder: 10,
  },
  {
    id: 'lungs_pneumothorax',
    name: 'Pneumothorax Lungs',
    description: 'One lung collapsed, the other still fighting',
    system: 'PULM',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Pneumothorax'
    },
    rarity: 'uncommon',
    icon: '◉○',
    displayOrder: 11,
  },
  {
    id: 'lungs_emphysema',
    name: 'Emphysematous Lungs',
    description: 'Barrel chest and hyperinflated',
    system: 'PULM',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'COPD'
    },
    rarity: 'uncommon',
    icon: '◉◎',
    displayOrder: 12,
  },
  {
    id: 'lungs_asthma',
    name: 'Reactive Airways',
    description: 'Hyperresponsive bronchial tree',
    system: 'PULM',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 75
    },
    rarity: 'uncommon',
    icon: '◉~',
    displayOrder: 13,
  },
  {
    id: 'lungs_golden',
    name: 'Crystal Clear Lungs',
    description: 'Perfect pulmonary mastery',
    system: 'PULM',
    isBase: false,
    unlockCondition: { 
      type: 'accuracy_threshold', 
      value: 90
    },
    rarity: 'epic',
    icon: '◉*',
    displayOrder: 14,
  },

  // ==================== GASTROINTESTINAL ====================
  {
    id: 'stomach_base',
    name: 'Happy Stomach',
    description: 'Healthy GI tract doing its job',
    system: 'GI',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◐',
    displayOrder: 20,
  },
  {
    id: 'stomach_ulcer',
    name: 'Peptic Ulcer',
    description: 'H. pylori has entered the chat',
    system: 'GI',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Peptic Ulcer'
    },
    rarity: 'uncommon',
    icon: '◐×',
    displayOrder: 21,
  },
  {
    id: 'stomach_crohns',
    name: 'Cobblestone Bowel',
    description: 'Transmural inflammation pattern',
    system: 'GI',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: "Crohn's Disease"
    },
    rarity: 'rare',
    icon: '◐▪',
    displayOrder: 22,
  },
  {
    id: 'stomach_appendicitis',
    name: "McBurney's Point",
    description: 'Right lower quadrant tenderness',
    system: 'GI',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 3,
      condition: 'Appendicitis'
    },
    rarity: 'uncommon',
    icon: '◐!',
    displayOrder: 23,
  },

  // ==================== NEUROLOGIC ====================
  {
    id: 'brain_base',
    name: 'Healthy Brain',
    description: 'All neurons firing properly',
    system: 'NEURO',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '⚡',
    displayOrder: 30,
  },
  {
    id: 'brain_stroke',
    name: 'Stroke Brain',
    description: 'Time is brain - knowing the signs saves lives',
    system: 'NEURO',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Stroke'
    },
    rarity: 'uncommon',
    icon: '⚡!',
    displayOrder: 31,
  },
  {
    id: 'brain_migraine',
    name: 'Migraine Brain',
    description: 'Throbbing, photophobic, and miserable',
    system: 'NEURO',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '⚡~',
    displayOrder: 32,
  },
  {
    id: 'brain_genius',
    name: 'Genius Brain',
    description: 'Exceptional neurologic expertise',
    system: 'NEURO',
    isBase: false,
    unlockCondition: { 
      type: 'accuracy_threshold', 
      value: 95
    },
    rarity: 'legendary',
    icon: '⚡★',
    displayOrder: 33,
  },

  // ==================== MUSCULOSKELETAL ====================
  {
    id: 'bone_base',
    name: 'Strong Bone',
    description: 'Calcium-rich and fracture-free',
    system: 'MSK',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '∥',
    displayOrder: 40,
  },
  {
    id: 'bone_fracture',
    name: 'Healing Fracture',
    description: 'Callus formation in progress',
    system: 'MSK',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '∥×',
    displayOrder: 41,
  },
  {
    id: 'bone_osteoporosis',
    name: 'Osteoporotic Bone',
    description: 'Swiss cheese appearance on X-ray',
    system: 'MSK',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Osteoporosis'
    },
    rarity: 'uncommon',
    icon: '∥○',
    displayOrder: 42,
  },

  // ==================== RENAL ====================
  {
    id: 'kidney_base',
    name: 'Healthy Kidney',
    description: 'Filtering blood like a champ',
    system: 'RENAL',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◈',
    displayOrder: 50,
  },
  {
    id: 'kidney_stone',
    name: 'Kidney Stone',
    description: 'Worst pain known to medicine',
    system: 'RENAL',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Nephrolithiasis'
    },
    rarity: 'uncommon',
    icon: '◈◆',
    displayOrder: 51,
  },
  {
    id: 'kidney_polycystic',
    name: 'Polycystic Kidney',
    description: 'Multiple cysts throughout',
    system: 'RENAL',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 3,
      condition: 'Polycystic Kidney Disease'
    },
    rarity: 'rare',
    icon: '◈○',
    displayOrder: 52,
  },

  // ==================== ENDOCRINE ====================
  {
    id: 'thyroid_base',
    name: 'Balanced Thyroid',
    description: 'Perfect euthyroid state',
    system: 'ENDO',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '⚬',
    displayOrder: 60,
  },
  {
    id: 'thyroid_hyper',
    name: 'Hyperthyroid',
    description: 'Revved up and ready to go',
    system: 'ENDO',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Hyperthyroidism'
    },
    rarity: 'uncommon',
    icon: '⚬↑',
    displayOrder: 61,
  },
  {
    id: 'thyroid_hypo',
    name: 'Hypothyroid',
    description: 'Slowed down and sluggish',
    system: 'ENDO',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Hypothyroidism'
    },
    rarity: 'uncommon',
    icon: '⚬↓',
    displayOrder: 62,
  },

  // ==================== HEMATOLOGIC ====================
  {
    id: 'blood_base',
    name: 'Healthy Blood',
    description: 'Normal CBC with differential',
    system: 'HEME',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '●',
    displayOrder: 70,
  },
  {
    id: 'blood_anemia',
    name: 'Anemic Blood',
    description: 'Low hemoglobin, feeling tired',
    system: 'HEME',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '○',
    displayOrder: 71,
  },
  {
    id: 'blood_sickle',
    name: 'Sickle Cell',
    description: 'Crescent-shaped RBCs',
    system: 'HEME',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Sickle Cell Disease'
    },
    rarity: 'rare',
    icon: '◐',
    displayOrder: 72,
  },

  // ==================== DERMATOLOGIC ====================
  {
    id: 'skin_base',
    name: 'Healthy Skin',
    description: 'Clear, intact epidermis',
    system: 'DERM',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '▢',
    displayOrder: 80,
  },
  {
    id: 'skin_rash',
    name: 'Maculopapular Rash',
    description: 'Classic viral exanthem',
    system: 'DERM',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '▢▪',
    displayOrder: 81,
  },
  {
    id: 'skin_melanoma',
    name: 'Melanoma Watch',
    description: 'ABCDE criteria master',
    system: 'DERM',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Melanoma'
    },
    rarity: 'rare',
    icon: '▢●',
    displayOrder: 82,
  },

  // ==================== HEENT ====================
  {
    id: 'eye_base',
    name: 'Clear Vision',
    description: '20/20 vision achieved',
    system: 'HEENT',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◉',
    displayOrder: 90,
  },
  {
    id: 'eye_red',
    name: 'Red Eye',
    description: 'Conjunctivitis or something worse?',
    system: 'HEENT',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '◉×',
    displayOrder: 91,
  },
  {
    id: 'eye_glaucoma',
    name: 'Glaucomatous Eye',
    description: 'Increased intraocular pressure',
    system: 'HEENT',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Glaucoma'
    },
    rarity: 'rare',
    icon: '◉↑',
    displayOrder: 92,
  },

  // ==================== GENITOURINARY ====================
  {
    id: 'bladder_base',
    name: 'Healthy Bladder',
    description: 'Normal voiding function',
    system: 'GU',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◎',
    displayOrder: 100,
  },
  {
    id: 'bladder_uti',
    name: 'UTI Bladder',
    description: 'Dysuria, frequency, and urgency',
    system: 'GU',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'UTI'
    },
    rarity: 'uncommon',
    icon: '◎×',
    displayOrder: 101,
  },

  // ==================== REPRODUCTIVE ====================
  {
    id: 'repro_base',
    name: 'Healthy Cell',
    description: 'Normal reproductive function',
    system: 'REPRO',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '✧',
    displayOrder: 110,
  },
  {
    id: 'repro_pregnancy',
    name: 'Developing Life',
    description: 'OB principles mastered',
    system: 'REPRO',
    isBase: false,
    unlockCondition: { 
      type: 'questions_answered', 
      value: 50
    },
    rarity: 'uncommon',
    icon: '✧+',
    displayOrder: 111,
  },

  // ==================== INFECTIOUS DISEASES ====================
  {
    id: 'antibody_base',
    name: 'Healthy Antibody',
    description: 'Immune system on guard',
    system: 'ID',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◆',
    displayOrder: 120,
  },
  {
    id: 'antibody_covid',
    name: 'COVID Warrior',
    description: 'Survived the pandemic studies',
    system: 'ID',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'COVID-19'
    },
    rarity: 'uncommon',
    icon: '◆+',
    displayOrder: 121,
  },
  {
    id: 'antibody_sepsis',
    name: 'Sepsis Fighter',
    description: 'SIRS criteria expert',
    system: 'ID',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Sepsis'
    },
    rarity: 'rare',
    icon: '◆×',
    displayOrder: 122,
  },

  // ==================== PSYCHIATRY ====================
  {
    id: 'neuro_transmitter_base',
    name: 'Balanced Mind',
    description: 'Neurotransmitters in harmony',
    system: 'PSYCH',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '◈',
    displayOrder: 130,
  },
  {
    id: 'neuro_transmitter_depression',
    name: 'Low Serotonin',
    description: 'Understanding depression mechanisms',
    system: 'PSYCH',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'Depression'
    },
    rarity: 'uncommon',
    icon: '◈↓',
    displayOrder: 131,
  },
  {
    id: 'neuro_transmitter_adhd',
    name: 'Dopamine Dysregulation',
    description: 'ADHD pathophysiology mastered',
    system: 'PSYCH',
    isBase: false,
    unlockCondition: { 
      type: 'specific_condition', 
      value: 5,
      condition: 'ADHD'
    },
    rarity: 'uncommon',
    icon: '◈~',
    displayOrder: 132,
  },

  // ==================== PROFESSIONAL PRACTICE ====================
  {
    id: 'stethoscope_base',
    name: 'Basic Stethoscope',
    description: 'Essential tool of the trade',
    system: 'PRO',
    isBase: true,
    unlockCondition: { type: 'default' },
    rarity: 'common',
    icon: '⊕',
    displayOrder: 140,
  },
  {
    id: 'stethoscope_golden',
    name: 'Golden Stethoscope',
    description: 'Symbol of clinical excellence',
    system: 'PRO',
    isBase: false,
    unlockCondition: { 
      type: 'accuracy_threshold', 
      value: 95
    },
    rarity: 'legendary',
    icon: '⊕★',
    displayOrder: 141,
  },

  // ==================== EASTER EGG CHARACTERS ====================
  {
    id: 'ecg_base',
    name: 'ECG Strip',
    description: 'Normal sinus rhythm',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'easter_egg',
      value: 10,
      condition: 'ecg_drill'
    },
    rarity: 'rare',
    icon: '~▬~',
    displayOrder: 200,
  },
  {
    id: 'ecg_vfib',
    name: 'V-Fib',
    description: 'Shockable rhythm - get the paddles!',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'easter_egg',
      value: 50,
      condition: 'ecg_drill'
    },
    rarity: 'epic',
    icon: '~⚡~',
    displayOrder: 201,
  },
  {
    id: 'ecg_asystole',
    name: 'Asystole',
    description: 'Flatline - start compressions',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'easter_egg',
      value: 75,
      condition: 'ecg_drill'
    },
    rarity: 'epic',
    icon: '▬▬▬',
    displayOrder: 202,
  },
  {
    id: 'skeleton_base',
    name: 'Skeleton Friend',
    description: 'Collect all major bones to bring him to life',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'achievement',
      condition: 'bone_collector'
    },
    rarity: 'legendary',
    icon: '☠',
    displayOrder: 210,
  },
  {
    id: 'lab_values',
    name: 'Lab Values Mascot',
    description: 'Master of interpreting results',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'easter_egg',
      value: 100,
      condition: 'mini_lab'
    },
    rarity: 'legendary',
    icon: '⊙',
    displayOrder: 220,
  },
  {
    id: 'pill_mascot',
    name: 'Pharma Pill',
    description: 'Pharmacology expert extraordinaire',
    system: 'SPECIAL',
    isBase: false,
    unlockCondition: { 
      type: 'easter_egg',
      value: 100,
      condition: 'pharmacology'
    },
    rarity: 'legendary',
    icon: '◉',
    displayOrder: 230,
  },
];

/**
 * Organ accessories that can be equipped to characters
 */
export const ORGAN_ACCESSORIES: OrganAccessory[] = [
  // ==================== COMMON ACCESSORIES ====================
  {
    id: 'basic_stethoscope',
    name: 'Basic Stethoscope',
    description: 'Every clinician\'s first tool',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'total_questions', 
      value: 50 
    },
    rarity: 'common',
    icon: '⊕',
    displayOrder: 1,
  },
  {
    id: 'medical_cap',
    name: 'Medical Cap',
    description: 'Scrubs fashion statement',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'total_questions', 
      value: 100 
    },
    rarity: 'common',
    icon: '^',
    displayOrder: 2,
  },
  {
    id: 'face_mask',
    name: 'Face Mask',
    description: 'PPE is important',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'total_questions', 
      value: 150 
    },
    rarity: 'common',
    icon: '▢',
    displayOrder: 3,
  },

  // ==================== STREAK-BASED ACCESSORIES ====================
  {
    id: 'flame_badge',
    name: 'Flame Badge',
    description: 'You\'re on fire!',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'streak', 
      value: 7 
    },
    rarity: 'uncommon',
    icon: '▲',
    displayOrder: 10,
  },
  {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    description: 'Supercharged studying',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'streak', 
      value: 14 
    },
    rarity: 'rare',
    icon: '⚡',
    displayOrder: 11,
  },
  {
    id: 'crown',
    name: 'Study Crown',
    description: 'Royalty of consistency',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'streak', 
      value: 30 
    },
    rarity: 'epic',
    icon: '♔',
    displayOrder: 12,
  },

  // ==================== ACHIEVEMENT ACCESSORIES ====================
  {
    id: 'golden_stethoscope',
    name: 'Golden Stethoscope',
    description: 'Symbol of clinical mastery',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'achievement',
      achievementId: 'clinical_excellence'
    },
    rarity: 'legendary',
    icon: '⊕★',
    displayOrder: 20,
  },
  {
    id: 'graduation_cap',
    name: 'Graduation Cap',
    description: 'Ready for boards',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'total_questions', 
      value: 1000 
    },
    rarity: 'epic',
    icon: '▭',
    displayOrder: 21,
  },
  {
    id: 'trophy_badge',
    name: 'Trophy Badge',
    description: 'Champion of learning',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'achievement',
      achievementId: 'perfect_100'
    },
    rarity: 'legendary',
    icon: '◊',
    displayOrder: 22,
  },

  // ==================== SPECIAL ACCESSORIES ====================
  {
    id: 'wizard_hat',
    name: 'Clinical Wizard Hat',
    description: 'Master of all systems',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'special_event',
    },
    rarity: 'legendary',
    icon: '△',
    displayOrder: 30,
  },
  {
    id: 'superhero_cape',
    name: 'Superhero Cape',
    description: 'Healthcare hero',
    compatibleSystems: ['ALL'],
    unlockCondition: { 
      type: 'streak', 
      value: 100 
    },
    rarity: 'legendary',
    icon: '▽',
    displayOrder: 31,
  },
];

/**
 * Get all variants for a specific system
 */
export function getVariantsForSystem(system: SystemCode | 'SPECIAL'): OrganVariant[] {
  return ORGAN_VARIANTS.filter(v => v.system === system);
}

/**
 * Get character by system
 */
export function getCharacterBySystem(system: SystemCode | 'SPECIAL'): OrganCharacter | undefined {
  return ORGAN_CHARACTERS.find(c => c.system === system);
}

/**
 * Get variant by ID
 */
export function getVariantById(variantId: OrganVariantId): OrganVariant | undefined {
  return ORGAN_VARIANTS.find(v => v.id === variantId);
}

/**
 * Get accessory by ID
 */
export function getAccessoryById(accessoryId: OrganAccessoryId): OrganAccessory | undefined {
  return ORGAN_ACCESSORIES.find(a => a.id === accessoryId);
}

/**
 * Check if accessory is compatible with system
 */
export function isAccessoryCompatible(
  accessoryId: OrganAccessoryId,
  system: SystemCode | 'SPECIAL'
): boolean {
  const accessory = getAccessoryById(accessoryId);
  if (!accessory) return false;
  return accessory.compatibleSystems.includes('ALL') || 
         accessory.compatibleSystems.includes(system);
}
