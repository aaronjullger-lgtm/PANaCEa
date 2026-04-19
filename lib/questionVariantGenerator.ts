/**
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai`
 * SDK usage with `gateway.callText()` — task='generation', tier='fast'
 * (gemini-2.0-flash — matches the prior `GEMINI_VARIANT_MODEL` binding).
 *
 * Callers should pass a `GatewayContext` built from `toGatewayContext(ctx)`
 * on the Edge side or a minimal `{ env: { GEMINI_API_KEY } }` object on the
 * Node side. Falls back to `process.env.GEMINI_API_KEY` if no context is
 * provided, for backward-compat with existing Node scripts and dev routes.
 *
 * Note: The prior implementation used Gemini `responseSchema` for structured
 * output. `callText` does not force JSON mode, so we rely on prompt-level
 * JSON instruction + defensive markdown fence stripping + safe parse.
 * Downstream consumers already validate the returned shape.
 */
import { gateway, GatewayError, type GatewayContext } from './ai/aiGateway';

/** A condition the student frequently confuses with the real answer */
export interface ConfusionPairHint {
  /** Display name of the condition they confuse this with */
  mistakenFor: string;
  /** How many times this confusion has occurred */
  count: number;
}

export interface VariantRequest {
  originalQuestion: string;
  originalOptions: string[];
  originalAnswer: string;
  originalExplanation: string;
  targetType:
    | 'rephrased'
    | 'different_distractors'
    | 'different_scenario'
    | 'remediation'
    | 'decomposition';
  userIncorrectAnswer?: string; // The incorrect option selected by the user
  /** Student-specific confusion pairs for this concept — used to craft targeted distractors */
  confusionPairs?: ConfusionPairHint[];
}

interface GeneratedVariant {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  variantType: string;
}

function buildContextFromEnv(): GatewayContext {
  const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY ?? '' : '';
  return { env: { GEMINI_API_KEY: apiKey } };
}

/**
 * Generate a question variant via the AI gateway.
 *
 * @param request  Variant parameters (type, source question, optional confusion hints).
 * @param ctx      Optional `GatewayContext`. If omitted, derives one from
 *                 `process.env.GEMINI_API_KEY` (Node fallback). Returns `null`
 *                 when no API key is available in either place.
 */
export async function generateVariant(
  request: VariantRequest,
  ctx?: GatewayContext
): Promise<GeneratedVariant | null> {
  const gatewayCtx = ctx ?? buildContextFromEnv();
  if (!gatewayCtx.env?.GEMINI_API_KEY) return null;

  let prompt = `
    You are a medical education expert. create a "${request.targetType}" variant of the following multiple choice question.

    Original Question: ${request.originalQuestion}
    Original Options: ${JSON.stringify(request.originalOptions)}
    Original Answer: ${request.originalAnswer}
    Original Explanation: ${request.originalExplanation}
    `;

  if (request.userIncorrectAnswer) {
    prompt += `\nThe user incorrectly answered: "${request.userIncorrectAnswer}".`;
  }

  if (request.confusionPairs && request.confusionPairs.length > 0) {
    const pairsText = request.confusionPairs
      .map((p) => `"${p.mistakenFor}" (confused ${p.count} time${p.count === 1 ? '' : 's'})`)
      .join(', ');
    prompt += `\nKnown student confusion patterns for this concept: ${pairsText}.`;
    if (request.targetType === 'different_distractors') {
      prompt += ` For the incorrect answer choices, include distractors based on these confusion patterns to specifically address the student's documented misconceptions.`;
    }
  }

  prompt += `\n\nRules for "${request.targetType}":
    - rephrased: Keep the same clinical concept but rewrite the vignette/question stem.
    - different_distractors: Keep the question similar but provide different/trickier wrong answer choices.
    - different_scenario: Change patient demographics or context but test the exact same underlying guideline/concept.
    - remediation: The user has a specific misconception as evidenced by their wrong answer ("${request.userIncorrectAnswer}"). Create a variant that specifically targets this confusion. Explain *why* their wrong answer is wrong in the new explanation, while testing the core concept again.
    - decomposition: The original question involves a multi-step verification (e.g. Diagnosis -> Treatment). The user failed this. Identify the *prerequisite* step (e.g. Diagnosis) and generate a question that ONLY tests that prerequisite step to check if that is where the knowledge gap lies. Keep the vignette similar but change the question to ask for the intermediate step.

    Ensure the new question is high-quality, unambiguous, and accurate.

    OUTPUT FORMAT — return ONLY valid JSON (no markdown), matching this shape:
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string",
      "variantType": "${request.targetType}"
    }
  `;

  try {
    const result = await gateway.callText(gatewayCtx, {
      mode: 'text',
      task: 'generation',
      tier: 'fast', // matches prior GEMINI_VARIANT_MODEL = gemini-2.0-flash
      endpoint: 'lib/questionVariantGenerator',
      userPrompt: prompt,
    });

    if (result.blocked) {
      console.warn('Variant generation blocked by safety filter');
      return null;
    }

    const text = (result.text ?? '').replace(/```json|```/g, '').trim();
    if (!text) return null;

    try {
      return JSON.parse(text) as GeneratedVariant;
    } catch (parseError) {
      console.error('Variant generation: JSON parse failed', parseError);
      return null;
    }
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error(`Variant generation gateway error [${error.code}]: ${error.message}`);
      return null;
    }
    console.error('Variant generation failed:', error);
    return null;
  }
}

