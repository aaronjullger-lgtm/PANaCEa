import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { TASK_TYPES, TaskType } from './taskTypes';
import { GEMINI_VARIANT_MODEL } from './constants/models';

const variantSchema = {
  type: SchemaType.OBJECT,
  properties: {
    question: { type: SchemaType.STRING },
    options: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    correctAnswer: { type: SchemaType.STRING },
    explanation: { type: SchemaType.STRING },
    variantType: { type: SchemaType.STRING },
  },
  required: ['question', 'options', 'correctAnswer', 'explanation', 'variantType'] as string[],
} as const;

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

/**
 * Generate a question variant via Gemini.
 * apiKey: pass from Edge (context.env.GEMINI_API_KEY) or Node (process.env.GEMINI_API_KEY).
 * Omit in browser; returns null if no key.
 */
export async function generateVariant(request: VariantRequest, apiKey?: string) {
  const key = apiKey ?? (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ?? '';
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_VARIANT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: variantSchema,
    },
  });

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
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Variant generation failed:', error);
    return null;
  }
}
