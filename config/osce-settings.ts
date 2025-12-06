/**
 * OSCE and Patient Encounter Configuration
 * Supports voice-to-voice, resource limitations, and cultural competency
 */

import type { OSCEConfiguration } from '@/types';

export const DEFAULT_OSCE_CONFIG: OSCEConfiguration = {
  enableVoiceMode: false,
  aiDifficultyLevel: 'cooperative',
  resourceLimited: false,
  culturalCompetency: false,
};

export const OSCE_DIFFICULTY_DESCRIPTIONS = {
  cooperative: 'Patient provides clear, direct answers to questions.',
  difficult: 'Patient gives vague answers, is distracted, or anxious - requires skilled interviewing.',
  very_difficult: 'Patient is hostile, in pain, or has cognitive impairment - extreme challenge.',
};

export const CULTURAL_COMPETENCY_SCENARIOS = [
  {
    id: 'blood_transfusion',
    title: 'Religious Objection to Blood Products',
    description: "Jehovah's Witness patient refusing blood transfusion despite severe anemia.",
    teachingPoints: [
      'Respect patient autonomy and religious beliefs',
      'Explore alternative treatments (iron supplementation, EPO)',
      'Document informed refusal clearly',
      'Involve ethics committee if life-threatening',
    ],
  },
  {
    id: 'organ_donation',
    title: 'Cultural Beliefs About Organ Donation',
    description: 'Family culturally opposed to organ donation after brain death declaration.',
    teachingPoints: [
      'Understand various cultural/religious perspectives on death',
      'Provide culturally sensitive grief support',
      'Do not coerce or pressure families',
      'Respect family decision-making processes',
    ],
  },
  {
    id: 'end_of_life',
    title: 'End-of-Life Care Preferences',
    description: 'Hispanic family wanting to bring in spiritual healer and traditional remedies.',
    teachingPoints: [
      'Integrate traditional healing practices when safe',
      'Involve family in care decisions',
      'Use professional interpreters, not family members',
      'Understand different cultural views on truth-telling',
    ],
  },
  {
    id: 'mental_health_stigma',
    title: 'Mental Health Cultural Stigma',
    description: 'Asian patient denying depression symptoms due to cultural stigma.',
    teachingPoints: [
      'Recognize cultural differences in mental health expression',
      'Frame mental health in culturally acceptable ways',
      'Involve family support systems appropriately',
      'Avoid pathologizing cultural expressions',
    ],
  },
];

export const RESOURCE_LIMITED_SETTINGS = {
  disabledTests: ['CT Scan', 'MRI', 'PET Scan', 'Cardiac Catheterization'],
  availableTests: [
    'X-Ray',
    'Ultrasound',
    'Basic Labs (CBC, BMP, LFT)',
    'Urinalysis',
    'ECG',
    'Rapid Tests (Strep, Flu, COVID)',
  ],
  scenario: 'Rural Clinic',
  description: 'You are practicing in a rural clinic with limited imaging and laboratory capabilities. Rely on physical exam, history, and basic diagnostics.',
};

/**
 * Apply resource limitations to a case
 */
export function applyResourceLimitations(availableTests: string[]): string[] {
  return availableTests.filter(
    test => !RESOURCE_LIMITED_SETTINGS.disabledTests.some(
      disabled => test.toLowerCase().includes(disabled.toLowerCase())
    )
  );
}

/**
 * Get AI difficulty prompt modifier
 */
export function getAIDifficultyPrompt(difficulty: OSCEConfiguration['aiDifficultyLevel']): string {
  switch (difficulty) {
    case 'difficult':
      return 'The patient is somewhat vague, distracted, and gives incomplete answers. They may need to be redirected or asked follow-up questions to clarify information.';
    case 'very_difficult':
      return 'The patient is very difficult to interview: they are in significant pain, anxious, or have mild cognitive impairment. Answers are fragmented and may contradict. Requires exceptional communication skills.';
    case 'cooperative':
    default:
      return 'The patient is cooperative and provides clear, relevant answers to questions.';
  }
}
