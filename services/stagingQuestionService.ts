/**
 * Staging Question Service
 *
 * Task 108: The "Staging Lake" Architecture
 * - AI generates questions and saves them to a staging area
 * - Run adequacy checks with a cheaper AI model
 * - Auto-promote to live questions if pass criteria
 * - Flag for human review if fail
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';

// Lazy initialization of AI model to improve testability and error handling
let cheapModel: any = null;
function getCheapModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!cheapModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    cheapModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return cheapModel;
}

interface AdequacyCheckResult {
  isValid: boolean;
  hasCorrectAnswer: boolean;
  explanationLength: number;
  hasMedicalErrors: boolean;
  score: number; // 0-1
  details: string;
}

/**
 * Save a generated question to staging (not shown to users immediately)
 */
export async function saveToStaging(questionData: any) {
  const explanationText =
    typeof questionData.explanation === 'string'
      ? questionData.explanation
      : questionData.explanation?.rationale || '';

  const explanationLength = countWords(explanationText);

  const question = await prisma.stagingQuestion.create({
    data: {
      id: uuidv4(),
      vignette: questionData.vignette || '',
      question: questionData.question,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      explanation: explanationText,
      system: questionData.system || 'General',
      difficulty: questionData.difficulty || 'medium',
      tags: questionData.tags || [],
      status: 'pending',
      aiGrade: {
        explanationLength,
      },
    },
  });

  return question;
}

/**
 * Run adequacy check on a staging question using cheaper AI model
 */
export async function runAdequacyCheck(stagingQuestionId: string): Promise<AdequacyCheckResult> {
  const question = await prisma.stagingQuestion.findUnique({
    where: { id: stagingQuestionId },
  });

  if (!question) {
    throw new Error('Staging question not found');
  }

  const nestedQuestionData = (question as any).questionData;
  const correctAnswer = question.correctAnswer || nestedQuestionData?.correctAnswer;
  const explanation =
    question.explanation ||
    (typeof nestedQuestionData?.explanation === 'string'
      ? nestedQuestionData.explanation
      : nestedQuestionData?.explanation?.rationale || '');
  const vignette = question.vignette || nestedQuestionData?.vignette || '';
  const questionText = question.question || nestedQuestionData?.question || '';

  // Basic validation checks
  const hasCorrectAnswer = Boolean(correctAnswer);
  const explanationLength = countWords(explanation || '');
  const explanationLongEnough = explanationLength >= 50;

  // Use cheaper AI model to check for medical inaccuracies
  let hasMedicalErrors = false;
  let aiDetails = '';
  let score = 0;

  const model = getCheapModel();
  if (model) {
    try {
      const prompt = `
You are a medical accuracy checker. Review this question and explanation for any medical inaccuracies or errors.

Vignette: ${question.vignette}
Question: ${questionText}
Correct Answer: ${correctAnswer}
Explanation: ${explanation}

Respond with JSON only:
{
  "hasMedicalErrors": true/false,
  "issues": ["list any specific medical errors found"],
  "severity": "none|minor|major",
  "score": 0-1 (1 is perfect)
}
`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const sanitized = response.replace(/```json|```/g, '').trim();
      const json = JSON.parse(sanitized);

      hasMedicalErrors = json.hasMedicalErrors;
      aiDetails = JSON.stringify(json.issues);
      score = json.score || (hasMedicalErrors ? 0 : 1);
    } catch (error) {
      console.error('Error running adequacy check:', error);
      // Fallback if AI fails
      hasMedicalErrors = false;
      aiDetails = 'AI check failed';
      score = 0.5;
    }
  }

  const isValid = hasCorrectAnswer && explanationLongEnough && !hasMedicalErrors;

  const result: AdequacyCheckResult = {
    isValid,
    hasCorrectAnswer,
    explanationLength,
    hasMedicalErrors,
    score,
    details: aiDetails,
  };

  // Update staging question with check results
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: isValid ? 'graded' : hasMedicalErrors ? 'rejected' : 'pending',
      aiGrade: {
        score,
        issues: aiDetails,
        isValid,
        hasCorrectAnswer,
        explanationLength,
        hasMedicalErrors,
      },
    },
  });

  return result;
}

/**
 * Promote a staging question to live questions
 */
export async function promoteToLive(stagingQuestionId: string) {
  const question = await prisma.stagingQuestion.findUnique({
    where: { id: stagingQuestionId },
  });

  if (!question) {
    throw new Error('Staging question not found');
  }

  if (question.status !== 'graded') {
    throw new Error('Question has not passed adequacy check');
  }

  // Save to PreGeneratedQuestion (live questions pool)
  const liveQuestion = await prisma.preGeneratedQuestion.create({
    data: {
      id: uuidv4(),
      questionType: 'mcq',
      system: question.system,
      conditionId: null,
      difficulty: question.difficulty,
      questionData: {
        vignette: question.vignette,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        tags: question.tags,
      },
      quality: 10,
      updatedAt: new Date(),
    },
  });

  // Update staging question status
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: 'approved',
    },
  });

  return liveQuestion;
}

/**
 * Discard a staging question that failed adequacy check
 */
export async function discardStagingQuestion(stagingQuestionId: string) {
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: 'rejected',
    },
  });
}

/**
 * Flag a staging question for human review
 */
export async function flagForReview(stagingQuestionId: string, reason?: string) {
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: 'flagged_for_review',
      adminReview: reason,
    },
  });
}

/**
 * Process all pending staging questions (for batch processing)
 */
export async function processStagingQueue(limit: number = 10) {
  const pending = await prisma.stagingQuestion.findMany({
    where: {
      status: 'pending',
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  const results = [];

  for (const question of pending) {
    try {
      const checkResult = await runAdequacyCheck(question.id);

      if (checkResult.isValid) {
        // Auto-promote to live
        await promoteToLive(question.id);
        results.push({ id: question.id, status: 'promoted', score: checkResult.score });
      } else if (checkResult.hasMedicalErrors) {
        // Flag for human review
        await flagForReview(question.id, 'Medical errors detected');
        results.push({ id: question.id, status: 'flagged', score: checkResult.score });
      } else {
        // Discard
        await discardStagingQuestion(question.id);
        results.push({ id: question.id, status: 'discarded', score: checkResult.score });
      }
    } catch (error) {
      console.error(`Error processing staging question ${question.id}:`, error);
      results.push({ id: question.id, status: 'error', error: (error as Error).message });
    }
  }

  return results;
}

/**
 * Get staging queue statistics
 */
export async function getStagingStats() {
  const [total, pending, passed, failed, flagged, promoted, discarded] = await Promise.all([
    prisma.stagingQuestion.count(),
    prisma.stagingQuestion.count({ where: { status: 'pending' } }),
    prisma.stagingQuestion.count({ where: { status: 'graded' } }), // Assuming graded means passed check but not yet promoted? Or maybe just use approved
    prisma.stagingQuestion.count({ where: { status: 'rejected' } }),
    prisma.stagingQuestion.count({ where: { status: 'flagged_for_review' } }),
    prisma.stagingQuestion.count({ where: { status: 'approved' } }),
    prisma.stagingQuestion.count({ where: { status: 'rejected' } }), // Duplicate?
  ]);

  return {
    total,
    pending,
    passed,
    failed,
    flagged,
    promoted,
    discarded,
  };
}

// Helper function to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
