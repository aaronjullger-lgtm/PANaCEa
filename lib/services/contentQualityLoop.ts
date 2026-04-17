/**
 * Content Quality Feedback Loop Service
 *
 * Orchestrates the full pipeline for identifying and regenerating poor-quality
 * questions based on psychometric item analysis:
 *
 *   1. Fetch questions with ≥30 attempts in the lookback window
 *   2. Map QuestionAttempt records to ItemAttemptRecord format
 *   3. Run analyzeItem() from itemAnalysisService on each
 *   4. Flag items meeting any critical criterion
 *   5. For flagged items, build self-refine prompts (critique + rewrite)
 *   6. Store flags in ContentQualityFlag table
 *   7. After regeneration, mark status as "reviewed" (human approval gate)
 *
 * Research basis:
 *   - NBME item analysis standards: D ≥ 0.20, rpb ≥ 0.15
 *   - Haladyna & Rodriguez (2013): Developing and Validating Test Items
 *
 * Architecture:
 *   Orchestration layer — delegates analysis to itemAnalysisService,
 *   prompt construction to selfRefineService, and persistence to Prisma.
 *   Accepts injected dependencies for testability.
 *
 * @module lib/services/contentQualityLoop
 */

import {
  analyzeItem,
  type ItemAnalysis,
  type ItemAttemptRecord,
  type ItemFlag,
  ITEM_ANALYSIS_THRESHOLDS,
} from './itemAnalysisService';
import {
  buildCritiquePrompt,
  parseCritiqueResponse,
  buildRewritePrompt,
  type GeneratedQuestion,
  type CritiqueResult,
} from './selfRefineService';

// ─── Types ──────────────────────────────────────────────────────────────

/** Configuration for the content quality loop */
export interface ContentQualityLoopConfig {
  /** Minimum attempts required before analyzing a question (default: 30) */
  minAttempts: number;
  /** How many days back to look for attempts (default: 30) */
  lookbackDays: number;
  /** Maximum number of questions to process in one run (default: 100) */
  batchSize: number;
  /** Whether to attempt AI regeneration for flagged items (default: true) */
  attemptRegeneration: boolean;
}

export const DEFAULT_CONTENT_QUALITY_CONFIG: ContentQualityLoopConfig = {
  minAttempts: ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS,
  lookbackDays: 30,
  batchSize: 100,
  attemptRegeneration: true,
};

/** Pipeline status for a content quality flag (matches Prisma enum) */
export type FlagStatus = 'FLAGGED' | 'REGENERATING' | 'REVIEWED' | 'RESOLVED';

/** Result of a single content quality loop run */
export interface ContentQualityLoopResult {
  questionsScanned: number;
  questionsAnalyzed: number;
  newlyFlagged: number;
  regenerated: number;
  alreadyFlagged: number;
  processingTimeMs: number;
}

/** A question with its attempts, as fetched from the database */
export interface QuestionWithAttempts {
  id: string;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  source: string;
  system: string;
  attempts: Array<{
    userId: string;
    wasCorrect: boolean;
    selectedAnswer: string | null;
    timeSpentMs: number | null;
  }>;
}

/** Persisted content quality flag */
export interface ContentQualityFlagRecord {
  id: string;
  questionId: string;
  flagType: string;
  metrics: Record<string, unknown>;
  status: FlagStatus;
  regeneratedContent: Record<string, unknown> | null;
  critiqueFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

/** Dependencies injected by the caller (cron endpoint) */
export interface ContentQualityLoopDeps {
  /** Fetch questions with attempts from DB */
  fetchQuestionsWithAttempts: (config: ContentQualityLoopConfig) => Promise<QuestionWithAttempts[]>;
  /** Create a new content quality flag */
  createFlag: (data: {
    questionId: string;
    flagType: string;
    metrics: ItemAnalysis;
    status: FlagStatus;
    regeneratedContent?: Record<string, unknown>;
    critiqueFeedback?: string;
  }) => Promise<ContentQualityFlagRecord>;
  /** Check if a question already has an active (non-resolved) flag */
  findActiveFlag: (questionId: string, flagType: string) => Promise<ContentQualityFlagRecord | null>;
  /** Update a flag after regeneration */
  updateFlag: (
    id: string,
    data: { status: FlagStatus; regeneratedContent?: Record<string, unknown>; critiqueFeedback?: string }
  ) => Promise<ContentQualityFlagRecord>;
  /** Optional: Call Gemini API for self-refine critique/rewrite */
  callGemini?: (prompt: string) => Promise<string>;
  /** Optional: structured logger */
  log?: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
  };
}

// ─── Flagging Criteria ──────────────────────────────────────────────────

/** Item flag types that qualify for the content quality feedback loop */
const CRITICAL_FLAG_TYPES = new Set<ItemFlag['type']>([
  'NON_DISCRIMINATING',
  'NEGATIVE_DISCRIMINATION',
  'NEGATIVE_RPB',
]);

/**
 * Determine which flag types from an item analysis qualify for the feedback loop.
 * Returns the most severe qualifying flag types (critical/warning severity).
 */
export function getQualifyingFlags(analysis: ItemAnalysis): ItemFlag[] {
  return analysis.flags.filter((f) => {
    if (f.severity === 'critical') return true;
    if (f.severity === 'warning' && CRITICAL_FLAG_TYPES.has(f.type)) return true;
    return false;
  });
}

/**
 * Check if an item has non-functioning distractors (any wrong option selected
 * by < 5% of students).
 */
export function hasNonFunctioningDistractors(analysis: ItemAnalysis): boolean {
  return analysis.distractors.some(
    (d) => !d.isCorrect && d.isNonFunctioning
  );
}

/**
 * Check if an item has concentrated wrong answers (>80% on one wrong option).
 */
export function hasConcentratedWrongOption(analysis: ItemAnalysis): boolean {
  const wrongDistractors = analysis.distractors.filter((d) => !d.isCorrect);
  if (wrongDistractors.length === 0) return false;
  const totalWrongSelections = wrongDistractors.reduce((sum, d) => sum + d.selectionCount, 0);
  if (totalWrongSelections === 0) return false;
  const maxWrongCount = Math.max(...wrongDistractors.map((d) => d.selectionCount));
  return maxWrongCount / totalWrongSelections > 0.80;
}

/**
 * Determine all flag types to record for a question.
 * Combines psychometric flags with distractor analysis flags.
 */
export function computeFlagTypes(analysis: ItemAnalysis): string[] {
  const types = new Set<string>();

  for (const flag of analysis.flags) {
    if (CRITICAL_FLAG_TYPES.has(flag.type)) {
      types.add(flag.type);
    }
  }

  if (hasNonFunctioningDistractors(analysis)) {
    types.add('NON_FUNCTIONING_DISTRACTOR');
  }
  if (hasConcentratedWrongOption(analysis)) {
    types.add('CONCENTRATED_WRONG_OPTION');
  }

  return [...types];
}

// ─── Attempt Mapping ────────────────────────────────────────────────────

/**
 * Map database question + attempts to ItemAttemptRecord format for analyzeItem().
 * Computes per-user total scores across the entire batch for rpb computation.
 */
export function mapToItemAttemptRecords(
  questions: QuestionWithAttempts[]
): Map<string, ItemAttemptRecord[]> {
  // Build per-user total scores across all questions in this batch
  const userScores = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    for (const a of q.attempts) {
      const existing = userScores.get(a.userId) ?? { correct: 0, total: 0 };
      existing.total++;
      if (a.wasCorrect) existing.correct++;
      userScores.set(a.userId, existing);
    }
  }

  const result = new Map<string, ItemAttemptRecord[]>();
  for (const q of questions) {
    const records: ItemAttemptRecord[] = q.attempts.map((a) => {
      const scores = userScores.get(a.userId) ?? { correct: 0, total: 1 };
      return {
        studentId: a.userId,
        isCorrect: a.wasCorrect,
        selectedOption: a.selectedAnswer ?? '',
        totalScore: scores.total > 0 ? scores.correct / scores.total : 0,
        totalItems: scores.total,
        timeSpentMs: a.timeSpentMs ?? 0,
      };
    });
    result.set(q.id, records);
  }
  return result;
}

// ─── Regeneration ───────────────────────────────────────────────────────

/**
 * Build a GeneratedQuestion from database question data for self-refine.
 */
export function toGeneratedQuestion(q: QuestionWithAttempts): GeneratedQuestion {
  const options = Array.isArray(q.options) ? q.options as string[] : [];
  return {
    type: q.system ?? 'unknown',
    question: q.question,
    options,
    correctAnswer: q.correctAnswer,
    explanation: {
      rationale: q.explanation,
    },
    difficulty: q.difficulty === 'easy' ? 0.2 : q.difficulty === 'medium' ? 0.5 : q.difficulty === 'hard' ? 0.8 : 0.5,
  };
}

/**
 * Attempt to regenerate a question using the self-refine pipeline.
 * Builds critique prompt → calls Gemini → parses response → builds rewrite prompt → calls Gemini.
 *
 * Returns null if regeneration is not possible (no callGemini, parse failure, etc.)
 */
export async function attemptRegeneration(
  question: QuestionWithAttempts,
  analysis: ItemAnalysis,
  callGemini: (prompt: string) => Promise<string>,
  log?: ContentQualityLoopDeps['log']
): Promise<{
  regeneratedContent: GeneratedQuestion | null;
  critiqueResult: CritiqueResult | null;
}> {
  const generatedQ = toGeneratedQuestion(question);

  // Step 1: Build and send critique prompt
  const critiquePrompt = buildCritiquePrompt(generatedQ);
  let critiqueRaw: string;
  try {
    critiqueRaw = await callGemini(critiquePrompt);
  } catch (err) {
    log?.warn('Gemini critique call failed', {
      questionId: question.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { regeneratedContent: null, critiqueResult: null };
  }

  const critique = parseCritiqueResponse(critiqueRaw);
  if (!critique) {
    log?.warn('Failed to parse critique response', { questionId: question.id });
    return { regeneratedContent: null, critiqueResult: null };
  }

  // Step 2: Build and send rewrite prompt
  const rewritePrompt = buildRewritePrompt(generatedQ, critique);
  let rewriteRaw: string;
  try {
    rewriteRaw = await callGemini(rewritePrompt);
  } catch (err) {
    log?.warn('Gemini rewrite call failed', {
      questionId: question.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { regeneratedContent: null, critiqueResult: critique };
  }

  // Step 3: Parse the rewritten question
  try {
    const cleaned = rewriteRaw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as GeneratedQuestion;
    return { regeneratedContent: parsed, critiqueResult: critique };
  } catch (err) {
    log?.warn('Failed to parse rewrite response', { questionId: question.id });
    console.debug('[contentQualityLoop] rewrite parse failed', err);
    return { regeneratedContent: null, critiqueResult: critique };
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────

/**
 * Run the full content quality feedback loop.
 *
 * 1. Fetches questions with sufficient attempts
 * 2. Analyzes each question's psychometric quality
 * 3. Flags items meeting quality criteria
 * 4. Optionally attempts AI regeneration for flagged items
 * 5. Persists flags to the database
 */
export async function runContentQualityLoop(
  deps: ContentQualityLoopDeps,
  config: ContentQualityLoopConfig = DEFAULT_CONTENT_QUALITY_CONFIG
): Promise<ContentQualityLoopResult> {
  const startTime = Date.now();
  const log = deps.log ?? {
    info: (msg: string, ctx?: Record<string, unknown>) => console.log(`[contentQualityLoop] ${msg}`, ctx ?? ''),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(`[contentQualityLoop] ${msg}`, ctx ?? ''),
    error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => console.error(`[contentQualityLoop] ${msg}`, err, ctx ?? ''),
  };

  const result: ContentQualityLoopResult = {
    questionsScanned: 0,
    questionsAnalyzed: 0,
    newlyFlagged: 0,
    regenerated: 0,
    alreadyFlagged: 0,
    processingTimeMs: 0,
  };

  try {
    // Step 1: Fetch questions with attempts
    log.info('Fetching questions with attempts', {
      minAttempts: config.minAttempts,
      lookbackDays: config.lookbackDays,
      batchSize: config.batchSize,
    });

    const questions = await deps.fetchQuestionsWithAttempts(config);
    result.questionsScanned = questions.length;

    // Filter to questions with enough attempts
    const qualifying = questions.filter((q) => q.attempts.length >= config.minAttempts);
    result.questionsAnalyzed = qualifying.length;

    log.info('Questions qualifying for analysis', {
      total: questions.length,
      qualifying: qualifying.length,
    });

    // Step 2: Map to ItemAttemptRecords and analyze
    const attemptsByQuestion = mapToItemAttemptRecords(qualifying);

    const analyses: Array<{ question: QuestionWithAttempts; analysis: ItemAnalysis }> = [];
    for (const q of qualifying) {
      const records = attemptsByQuestion.get(q.id);
      if (records && records.length >= config.minAttempts) {
        const analysis = analyzeItem(q.id, records);
        analyses.push({ question: q, analysis });
      }
    }

    // Step 3: Flag qualifying items
    let regenerationAttempted = 0;
    for (const { question, analysis } of analyses) {
      const flagTypes = computeFlagTypes(analysis);
      if (flagTypes.length === 0) continue;

      // Check each flag type — create flags for any not already active
      for (const flagType of flagTypes) {
        const existing = await deps.findActiveFlag(question.id, flagType);
        if (existing) {
          result.alreadyFlagged++;
          continue;
        }

        // Attempt regeneration if configured and caller provided callGemini
        let regeneratedContent: Record<string, unknown> | undefined;
        let critiqueFeedback: string | undefined;

        if (config.attemptRegeneration && deps.callGemini && regenerationAttempted < 10) {
          regenerationAttempted++;
          try {
            const regenResult = await attemptRegeneration(question, analysis, deps.callGemini, log);
            if (regenResult.critiqueResult) {
              critiqueFeedback = regenResult.critiqueResult.feedbackForRewrite;
            }
            if (regenResult.regeneratedContent) {
              regeneratedContent = regenResult.regeneratedContent as unknown as Record<string, unknown>;
            }
          } catch (err) {
            log.warn('Regeneration attempt failed', {
              questionId: question.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const status: FlagStatus = regeneratedContent ? 'REVIEWED' : 'FLAGGED';

        await deps.createFlag({
          questionId: question.id,
          flagType,
          metrics: analysis,
          status,
          regeneratedContent,
          critiqueFeedback,
        });

        result.newlyFlagged++;
        if (regeneratedContent) {
          result.regenerated++;
        }
      }
    }

    log.info('Content quality loop complete', {
      questionsScanned: result.questionsScanned,
      questionsAnalyzed: result.questionsAnalyzed,
      newlyFlagged: result.newlyFlagged,
      regenerated: result.regenerated,
      alreadyFlagged: result.alreadyFlagged,
    });
  } catch (error) {
    log.error('Content quality loop failed', error);
    throw error;
  } finally {
    result.processingTimeMs = Date.now() - startTime;
  }

  return result;
}
