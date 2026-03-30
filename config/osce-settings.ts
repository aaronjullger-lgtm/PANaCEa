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
  difficult:
    'Patient gives vague answers, is distracted, or anxious - requires skilled interviewing.',
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
  description:
    'You are practicing in a rural clinic with limited imaging and laboratory capabilities. Rely on physical exam, history, and basic diagnostics.',
};

/**
 * Apply resource limitations to a case
 */
export function applyResourceLimitations(availableTests: string[]): string[] {
  return availableTests.filter(
    (test) =>
      !RESOURCE_LIMITED_SETTINGS.disabledTests.some((disabled) =>
        test.toLowerCase().includes(disabled.toLowerCase())
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

/**
 * Get a random cultural competency scenario for injection into an OSCE encounter.
 * Returns the scenario object or null if cultural competency is disabled.
 */
export function getRandomCulturalScenario(): (typeof CULTURAL_COMPETENCY_SCENARIOS)[number] | null {
  if (CULTURAL_COMPETENCY_SCENARIOS.length === 0) return null;
  const index = Math.floor(Math.random() * CULTURAL_COMPETENCY_SCENARIOS.length);
  return CULTURAL_COMPETENCY_SCENARIOS[index];
}

/**
 * Build a cultural competency prompt modifier for the AI patient simulator.
 * This gets appended to the patient persona system prompt when cultural competency is enabled.
 */
export function getCulturalCompetencyPrompt(scenarioId?: string): string {
  const scenario = scenarioId
    ? CULTURAL_COMPETENCY_SCENARIOS.find(s => s.id === scenarioId)
    : getRandomCulturalScenario();

  if (!scenario) return '';

  return `\n\nCULTURAL COMPETENCY LAYER: ${scenario.title}
${scenario.description}
The patient (or their family) has cultural beliefs that affect their care decisions. You should:
- Express these beliefs naturally during the conversation when relevant topics arise
- Do not volunteer the cultural concern immediately — let it emerge as the student asks appropriate questions
- React positively to culturally sensitive approaches and negatively to dismissive or pressuring behavior
- If the student acknowledges and respects the cultural perspective, become more cooperative
Teaching context (do not reveal to student): ${scenario.teachingPoints.join('; ')}`;
}

/**
 * Build a resource-limited prompt modifier for the AI patient simulator.
 * Appended to system prompt when resource-limited mode is enabled.
 */
export function getResourceLimitedPrompt(): string {
  return `\n\nRESOURCE-LIMITED SETTING: ${RESOURCE_LIMITED_SETTINGS.scenario}
${RESOURCE_LIMITED_SETTINGS.description}
The following tests are NOT available: ${RESOURCE_LIMITED_SETTINGS.disabledTests.join(', ')}.
Available diagnostics: ${RESOURCE_LIMITED_SETTINGS.availableTests.join(', ')}.
If the student orders an unavailable test, respond: "I'm sorry, that test is not available at this facility. What alternative would you like to consider?"`;
}

/**
 * OSCE Quick-Start Presets
 * Predefined configurations for focused organ-system practice sessions
 */
export interface OSCEQuickStartPreset {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  targetSystems: string[]; // organ systems to filter cases by
  difficulty: 'cooperative' | 'difficult' | 'very_difficult';
  enableCulturalCompetency: boolean;
  enableResourceLimited: boolean;
}

export const OSCE_QUICK_START_PRESETS: OSCEQuickStartPreset[] = [
  {
    id: 'cardio_basics',
    label: 'Cardiovascular Essentials',
    description: 'Master ACS, CHF, and DVT/PE management with supportive patients.',
    icon: 'Heart',
    targetSystems: ['cardiovascular'],
    difficulty: 'cooperative',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
  {
    id: 'neuro_emergencies',
    label: 'Neuro Emergencies',
    description: 'Handle acute stroke and seizure presentations with increased complexity.',
    icon: 'Brain',
    targetSystems: ['neurological'],
    difficulty: 'difficult',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
  {
    id: 'endo_crisis',
    label: 'Endocrine Crises',
    description: 'Manage DKA, HHS, and thyroid storm in cooperative patient encounters.',
    icon: 'Zap',
    targetSystems: ['endocrine'],
    difficulty: 'cooperative',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
  {
    id: 'infectious_workup',
    label: 'Infectious Disease Workup',
    description: 'Work through sepsis, pneumonia, and UTI diagnostics with clear histories.',
    icon: 'Bug',
    targetSystems: ['infectious_disease'],
    difficulty: 'cooperative',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
  {
    id: 'surgical_abdomen',
    label: 'Surgical Abdomen',
    description: 'Evaluate acute appendicitis, pancreatitis, and other surgical emergencies.',
    icon: 'Knife',
    targetSystems: ['gastrointestinal'],
    difficulty: 'difficult',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
  {
    id: 'rural_clinic',
    label: 'Rural Clinic Challenge',
    description: 'Mixed complex cases with limited diagnostic resources and delayed referrals.',
    icon: 'MapPin',
    targetSystems: [
      'cardiovascular',
      'neurological',
      'endocrine',
      'infectious_disease',
      'gastrointestinal',
    ],
    difficulty: 'difficult',
    enableCulturalCompetency: false,
    enableResourceLimited: true,
  },
  {
    id: 'cultural_sensitivity',
    label: 'Cultural Sensitivity Practice',
    description: 'Navigate cultural beliefs, language barriers, and health system mistrust.',
    icon: 'Users',
    targetSystems: [
      'cardiovascular',
      'neurological',
      'endocrine',
      'infectious_disease',
      'gastrointestinal',
    ],
    difficulty: 'cooperative',
    enableCulturalCompetency: true,
    enableResourceLimited: false,
  },
  {
    id: 'pance_rapid_fire',
    label: 'PANCE Rapid Fire',
    description: 'High-difficulty multi-system cases simulating board exam intensity.',
    icon: 'Zap',
    targetSystems: [
      'cardiovascular',
      'neurological',
      'endocrine',
      'infectious_disease',
      'gastrointestinal',
    ],
    difficulty: 'difficult',
    enableCulturalCompetency: false,
    enableResourceLimited: false,
  },
];

/**
 * Retrieve a quick-start preset by ID
 * @param id The preset ID
 * @returns The preset object or undefined if not found
 */
export function getPresetById(id: string): OSCEQuickStartPreset | undefined {
  return OSCE_QUICK_START_PRESETS.find((preset) => preset.id === id);
}
