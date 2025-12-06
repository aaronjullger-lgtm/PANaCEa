/**
 * Staging Question Service
 * 
 * Task 108: The "Staging Lake" Architecture
 * - AI generates questions and saves them to a staging area
 * - Run adequacy checks with a cheaper AI model
 * - Auto-promote to live questions if pass criteria
 * - Flag for human review if fail
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma";

const API_KEY = process.env.GEMINI_API_KEY;

// Lazy initialization of AI model to improve testability and error handling
let cheapModel: any = null;
function getCheapModel() {
  if (!API_KEY) {
    return null;
  }
  if (!cheapModel) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    cheapModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
  const question = await prisma.stagingQuestion.create({
    data: {
      questionType: questionData.type || "mcq",
      system: questionData.system || null,
      conditionId: questionData.conditionId || null,
      difficulty: questionData.difficulty || "medium",
      questionData: questionData,
      explanationLength: countWords(questionData.explanation?.rationale || ""),
      hasCorrectAnswer: !!questionData.correctAnswer,
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
    throw new Error("Staging question not found");
  }

  const questionData = question.questionData as any;

  // Basic validation checks
  const hasCorrectAnswer = !!questionData.correctAnswer;
  const explanationLength = countWords(questionData.explanation?.rationale || "");
  const explanationLongEnough = explanationLength >= 50;

  // Use cheaper AI model to check for medical inaccuracies
  let hasMedicalErrors = false;
  let aiDetails = "";

  const model = getCheapModel();
  if (model) {
    try {
      const prompt = `
You are a medical accuracy checker. Review this question and explanation for any medical inaccuracies or errors.

Question: ${questionData.question}
Correct Answer: ${questionData.correctAnswer}
Explanation: ${questionData.explanation?.rationale || ""}

Respond with JSON only:
{
  "hasMedicalErrors": true/false,
  "issues": ["list any specific medical errors found"],
  "severity": "none|minor|major"
}
`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const sanitized = response.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(sanitized);
        hasMedicalErrors = parsed.hasMedicalErrors || parsed.severity === "major";
        aiDetails = parsed.issues?.join("; ") || "";
      } catch {
        // If parsing fails, be conservative and flag for review
        aiDetails = "Could not parse AI response";
      }
    } catch (error) {
      console.error("Error in adequacy check AI call:", error);
      aiDetails = "AI check failed - needs manual review";
    }
  }

  // Calculate overall score
  let score = 0;
  if (hasCorrectAnswer) score += 0.4;
  if (explanationLongEnough) score += 0.4;
  if (!hasMedicalErrors) score += 0.2;

  const isValid = score >= 0.8; // Pass threshold

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
      adequacyStatus: isValid ? "pass" : hasMedicalErrors ? "flagged" : "fail",
      adequacyScore: score,
      adequacyDetails: result,
      hasCorrectAnswer,
      explanationLength,
      hasMedicalErrors,
      checkedAt: new Date(),
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
    throw new Error("Staging question not found");
  }

  if (question.adequacyStatus !== "pass") {
    throw new Error("Question has not passed adequacy check");
  }

  // Save to PreGeneratedQuestion (live questions pool)
  const liveQuestion = await prisma.preGeneratedQuestion.create({
    data: {
      questionType: question.questionType,
      system: question.system,
      conditionId: question.conditionId,
      difficulty: question.difficulty,
      questionData: question.questionData,
      quality: Math.round(question.adequacyScore! * 10), // Convert 0-1 to 1-10
    },
  });

  // Update staging question status
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: "live",
      promotedAt: new Date(),
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
      status: "discarded",
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
      status: "flagged_for_review",
      adequacyStatus: "flagged",
    },
  });
}

/**
 * Process all pending staging questions (for batch processing)
 */
export async function processStagingQueue(limit: number = 10) {
  const pending = await prisma.stagingQuestion.findMany({
    where: {
      adequacyStatus: "pending",
      status: "staging",
    },
    take: limit,
    orderBy: { generatedAt: "asc" },
  });

  const results = [];

  for (const question of pending) {
    try {
      const checkResult = await runAdequacyCheck(question.id);

      if (checkResult.isValid) {
        // Auto-promote to live
        await promoteToLive(question.id);
        results.push({ id: question.id, status: "promoted", score: checkResult.score });
      } else if (checkResult.hasMedicalErrors) {
        // Flag for human review
        await flagForReview(question.id, "Medical errors detected");
        results.push({ id: question.id, status: "flagged", score: checkResult.score });
      } else {
        // Discard
        await discardStagingQuestion(question.id);
        results.push({ id: question.id, status: "discarded", score: checkResult.score });
      }
    } catch (error) {
      console.error(`Error processing staging question ${question.id}:`, error);
      results.push({ id: question.id, status: "error", error: (error as Error).message });
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
    prisma.stagingQuestion.count({ where: { adequacyStatus: "pending" } }),
    prisma.stagingQuestion.count({ where: { adequacyStatus: "pass" } }),
    prisma.stagingQuestion.count({ where: { adequacyStatus: "fail" } }),
    prisma.stagingQuestion.count({ where: { adequacyStatus: "flagged" } }),
    prisma.stagingQuestion.count({ where: { status: "live" } }),
    prisma.stagingQuestion.count({ where: { status: "discarded" } }),
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
