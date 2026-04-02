import { GeneratedQuestionStrict } from './question-schema';

/**
 * Common medical stop words to skip when checking for diagnosis leaks in stems.
 * These words appear in many stems and should not trigger a diagnosis leak warning.
 */
export const COMMON_MEDICAL_STOP_WORDS = new Set([
  'patient',
  'presents',
  'with',
  'the',
  'and',
  'or',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'by',
  'from',
  'as',
  'who',
  'which',
  'that',
  'this',
  'his',
  'her',
  'their',
  'your',
  'has',
  'have',
  'having',
  'had',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'may',
  'might',
  'must',
  'year',
  'old',
  'ago',
  'days',
  'weeks',
  'months',
  'hours',
  'presenting',
  'complains',
  'reports',
  'noted',
  'found',
  'seen',
  'admitted',
  'hospitalized',
  'emergency',
  'symptoms',
  'signs',
  'findings',
  'examination',
  'exam',
  'vitals',
  'vital',
  'blood',
  'pressure',
  'temperature',
  'heart',
  'rate',
  'respiratory',
  'lab',
  'labs',
  'imaging',
  'image',
  'xray',
  'ct',
  'mri',
  'ultrasound',
  'ecg',
  'ekg',
  'test',
  'tests',
  'result',
  'results',
  'shows',
  'showing',
  'elevated',
  'decreased',
  'low',
  'high',
  'normal',
  'positive',
  'negative',
  'present',
  'absent',
  'history',
  'hpi',
  'chief',
  'complaint',
  'denies',
  'otherwise',
  'healthy',
  'well'
]);

/**
 * Validates a generated question against strict rules.
 * 
 * Rules:
 * 1. correctAnswer must exactly match one element of options[]
 * 2. No two options can be identical (case-insensitive)
 * 3. question stem must be at least 50 characters
 * 4. difficulty must be between 0.0 and 1.0 inclusive
 * 5. All 4 explanation.incorrect keys (A, B, C, D) must have non-empty strings
 * 6. The question stem must NOT contain diagnosis leak patterns
 *
 * @param question The generated question to validate
 * @returns Object with valid boolean and array of error strings
 */
export function validateGeneratedQuestion(
  question: GeneratedQuestionStrict
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: correctAnswer must exactly match one option
  if (!question.options.includes(question.correctAnswer)) {
    errors.push(
      `correctAnswer "${question.correctAnswer}" does not exactly match any option. Available options: ${question.options.join(', ')}`
    );
  }

  // Rule 2: No duplicate options (case-insensitive)
  const lowerOptions = question.options.map((opt) => opt.toLowerCase());
  const uniqueLowerOptions = new Set(lowerOptions);
  if (uniqueLowerOptions.size !== lowerOptions.length) {
    const duplicates = lowerOptions.filter(
      (opt, idx) => lowerOptions.indexOf(opt) !== idx
    );
    errors.push(`Duplicate options found (case-insensitive): ${[...new Set(duplicates)].join(', ')}`);
  }

  // Rule 3: question stem must be at least 50 characters
  if (question.question.length < 50) {
    errors.push(
      `Question stem is too short (${question.question.length} chars). Minimum 50 characters required.`
    );
  }

  // Rule 4: difficulty must be 0.0-1.0
  if (typeof question.difficulty !== 'number' || question.difficulty < 0.0 || question.difficulty > 1.0) {
    errors.push(
      `Difficulty must be a number between 0.0 and 1.0, got: ${question.difficulty}`
    );
  }

  // Rule 5: All 4 explanation.incorrect entries must be non-empty strings
  const incorrectKeys = ['A', 'B', 'C', 'D'] as const;
  for (const key of incorrectKeys) {
    const explanation = question.explanation.incorrect[key];
    if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
      errors.push(
        `explanation.incorrect.${key} is missing or empty`
      );
    }
  }

  // Rule 6: Check for diagnosis leak in stem
  // Tokenize the stem and check if any high-value medical term appears as a standalone word
  // (This is a heuristic check; for production use, consider more sophisticated NLP)
  const stemLower = question.question.toLowerCase();
  const stemWords = stemLower
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/[.,;:!?\-()]/g, '')
        .toLowerCase()
    )
    .filter((word) => word.length > 2); // Skip very short words

  // Flag common diagnosis/condition words that shouldn't appear directly in the stem
  const suspiciousDiagnosisTerms = [
    'afib',
    'fibrillation',
    'pneumonia',
    'lyme',
    'myocardial',
    'infarction',
    'stroke',
    'sepsis',
    'asthma',
    'copd',
    'diabetes',
    'thyroid',
    'cancer',
    'tuberculosis',
    'hepatitis',
    'cirrhosis',
    'pancreatitis',
    'appendicitis',
    'gastroenteritis',
    'meningitis',
    'encephalitis',
    'glomerulonephritis',
    'endocarditis'
  ];

  for (const term of suspiciousDiagnosisTerms) {
    if (stemWords.includes(term)) {
      errors.push(
        `Possible diagnosis leak: "${term}" appears directly in stem. Stems should not contain the diagnosis name.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
