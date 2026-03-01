/**
 * Shared "Ghost Grader" logic: call Gemini to infer recall confidence and implied FSRS rating
 * from behavioral telemetry. Used by /api/srs/analyze-behavior and /api/srs/submit.
 */

import { fetchWithTimeout } from './timeout';
import { deriveContinuousRating } from '../../../lib/implicit-metrics';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const BEHAVIOR_MODEL = 'gemini-2.0-flash-exp';

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
  const hovers = t.mouse_hover_duration_ms ?? t.trajectory_metrics?.distractorHovers ?? {};
  const rapidGuess = t.rapid_guess ?? false;

  const prompt = `You are a behavioral analyst for a medical education spaced-repetition system.
Analyze the student's behavior on a multiple-choice question.

Facts:
- Time to first interaction (hesitation): ${tti != null ? `${tti}ms` : 'unknown'}
- Answer change count: ${changes}
- Total time on question: ${duration}ms
- Hover duration per option (ms): ${JSON.stringify(hovers)}
- Rapid guess (answered very fast): ${rapidGuess}
- User's self-rated FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy): ${rating}
- Was the answer correct: ${wasCorrect ?? 'unknown'}
- Selected option: ${selectedAnswer ?? 'unknown'}

Interpretation rules:
- Long hesitation + many answer changes + long hover on wrong options → likely "Hard" or "Again" (low confidence).
- Quick first interaction, few changes, little distractor hover → likely "Good" or "Easy" (high confidence).
- If they self-rated "Easy" but hovered 10+ seconds on a wrong option, treat as "Good" or "Hard".

Respond with a JSON object only, no markdown:
{"confidence": <number 0-1, 1=high confidence in recall>, "impliedRating": <1-4 FSRS rating>}`;

  const url = `${GEMINI_BASE}/models/${BEHAVIOR_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      },
      30000
    );

    if (!res.ok) {
      throw new Error(`Gemini API responded with status: ${res.status}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('')
        ?.trim() ?? '';

    let confidence = 0.5;
    let impliedRating = rating;
    try {
      const parsed = JSON.parse(text) as { confidence?: number; impliedRating?: number };
      if (typeof parsed.confidence === 'number')
        confidence = Math.max(0, Math.min(1, parsed.confidence));
      if (
        typeof parsed.impliedRating === 'number' &&
        parsed.impliedRating >= 1 &&
        parsed.impliedRating <= 4
      )
        impliedRating = Math.round(parsed.impliedRating);
    } catch {
      // keep defaults
    }

    return { confidence, impliedRating, rawText: text };
  } catch (error) {
    console.warn('[AI_SAFETY] Gemini API failed or timed out. Attempting local fallback.', error);
    
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
      console.error('[AI_SAFETY] Local fallback also failed. Using default confidence.', fallbackError);
      return {
        confidence: 0.5,
        impliedRating: rating,
        rawText: 'fallback_failed',
      };
    }
  }
}
