/**
 * Distractor Validation Utility
 *
 * Sprint C - Step 7: Validate quality of incorrect answer options (distractors)
 *
 * Purpose: Ensure distractors are:
 * - Not duplicates
 * - Similar length to correct answer (±50%)
 * - Medically plausible (not obviously wrong)
 * - Not revealing the correct answer through pattern
 *
 * Kaplan-Level Standard (see docs/AUDIT_KAPLAN_QUESTION_MODEL.md):
 * Every wrong answer should be "the right answer to a different question" - correct
 * for a slightly different patient (e.g. otitis: viral vs bacterial vs recurrent vs
 * penicillin-allergic). Validation suggests this when score or plausibility is low.
 *
 * Poor distractors reduce question effectiveness and can harm learning.
 */

export interface DistractorValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

export interface QuestionForValidation {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string | number; // Can be letter (A,B,C,D) or index (0,1,2,3)
}

/**
 * Validate distractors for a single question
 *
 * @param question - Question with options to validate
 * @returns Validation result with score and issues
 */
export function validateDistractors(question: QuestionForValidation): DistractorValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Get correct answer index
  let correctIndex: number;
  if (typeof question.correctAnswer === 'number') {
    correctIndex = question.correctAnswer;
  } else {
    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    correctIndex = letterMap[question.correctAnswer.toUpperCase()] ?? 0;
  }

  const options = question.options;
  const correctOption = options[correctIndex] ?? '';

  // RULE 1: No duplicate options
  const uniqueOptions = new Set(options.map((opt) => opt.trim().toLowerCase()));
  if (uniqueOptions.size < options.length) {
    issues.push('Duplicate options detected');
    score -= 30;
  }

  // RULE 2: No empty options
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt || opt.trim().length === 0) {
      issues.push(`Option ${String.fromCharCode(65 + i)} is empty`);
      score -= 20;
    }
  }

  // RULE 3: Similar length (within ±50% of correct answer)
  const correctLength = correctOption?.length || 0;
  const minLength = correctLength * 0.5;
  const maxLength = correctLength * 1.5;

  let lengthViolations = 0;
  for (let i = 0; i < options.length; i++) {
    if (i === correctIndex) continue;

    const opt = options[i];
    if (!opt) continue;
    const optLength = opt.length;
    if (optLength < minLength || optLength > maxLength) {
      lengthViolations++;
      const letterCode = String.fromCharCode(65 + i);
      warnings.push(
        `Option ${letterCode} length (${optLength}) differs significantly from correct answer (${correctLength})`
      );
    }
  }

  if (lengthViolations >= 2) {
    score -= 15;
    suggestions.push('Make option lengths more similar to avoid revealing correct answer');
  }

  // Kaplan-level suggestion: each distractor should be "right answer to a different question"
  if (score < 85) {
    suggestions.push(
      'Kaplan-level: Ensure each wrong answer is correct for a different patient/scenario (e.g. viral vs bacterial vs recurrent vs penicillin-allergic for otitis)'
    );
  }

  // RULE 4: Correct answer not always in same position
  // (Can only check this across multiple questions, so just warn if it's always A or always D)
  if (correctIndex === 0) {
    warnings.push('Correct answer is A - ensure variety across questions');
  } else if (correctIndex === options.length - 1) {
    warnings.push('Correct answer is last option - ensure variety across questions');
  }

  // RULE 5: Avoid obviously wrong distractors
  const obviouslyWrongPatterns = [
    /\bnone of the above\b/i,
    /\ball of the above\b/i,
    /\bnot applicable\b/i,
    /\bn\/a\b/i,
    /\bunknown\b/i,
    /\bcannot be determined\b/i,
  ];

  for (let i = 0; i < options.length; i++) {
    if (i === correctIndex) continue;

    const option = options[i].toLowerCase();

    for (const pattern of obviouslyWrongPatterns) {
      if (pattern.test(option)) {
        warnings.push(
          `Option ${String.fromCharCode(65 + i)} contains weak distractor phrase: "${option.match(pattern)?.[0]}"`
        );
        score -= 5;
        break;
      }
    }
  }

  // RULE 6: Avoid numerical patterns that reveal answer
  // Example: If options are 10, 20, 30, 40 and answer is 30, it's in the middle
  const numericOptions = options.map((opt) => {
    const match = opt.match(/^(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  });

  const allNumeric = numericOptions.every((n) => n !== null);

  if (allNumeric) {
    const sorted = [...numericOptions].sort((a, b) => (a ?? 0) - (b ?? 0));
    const correctValue = numericOptions[correctIndex] ?? 0;
    const sortedIndex = sorted.indexOf(correctValue);

    // If correct answer is always middle value, that's a pattern
    if (sortedIndex === 1 || sortedIndex === 2) {
      warnings.push('Correct numerical value is near middle of range - consider varying');
    }
  }

  // RULE 7: Check for grammatical giveaways
  // Example: Question ends with "a" but only one option starts with vowel
  const questionEndsWithA = /\ba$/i.test(question.question);
  const questionEndsWithAn = /\ban$/i.test(question.question);

  if (questionEndsWithA || questionEndsWithAn) {
    const startsWithVowel = (opt: string | undefined) =>
      opt ? /^[aeiou]/i.test(opt.trim()) : false;
    const vowelOptions = options.filter(
      (opt): opt is string => opt !== undefined && startsWithVowel(opt)
    );

    if (vowelOptions.length === 1 && correctOption && startsWithVowel(correctOption)) {
      issues.push('Grammatical article ("a"/"an") reveals correct answer');
      score -= 20;
      suggestions.push('Rephrase question to avoid using "a" or "an" at the end');
    }
  }

  // RULE 8: Avoid overly specific vs. overly general distractors
  // Correct answer should not be the only specific or only general option
  const hasNumbers = (opt: string | undefined) => (opt ? /\d+/.test(opt) : false);
  const hasUnits = (opt: string | undefined) =>
    opt ? /(mg|mcg|ml|units|days|hours|minutes|weeks|months|years)/i.test(opt) : false;

  const correctHasNumbers = hasNumbers(correctOption);
  const correctHasUnits = hasUnits(correctOption);

  const otherOptions = options.filter((_, i) => i !== correctIndex);
  const othersHaveNumbers = otherOptions.some(hasNumbers);
  const othersHaveUnits = otherOptions.some(hasUnits);

  if (correctHasNumbers && !othersHaveNumbers) {
    warnings.push('Correct answer has specific numbers but distractors do not');
    score -= 10;
  }

  if (correctHasUnits && !othersHaveUnits) {
    warnings.push('Correct answer has units but distractors do not');
    score -= 10;
  }

  // Final score bounds
  score = Math.max(0, Math.min(100, score));

  // Determine overall validity
  const isValid = score >= 70 && issues.length === 0;

  return {
    isValid,
    score,
    issues,
    warnings,
    suggestions,
  };
}

/**
 * Batch validate multiple questions
 *
 * @param questions - Array of questions to validate
 * @returns Array of validation results
 */
export function validateDistractorsBatch(questions: QuestionForValidation[]): Array<{
  questionId: string;
  validation: DistractorValidationResult;
}> {
  return questions.map((q) => ({
    questionId: q.id,
    validation: validateDistractors(q),
  }));
}

/**
 * Get summary statistics for a batch of questions
 *
 * @param results - Array of validation results
 * @returns Summary statistics
 */
export function getValidationSummary(
  results: Array<{ questionId: string; validation: DistractorValidationResult }>
): {
  totalQuestions: number;
  validQuestions: number;
  invalidQuestions: number;
  averageScore: number;
  commonIssues: Array<{ issue: string; count: number }>;
  commonWarnings: Array<{ warning: string; count: number }>;
} {
  const totalQuestions = results.length;
  const validQuestions = results.filter((r) => r.validation.isValid).length;
  const invalidQuestions = totalQuestions - validQuestions;

  const totalScore = results.reduce((sum, r) => sum + r.validation.score, 0);
  const averageScore = totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;

  // Count issues
  const issueMap = new Map<string, number>();
  const warningMap = new Map<string, number>();

  for (const result of results) {
    for (const issue of result.validation.issues) {
      issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
    }
    for (const warning of result.validation.warnings) {
      warningMap.set(warning, (warningMap.get(warning) || 0) + 1);
    }
  }

  const commonIssues = Array.from(issueMap.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count);

  const commonWarnings = Array.from(warningMap.entries())
    .map(([warning, count]) => ({ warning, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 warnings

  return {
    totalQuestions,
    validQuestions,
    invalidQuestions,
    averageScore,
    commonIssues,
    commonWarnings,
  };
}

/**
 * Generate a human-readable report
 *
 * @param results - Array of validation results
 * @returns Formatted report string
 */
export function generateValidationReport(
  results: Array<{ questionId: string; validation: DistractorValidationResult }>
): string {
  const summary = getValidationSummary(results);

  const lines = [
    '📊 Distractor Validation Report',
    '═'.repeat(70),
    '',
    `Total Questions: ${summary.totalQuestions}`,
    `Valid Questions: ${summary.validQuestions} (${Math.round((summary.validQuestions / summary.totalQuestions) * 100)}%)`,
    `Invalid Questions: ${summary.invalidQuestions}`,
    `Average Score: ${summary.averageScore}/100`,
    '',
  ];

  if (summary.commonIssues.length > 0) {
    lines.push('Common Issues:');
    for (const { issue, count } of summary.commonIssues) {
      lines.push(`  ❌ ${issue} (${count} questions)`);
    }
    lines.push('');
  }

  if (summary.commonWarnings.length > 0) {
    lines.push('Common Warnings:');
    for (const { warning, count } of summary.commonWarnings.slice(0, 5)) {
      lines.push(`  ⚠️  ${warning} (${count} questions)`);
    }
    lines.push('');
  }

  // Show worst questions
  const worstQuestions = results
    .filter((r) => !r.validation.isValid)
    .sort((a, b) => a.validation.score - b.validation.score)
    .slice(0, 5);

  if (worstQuestions.length > 0) {
    lines.push('Worst Questions (Need Immediate Attention):');
    for (const { questionId, validation } of worstQuestions) {
      lines.push(`  🔴 ${questionId} (score: ${validation.score}/100)`);
      for (const issue of validation.issues) {
        lines.push(`     - ${issue}`);
      }
    }
    lines.push('');
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

/**
 * Get questions that need attention (score < 70)
 *
 * @param results - Array of validation results
 * @returns Array of question IDs that need review
 */
export function getQuestionsNeedingAttention(
  results: Array<{ questionId: string; validation: DistractorValidationResult }>
): string[] {
  return results.filter((r) => r.validation.score < 70).map((r) => r.questionId);
}
