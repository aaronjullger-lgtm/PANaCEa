/**
 * Condition Drill Data
 * 
 * Provides condition-based drill questions using the condition registry.
 * Generates questions about etiology, symptoms, diagnosis, treatment, and pearls.
 */

import { CONDITION_REGISTRY } from '@/conditionRegistry';
import type { ConditionMeta } from '@/conditionRegistry';

export type ConditionQuestionType = 
  | 'presentation'
  | 'diagnosis'
  | 'treatment'
  | 'etiology'
  | 'complication';

export interface ConditionQuestion {
  id: string;
  type: ConditionQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  conditionName: string;
  system: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Common presentations by system for generating questions
 */
const SYSTEM_PRESENTATIONS: Record<string, string[]> = {
  CV: [
    'Chest pain radiating to left arm',
    'Dyspnea on exertion',
    'Palpitations',
    'Syncope',
    'Lower extremity edema',
    'Orthopnea',
    'Paroxysmal nocturnal dyspnea',
  ],
  PULM: [
    'Productive cough',
    'Hemoptysis',
    'Wheezing',
    'Pleuritic chest pain',
    'Shortness of breath',
    'Cyanosis',
    'Digital clubbing',
  ],
  GI: [
    'Abdominal pain',
    'Nausea and vomiting',
    'Diarrhea',
    'Constipation',
    'Melena',
    'Hematochezia',
    'Jaundice',
    'Dysphagia',
  ],
  NEURO: [
    'Headache',
    'Altered mental status',
    'Focal weakness',
    'Numbness/tingling',
    'Seizures',
    'Vision changes',
    'Vertigo',
    'Gait disturbance',
  ],
  MSK: [
    'Joint pain',
    'Joint swelling',
    'Morning stiffness',
    'Limited range of motion',
    'Muscle weakness',
    'Back pain',
    'Deformity',
  ],
  ENDO: [
    'Weight changes',
    'Fatigue',
    'Polydipsia',
    'Polyuria',
    'Heat/cold intolerance',
    'Hair changes',
    'Skin changes',
  ],
  HEME: [
    'Fatigue',
    'Easy bruising',
    'Prolonged bleeding',
    'Pallor',
    'Lymphadenopathy',
    'Splenomegaly',
    'Petechiae',
  ],
  ID: [
    'Fever',
    'Chills',
    'Night sweats',
    'Weight loss',
    'Fatigue',
    'Rash',
    'Lymphadenopathy',
  ],
  RENAL: [
    'Flank pain',
    'Dysuria',
    'Hematuria',
    'Oliguria',
    'Peripheral edema',
    'Hypertension',
    'Foamy urine',
  ],
  PSYCH: [
    'Depressed mood',
    'Anxiety',
    'Insomnia',
    'Hallucinations',
    'Delusions',
    'Suicidal ideation',
    'Mood swings',
  ],
  DERM: [
    'Pruritus',
    'Rash',
    'Skin lesions',
    'Hair loss',
    'Nail changes',
    'Skin discoloration',
    'Vesicles/bullae',
  ],
};

/**
 * Get random conditions excluding a specific one
 */
function getRandomConditions(count: number, exclude: string): ConditionMeta[] {
  const filtered = CONDITION_REGISTRY.filter(c => c.condition !== exclude);
  return filtered.sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Get conditions from the same system
 */
function getSameSystemConditions(system: string, exclude: string, count: number): ConditionMeta[] {
  const filtered = CONDITION_REGISTRY.filter(
    c => c.system === system && c.condition !== exclude
  );
  
  if (filtered.length >= count) {
    return filtered.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  // Add from other systems if needed
  const additional = getRandomConditions(count - filtered.length, exclude);
  return [...filtered, ...additional].slice(0, count);
}

/**
 * Generate a presentation question
 */
function generatePresentationQuestion(condition: ConditionMeta): ConditionQuestion {
  const presentations = SYSTEM_PRESENTATIONS[condition.system] || SYSTEM_PRESENTATIONS['GI'];
  const correctPresentation = presentations[Math.floor(Math.random() * presentations.length)];
  
  // Get distractors from other systems
  const otherSystems = Object.keys(SYSTEM_PRESENTATIONS).filter(s => s !== condition.system);
  const distractorPresentations = otherSystems
    .flatMap(s => SYSTEM_PRESENTATIONS[s])
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  
  const options = [correctPresentation, ...distractorPresentations];
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(correctPresentation);
  
  return {
    id: `cond-pres-${condition.id}-${Date.now()}`,
    type: 'presentation',
    question: `Which presentation is most commonly associated with ${condition.condition}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${condition.condition} typically presents with symptoms related to the ${condition.system} system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'easy',
  };
}

/**
 * Generate a diagnosis identification question
 */
function generateDiagnosisQuestion(condition: ConditionMeta): ConditionQuestion {
  const distractors = getSameSystemConditions(condition.system, condition.condition, 3);
  
  const options = [
    condition.condition,
    ...distractors.map(d => d.condition)
  ];
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(condition.condition);
  
  // Create a clinical vignette-style question
  const presentations = SYSTEM_PRESENTATIONS[condition.system] || SYSTEM_PRESENTATIONS['GI'];
  const presentation = presentations[Math.floor(Math.random() * presentations.length)];
  
  return {
    id: `cond-dx-${condition.id}-${Date.now()}`,
    type: 'diagnosis',
    question: `A patient presents with ${presentation.toLowerCase()}. Based on this presentation and the ${condition.system} system involvement, which diagnosis should be considered?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${condition.condition} is a ${condition.system} condition that can present with various symptoms typical of the system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'medium',
  };
}

/**
 * Generate a system identification question
 */
function generateSystemQuestion(condition: ConditionMeta): ConditionQuestion {
  const allSystems = [...new Set(CONDITION_REGISTRY.map(c => c.system))];
  const distractorSystems = allSystems
    .filter(s => s !== condition.system)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  
  const options = [condition.system, ...distractorSystems];
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(condition.system);
  
  return {
    id: `cond-sys-${condition.id}-${Date.now()}`,
    type: 'etiology',
    question: `${condition.condition} primarily affects which organ system?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${condition.condition} is classified under the ${condition.system} (${condition.subcategory}) system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'easy',
  };
}

/**
 * Generate a subcategory question
 */
function generateSubcategoryQuestion(condition: ConditionMeta): ConditionQuestion {
  // Get other subcategories from the same system
  const sameSystem = CONDITION_REGISTRY.filter(c => c.system === condition.system);
  const subcategories = [...new Set(sameSystem.map(c => c.subcategory))];
  
  const distractors = subcategories
    .filter(s => s !== condition.subcategory)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  
  // Pad with generic options if needed
  while (distractors.length < 3) {
    distractors.push('General/Miscellaneous');
  }
  
  const options = [condition.subcategory, ...distractors];
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(condition.subcategory);
  
  return {
    id: `cond-subcat-${condition.id}-${Date.now()}`,
    type: 'complication',
    question: `${condition.condition} falls under which subcategory of ${condition.system} conditions?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${condition.condition} is categorized under "${condition.subcategory}" within the ${condition.system} system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'hard',
  };
}

/**
 * Generate a random condition drill question
 */
export function generateConditionQuestion(
  preferredType?: ConditionQuestionType,
  specificCondition?: ConditionMeta
): ConditionQuestion {
  const condition = specificCondition || 
    CONDITION_REGISTRY[Math.floor(Math.random() * CONDITION_REGISTRY.length)];
  
  const questionTypes: ConditionQuestionType[] = [
    'presentation',
    'diagnosis',
    'etiology',
    'complication',
  ];
  
  const type = preferredType || questionTypes[Math.floor(Math.random() * questionTypes.length)];
  
  switch (type) {
    case 'presentation':
      return generatePresentationQuestion(condition);
    case 'diagnosis':
      return generateDiagnosisQuestion(condition);
    case 'etiology':
      return generateSystemQuestion(condition);
    case 'complication':
      return generateSubcategoryQuestion(condition);
    default:
      return generatePresentationQuestion(condition);
  }
}

/**
 * Generate multiple condition questions
 */
export function generateConditionQuestions(count: number): ConditionQuestion[] {
  const questions: ConditionQuestion[] = [];
  const usedConditions = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let question: ConditionQuestion;
    
    do {
      question = generateConditionQuestion();
      attempts++;
    } while (usedConditions.has(question.conditionName) && attempts < 10);
    
    usedConditions.add(question.conditionName);
    questions.push(question);
  }
  
  return questions;
}

/**
 * Get all unique conditions
 */
export function getAllConditions(): ConditionMeta[] {
  return CONDITION_REGISTRY;
}

/**
 * Get conditions by system
 */
export function getConditionsBySystem(system: string): ConditionMeta[] {
  return CONDITION_REGISTRY.filter(c => c.system === system);
}

export default {
  generateConditionQuestion,
  generateConditionQuestions,
  getAllConditions,
  getConditionsBySystem,
};
