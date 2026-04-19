/**
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai`
 * SDK usage with `gateway.callText()` so the staging quality-check pipeline
 * shares the same telemetry + fallback + cost tracking as other question
 * generation endpoints.
 *
 * `runAdequacyCheck` — tier='fast' (gemini-2.0-flash; cheap accuracy check).
 * `processStagingQueueWithCritic` — tier='balanced' (gemini-2.5-flash;
 * scoring critic).
 *
 * Both call sites construct a minimal `GatewayContext` from `env` because the
 * surrounding functions don't receive the full AuthenticatedContext object.
 */
import { gateway, GatewayError, type GatewayContext } from '../../../lib/ai/aiGateway';

interface AdequacyCheckResult {
  isValid: boolean;
  hasCorrectAnswer: boolean;
  explanationLength: number;
  hasMedicalErrors: boolean;
  score: number; // 0-1
  details: string;
}

// Helper function to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Save a generated question to staging (not shown to users immediately)
 */
export async function saveToStaging(prisma: any, questionData: any) {
  const question = await prisma.stagingQuestion.create({
    data: {
      vignette: questionData.vignette || '',
      question: questionData.question,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      explanation:
        typeof questionData.explanation === 'string'
          ? questionData.explanation
          : questionData.explanation?.rationale || '',
      system: questionData.system || 'General',
      difficulty: questionData.difficulty || 'medium',
      tags: questionData.tags || [],
      status: 'pending',
    },
  });

  return question;
}

/**
 * Run adequacy check on a staging question using cheaper AI model
 */
export async function runAdequacyCheck(
  prisma: any,
  env: any,
  stagingQuestionId: string
): Promise<AdequacyCheckResult> {
  const question = await prisma.stagingQuestion.findUnique({
    where: { id: stagingQuestionId },
  });

  if (!question) {
    throw new Error('Staging question not found');
  }

  // Basic validation checks
  const hasCorrectAnswer = !!question.correctAnswer;
  const explanationLength = countWords(question.explanation || '');
  const explanationLongEnough = explanationLength >= 50;

  // Use cheaper AI model to check for medical inaccuracies
  let hasMedicalErrors = false;
  let aiDetails = '';
  let score = 0;

  if (env.GEMINI_API_KEY) {
    try {
      const gatewayCtx: GatewayContext = {
        env: { GEMINI_API_KEY: env.GEMINI_API_KEY as string },
      };

      const prompt = `
You are a medical accuracy checker. Review this question and explanation for any medical inaccuracies or errors.

Vignette: ${question.vignette}
Question: ${question.question}
Correct Answer: ${question.correctAnswer}
Explanation: ${question.explanation}

Respond with JSON only:
{
  "hasMedicalErrors": true/false,
  "issues": ["list any specific medical errors found"],
  "severity": "none|minor|major",
  "score": 0-1 (1 is perfect)
}
`;

      const result = await gateway.callText(gatewayCtx, {
        mode: 'text',
        task: 'generation',
        tier: 'fast', // cheap accuracy check — matches prior gemini-2.0-flash
        endpoint: 'functions/api/_shared/staging-questions#runAdequacyCheck',
        userPrompt: prompt,
      });

      if (result.blocked) {
        hasMedicalErrors = false;
        aiDetails = 'Adequacy check blocked by safety filter';
        score = 0.5;
      } else {
        const sanitized = (result.text ?? '').replace(/```json|```/g, '').trim();
        const json = JSON.parse(sanitized);

        hasMedicalErrors = json.hasMedicalErrors;
        aiDetails = JSON.stringify(json.issues);
        score = json.score || (hasMedicalErrors ? 0 : 1);
      }
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error(`Adequacy check gateway error [${error.code}]:`, error.message);
      } else {
        console.error('Error running adequacy check:', error);
      }
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
export async function promoteToLive(prisma: any, stagingQuestionId: string) {
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
export async function discardStagingQuestion(prisma: any, stagingQuestionId: string) {
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
export async function flagForReview(prisma: any, stagingQuestionId: string, reason?: string) {
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
export async function processStagingQueue(prisma: any, env: any, limit: number = 10) {
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
      const checkResult = await runAdequacyCheck(prisma, env, question.id);

      if (checkResult.isValid) {
        // Auto-promote to live
        await promoteToLive(prisma, question.id);
        results.push({ id: question.id, status: 'promoted', score: checkResult.score });
      } else if (checkResult.hasMedicalErrors) {
        // Flag for human review
        await flagForReview(prisma, question.id, 'Medical errors detected');
        results.push({ id: question.id, status: 'flagged', score: checkResult.score });
      } else {
        // Discard
        await discardStagingQuestion(prisma, question.id);
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
export async function getStagingStats(prisma: any) {
  const [total, pending, passed, failed, flagged, promoted, discarded] = await Promise.all([
    prisma.stagingQuestion.count(),
    prisma.stagingQuestion.count({ where: { status: 'pending' } }),
    prisma.stagingQuestion.count({ where: { status: 'graded' } }),
    prisma.stagingQuestion.count({ where: { status: 'rejected' } }),
    prisma.stagingQuestion.count({ where: { status: 'flagged_for_review' } }),
    prisma.stagingQuestion.count({ where: { status: 'approved' } }),
    prisma.stagingQuestion.count({ where: { status: 'rejected' } }),
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

/**
 * Process pending staging questions with Critic (Gemini Pro): score 0–100.
 * score > 90 → auto-promote to PreGeneratedQuestion; < 70 → delete; 70–90 → flag for human review.
 */
export async function processStagingQueueWithCritic(
  prisma: any,
  env: { GEMINI_API_KEY?: string },
  limit: number = 10
): Promise<Array<{ id: string; status: string; score?: number; error?: string }>> {
  const pending = await prisma.stagingQuestion.findMany({
    where: { status: 'pending' },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  const results: Array<{ id: string; status: string; score?: number; error?: string }> = [];

  if (!env.GEMINI_API_KEY) {
    for (const q of pending) {
      results.push({ id: q.id, status: 'skipped', error: 'GEMINI_API_KEY not set' });
    }
    return results;
  }

  const gatewayCtx: GatewayContext = {
    env: { GEMINI_API_KEY: env.GEMINI_API_KEY as string },
  };

  for (const question of pending) {
    try {
      const prompt = `You are a medical question critic. Rate this staging question 0-100 for quality (clarity, accuracy, appropriateness for PANCE prep).
Vignette: ${question.vignette}
Question: ${question.question}
Correct Answer: ${question.correctAnswer}
Explanation: ${question.explanation}

Respond with JSON only: { "score": number 0-100, "briefReason": "string" }`;

      const result = await gateway.callText(gatewayCtx, {
        mode: 'text',
        task: 'generation',
        tier: 'balanced', // critic scoring — matches prior gemini-2.5-flash
        endpoint: 'functions/api/_shared/staging-questions#processStagingQueueWithCritic',
        userPrompt: prompt,
      });

      if (result.blocked) {
        results.push({ id: question.id, status: 'skipped', error: 'Critic blocked by safety filter' });
        continue;
      }

      const sanitized = (result.text ?? '').replace(/```json|```/g, '').trim();
      const json = JSON.parse(sanitized);
      const score = typeof json.score === 'number' ? Math.max(0, Math.min(100, json.score)) : 50;

      if (score > 90) {
        await prisma.stagingQuestion.update({
          where: { id: question.id },
          data: { status: 'graded' },
        });
        await promoteToLive(prisma, question.id);
        results.push({ id: question.id, status: 'promoted', score });
      } else if (score < 70) {
        await discardStagingQuestion(prisma, question.id);
        results.push({ id: question.id, status: 'discarded', score });
      } else {
        await flagForReview(
          prisma,
          question.id,
          `Critic score ${score}: ${json.briefReason || 'Review'}`
        );
        results.push({ id: question.id, status: 'flagged_for_review', score });
      }
    } catch (error) {
      const errMsg =
        error instanceof GatewayError
          ? `gateway ${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      results.push({ id: question.id, status: 'error', error: errMsg });
    }
  }

  return results;
}
