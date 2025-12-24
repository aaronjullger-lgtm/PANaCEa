/**
 * Condition Drill Data
 * 
 * Provides condition-based drill questions using the database API.
 * Generates questions about etiology, symptoms, diagnosis, treatment, and pearls.
 * 
 * NOTE: This file is legacy and should be migrated to use the database API.
 * Currently kept for type definitions and backward compatibility.
 */

import type { ConditionMeta } from '@/src/types/conditions';

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
 * TODO: Migrate to use /api/conditions endpoint
 */
function getRandomConditions(count: number, exclude: string): ConditionMeta[] {
  console.warn('getRandomConditions: Legacy function - migrate to database API');
  return [];
}

/**
 * Get conditions from the same system
 * TODO: Migrate to use /api/conditions?system={system} endpoint
 */
function getSameSystemConditions(system: string, exclude: string, count: number): ConditionMeta[] {
  console.warn('getSameSystemConditions: Legacy function - migrate to database API');
  return [];
}
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
    id: `cond-pres-${condition.condition.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
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
    id: `cond-dx-${condition.condition.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
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
 * TODO: Migrate to use /api/conditions endpoint
 */
function generateSystemQuestion(condition: ConditionMeta): ConditionQuestion {
  console.warn('generateSystemQuestion: Legacy function - migrate to database API');
  return {
    id: `cond-sys-${condition.condition.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
    type: 'etiology',
    question: `${condition.condition} primarily affects which organ system?`,
    options: [condition.system, 'CV', 'PULM', 'GI'],
    correctAnswerIndex: 0,
    explanation: `${condition.condition} is classified under the ${condition.system} (${condition.subcategory}) system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'easy',
  };
}

/**
 * Generate a subcategory question
 * TODO: Migrate to use /api/conditions?system={system} endpoint
 */
function generateSubcategoryQuestion(condition: ConditionMeta): ConditionQuestion {
  console.warn('generateSubcategoryQuestion: Legacy function - migrate to database API');
  return {
    id: `cond-subcat-${condition.condition.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
    type: 'complication',
    question: `${condition.condition} falls under which subcategory of ${condition.system} conditions?`,
    options: [condition.subcategory, 'General', 'Acute', 'Chronic'],
    correctAnswerIndex: 0,
    explanation: `${condition.condition} is categorized under "${condition.subcategory}" within the ${condition.system} system.`,
    conditionName: condition.condition,
    system: condition.system,
    difficulty: 'hard',
  };
}

/**
 * Generate a random condition drill question
 * TODO: Migrate to use /api/conditions endpoint
 */
export function generateConditionQuestion(
  preferredType?: ConditionQuestionType,
  specificCondition?: ConditionMeta
): ConditionQuestion {
  console.warn('generateConditionQuestion: Legacy function - migrate to database API');
  
  if (!specificCondition) {
    throw new Error('specificCondition is required - random selection removed');
  }
  
  const condition = specificCondition;
  
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
 * TODO: Migrate to use /api/conditions endpoint
 */
export function getAllConditions(): ConditionMeta[] {
  console.warn('getAllConditions: Legacy function - migrate to database API');
  return [];
}

/**
 * Get conditions by system
 * TODO: Migrate to use /api/conditions?system={system} endpoint
 */
export function getConditionsBySystem(system: string): ConditionMeta[] {
  console.warn('getConditionsBySystem: Legacy function - migrate to database API');
  return [];
}

export default {
  generateConditionQuestion,
  generateConditionQuestions,
  getAllConditions,
  getConditionsBySystem,
};
