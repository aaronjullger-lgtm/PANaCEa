/**
 * Ghost Grader — infer recall confidence and implied FSRS rating from behavioral
 * telemetry via the AI gateway.
 *
 * Sprint 8 (AI Gateway migration): Replaced direct fetchWithTimeout call to
 * generativelanguage.googleapis.com with gateway.grade(). The gateway owns
 * model selection (tier:'fast' → gemini-2.0-flash, same model as before),
 * JSON repair, Zod validation, telemetry, and the fallback chain.
 *
 * Fallback: GatewayError → deriveContinuousRating() (local Bayesian, no
 * network) → static defaults. The student always gets a confidence score.
 *
 * Safety invariant: impliedRating is bounded 1–4 by BehaviorGradeSchema.
 * Hard/Easy (2/4) are still allowed here — the caller normalises to
 * Again(1)/Good(3) before writing to FSRS.
 */

import { gateway, GatewayError, type GatewayContext } from '../../../lib/ai/aiGateway';
import {
  BehaviorGradeSchema,
  BEHAVIOR_GRADE_DESCRIPTION,
  type BehaviorGrade,
} from '../../../lib/ai/schemas/grading';
import { deriveContinuousRating } from '../../../lib/implicit-metrics';

export interface BehaviorTelemetryInput {
  time_to_first_interaction_ms?: number | null;
  answer_change_count?: number;
  answer_changes?: number;
  duration_ms?: number;
  mouse_hover_duration_ms?: Record<string, number>;
  trajectory_metrics?: { distractorHovers?: Record<string, number> };
  rapid_guess?: boolean;
  [key: string]: unknown;
}

export interface AnalyzeBehaviorResult {
  confidence: number;
  impliedRating: number;
  rawText?: string;
}

function buildBehaviorPrompt(params: {
  rating: number;
  wasCorrect?: boolean;
  selectedAnswer?: string;
  tti: number | null;
  changes: number;
  duration: number;
  hovers: Record<string, number>;
  rapidGuess: boolean;
}): string {
  return `You are a behavioral analyst for a medical education spaced-repetition system.
Analyze the student's behavior on a multiple-choice question.

Facts:
- Time to first interaction (hesitation): ${params.tti != null ? `${params.tti}ms` : 'unknown'}
- Answer change count: ${params.changes}
- Total time on question: ${params.duration}ms
- Hover duration per option (ms): ${JSON.stringify(params.hovers)}
- Rapid guess (answered very fast): ${params.rapidGuess}
- User's self-rated FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy): ${params.rating}
- Was the answer correct: ${params.wasCorrect ?? 'unknown'}
- Selected option: ${params.selectedAnswer ?? 'unknown'}

Interpretation rules:
- Long hesitation + many answer changes + long hover on wrong options → likely "Hard" or "Again" (low confidence).
- Quick first interaction, few changes, little distractor hover → likely "Good" or "Easy" (high confidence).
- If they self-rated "Easy" but hovered 10+ seconds on a wrong option, treat as "Good" or "Hard".`;
}

export async function analyzeBehaviorGemini(
  env: { GEMINI_API_KEY: string },
  params: {
    rating: number;
    wasCorrect?: boolean;
    selectedAnswer?: string;
    telemetry?: BehaviorTelemetryInput | null;
  }
): Promise<AnalyzeBehaviorResult> {
  const { rating, wasCorrect, selectedAnswer, telemetry } = params;
  const t = telemetry ?? {};
  const tti = t.time_to_first_interaction_ms ?? null;
  const changes = t.answer_change_count ?? t.answer_changes ?? 0;
  const duration = t.duration_ms ?? 0;
  const hovers =
    (t.mouse_hover_duration_ms as Record<string, number> | undefined) ??
    (t.trajectory_metrics?.distractorHovers as Record<string, number> | undefined) ??
    {};
  const rapidGuess = t.rapid_guess ?? false;

  const ctx: GatewayContext = { env };

  try {
    const result = await gateway.grade<BehaviorGrade>(ctx, {
      schema: BehaviorGradeSchema,
      schemaDescription: BEHAVIOR_GRADE_DESCRIPTION,
      endpoint: '/api/srs/analyze-behavior',
      tier: 'fast',
      temperature: 0.2,
      maxOutputTokens: 256,
      fallback: 'schema_repair_only',
      userPrompt: buildBehaviorPrompt({
        rating,
        wasCorrect,
        selectedAnswer,
        tti,
        changes,
        duration,
        hovers,
        rapidGuess,
      }),
    });

    return {
      confidence: Math.max(0, Math.min(1, result.data.confidence)),
      impliedRating: Math.round(result.data.impliedRating),
      rawText: result.rawText,
    };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.warn(
        '[AI_SAFETY] Ghost Grader gateway failure — using local fallback.',
        error.code,
        error.requestId
      );
    } else {
      console.warn('[AI_SAFETY] Ghost Grader unexpected error — using local fallback.', error);
    }

    try {
      const fallbackMetrics = deriveContinuousRating({
        timeToFirstClick: tti ?? duration,
        answerSwitches: changes,
        totalDwellTime: duration,
        isCorrect: wasCorrect ?? false,
        parTimeMs: 30000,
        commitmentGapMs: undefined,
        cursorEntropy: Object.keys(hovers).length > 2 ? 1.5 : 1.0,
        hoverOscillationCount: changes,
      });

      return {
        confidence: fallbackMetrics.confidence,
        impliedRating: fallbackMetrics.discreteRating,
        rawText: 'fallback',
      };
    } catch (fallbackError) {
      console.error('[AI_SAFETY] Local fallback also failed.', fallbackError);
      return {
        confidence: 0.5,
        impliedRating: rating,
        rawText: 'fallback_failed',
      };
    }
  }
}
