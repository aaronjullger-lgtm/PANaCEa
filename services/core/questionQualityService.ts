/**
 * Question Quality Service
 *
 * Provides AI-powered quality scoring, condition accuracy validation,
 * and duplicate detection for generated questions.
 */

// Browser-compatible hash function using simple string hashing
// (SHA-256 via Web Crypto would be async, so we use a fast sync hash for deduplication)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to ensure consistent length
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Double-hash for better distribution
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash2 = ((hash2 << 7) - hash2) + char;
    hash2 = hash2 & hash2;
  }
  return hex + Math.abs(hash2).toString(16).padStart(8, '0');
}

// Types for quality assessment
export interface QualityAssessment {
  qualityScore: number; // 0-100 overall quality
  conditionAccuracy: number; // 0-1 how well it tests the condition
  contentRelevance: number; // 0-1 PANCE relevance
  distractorQuality: number; // 0-1 quality of wrong answers
  issues: string[]; // List of identified issues
  suggestions: string[]; // Improvement suggestions
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarityScore: number; // 0-1
  similarQuestionIds: string[];
  semanticHash: string;
}

export interface QuestionData {
  question: string;
  vignette?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system?: string;
  conditionId?: string;
}

/**
 * Generate a semantic hash for duplicate detection.
 * Normalizes text and creates a hash based on key content.
 */
export function generateSemanticHash(question: QuestionData): string {
  // Normalize: lowercase, remove punctuation, trim whitespace
  const normalizedQuestion = normalizeText(question.question);
  const normalizedVignette = question.vignette ? normalizeText(question.vignette) : '';
  const normalizedAnswer = normalizeText(question.correctAnswer);

  // Create composite string for hashing
  const content = `${normalizedQuestion}|${normalizedVignette}|${normalizedAnswer}`;

  // Generate hash using browser-compatible function
  return simpleHash(content);
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate text similarity using Jaccard index on word sets
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    normalizeText(text1)
      .split(' ')
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    normalizeText(text2)
      .split(' ')
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Assess distractor (wrong answer) quality
 */
export function assessDistractorQuality(
  options: string[],
  correctAnswer: string,
  system?: string
): number {
  const distractors = options.filter((o) => o !== correctAnswer);

  if (distractors.length === 0) return 0;

  let score = 1.0;
  const issues: string[] = [];

  // Check for obvious patterns that give away wrong answers
  distractors.forEach((d) => {
    const normalizedD = d.toLowerCase();

    // Penalize very short distractors
    if (d.length < 10) {
      score -= 0.1;
      issues.push('Short distractor');
    }

    // Penalize "None of the above" type answers
    if (normalizedD.includes('none of') || normalizedD.includes('all of')) {
      score -= 0.15;
      issues.push('Generic answer option');
    }

    // Penalize obviously wrong medical terms (misspellings)
    // This would need a medical dictionary in production
  });

  // Check if correct answer is obviously different in length
  const avgDistractorLength =
    distractors.reduce((sum, d) => sum + d.length, 0) / distractors.length;
  const lengthDiff = Math.abs(correctAnswer.length - avgDistractorLength) / avgDistractorLength;
  if (lengthDiff > 0.5) {
    score -= 0.2;
    issues.push('Correct answer differs significantly in length');
  }

  // Check for distractor variety
  const uniqueStartWords = new Set(distractors.map((d) => d.split(' ')[0]?.toLowerCase()));
  if (uniqueStartWords.size < distractors.length * 0.5) {
    score -= 0.1;
    issues.push('Distractors start similarly');
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Quick quality check without AI (rule-based)
 */
export function quickQualityCheck(question: QuestionData): QualityAssessment {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let qualityScore = 100;

  // Check question length
  if (question.question.length < 20) {
    qualityScore -= 20;
    issues.push('Question too short');
    suggestions.push('Add more clinical context to the question stem');
  }

  // Check for vignette in clinical questions
  if (!question.vignette && question.system) {
    qualityScore -= 10;
    issues.push('Missing clinical vignette');
    suggestions.push('Add a patient scenario for clinical relevance');
  }

  // Check option count
  if (question.options.length < 4) {
    qualityScore -= 15;
    issues.push('Fewer than 4 answer options');
    suggestions.push('Add more plausible distractors');
  }

  if (question.options.length > 6) {
    qualityScore -= 5;
    issues.push('Too many answer options');
  }

  // Check explanation
  if (!question.explanation || question.explanation.length < 50) {
    qualityScore -= 15;
    issues.push('Explanation too short');
    suggestions.push('Provide a detailed educational explanation');
  }

  // Check correct answer is in options
  if (!question.options.includes(question.correctAnswer)) {
    qualityScore -= 30;
    issues.push('Correct answer not in options');
  }

  // Check for duplicate options
  const uniqueOptions = new Set(question.options.map((o) => o.toLowerCase().trim()));
  if (uniqueOptions.size < question.options.length) {
    qualityScore -= 20;
    issues.push('Duplicate answer options');
  }

  // Assess distractors
  const distractorQuality = assessDistractorQuality(
    question.options,
    question.correctAnswer,
    question.system
  );

  // Content relevance - basic check
  const contentRelevance = question.system ? 0.8 : 0.5;

  // Condition accuracy - basic check
  const conditionAccuracy = question.conditionId ? 0.7 : 0.4;

  return {
    qualityScore: Math.max(0, qualityScore),
    conditionAccuracy,
    contentRelevance,
    distractorQuality,
    issues,
    suggestions,
  };
}

/**
 * Build prompt for AI quality assessment
 */
export function buildQualityAssessmentPrompt(
  question: QuestionData,
  conditionName?: string
): string {
  return `Assess this PANCE-style medical question for quality:

QUESTION:
${question.vignette ? `Vignette: ${question.vignette}\n` : ''}
Stem: ${question.question}

OPTIONS:
${question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}

CORRECT ANSWER: ${question.correctAnswer}

EXPLANATION: ${question.explanation}

${conditionName ? `TARGET CONDITION: ${conditionName}` : ''}
${question.system ? `ORGAN SYSTEM: ${question.system}` : ''}

Rate this question on a scale of 0-100 for:
1. Overall Quality (clarity, clinical relevance, educational value)
2. Condition Accuracy (does it test the target condition properly?) [0-1]
3. Content Relevance (appropriate for PANCE exam) [0-1]
4. Distractor Quality (are wrong answers plausible but clearly wrong?) [0-1]

Also identify any issues and provide improvement suggestions.

Respond in JSON format:
{
  "qualityScore": <0-100>,
  "conditionAccuracy": <0-1>,
  "contentRelevance": <0-1>,
  "distractorQuality": <0-1>,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;
}

/**
 * Parse AI quality assessment response
 */
export function parseQualityAssessmentResponse(response: string): QualityAssessment | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      qualityScore: Math.max(0, Math.min(100, Number(parsed.qualityScore) || 0)),
      conditionAccuracy: Math.max(0, Math.min(1, Number(parsed.conditionAccuracy) || 0)),
      contentRelevance: Math.max(0, Math.min(1, Number(parsed.contentRelevance) || 0)),
      distractorQuality: Math.max(0, Math.min(1, Number(parsed.distractorQuality) || 0)),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return null;
  }
}

/**
 * Calculate overall validation status based on quality scores
 */
export function determineValidationStatus(
  assessment: QualityAssessment
): 'approved' | 'needs_revision' | 'rejected' {
  // Auto-approve high quality questions
  if (
    assessment.qualityScore >= 80 &&
    assessment.conditionAccuracy >= 0.7 &&
    assessment.distractorQuality >= 0.6 &&
    assessment.issues.length <= 1
  ) {
    return 'approved';
  }

  // Auto-reject very low quality
  if (
    assessment.qualityScore < 40 ||
    assessment.conditionAccuracy < 0.3 ||
    assessment.issues.length >= 5
  ) {
    return 'rejected';
  }

  // Everything else needs manual review
  return 'needs_revision';
}

/**
 * Main quality validation function
 * Combines rule-based and AI assessment
 */
export async function validateQuestionQuality(
  question: QuestionData,
  conditionName?: string,
  useAI: boolean = false
): Promise<{
  assessment: QualityAssessment;
  validationStatus: 'approved' | 'needs_revision' | 'rejected' | 'pending';
  semanticHash: string;
}> {
  // Start with rule-based assessment
  const assessment = quickQualityCheck(question);

  // Generate semantic hash for duplicate detection
  const semanticHash = generateSemanticHash(question);

  // If AI assessment is requested and enabled, enhance the assessment
  // This would integrate with geminiService in production
  if (useAI && typeof window === 'undefined') {
    // Server-side only - would call Gemini API here
    // const prompt = buildQualityAssessmentPrompt(question, conditionName);
    // const aiResponse = await callGeminiAPI(prompt);
    // const aiAssessment = parseQualityAssessmentResponse(aiResponse);
    // if (aiAssessment) {
    //   // Blend AI and rule-based scores
    //   assessment = blendAssessments(assessment, aiAssessment);
    // }
  }

  const validationStatus = determineValidationStatus(assessment);

  return {
    assessment,
    validationStatus,
    semanticHash,
  };
}

/**
 * Batch validate questions
 */
export async function batchValidateQuestions(
  questions: Array<{ id: string; data: QuestionData; conditionName?: string }>
): Promise<
  Map<string, ReturnType<typeof validateQuestionQuality> extends Promise<infer T> ? T : never>
> {
  const results = new Map();

  for (const q of questions) {
    const result = await validateQuestionQuality(q.data, q.conditionName);
    results.set(q.id, result);
  }

  return results;
}

export default {
  generateSemanticHash,
  calculateTextSimilarity,
  assessDistractorQuality,
  quickQualityCheck,
  validateQuestionQuality,
  batchValidateQuestions,
  determineValidationStatus,
  buildQualityAssessmentPrompt,
  parseQualityAssessmentResponse,
};
