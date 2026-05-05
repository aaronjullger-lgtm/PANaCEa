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
import { z } from 'zod';
import { upsertCanonicalQuestionMirror } from './canonical-question-mirror';

interface AdequacyCheckResult {
  isValid: boolean;
  hasCorrectAnswer: boolean;
  explanationLength: number;
  hasMedicalErrors: boolean;
  accuracyCheckCompleted: boolean;
  score: number; // 0-1
  details: string;
}

const adequacyGatewayResponseSchema = z.object({
  hasMedicalErrors: z.boolean(),
  issues: z.array(z.string()).default([]),
  severity: z.enum(['none', 'minor', 'major']).optional(),
  score: z.number().min(0).max(1).optional(),
});

const criticGatewayResponseSchema = z.object({
  score: z.number().min(0).max(100),
  briefReason: z.string().optional(),
});

type StagingIdentity = {
  taxonomyCode?: string;
  subcategory?: string;
  conditionId?: string;
  medicalContentId?: string;
  conditionName?: string;
  questionOrder?: string;
  taskCategory?: string;
  source?: string;
  generatorUserId?: string;
  generatedAt?: string;
  sourceMetadata?: Record<string, unknown>;
};

// Helper function to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeDifficulty(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0.4) return 'easy';
    if (value > 0.75) return 'hard';
    return 'medium';
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return 'medium';
}

function normalizeExplanation(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const explanation = value as Record<string, unknown>;
    return String(explanation.rationale ?? explanation.text ?? '');
  }
  return '';
}

function buildSourceMetadata(questionData: any): Record<string, unknown> {
  const metadata = questionData?.metadata && typeof questionData.metadata === 'object'
    ? { ...(questionData.metadata as Record<string, unknown>) }
    : {};

  [
    'groundingSources',
    'pubmedCitations',
    'sourceSections',
    'questionOrder',
    'taskCategory',
    'correctAnswerIndex',
    'correctIndex',
  ].forEach((key) => {
    if (questionData?.[key] !== undefined) {
      metadata[key] = questionData[key];
    }
  });

  return metadata;
}

function normalizeTags(questionData: any): string[] {
  const tags = new Set<string>();
  const rawTags = questionData?.tags;

  if (Array.isArray(rawTags)) {
    rawTags.forEach((tag) => {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
    });
  }

  const metadata = questionData?.metadata ?? {};
  const addTag = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      tags.add(`${key}:${value.trim()}`);
    }
  };

  addTag('taxonomy', metadata.taxonomyCode ?? questionData?.system);
  addTag('subcategory', metadata.subcategory ?? questionData?.subcategory);
  addTag('condition', metadata.conditionId ?? questionData?.conditionId);
  addTag('medicalContent', metadata.medicalContentId ?? questionData?.medicalContentId);
  addTag('conditionName', metadata.conditionName ?? questionData?.conditionName);
  addTag('questionOrder', metadata.questionOrder ?? questionData?.questionOrder);
  addTag('taskCategory', metadata.taskCategory ?? questionData?.taskCategory);
  addTag('source', metadata.source ?? 'admin_question_generator');
  addTag('generatorUser', metadata.generatorUserId);
  addTag('generatedAt', metadata.generatedAt);

  const sourceMetadata = buildSourceMetadata(questionData);
  if (Object.keys(sourceMetadata).length > 0) {
    tags.add(`sourceMetadata:${encodeURIComponent(JSON.stringify(sourceMetadata))}`);
  }

  return [...tags];
}

function parseIdentityFromTags(tags: unknown): StagingIdentity {
  const identity: StagingIdentity = {};
  if (!tags) return identity;

  const assign = (key: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const normalizedValue = value.trim();
    switch (key) {
      case 'taxonomy':
        identity.taxonomyCode = normalizedValue;
        break;
      case 'subcategory':
        identity.subcategory = normalizedValue;
        break;
      case 'condition':
        identity.conditionId = normalizedValue;
        break;
      case 'medicalContent':
        identity.medicalContentId = normalizedValue;
        break;
      case 'conditionName':
        identity.conditionName = normalizedValue;
        break;
      case 'questionOrder':
        identity.questionOrder = normalizedValue;
        break;
      case 'taskCategory':
        identity.taskCategory = normalizedValue;
        break;
      case 'source':
        identity.source = normalizedValue;
        break;
      case 'generatorUser':
        identity.generatorUserId = normalizedValue;
        break;
      case 'generatedAt':
        identity.generatedAt = normalizedValue;
        break;
      case 'sourceMetadata':
        try {
          const parsed = JSON.parse(decodeURIComponent(normalizedValue));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            identity.sourceMetadata = parsed as Record<string, unknown>;
            if (typeof parsed.questionOrder === 'string') {
              identity.questionOrder = parsed.questionOrder;
            }
            if (typeof parsed.taskCategory === 'string') {
              identity.taskCategory = parsed.taskCategory;
            }
          }
        } catch {
          // Ignore malformed optional source metadata tags; core identity tags still apply.
        }
        break;
      default:
        break;
    }
  };

  if (Array.isArray(tags)) {
    tags.forEach((tag) => {
      if (typeof tag !== 'string') return;
      const separator = tag.indexOf(':');
      if (separator <= 0) return;
      assign(tag.slice(0, separator), tag.slice(separator + 1));
    });
  } else if (typeof tags === 'object') {
    Object.entries(tags as Record<string, unknown>).forEach(([key, value]) => assign(key, value));
  }

  return identity;
}

function normalizeOptionValues(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option ?? '').trim()).filter(Boolean);
  }

  if (options && typeof options === 'object') {
    return Object.values(options as Record<string, unknown>)
      .map((option) => String(option ?? '').trim())
      .filter(Boolean);
  }

  return [];
}

function resolveCorrectAnswer(questionData: any): string {
  if (typeof questionData?.correctAnswer === 'string' && questionData.correctAnswer.trim()) {
    return questionData.correctAnswer.trim();
  }

  const options = normalizeOptionValues(questionData?.options);
  const index = questionData?.correctAnswerIndex ?? questionData?.correctIndex;
  if (typeof index === 'number' && index >= 0 && index < options.length) {
    return String(options[index] ?? '').trim();
  }

  return String(questionData?.answer ?? questionData?.correct_option ?? '').trim();
}

function correctAnswerResolvesToOption(correctAnswer: unknown, options: unknown): boolean {
  if (typeof correctAnswer !== 'string' || !correctAnswer.trim()) return false;
  const optionValues = normalizeOptionValues(options);
  if (optionValues.length === 0) return false;

  const normalized = correctAnswer.trim().toLowerCase();
  const exactOptionMatch = optionValues.some((option) => option.toLowerCase() === normalized);
  if (exactOptionMatch) return true;

  const letterMatch = normalized.match(/^[a-z]$/);
  if (letterMatch) {
    const index = normalized.charCodeAt(0) - 97;
    return index >= 0 && index < optionValues.length;
  }

  return false;
}

export function getStagingQuestionValidationErrors(questionData: unknown): string[] {
  const data = questionData && typeof questionData === 'object'
    ? (questionData as Record<string, unknown>)
    : null;
  if (!data) return ['questionData must be an object'];

  const question = String(data.question ?? data.stem ?? data.text ?? '').trim();
  const options = normalizeOptionValues(data.options ?? data.choices ?? data.answers);
  const correctAnswer = resolveCorrectAnswer(data);
  const explanation = normalizeExplanation(data.explanation ?? data.rationale);
  const errors: string[] = [];

  if (!question) {
    errors.push('question is required');
  }

  if (options.length < 2) {
    errors.push('at least two answer options are required');
  }

  if (!correctAnswerResolvesToOption(correctAnswer, options)) {
    errors.push('correctAnswer must resolve to one of the answer options');
  }

  if (!explanation.trim()) {
    errors.push('explanation or rationale is required');
  }

  return errors;
}

/**
 * Save a generated question to staging (not shown to users immediately)
 */
export async function saveToStaging(prisma: any, questionData: any) {
  const validationErrors = getStagingQuestionValidationErrors(questionData);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid staging question payload: ${validationErrors.join('; ')}`);
  }

  const tags = normalizeTags(questionData);
  const questionText = String(questionData.question ?? questionData.stem ?? questionData.text ?? '').trim();
  const explanation = normalizeExplanation(questionData.explanation ?? questionData.rationale);
  const question = await prisma.stagingQuestion.create({
    data: {
      id: crypto.randomUUID(),
      vignette: questionData.vignette || '',
      question: questionText,
      options: normalizeOptionValues(questionData.options ?? questionData.choices ?? questionData.answers),
      correctAnswer: resolveCorrectAnswer(questionData),
      explanation,
      system: questionData.system || 'General',
      difficulty: normalizeDifficulty(questionData.difficulty),
      tags,
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
  const hasCorrectAnswer = correctAnswerResolvesToOption(question.correctAnswer, question.options);
  const explanationLength = countWords(question.explanation || '');
  const explanationLongEnough = explanationLength >= 50;

  // Use cheaper AI model to check for medical inaccuracies
  let hasMedicalErrors = false;
  let aiDetails = '';
  let score = 0;
  let accuracyCheckCompleted = false;

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
        const parsed = adequacyGatewayResponseSchema.safeParse(json);

        if (parsed.success) {
          hasMedicalErrors = parsed.data.hasMedicalErrors;
          aiDetails = JSON.stringify(parsed.data.issues);
          score = parsed.data.score ?? (hasMedicalErrors ? 0 : 1);
          accuracyCheckCompleted = true;
        } else {
          hasMedicalErrors = false;
          aiDetails = 'Adequacy check returned invalid JSON shape';
          score = 0.5;
        }
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
  } else {
    aiDetails = 'AI check unavailable';
    score = 0.5;
  }

  const isValid =
    hasCorrectAnswer &&
    explanationLongEnough &&
    !hasMedicalErrors &&
    accuracyCheckCompleted;

  const result: AdequacyCheckResult = {
    isValid,
    hasCorrectAnswer,
    explanationLength,
    hasMedicalErrors,
    accuracyCheckCompleted,
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
        accuracyCheckCompleted,
      },
    },
  });

  return result;
}

/**
 * Promote a staging question to live questions
 */
export async function promoteToLive(
  prisma: any,
  stagingQuestionId: string,
  options: { allowPendingHumanReview?: boolean; reviewedBy?: string | null } = {}
) {
  const question = await prisma.stagingQuestion.findUnique({
    where: { id: stagingQuestionId },
  });

  if (!question) {
    throw new Error('Staging question not found');
  }

  if (question.status !== 'graded' && !(options.allowPendingHumanReview && question.status === 'pending')) {
    throw new Error('Question has not passed adequacy check');
  }

  const validationErrors = getStagingQuestionValidationErrors(question);
  if (validationErrors.length > 0) {
    throw new Error(`Question cannot be promoted: ${validationErrors.join('; ')}`);
  }

  const identity = parseIdentityFromTags(question.tags);
  const promotedAt = new Date();

  // Save to PreGeneratedQuestion (live questions pool). Keep the staging id
  // as the live pool id so generated content retains a stable source identity
  // across staging, reservoir selection, session serving, and submission.
  const liveQuestion = await prisma.preGeneratedQuestion.upsert({
    where: { id: question.id },
    create: {
      id: question.id,
      questionType: 'mcq',
      system: question.system,
      conditionId: identity.conditionId ?? null,
      medicalContentId: identity.medicalContentId ?? null,
      difficulty: question.difficulty,
      questionOrder: identity.questionOrder ?? null,
      taskCategory: identity.taskCategory ?? null,
      questionData: {
        vignette: question.vignette,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        system: question.system,
        subcategory: identity.subcategory ?? null,
        conditionId: identity.conditionId ?? null,
        medicalContentId: identity.medicalContentId ?? null,
        conditionName: identity.conditionName ?? null,
        tags: question.tags,
        provenance: {
          source: identity.source ?? 'staging',
          stagingQuestionId: question.id,
          taxonomyCode: identity.taxonomyCode ?? question.system,
          subcategory: identity.subcategory ?? null,
          conditionId: identity.conditionId ?? null,
          medicalContentId: identity.medicalContentId ?? null,
          conditionName: identity.conditionName ?? null,
          sourceMetadata: identity.sourceMetadata ?? null,
          generatorUserId: identity.generatorUserId ?? null,
          generatedAt: identity.generatedAt ?? null,
          promotedAt: promotedAt.toISOString(),
          aiGrade: question.aiGrade ?? null,
          humanReviewedBy: options.reviewedBy ?? null,
        },
      },
      quality: 10,
      validationStatus: 'approved',
      validatedAt: promotedAt,
    },
    update: {
      questionType: 'mcq',
      system: question.system,
      conditionId: identity.conditionId ?? null,
      medicalContentId: identity.medicalContentId ?? null,
      difficulty: question.difficulty,
      questionOrder: identity.questionOrder ?? null,
      taskCategory: identity.taskCategory ?? null,
      questionData: {
        vignette: question.vignette,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        system: question.system,
        subcategory: identity.subcategory ?? null,
        conditionId: identity.conditionId ?? null,
        medicalContentId: identity.medicalContentId ?? null,
        conditionName: identity.conditionName ?? null,
        tags: question.tags,
        provenance: {
          source: identity.source ?? 'staging',
          stagingQuestionId: question.id,
          taxonomyCode: identity.taxonomyCode ?? question.system,
          subcategory: identity.subcategory ?? null,
          conditionId: identity.conditionId ?? null,
          medicalContentId: identity.medicalContentId ?? null,
          conditionName: identity.conditionName ?? null,
          sourceMetadata: identity.sourceMetadata ?? null,
          generatorUserId: identity.generatorUserId ?? null,
          generatedAt: identity.generatedAt ?? null,
          promotedAt: promotedAt.toISOString(),
          aiGrade: question.aiGrade ?? null,
          humanReviewedBy: options.reviewedBy ?? null,
        },
      },
      quality: 10,
      validationStatus: 'approved',
      validatedAt: promotedAt,
    },
  });

  const canonicalQuestionId = await upsertCanonicalQuestionMirror(prisma, {
    id: liveQuestion.id,
    questionData: liveQuestion.questionData,
    system: liveQuestion.system,
    difficulty: liveQuestion.difficulty,
    conditionId: liveQuestion.conditionId,
    medicalContentId: liveQuestion.medicalContentId,
    generatedAt: liveQuestion.generatedAt,
  }, {
    source: 'staging_promoted_pre_generated',
    humanReviewed: true,
  });
  if (!canonicalQuestionId) {
    throw new Error('Question cannot be promoted: canonical Question mirror could not be created');
  }

  // Update staging question status
  await prisma.stagingQuestion.update({
    where: { id: stagingQuestionId },
    data: {
      status: 'approved',
      adminReview: options.allowPendingHumanReview
        ? 'Approved by human reviewer without automated adequacy grade'
        : undefined,
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
      } else if (!checkResult.accuracyCheckCompleted) {
        // Keep the question pending when the AI critic did not complete. This
        // fail-closed path prevents unreviewed content from reaching learners
        // without destroying work that can be checked later.
        results.push({
          id: question.id,
          status: 'skipped_pending',
          score: checkResult.score,
          error: checkResult.details,
        });
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
 * score > 90 → auto-promote to PreGeneratedQuestion; < 70 → mark rejected;
 * 70–90 → flag for human review.
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
      const parsed = criticGatewayResponseSchema.safeParse(json);
      if (!parsed.success) {
        results.push({ id: question.id, status: 'error', error: 'Critic returned invalid JSON shape' });
        continue;
      }

      const { score, briefReason } = parsed.data;

      if (score > 90) {
        const validationErrors = getStagingQuestionValidationErrors(question);
        if (validationErrors.length > 0) {
          await flagForReview(
            prisma,
            question.id,
            `Critic score ${score}, but promotion validation failed: ${validationErrors.join('; ')}`
          );
          results.push({ id: question.id, status: 'flagged_for_review', score });
          continue;
        }

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
          `Critic score ${score}: ${briefReason || 'Review'}`
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
