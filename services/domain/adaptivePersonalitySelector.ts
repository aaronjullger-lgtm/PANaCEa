/**
 * Adaptive Personality Selector for OSCE Encounters
 *
 * Instead of random personality generation, this module selects personality
 * traits based on:
 * - Student's weak clinical areas (anxious patient if struggling with psych)
 * - Current rotation alignment (surgical personality for surgery rotation)
 * - Progressive difficulty (cooperative → evasive → angry over sessions)
 * - Previous OSCE performance (focus on communication gaps)
 *
 * Falls back to random generation when no adaptive data is available.
 */

import type {
  PatientPersonalityMatrix,
  CommunicationStyle,
  HiddenAgenda,
} from '@/types/osce-enhanced';
import { generatePatientPersonality } from './patientPersonalityEngine';

export interface StudentOSCEProfile {
  /** Number of completed OSCE sessions */
  totalSessions: number;
  /** Average rapport score (0-100) across sessions */
  averageRapportScore: number;
  /** Communication competency scores by category */
  communicationScores?: {
    empathy?: number;       // 0-5
    professionalism?: number;
    pacing?: number;
  };
  /** Organ systems where accuracy is lowest */
  weakSystems?: string[];
  /** Current clinical rotation name */
  currentRotation?: string;
  /** Previously encountered personality styles */
  seenStyles?: CommunicationStyle[];
}

/** Rotation → personality style mapping for realistic encounters */
const ROTATION_PERSONALITY_WEIGHTS: Record<string, Partial<Record<CommunicationStyle, number>>> = {
  'Internal Medicine': { verbose: 0.3, confused: 0.2, stoic: 0.2, anxious: 0.15, terse: 0.15 },
  'Emergency Medicine': { anxious: 0.3, dramatic: 0.2, angry: 0.15, terse: 0.15, confused: 0.2 },
  'Psychiatry': { anxious: 0.25, evasive: 0.25, dramatic: 0.15, angry: 0.15, confused: 0.1, verbose: 0.1 },
  'Behavioral Health': { anxious: 0.25, evasive: 0.25, dramatic: 0.15, angry: 0.15, confused: 0.1, verbose: 0.1 },
  'Pediatrics': { anxious: 0.35, verbose: 0.25, dramatic: 0.2, confused: 0.1, terse: 0.1 },
  'Surgery': { stoic: 0.3, terse: 0.25, anxious: 0.2, angry: 0.1, confused: 0.15 },
  'General Surgery': { stoic: 0.3, terse: 0.25, anxious: 0.2, angry: 0.1, confused: 0.15 },
  'Family Medicine': { verbose: 0.25, anxious: 0.2, stoic: 0.15, confused: 0.15, terse: 0.15, evasive: 0.1 },
  "Women's Health": { anxious: 0.3, evasive: 0.2, verbose: 0.2, stoic: 0.15, dramatic: 0.15 },
  'Orthopedics': { stoic: 0.35, terse: 0.25, angry: 0.15, dramatic: 0.15, anxious: 0.1 },
};

/** Progressive difficulty tiers based on completed sessions */
const DIFFICULTY_TIERS: Array<{
  maxSessions: number;
  allowedStyles: CommunicationStyle[];
  hiddenAgendaChance: number;
  minTrust: number;
  maxTrust: number;
}> = [
  {
    maxSessions: 3,
    allowedStyles: ['verbose', 'anxious', 'stoic'],
    hiddenAgendaChance: 0.1,
    minTrust: 5,
    maxTrust: 8,
  },
  {
    maxSessions: 10,
    allowedStyles: ['verbose', 'anxious', 'stoic', 'terse', 'confused', 'dramatic'],
    hiddenAgendaChance: 0.3,
    minTrust: 3,
    maxTrust: 7,
  },
  {
    maxSessions: 25,
    allowedStyles: ['verbose', 'anxious', 'stoic', 'terse', 'confused', 'dramatic', 'evasive'],
    hiddenAgendaChance: 0.5,
    minTrust: 2,
    maxTrust: 6,
  },
  {
    maxSessions: Infinity,
    allowedStyles: ['verbose', 'anxious', 'stoic', 'terse', 'confused', 'dramatic', 'evasive', 'angry'],
    hiddenAgendaChance: 0.6,
    minTrust: 1,
    maxTrust: 6,
  },
];

/**
 * Select an adaptive personality based on student profile.
 * Falls back to random generation if profile data is insufficient.
 */
export function selectAdaptivePersonality(
  profile?: StudentOSCEProfile
): PatientPersonalityMatrix {
  // Fallback to random if no profile data
  if (!profile || profile.totalSessions === 0) {
    return generatePatientPersonality();
  }

  // Determine difficulty tier
  const tier = DIFFICULTY_TIERS.find(t => profile.totalSessions <= t.maxSessions)
    || DIFFICULTY_TIERS[DIFFICULTY_TIERS.length - 1]!;

  // Select communication style
  const style = selectCommunicationStyle(profile, tier);

  // Determine hidden agenda
  const hiddenAgenda = selectHiddenAgenda(profile, tier);

  // Trust threshold based on tier + student's rapport skills
  const rapportFactor = profile.averageRapportScore / 100; // 0-1
  const trustRange = tier.maxTrust - tier.minTrust;
  // Better rapport skill → lower trust threshold (harder patient — they can handle it)
  const trustThreshold = Math.round(
    tier.minTrust + trustRange * (1 - rapportFactor * 0.7)
  );

  // Anxiety level — higher for students who struggle with empathy
  const empathyScore = profile.communicationScores?.empathy ?? 3;
  const anxietyLevel = Math.min(10, Math.max(2,
    Math.round(8 - empathyScore) + Math.round(Math.random() * 2)
  ));

  // Cooperativeness — lower for more experienced students
  const cooperativeness = Math.min(10, Math.max(3,
    9 - Math.floor(profile.totalSessions / 8) + Math.round(Math.random() * 2)
  ));

  return {
    communicationStyle: style,
    healthLiteracy: selectWeighted(
      ['low', 'moderate', 'high'] as const,
      [0.25, 0.5, 0.25]
    ),
    painBehavior: selectWeighted(
      ['minimizer', 'accurate', 'catastrophizer'] as const,
      [0.3, 0.4, 0.3]
    ),
    hiddenAgenda,
    trustThreshold,
    anxietyLevel,
    cooperativeness,
  };
}

function selectCommunicationStyle(
  profile: StudentOSCEProfile,
  tier: typeof DIFFICULTY_TIERS[number]
): CommunicationStyle {
  const allowedStyles = tier.allowedStyles;

  // Get rotation-specific weights if available
  let weights: Partial<Record<CommunicationStyle, number>> = {};
  if (profile.currentRotation) {
    // Try exact match first, then partial match
    weights = ROTATION_PERSONALITY_WEIGHTS[profile.currentRotation] || {};
    if (Object.keys(weights).length === 0) {
      for (const [rotation, w] of Object.entries(ROTATION_PERSONALITY_WEIGHTS)) {
        if (profile.currentRotation.toLowerCase().includes(rotation.toLowerCase()) ||
            rotation.toLowerCase().includes(profile.currentRotation.toLowerCase())) {
          weights = w;
          break;
        }
      }
    }
  }

  // Prioritize styles the student hasn't seen recently
  const unseenBonus = 0.15;
  const seenStyles = new Set(profile.seenStyles || []);

  // Build weighted array
  const candidates: Array<{ style: CommunicationStyle; weight: number }> = [];
  for (const style of allowedStyles) {
    let weight = weights[style] ?? (1 / allowedStyles.length);
    if (!seenStyles.has(style)) weight += unseenBonus;
    candidates.push({ style, weight });
  }

  // Normalize and select
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const candidate of candidates) {
    rand -= candidate.weight;
    if (rand <= 0) return candidate.style;
  }

  return candidates[0]?.style ?? 'verbose';
}

function selectHiddenAgenda(
  profile: StudentOSCEProfile,
  tier: typeof DIFFICULTY_TIERS[number]
): HiddenAgenda {
  if (Math.random() > tier.hiddenAgendaChance) return 'none';

  // Weight agendas by relevance to student's weak areas
  const agendas: Array<{ agenda: HiddenAgenda; weight: number }> = [
    { agenda: 'afraid_of_diagnosis', weight: 0.25 },
    { agenda: 'wants_specific_medication', weight: 0.2 },
    { agenda: 'social_issues', weight: 0.2 },
    { agenda: 'secondary_gain', weight: 0.2 },
    { agenda: 'family_pressure', weight: 0.15 },
  ];

  // If student is weak in psych, increase social/family agenda likelihood
  if (profile.weakSystems?.includes('PSYCH')) {
    const social = agendas.find(a => a.agenda === 'social_issues');
    const family = agendas.find(a => a.agenda === 'family_pressure');
    if (social) social.weight += 0.15;
    if (family) family.weight += 0.1;
  }

  const total = agendas.reduce((s, a) => s + a.weight, 0);
  let rand = Math.random() * total;
  for (const a of agendas) {
    rand -= a.weight;
    if (rand <= 0) return a.agenda;
  }
  return 'afraid_of_diagnosis';
}

function selectWeighted<T>(items: readonly T[], weights: number[]): T {
  const rand = Math.random();
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += weights[i]!;
    if (rand <= sum) return items[i]!;
  }
  return items[0]!;
}

/**
 * Map rotation name to OSCE case categories for rotation-specific practice.
 */
export const ROTATION_CASE_MAP: Record<string, string[]> = {
  'Internal Medicine': ['ACS', 'CHF', 'COPD exacerbation', 'DKA', 'Pneumonia', 'DVT/PE', 'Cirrhosis', 'GI bleed', 'Sepsis'],
  'Emergency Medicine': ['STEMI', 'Stroke', 'Trauma', 'PE', 'Appendicitis', 'Anaphylaxis', 'Pneumothorax', 'Sepsis', 'Overdose'],
  'General Surgery': ['Appendicitis', 'Cholecystitis', 'Bowel obstruction', 'Hernia', 'Breast mass', 'Diverticulitis', 'Trauma'],
  'Pediatrics': ['Asthma exacerbation', 'Otitis media', 'Croup', 'Bronchiolitis', 'Febrile seizure', 'Gastroenteritis', 'Kawasaki disease'],
  'Behavioral Health': ['MDD', 'Generalized anxiety', 'Bipolar disorder', 'Schizophrenia', 'PTSD', 'Substance use', 'Suicidal ideation'],
  'Psychiatry': ['MDD', 'Generalized anxiety', 'Bipolar disorder', 'Schizophrenia', 'PTSD', 'Substance use', 'Suicidal ideation'],
  "Women's Health": ['Ectopic pregnancy', 'Preeclampsia', 'PCOS', 'Endometriosis', 'Abnormal uterine bleeding', 'Pelvic inflammatory disease'],
  'Family Medicine': ['Hypertension', 'Diabetes management', 'Depression', 'Low back pain', 'UTI', 'Osteoarthritis', 'Well-child visit'],
  'Orthopedics': ['ACL tear', 'Rotator cuff', 'Hip fracture', 'Carpal tunnel', 'Compartment syndrome', 'Ankle sprain'],
  'Cardiology': ['Heart failure', 'Atrial fibrillation', 'Valvular disease', 'Aortic dissection', 'Endocarditis', 'Pericarditis'],
  'Dermatology': ['Melanoma', 'Basal cell carcinoma', 'Psoriasis', 'Contact dermatitis', 'Cellulitis', 'Herpes zoster'],
};

/**
 * Get suggested OSCE cases for a rotation.
 */
export function getRotationCases(rotationName: string): string[] {
  // Try exact match, then partial
  if (ROTATION_CASE_MAP[rotationName]) return ROTATION_CASE_MAP[rotationName]!;
  for (const [key, cases] of Object.entries(ROTATION_CASE_MAP)) {
    if (rotationName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(rotationName.toLowerCase())) {
      return cases;
    }
  }
  return [];
}
