/**
 * Medical Spanish Service
 * Provides bilingual vignettes and medical vocabulary in Spanish
 * Additional Requirement: 58
 */

import type { Question } from '../types';

export type SpanishMode = 'english' | 'spanish' | 'side-by-side';

interface MedicalTerm {
  english: string;
  spanish: string;
  category: string;
}

// Common medical vocabulary
const MEDICAL_VOCABULARY: MedicalTerm[] = [
  { english: 'Chest pain', spanish: 'Dolor de pecho', category: 'Symptoms' },
  { english: 'Shortness of breath', spanish: 'Falta de aire', category: 'Symptoms' },
  { english: 'Headache', spanish: 'Dolor de cabeza', category: 'Symptoms' },
  { english: 'Fever', spanish: 'Fiebre', category: 'Symptoms' },
  { english: 'Nausea', spanish: 'Náusea', category: 'Symptoms' },
  { english: 'Vomiting', spanish: 'Vómito', category: 'Symptoms' },
  { english: 'Diarrhea', spanish: 'Diarrea', category: 'Symptoms' },
  { english: 'Cough', spanish: 'Tos', category: 'Symptoms' },
  { english: 'Dizziness', spanish: 'Mareo', category: 'Symptoms' },
  { english: 'Fatigue', spanish: 'Fatiga', category: 'Symptoms' },
  
  { english: 'Heart', spanish: 'Corazón', category: 'Anatomy' },
  { english: 'Lung', spanish: 'Pulmón', category: 'Anatomy' },
  { english: 'Liver', spanish: 'Hígado', category: 'Anatomy' },
  { english: 'Kidney', spanish: 'Riñón', category: 'Anatomy' },
  { english: 'Brain', spanish: 'Cerebro', category: 'Anatomy' },
  { english: 'Stomach', spanish: 'Estómago', category: 'Anatomy' },
  
  { english: 'Blood pressure', spanish: 'Presión arterial', category: 'Vitals' },
  { english: 'Heart rate', spanish: 'Frecuencia cardíaca', category: 'Vitals' },
  { english: 'Temperature', spanish: 'Temperatura', category: 'Vitals' },
  { english: 'Pulse', spanish: 'Pulso', category: 'Vitals' },
  
  { english: 'Diabetes', spanish: 'Diabetes', category: 'Conditions' },
  { english: 'Hypertension', spanish: 'Hipertensión', category: 'Conditions' },
  { english: 'Asthma', spanish: 'Asma', category: 'Conditions' },
  { english: 'Pneumonia', spanish: 'Neumonía', category: 'Conditions' },
  { english: 'Heart attack', spanish: 'Ataque al corazón', category: 'Conditions' },
  { english: 'Stroke', spanish: 'Accidente cerebrovascular', category: 'Conditions' },
];

/**
 * Translate question vignette to Spanish (simplified version)
 * In production, this would use a translation API or pre-translated content
 */
export function translateToSpanish(text: string): string {
  let translated = text;
  
  // Replace common medical terms
  MEDICAL_VOCABULARY.forEach(term => {
    const regex = new RegExp(term.english, 'gi');
    translated = translated.replace(regex, `${term.spanish} (${term.english})`);
  });
  
  return translated;
}

/**
 * Get a question with Spanish translation
 */
export function getSpanishQuestion(question: Question, mode: SpanishMode): Question {
  if (mode === 'english') {
    return question;
  }
  
  const spanishVignette = translateToSpanish(question.question);
  
  if (mode === 'spanish') {
    return {
      ...question,
      question: spanishVignette
    };
  }
  
  // Side-by-side mode
  return {
    ...question,
    question: `[English]\n${question.question}\n\n[Spanish]\n${spanishVignette}`
  };
}

/**
 * Get medical vocabulary for a specific category
 */
export function getMedicalVocabulary(category?: string): MedicalTerm[] {
  if (!category) {
    return MEDICAL_VOCABULARY;
  }
  return MEDICAL_VOCABULARY.filter(term => term.category === category);
}

/**
 * Get all vocabulary categories
 */
export function getVocabularyCategories(): string[] {
  return Array.from(new Set(MEDICAL_VOCABULARY.map(term => term.category)));
}

/**
 * Search medical vocabulary
 */
export function searchMedicalVocabulary(query: string): MedicalTerm[] {
  const lowerQuery = query.toLowerCase();
  return MEDICAL_VOCABULARY.filter(term => 
    term.english.toLowerCase().includes(lowerQuery) ||
    term.spanish.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get random medical term for flashcard
 */
export function getRandomMedicalTerm(): MedicalTerm {
  return MEDICAL_VOCABULARY[Math.floor(Math.random() * MEDICAL_VOCABULARY.length)];
}

/**
 * Extract medical terms from a vignette
 */
export function extractMedicalTerms(vignette: string): MedicalTerm[] {
  const foundTerms: MedicalTerm[] = [];
  
  MEDICAL_VOCABULARY.forEach(term => {
    if (vignette.toLowerCase().includes(term.english.toLowerCase())) {
      foundTerms.push(term);
    }
  });
  
  return foundTerms;
}
