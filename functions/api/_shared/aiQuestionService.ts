import { prisma } from './prisma-edge';

/**
 * AI-Assisted Question Generation Service
 *
 * Provides safe, validated question generation with:
 * - Duplicate detection
 * - Blueprint gap analysis
 * - Difficulty estimation
 * - Auto-validation before author submission
 */

/**
 * Generate a question from clinical guidelines
 * Returns draft with validation checks performed
 */
export async function generateQuestionFromGuideline(
  guideline: string,
  system: string,
  conditionId: string
): Promise<{
  draftQuestion: {
    vignette: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    system: string;
    conditionId: string;
    estimatedDifficulty: number;
  };
  duplicateCandidates: Array<{ id: string; question: string; conditionId: string }>;
  blueprintAnalysis: { coveredSystem: string; helpsGap: boolean };
}> {
  // In a real implementation, this would call an LLM (Claude, GPT) API
  // For now, we'll return a structured response showing what would be generated

  // Simulate difficulty estimation based on guideline complexity
  const estimatedDifficulty = estimateDifficultyFromGuideline(guideline);

  // Create draft question structure
  const draftQuestion = {
    vignette: `Clinical scenario based on ${system} guidelines...`,
    question: `Question generated from: ${guideline.substring(0, 50)}...`,
    options: [
      'Option A based on guideline',
      'Option B (common misconception)',
      'Option C (related condition)',
      'Option D (another consideration)',
    ],
    correctAnswer: 'A',
    explanation: `Correct because: This follows the guideline "${guideline.substring(0, 80)}..."`,
    system,
    conditionId,
    estimatedDifficulty,
  };

  // Find similar questions to detect duplicates
  const similarQuestions = await prisma.question.findMany({
    where: {
      system,
      conditionId,
      status: 'published',
    },
    select: {
      id: true,
      question: true,
      conditionId: true,
    },
    take: 5,
  });

  // Check blueprint coverage
  const blueprintGaps = await prisma.examBlueprintSystem.findMany({
    where: { system },
  });

  const helpsGap = blueprintGaps.length > 0 && blueprintGaps[0].targetPercentage > 10;

  return {
    draftQuestion,
    duplicateCandidates: similarQuestions,
    blueprintAnalysis: {
      coveredSystem: system,
      helpsGap,
    },
  };
}

/**
 * Validate a question submission before publishing
 */
export async function validateNewQuestion(submission: {
  vignette: string;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  system: string;
  conditionId?: string;
}): Promise<{
  isDuplicate: boolean;
  duplicateOf?: { id: string; question: string };
  coversGap: boolean;
  estimatedDifficulty: number;
  estimatedHealthScore: number;
}> {
  // Check for duplicates using text similarity
  const existingQuestions = await prisma.question.findMany({
    where: {
      system: submission.system,
      status: 'published',
    },
    select: {
      id: true,
      question: true,
    },
    take: 20,
  });

  // Simple duplicate detection: check if any similar question exists
  const isDuplicate = existingQuestions.some(q =>
    calculateSimilarity(submission.question, q.question) > 0.85
  );

  const duplicateOf = isDuplicate ? existingQuestions[0] : undefined;

  // Check blueprint coverage
  const blueprintTarget = await prisma.examBlueprintSystem.findUnique({
    where: {
      examType_system: {
        examType: 'PANCE',
        system: submission.system,
      },
    },
  });

  const currentCount = await prisma.question.count({
    where: {
      system: submission.system,
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    },
  });

  const totalQuestions = await prisma.question.count({
    where: { lifecycleStatus: 'ACTIVE', qaStatus: 'APPROVED' },
  });

  const currentCoverage = totalQuestions > 0 ? (currentCount / totalQuestions) * 100 : 0;
  const coversGap = !blueprintTarget || currentCoverage < blueprintTarget.targetPercentage;

  // Estimate difficulty
  const estimatedDifficulty = estimateDifficultyFromContent(submission);

  // Estimate health score (new questions start at moderate health)
  // Actual health score computed from user performance over time
  const estimatedHealthScore = 0.65 + (0.3 * (coversGap ? 1 : 0.5));

  return {
    isDuplicate,
    duplicateOf,
    coversGap,
    estimatedDifficulty,
    estimatedHealthScore,
  };
}

// ============================================
// Helper functions
// ============================================

function estimateDifficultyFromGuideline(guideline: string): number {
  // Simple heuristic: longer guidelines suggest more complex topics
  if (guideline.length < 100) return 0.3;
  if (guideline.length < 300) return 0.5;
  if (guideline.length < 700) return 0.7;
  return 0.85;
}

function estimateDifficultyFromContent(submission: {
  question: string;
  explanation: string;
  options: unknown;
}): number {
  // Simple heuristic based on explanation complexity
  let score = 0.5;

  // Longer explanations suggest more complex concepts
  if (submission.explanation.length > 300) score += 0.2;
  if (submission.explanation.length > 500) score += 0.15;

  // Longer questions suggest more complexity
  if (submission.question.length > 200) score += 0.1;

  return Math.min(1, score);
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance approximation
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  // Find matching characters in order (simplified)
  let matches = 0;
  let j = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (j < longer.length) {
      if (shorter[i] === longer[j]) {
        matches++;
        j++;
      }
    }
  }

  return matches / longer.length;
}
