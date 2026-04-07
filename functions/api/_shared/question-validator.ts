import { GeneratedQuestionStrict, type QuestionOrder, type TaskCategory } from './question-schema';

/**
 * Valid question orders mapped to expected difficulty ranges.
 * first  = Remember/Understand (Bloom's 1-2) → 0.2–0.4
 * second = Apply/Analyze (Bloom's 3-4)       → 0.4–0.6
 * third  = Evaluate/Create (Bloom's 5-6)     → 0.6–0.9
 */
const ORDER_DIFFICULTY_RANGES: Record<QuestionOrder, [number, number]> = {
  first: [0.15, 0.50],   // generous bounds for fuzzy generation
  second: [0.35, 0.70],
  third: [0.50, 0.95],
};

const VALID_QUESTION_ORDERS: QuestionOrder[] = ['first', 'second', 'third'];

const VALID_TASK_CATEGORIES: TaskCategory[] = [
  'history_pe', 'diagnostics', 'diagnosis', 'management',
  'health_maintenance', 'pharmaceutical', 'basic_science', 'professional',
];

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

  // Rule 5: All explanation.incorrect entries must be non-empty strings.
  // For 4-option questions validate A–D; for 5-option questions validate A–E.
  const optionCount = question.options.length;
  const incorrectKeys = (['A', 'B', 'C', 'D', 'E'] as const).slice(0, optionCount);
  for (const key of incorrectKeys) {
    const explanation = (question.explanation.incorrect as Record<string, string>)[key];
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

  // Rule 7: questionOrder must be valid and align with difficulty
  if (!question.questionOrder || !VALID_QUESTION_ORDERS.includes(question.questionOrder)) {
    errors.push(
      `questionOrder must be one of ${VALID_QUESTION_ORDERS.join(', ')}, got: "${question.questionOrder}"`
    );
  } else {
    const [minDiff, maxDiff] = ORDER_DIFFICULTY_RANGES[question.questionOrder];
    if (typeof question.difficulty === 'number' && (question.difficulty < minDiff || question.difficulty > maxDiff)) {
      // Warn but don't fail — difficulty is a soft alignment
      errors.push(
        `questionOrder "${question.questionOrder}" has difficulty ${question.difficulty} outside expected range [${minDiff}, ${maxDiff}]. Consider adjusting.`
      );
    }
  }

  // Rule 8: taskCategory must be valid
  if (!question.taskCategory || !VALID_TASK_CATEGORIES.includes(question.taskCategory)) {
    errors.push(
      `taskCategory must be one of ${VALID_TASK_CATEGORIES.join(', ')}, got: "${question.taskCategory}"`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Throwing variant of validateGeneratedQuestion.
 *
 * Use this in code paths where an invalid question must never proceed
 * (e.g. writing directly to a canonical Question table without staging).
 * Callers that prefer graceful degradation should use validateGeneratedQuestion
 * and check the returned `valid` flag themselves.
 *
 * @throws Error listing all validation failures if the question is invalid.
 */
export function assertValidQuestion(
  question: Parameters<typeof validateGeneratedQuestion>[0]
): void {
  const result = validateGeneratedQuestion(question);
  if (!result.valid) {
    throw new Error(
      `Question validation failed:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`
    );
  }
}
