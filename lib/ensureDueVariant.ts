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
import type { ConfusionPairHint } from './questionVariantGenerator';
import { computeSemanticHash } from './utils/semanticHash';

const VARIANT_TYPES = [
  'rephrased',
  'different_scenario',
  'different_distractors',
] as const;
type VariantType = (typeof VARIANT_TYPES)[number];

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
  return raw.map((o) =>
    typeof o === 'string'
      ? o
      : ((o as { value?: string; text?: string; label?: string })?.value ??
        (o as { value?: string; text?: string; label?: string })?.text ??
        (o as { value?: string; text?: string; label?: string })?.label ??
        String(o))
  );
}

/**
 * Get correct answer string from questionData.
 *
 * Resolution order:
 *   1. correctAnswer / answer / correct_option / correctChoice text fields
 *   2. correctAnswerIndex / correctIndex numeric index into options
 *
 * Returns null when the answer cannot be determined. Callers MUST handle null
 * — do NOT fall back to options[0], which would store a wrong answer permanently.
 */
function getCorrectAnswerString(data: Record<string, unknown>, options: string[]): string | null {
  // 1. Direct string field (several field-name variants in use across generators)
  const correct = data.correctAnswer ?? data.answer ?? data.correct_option ?? data.correctChoice;
  if (typeof correct === 'string' && correct.trim().length > 0) return correct.trim();

  // 2. Numeric index
  const idx =
    typeof data.correctAnswerIndex === 'number'
      ? data.correctAnswerIndex
      : (data.correctIndex as number | undefined);
  if (typeof idx === 'number' && idx >= 0 && options[idx]) return options[idx]!;

  // 3. Cannot determine — return null so the caller can abort rather than corrupt
  return null;
}

/**
 * Ensures at least one sibling (different question, same concept) exists for due review.
 * If none exists, generates a variant via Gemini and stores it as PreGeneratedQuestion.
 * Safe to call from Edge; generation is best-effort (logs and returns on failure).
 *
 * When userId is supplied, the most common confusion pairs for this condition are fetched
 * and injected into the generation prompt so distractors target actual misconceptions.
 */
export async function ensureDueVariant(
  prisma: PrismaClient,
  question: PreGenQuestionForVariant,
  apiKey: string | undefined,
  log?: { info: (msg: string, ctx?: Record<string, unknown>) => void; warn: (msg: string, ctx?: Record<string, unknown>) => void },
  userId?: string
): Promise<void> {
  const conditionId = question.conditionId ?? undefined;
  if (!conditionId) return;

  try {
    // Determine how many siblings already exist for this concept.
    // For high-confusion conditions we raise the threshold so more variants are generated,
    // ensuring the Due session has varied exposure rather than re-presenting the same sibling.
    const siblingCount = await prisma.preGeneratedQuestion.count({
      where: {
        conditionId,
        id: { not: question.id },
      },
    });

    // Base threshold: 1 sibling is enough for most concepts.
    // Raise to 3 if the user has documented confusion (≥2 confusion pairs) for this condition
    // so high-confusion concepts accumulate a richer variant pool over time.
    let siblingThreshold = 1;
    if (userId) {
      try {
        const confusionCount = await prisma.confusionPair.count({
          where: { userId, realConditionId: conditionId, count: { gte: 2 } },
        });
        if (confusionCount >= 2) siblingThreshold = 3;
      } catch {
        // Non-fatal — use default threshold
      }
    }

    if (siblingCount >= siblingThreshold) {
      log?.info('Due variant: sufficient siblings exist', {
        conditionId, siblingCount, siblingThreshold,
      });
      return;
    }

    if (!apiKey) {
      log?.warn('Due variant: no API key, skip generation', { conditionId });
      return;
    }

    const data = (question.questionData ?? {}) as Record<string, unknown>;
    const options = getOptionsAsStrings(data);
    const correctAnswer = getCorrectAnswerString(data, options);
    const questionText =
      [data.vignette, data.question].filter(Boolean).join('\n\n') ||
      (data.question as string) ||
      '';
    const explanation = (data.rationale ?? data.explanation ?? '') as string;

    if (!questionText || options.length === 0) {
      log?.warn('Due variant: insufficient question data to generate', { conditionId });
      return;
    }

    // Abort if we cannot determine the correct answer — storing a variant with
    // the wrong answer marked as correct is worse than not storing it at all.
    if (correctAnswer === null) {
      log?.warn('Due variant: cannot determine correct answer, aborting generation', {
        conditionId,
        questionId: question.id,
        availableFields: Object.keys(data).join(', '),
      });
      return;
    }

    // Fetch confusion pairs if userId provided — used to craft targeted distractors.
    // Query the top 3 most frequent confusions for this condition for this user.
    let confusionPairs: ConfusionPairHint[] = [];
    if (userId) {
      try {
        const pairs = await prisma.confusionPair.findMany({
          where: { userId, realConditionId: conditionId },
          orderBy: { count: 'desc' },
          take: 3,
          select: { mistakenFor: true, count: true },
        });
        confusionPairs = pairs.filter((p) => p.count >= 2); // only meaningful patterns
        if (confusionPairs.length > 0) {
          log?.info('Due variant: injecting confusion pairs into prompt', {
            conditionId,
            pairCount: confusionPairs.length,
          });
        }
      } catch (pairErr) {
        // Non-fatal — proceed without confusion pair data
        log?.warn('Due variant: confusion pair fetch failed (non-fatal)', {
          conditionId,
          error: pairErr instanceof Error ? pairErr.message : String(pairErr),
        });
      }
    }

    // Adaptive strategy selection (priority order):
    //   1. confusion pairs present  → different_distractors  (target the misconception)
    //   2. ≥3 consecutive incorrect → different_scenario     (test transfer after repeated misses)
    //   3. 2  consecutive incorrect → different_scenario     (test transfer of learning)
    //   4. otherwise               → rephrased               (lower bar: just re-exposure)
    let targetType: VariantType = 'rephrased';
    if (confusionPairs.length > 0) {
      targetType = 'different_distractors';
    } else if (userId) {
      try {
        const weakness = await prisma.weaknessPattern.findFirst({
          where: { userId, conditionId },
          orderBy: { timestamp: 'desc' },
          select: { consecutiveWrong: true },
        });
        if (weakness) {
          if (weakness.consecutiveWrong >= 3) targetType = 'different_scenario';
          else if (weakness.consecutiveWrong >= 2) targetType = 'different_scenario';
        }
      } catch {
        // Non-fatal — WeaknessPattern query failure should never block variant generation
      }
    }

    const variant = await generateVariant(
      {
        originalQuestion: questionText,
        originalOptions: options,
        originalAnswer: correctAnswer,
        originalExplanation: explanation,
        targetType,
        confusionPairs: confusionPairs.length > 0 ? confusionPairs : undefined,
      },
      { env: { GEMINI_API_KEY: apiKey ?? '' } }
    );
    if (!variant?.question || !Array.isArray(variant.options) || variant.options.length === 0) {
      log?.warn('Due variant: generation returned no usable variant', { conditionId });
      return;
    }

    const correctAnswerStr = variant.correctAnswer ?? variant.options[0];
    const correctAnswerIndex = variant.options.indexOf(correctAnswerStr ?? '');
    if (correctAnswerIndex === -1) {
      // correctAnswer returned by the variant generator is not present in the options array.
      // This means the generator produced inconsistent output — log it but still store at index 0
      // so the variant is usable. The question-flag mechanism can surface it for review.
      log?.warn('Due variant: correctAnswer not found in generated options, defaulting to index 0', {
        conditionId,
        correctAnswerStr,
        optionCount: variant.options.length,
      });
    }
    const finalIndex = Math.max(0, correctAnswerIndex);

    // Dedup: skip if the generated variant is near-identical to an existing sibling.
    // Uses semantic hash (djb2 on first 200 normalised chars) checked against the
    // semanticHash column so we don't waste DB writes or reviewer time on duplicates.
    const variantHash = computeSemanticHash(variant.question);
    const existingHash = await prisma.preGeneratedQuestion.findFirst({
      where: { conditionId, semanticHash: variantHash },
      select: { id: true },
    }).catch(() => null); // Non-fatal — if the column doesn't exist yet, skip check
    if (existingHash) {
      log?.info('Due variant: generated variant is a near-duplicate — skipping write', {
        conditionId, variantHash,
      });
      return;
    }

    const newId =
      typeof crypto !== 'undefined' &&
      typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function'
        ? (crypto as { randomUUID: () => string }).randomUUID()
        : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    await prisma.preGeneratedQuestion.create({
      data: {
        id: newId,
        questionType: question.questionType || 'mcq',
        system: question.system ?? undefined,
        conditionId,
        difficulty: question.difficulty || 'medium',
        semanticHash: variantHash,
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
