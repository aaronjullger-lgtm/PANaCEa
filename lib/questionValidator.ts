import { GeneratedQuestion, ConditionData } from '../types/question';

export interface ValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
}

/**
 * Minimum acceptable validation score for a question to be considered valid.
 * Questions must score above this threshold AND have no errors to pass validation.
 * Score starts at 1.0 and is reduced by penalties for various issues:
 * - 0.2 for each missing cited section
 * - 0.5 for low keyword overlap with source
 * - 1.0 for structural issues (wrong option count, answer not in options)
 */
const VALIDATION_SCORE_THRESHOLD = 0.6;

/**
 * Validates that the question's answer is supported by the provided source text.
 * Uses a keyword density and semantic overlap heuristic.
 */
export function validateQuestion(
  question: GeneratedQuestion,
  sourceData: ConditionData
): ValidationResult {
  const errors: string[] = [];
  let score = 1.0;

  // 1. Check if source sections actually exist in the data
  question.sourceSections.forEach((sectionKey) => {
    if (!sourceData.sections[sectionKey]) {
      errors.push(`Cited section '${sectionKey}' does not exist in source data.`);
      score -= 0.2;
    }
  });

  // 2. Content Grounding Check
  // Combine text from cited sections
  const sourceText = question.sourceSections
    .map((key) => sourceData.sections[key] || '')
    .join(' ')
    .toLowerCase();

  const answerKeywords = question.correctAnswer
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Calculate how many significant words from the answer appear in the source
  const foundKeywords = answerKeywords.filter((word) => sourceText.includes(word));
  const coverage = answerKeywords.length > 0 ? foundKeywords.length / answerKeywords.length : 0;

  // Strict threshold: if answer is totally alien to the text, reject it.
  if (coverage < 0.3 && answerKeywords.length > 0) {
    errors.push('Answer appears unsupported by the cited source sections (low keyword overlap).');
    score -= 0.5;
  }

  // 3. Structure Check (PANCE uses 5 options; allow 4 for backward compatibility)
  if (question.type === 'mcq' || question.type === 'vignette') {
    if (!question.options || question.options.length < 4 || question.options.length > 5) {
      errors.push('MCQ/Vignette must have 4 or 5 options.');
      score -= 1.0; // Critical failure
    }
    if (!question.options?.includes(question.correctAnswer)) {
      errors.push('Correct answer is not listed among the options.');
      score -= 1.0;
    }
  }

  return {
    isValid: score > VALIDATION_SCORE_THRESHOLD && errors.length === 0,
    score: Math.max(0, score),
    errors,
  };
}
