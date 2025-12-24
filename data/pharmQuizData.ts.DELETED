/**
 * Pharmacology Quiz Data and Questions Generator
 * 
 * Generates high-yield PANCE pharmacology questions from Drug objects.
 * Focuses on mechanisms, side effects, contraindications, and clinical pearls.
 */

export interface Drug {
  id: string;
  genericName: string;
  brandName?: string | null;
  drugClass: string[];
  mechanismOfAction?: string | null;
  indications: string[];
  contraindications: string[];
  sideEffects: string[];
  interactions: string[];
  dosing?: string | null;
  tags: string[];
  clinicalNotes?: string | null;
  antidote?: string | null;
  metabolism?: string | null;
  elimination?: string | null;
}

export type PharmQuestionType = 
  | 'mechanism'
  | 'side_effect'
  | 'contraindication'
  | 'drug_class'
  | 'antidote'
  | 'interaction'
  | 'clinical_use';

export interface PharmQuestion {
  id: string;
  type: PharmQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  drugName: string;
  drugClass: string | string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

// Helper to get random distractors
function getRandomDrugs(count: number, excludeNames: string[], allDrugs: Drug[]): Drug[] {
  const pool = allDrugs.filter(d => !excludeNames.includes(d.genericName));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Helper to get similar drugs (same class)
function getSimilarDrugs(drug: Drug, count: number, allDrugs: Drug[]): Drug[] {
  const sameClass = allDrugs.filter(
    d => d.genericName !== drug.genericName && 
        d.drugClass.some(c => drug.drugClass.includes(c))
  );
  
  if (sameClass.length >= count) {
    return sameClass.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  // If not enough similar drugs, add random ones
  const remaining = getRandomDrugs(count - sameClass.length, [drug.genericName, ...sameClass.map(d => d.genericName)], allDrugs);
  return [...sameClass, ...remaining].slice(0, count);
}

function generateMechanismQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  const distractors = getSimilarDrugs(drug, 3, allDrugs);
  
  const moa = drug.mechanismOfAction || 'Mechanism unknown';
  const options = [
    moa.split('.')[0] + '.',
    ...distractors.map(d => (d.mechanismOfAction || 'Mechanism unknown').split('.')[0] + '.')
  ];
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(moa.split('.')[0] + '.');
  
  return {
    id: `pharm-moa-${drug.genericName}-${Date.now()}`,
    type: 'mechanism',
    question: `What is the primary mechanism of action of ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} works by: ${moa}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}

function generateSideEffectQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.sideEffects || drug.sideEffects.length === 0) {
    return generateMechanismQuestion(drug, allDrugs);
  }
  
  const correctADE = drug.sideEffects[Math.floor(Math.random() * drug.sideEffects.length)];
  const distractors = getSimilarDrugs(drug, 3, allDrugs);
  
  const options = [
    correctADE,
    ...distractors.flatMap(d => d.sideEffects || []).slice(0, 3)
  ].slice(0, 4);
  
  while (options.length < 4) {
    options.push('Minimal side effects');
  }
  
  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctADE);
  
  return {
    id: `pharm-ade-${drug.genericName}-${Date.now()}`,
    type: 'side_effect',
    question: `Which of the following is a known adverse effect of ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} can cause: ${drug.sideEffects.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'easy',
  };
}

function generateContraindicationQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.contraindications || drug.contraindications.length === 0) {
    return generateSideEffectQuestion(drug, allDrugs);
  }
  
  const correctContra = drug.contraindications[Math.floor(Math.random() * drug.contraindications.length)];
  const distractors = getRandomDrugs(3, [drug.genericName], allDrugs);
  
  const options = [
    correctContra,
    ...distractors.flatMap(d => d.contraindications || []).slice(0, 3)
  ].slice(0, 4);
  
  while (options.length < 4) {
    options.push('No significant contraindications');
  }
  
  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctContra);
  
  return {
    id: `pharm-contra-${drug.genericName}-${Date.now()}`,
    type: 'contraindication',
    question: `Which of the following is a contraindication for ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} is contraindicated in: ${drug.contraindications.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}

function generateDrugClassQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  const allClasses = [...new Set(allDrugs.flatMap(d => d.drugClass))];
  const primaryClass = drug.drugClass[0] || 'Unknown';
  
  const distractorClasses = allClasses
    .filter(c => !drug.drugClass.includes(c))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  
  const options = [primaryClass, ...distractorClasses];
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(primaryClass);
  
  return {
    id: `pharm-class-${drug.genericName}-${Date.now()}`,
    type: 'drug_class',
    question: `${drug.genericName} belongs to which drug class?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `${drug.genericName} is classified as a ${drug.drugClass.join(', ')}.`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'easy',
  };
}

function generateAntidoteQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.antidote || drug.antidote === 'None' || drug.antidote.toLowerCase().includes('no specific')) {
    return generateSideEffectQuestion(drug, allDrugs);
  }
  
  const commonAntidotes = [
    'Naloxone', 'Flumazenil', 'N-acetylcysteine', 'Vitamin K', 'Protamine sulfate',
    'Atropine', 'Physostigmine', 'Calcium gluconate', 'Deferoxamine', 'Glucagon', 'Fomepizole'
  ].filter(a => a !== drug.antidote);
  
  const distractors = commonAntidotes.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [drug.antidote.split('.')[0], ...distractors];
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(drug.antidote.split('.')[0]);
  
  return {
    id: `pharm-antidote-${drug.genericName}-${Date.now()}`,
    type: 'antidote',
    question: `What is the antidote for ${drug.genericName} toxicity?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `The antidote for ${drug.genericName} is: ${drug.antidote}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'hard',
  };
}

function generateInteractionQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.interactions || drug.interactions.length === 0) {
    return generateMechanismQuestion(drug, allDrugs);
  }
  
  const interaction = drug.interactions[Math.floor(Math.random() * drug.interactions.length)];
  // Interaction is now a string "Drug: Effect"
  const parts = interaction.split(':');
  const interactingDrug = parts[0].split('(')[0].trim();
  
  const distractorDrugs = getRandomDrugs(3, [drug.genericName], allDrugs).map(d => d.genericName);
  const options = [interactingDrug, ...distractorDrugs].slice(0, 4);
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(interactingDrug);
  
  return {
    id: `pharm-interact-${drug.genericName}-${Date.now()}`,
    type: 'interaction',
    question: `Which drug has a significant interaction with ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} interaction: ${interaction}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'hard',
  };
}

function generateClinicalUseQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.clinicalNotes) {
    return generateMechanismQuestion(drug, allDrugs);
  }
  
  const clinicalUse = drug.clinicalNotes.split('.')[0] + '.';
  const distractors = getRandomDrugs(3, [drug.genericName], allDrugs);
  
  const options = [
    clinicalUse,
    ...distractors.map(d => (d.clinicalNotes || 'Used for various conditions').split('.')[0] + '.')
  ].slice(0, 4);
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(clinicalUse);
  
  return {
    id: `pharm-clinical-${drug.genericName}-${Date.now()}`,
    type: 'clinical_use',
    question: `What is a primary clinical use of ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} clinical notes: ${drug.clinicalNotes}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}

export function generatePharmQuestion(drug: Drug, allDrugs: Drug[], preferredType?: PharmQuestionType): PharmQuestion {
  const questionTypes: PharmQuestionType[] = [
    'mechanism', 'side_effect', 'contraindication', 'drug_class', 
    'antidote', 'interaction', 'clinical_use'
  ];
  
  const type = preferredType || questionTypes[Math.floor(Math.random() * questionTypes.length)];
  
  switch (type) {
    case 'mechanism': return generateMechanismQuestion(drug, allDrugs);
    case 'side_effect': return generateSideEffectQuestion(drug, allDrugs);
    case 'contraindication': return generateContraindicationQuestion(drug, allDrugs);
    case 'drug_class': return generateDrugClassQuestion(drug, allDrugs);
    case 'antidote': return generateAntidoteQuestion(drug, allDrugs);
    case 'interaction': return generateInteractionQuestion(drug, allDrugs);
    case 'clinical_use': return generateClinicalUseQuestion(drug, allDrugs);
    default: return generateMechanismQuestion(drug, allDrugs);
  }
}

export default {
  generatePharmQuestion,
};
