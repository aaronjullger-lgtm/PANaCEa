/**
 * Ensure a due variant exists for a concept when the user answers incorrectly.
 * Each schedule (incorrect answer) is paired with picking an existing sibling or
 * generating and storing one, so the Due session never has to wait for generation.
 *
 * Used by: /api/drills/submit-review (main session incorrect), and can be used
 * by any path that schedules a concept for due (e.g. due session incorrect again).
 */

import type { PrismaClient } from '@prisma/client';
import { generateVariant } from './questionVariantGenerator';

/** PreGeneratedQuestion fields needed for variant check + generation */
export interface PreGenQuestionForVariant {
  id: string;
  conditionId: string | null;
  system: string | null;
  difficulty: string;
  questionType: string;
  questionData: unknown;
}

/** Normalize questionData options to string[] for variant generator */
function getOptionsAsStrings(data: Record<string, unknown>): string[] {
  const raw = data.options ?? data.answers ?? data.choices;
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => (typeof o === 'string' ? o : (o as { value?: string; text?: string; label?: string })?.value ?? (o as { value?: string; text?: string; label?: string })?.text ?? (o as { value?: string; text?: string; label?: string })?.label ?? String(o)));
}

/** Get correct answer string from questionData */
function getCorrectAnswerString(data: Record<string, unknown>, options: string[]): string {
  const correct = data.correctAnswer ?? data.answer ?? data.correct_option ?? data.correctChoice;
  if (typeof correct === 'string') return correct;
  const idx = typeof data.correctAnswerIndex === 'number' ? data.correctAnswerIndex : (data.correctIndex as number | undefined);
  if (typeof idx === 'number' && options[idx]) return options[idx];
  return options[0] ?? '';
}

/**
 * Ensures at least one sibling (different question, same concept) exists for due review.
 * If none exists, generates a variant via Gemini and stores it as PreGeneratedQuestion.
 * Safe to call from Edge; generation is best-effort (logs and returns on failure).
 */
export async function ensureDueVariant(
  prisma: PrismaClient,
  question: PreGenQuestionForVariant,
  apiKey: string | undefined,
  log?: { info: (msg: string, ctx?: object) => void; warn: (msg: string, ctx?: object) => void }
): Promise<void> {
  const conditionId = question.conditionId ?? undefined;
  if (!conditionId) return;

  try {
    const siblingCount = await prisma.preGeneratedQuestion.count({
      where: {
        conditionId,
        id: { not: question.id },
      },
    });
    if (siblingCount >= 1) {
      log?.info('Due variant: sibling already exists', { conditionId, siblingCount });
      return;
    }

    if (!apiKey) {
      log?.warn('Due variant: no API key, skip generation', { conditionId });
      return;
    }

    const data = (question.questionData ?? {}) as Record<string, unknown>;
    const options = getOptionsAsStrings(data);
    const correctAnswer = getCorrectAnswerString(data, options);
    const questionText = [data.vignette, data.question].filter(Boolean).join('\n\n') || (data.question as string) || '';
    const explanation = (data.rationale ?? data.explanation ?? '') as string;

    if (!questionText || options.length === 0) {
      log?.warn('Due variant: insufficient question data to generate', { conditionId });
      return;
    }

    const variant = await generateVariant(
      {
        originalQuestion: questionText,
        originalOptions: options,
        originalAnswer: correctAnswer,
        originalExplanation: explanation,
        targetType: 'rephrased',
      },
      apiKey
    );
    if (!variant?.question || !Array.isArray(variant.options) || variant.options.length === 0) {
      log?.warn('Due variant: generation returned no usable variant', { conditionId });
      return;
    }

    const correctAnswerStr = variant.correctAnswer ?? variant.options[0];
    const correctAnswerIndex = variant.options.indexOf(correctAnswerStr);
    const finalIndex = Math.max(0, correctAnswerIndex);

    const newId =
      typeof crypto !== 'undefined' && typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function'
        ? (crypto as { randomUUID: () => string }).randomUUID()
        : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    await prisma.preGeneratedQuestion.create({
      data: {
        id: newId,
        questionType: question.questionType || 'mcq',
        system: question.system ?? undefined,
        conditionId,
        difficulty: question.difficulty || 'medium',
        questionData: {
          question: variant.question,
          options: variant.options,
          correctAnswer: correctAnswerStr,
          correctAnswerIndex: finalIndex,
          rationale: variant.explanation ?? explanation,
        },
      },
    });

    log?.info('Due variant: generated and stored', { conditionId, newId });
  } catch (err) {
    log?.warn('Due variant: ensure failed (non-fatal)', {
      conditionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
