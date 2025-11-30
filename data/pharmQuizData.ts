/**
 * Pharmacology Quiz Data and Questions Generator
 * 
 * Generates high-yield PANCE pharmacology questions from the drugData.json database.
 * Focuses on mechanisms, side effects, contraindications, and clinical pearls.
 */

import drugData from '@/pharm/drugData.json';
import type { DrugEntry } from '@/pharm/drugTypes';
import { capitalizeFirstLetter, capitalizeOptions } from '@/lib/textUtils';

// Type assertion for the drug database
const DRUG_DATABASE = drugData as Record<string, DrugEntry>;

/**
 * Question types for pharmacology drills
 */
export type PharmQuestionType = 
  | 'mechanism'
  | 'side_effect'
  | 'contraindication'
  | 'drug_class'
  | 'antidote'
  | 'interaction'
  | 'clinical_use';

/**
 * A generated pharmacology question
 */
export interface PharmQuestion {
  id: string;
  type: PharmQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  drugName: string;
  drugClass: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * High-yield drug classes for PANCE
 */
const HIGH_YIELD_CLASSES = [
  'Beta-blocker',
  'ACE Inhibitor',
  'Angiotensin II Receptor Blocker',
  'Calcium Channel Blocker',
  'Thiazide Diuretic',
  'Loop Diuretic',
  'Potassium-sparing Diuretic',
  'Statin',
  'Anticoagulant',
  'Antiplatelet',
  'SSRI',
  'SNRI',
  'Benzodiazepine',
  'Opioid Analgesic',
  'NSAID',
  'Aminoglycoside',
  'Fluoroquinolone',
  'Macrolide',
  'Penicillin',
  'Cephalosporin',
  'Sulfonylurea',
  'Biguanide',
  'DPP-4 Inhibitor',
  'GLP-1 Receptor Agonist',
  'SGLT2 Inhibitor',
  'Proton Pump Inhibitor',
  'H2 Receptor Antagonist',
  'Corticosteroid',
  'Bronchodilator',
  'Anticholinergic',
  'Antihistamine',
  'Antipsychotic',
];

/**
 * Get all drugs in the database
 */
export function getAllDrugs(): string[] {
  return Object.keys(DRUG_DATABASE);
}

/**
 * Get drugs by class
 */
export function getDrugsByClass(drugClass: string): DrugEntry[] {
  return Object.values(DRUG_DATABASE).filter(
    drug => drug.class?.toLowerCase().includes(drugClass.toLowerCase()) ||
            drug.subclass?.toLowerCase().includes(drugClass.toLowerCase())
  );
}

/**
 * Get a random subset of drugs
 */
function getRandomDrugs(count: number, exclude?: string[]): DrugEntry[] {
  const allDrugs = Object.values(DRUG_DATABASE).filter(
    drug => !exclude?.includes(drug.term)
  );
  const shuffled = [...allDrugs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get drugs with similar class for distractor generation
 */
function getSimilarDrugs(drug: DrugEntry, count: number): DrugEntry[] {
  const sameClas = Object.values(DRUG_DATABASE).filter(
    d => d.term !== drug.term && 
        (d.class === drug.class || d.subclass === drug.subclass)
  );
  
  if (sameClas.length >= count) {
    return sameClas.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  // If not enough similar drugs, add random ones
  const remaining = getRandomDrugs(count - sameClas.length, [drug.term, ...sameClas.map(d => d.term)]);
  return [...sameClas, ...remaining].slice(0, count);
}

/**
 * Generate a mechanism of action question
 */
function generateMechanismQuestion(drug: DrugEntry): PharmQuestion {
  const distractors = getSimilarDrugs(drug, 3);
  
  const options = [
    drug.MOA.split('.')[0] + '.',
    ...distractors.map(d => d.MOA.split('.')[0] + '.')
  ];
  
  const shuffledOptions = capitalizeOptions(options.sort(() => Math.random() - 0.5));
  const correctIndex = shuffledOptions.indexOf(capitalizeFirstLetter(options[0]));
  
  return {
    id: `pharm-moa-${drug.term}-${Date.now()}`,
    type: 'mechanism',
    question: `What is the primary mechanism of action of ${drug.term}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${drug.term} works by: ${drug.MOA}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'medium',
  };
}

/**
 * Generate a side effect question
 */
function generateSideEffectQuestion(drug: DrugEntry): PharmQuestion {
  if (!drug.ADEs || drug.ADEs.length === 0) {
    return generateMechanismQuestion(drug); // Fallback
  }
  
  const correctADE = capitalizeFirstLetter(drug.ADEs[Math.floor(Math.random() * drug.ADEs.length)]);
  const distractors = getSimilarDrugs(drug, 3);
  
  const options = [
    correctADE,
    ...distractors.flatMap(d => d.ADEs || []).map(capitalizeFirstLetter).slice(0, 3)
  ].slice(0, 4);
  
  // Ensure we have 4 options
  while (options.length < 4) {
    options.push('Minimal side effects');
  }
  
  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctADE);
  
  return {
    id: `pharm-ade-${drug.term}-${Date.now()}`,
    type: 'side_effect',
    question: `Which of the following is a known adverse effect of ${drug.term}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.term} can cause: ${drug.ADEs.join(', ')}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'easy',
  };
}

/**
 * Generate a contraindication question
 */
function generateContraindicationQuestion(drug: DrugEntry): PharmQuestion {
  if (!drug.contraindications || drug.contraindications.length === 0) {
    return generateSideEffectQuestion(drug); // Fallback
  }
  
  const correctContra = capitalizeFirstLetter(drug.contraindications[Math.floor(Math.random() * drug.contraindications.length)]);
  const distractors = getRandomDrugs(3, [drug.term]);
  
  const options = [
    correctContra,
    ...distractors.flatMap(d => d.contraindications || []).map(capitalizeFirstLetter).slice(0, 3)
  ].slice(0, 4);
  
  while (options.length < 4) {
    options.push('No significant contraindications');
  }
  
  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctContra);
  
  return {
    id: `pharm-contra-${drug.term}-${Date.now()}`,
    type: 'contraindication',
    question: `Which of the following is a contraindication for ${drug.term}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.term} is contraindicated in: ${drug.contraindications.join(', ')}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'medium',
  };
}

/**
 * Generate a drug class identification question
 */
function generateDrugClassQuestion(drug: DrugEntry): PharmQuestion {
  const allClasses = [...new Set(Object.values(DRUG_DATABASE).map(d => d.class).filter(Boolean))];
  const distractorClasses = allClasses.filter(c => c !== drug.class).sort(() => Math.random() - 0.5).slice(0, 3);
  
  const options = capitalizeOptions([drug.class, ...distractorClasses]);
  const capitalizedClass = capitalizeFirstLetter(drug.class);
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(capitalizedClass);
  
  return {
    id: `pharm-class-${drug.term}-${Date.now()}`,
    type: 'drug_class',
    question: `${drug.term} belongs to which drug class?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${drug.term} is classified as a ${drug.class} (${drug.subclass}).`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'easy',
  };
}

/**
 * Generate an antidote question
 */
function generateAntidoteQuestion(drug: DrugEntry): PharmQuestion {
  if (!drug.antidote || drug.antidote === 'None' || drug.antidote.toLowerCase().includes('no specific')) {
    return generateSideEffectQuestion(drug); // Fallback
  }
  
  // Common antidotes for distractors
  const commonAntidotes = [
    'Naloxone',
    'Flumazenil',
    'N-acetylcysteine',
    'Vitamin K',
    'Protamine sulfate',
    'Atropine',
    'Physostigmine',
    'Calcium gluconate',
    'Deferoxamine',
    'Glucagon',
    'Fomepizole',
  ].filter(a => a !== drug.antidote);
  
  const distractors = commonAntidotes.sort(() => Math.random() - 0.5).slice(0, 3);
  const correctAntidote = capitalizeFirstLetter(drug.antidote.split('.')[0]);
  const options = [correctAntidote, ...distractors.map(capitalizeFirstLetter)];
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(correctAntidote);
  
  return {
    id: `pharm-antidote-${drug.term}-${Date.now()}`,
    type: 'antidote',
    question: `What is the antidote for ${drug.term} toxicity?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `The antidote for ${drug.term} is: ${drug.antidote}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'hard',
  };
}

/**
 * Generate a drug interaction question
 */
function generateInteractionQuestion(drug: DrugEntry): PharmQuestion {
  if (!drug.interactions || drug.interactions.length === 0) {
    return generateMechanismQuestion(drug); // Fallback
  }
  
  const interaction = drug.interactions[Math.floor(Math.random() * drug.interactions.length)];
  const interactionText = typeof interaction === 'string' ? interaction : interaction.drug || '';
  
  // Extract the interacting drug name
  const interactingDrug = capitalizeFirstLetter(interactionText.split(':')[0].split('(')[0].trim());
  
  const distractorDrugs = getRandomDrugs(3, [drug.term]).map(d => capitalizeFirstLetter(d.term));
  const options = [interactingDrug, ...distractorDrugs].slice(0, 4);
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(interactingDrug);
  
  return {
    id: `pharm-interact-${drug.term}-${Date.now()}`,
    type: 'interaction',
    question: `Which drug has a significant interaction with ${drug.term}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.term} interaction: ${interactionText}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'hard',
  };
}

/**
 * Generate a clinical use question
 */
function generateClinicalUseQuestion(drug: DrugEntry): PharmQuestion {
  if (!drug.clinicalNotes) {
    return generateMechanismQuestion(drug); // Fallback
  }
  
  // Extract key clinical uses from notes
  const clinicalUse = capitalizeFirstLetter(drug.clinicalNotes.split('.')[0] + '.');
  const distractors = getRandomDrugs(3, [drug.term]);
  
  const options = [
    clinicalUse,
    ...distractors.map(d => capitalizeFirstLetter(d.clinicalNotes?.split('.')[0] + '.' || 'Used for various conditions'))
  ].slice(0, 4);
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(clinicalUse);
  
  return {
    id: `pharm-clinical-${drug.term}-${Date.now()}`,
    type: 'clinical_use',
    question: `What is a primary clinical use of ${drug.term}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.term} clinical notes: ${drug.clinicalNotes}`,
    drugName: drug.term,
    drugClass: drug.class,
    difficulty: 'medium',
  };
}

/**
 * Generate a random pharmacology question
 */
export function generatePharmQuestion(preferredType?: PharmQuestionType): PharmQuestion {
  const drugs = Object.values(DRUG_DATABASE);
  const randomDrug = drugs[Math.floor(Math.random() * drugs.length)];
  
  const questionTypes: PharmQuestionType[] = [
    'mechanism',
    'side_effect',
    'contraindication',
    'drug_class',
    'antidote',
    'interaction',
    'clinical_use',
  ];
  
  const type = preferredType || questionTypes[Math.floor(Math.random() * questionTypes.length)];
  
  switch (type) {
    case 'mechanism':
      return generateMechanismQuestion(randomDrug);
    case 'side_effect':
      return generateSideEffectQuestion(randomDrug);
    case 'contraindication':
      return generateContraindicationQuestion(randomDrug);
    case 'drug_class':
      return generateDrugClassQuestion(randomDrug);
    case 'antidote':
      return generateAntidoteQuestion(randomDrug);
    case 'interaction':
      return generateInteractionQuestion(randomDrug);
    case 'clinical_use':
      return generateClinicalUseQuestion(randomDrug);
    default:
      return generateMechanismQuestion(randomDrug);
  }
}

/**
 * Generate multiple pharmacology questions
 */
export function generatePharmQuestions(count: number): PharmQuestion[] {
  const questions: PharmQuestion[] = [];
  const usedDrugs = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let question: PharmQuestion;
    
    do {
      question = generatePharmQuestion();
      attempts++;
    } while (usedDrugs.has(question.drugName) && attempts < 10);
    
    usedDrugs.add(question.drugName);
    questions.push(question);
  }
  
  return questions;
}

/**
 * Get high-yield drugs for PANCE study
 */
export function getHighYieldDrugs(): DrugEntry[] {
  return Object.values(DRUG_DATABASE).filter(drug => {
    const drugClass = (drug.class || '').toLowerCase();
    const drugSubclass = (drug.subclass || '').toLowerCase();
    
    return HIGH_YIELD_CLASSES.some(hyc => 
      drugClass.includes(hyc.toLowerCase()) || 
      drugSubclass.includes(hyc.toLowerCase())
    );
  });
}

export default {
  generatePharmQuestion,
  generatePharmQuestions,
  getAllDrugs,
  getDrugsByClass,
  getHighYieldDrugs,
};
