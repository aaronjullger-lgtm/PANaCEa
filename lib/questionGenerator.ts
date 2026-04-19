/**
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai` SDK
 * usage with `gateway.callText()` using task='generation', tier='powerful'
 * (gemini-2.5-pro — matches the prior `GEMINI_PRO_MODEL` binding).
 *
 * This module is Node-only (used by `services/core/noRepeatService`, test
 * scripts, and the dev-only Express route handlers). It builds a minimal
 * `GatewayContext` from `process.env` on each call so it can share the same
 * telemetry + fallback + cost-tracking pipeline as the Cloudflare Edge
 * endpoints — without forking logic between runtimes.
 */
import { v4 as uuidv4 } from 'uuid';
import { ConditionData, GeneratedQuestion, QuestionType } from '../types/question';
import { validateQuestion } from './questionValidator';
import {
  gateway,
  GatewayError,
  type GatewayContext,
} from './ai/aiGateway';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('GEMINI_API_KEY environment variable is not set. Question generation will fail.');
}

/**
 * Construct a minimal `GatewayContext` for Node-side callers. The gateway
 * expects the Cloudflare env shape; we mimic it using process.env so the same
 * gateway code path can service both runtimes.
 */
function buildNodeGatewayContext(): GatewayContext {
  return {
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    },
  };
}

const SYSTEM_INSTRUCTION = `
You are a strict medical education assistant for the PANaCEa platform. 
Your goal is to generate PANCE-style medical questions based ONLY on the provided context.
- NEVER hallucinate information.
- If the provided text does not support a question, return NULL.
- RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).
- Clinical vignettes should follow: [Age/Sex] presents with [Chief Complaint]. History reveals [Findings]. Physical exam shows [Signs].
- Difficulty scoring: 0.3 (Recall) to 0.9 (Complex synthesis).
- Kaplan-level: Prefer third-order stems (STRICT): Vignette → Diagnosis → Complication/next step → Answer. Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible.
- Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient (e.g. otitis: viral vs bacterial vs recurrent vs penicillin-allergic). No obviously wrong options.
`;

export async function generateSingleQuestion(
  condition: ConditionData,
  type: QuestionType
): Promise<GeneratedQuestion | null> {
  // Fast path for tests to avoid network dependency/timeouts
  const mockQuestion: GeneratedQuestion = {
    id: uuidv4(),
    conditionId: condition.condition,
    type,
    question: `Mock ${type} for ${condition.condition}`,
    options:
      type === 'mcq' || type === 'vignette'
        ? ['Thiazides', 'ACE inhibitor', 'Beta blocker', 'Calcium channel blocker']
        : undefined,
    correctAnswer: 'Thiazides',
    explanation: {
      rationale: 'Mock rationale derived from treatment section',
      incorrect:
        type === 'mcq' || type === 'vignette'
          ? {
              'ACE inhibitor': 'Alternative first-line but not the primary recommendation here',
              'Beta blocker': 'Not first-line without specific indications',
              'Calcium channel blocker':
                'Considered but not the primary recommendation in this context',
            }
          : undefined,
    },
    difficulty: 0.4,
    sourceSections: ['treatment'],
  };

  if (process.env.NODE_ENV === 'test') {
    const validation = validateQuestion(mockQuestion, condition);
    return validation.isValid ? mockQuestion : null;
  }

  if (!API_KEY) {
    console.warn('GEMINI_API_KEY missing; skipping question generation.');
    return null;
  }

  // Pass findings-only for vignette-building; withhold condition/overview from vignette text
  const findings = condition.sections;
  const findingsContext = [
    findings.clinicalPresentation
      ? `Clinical Presentation: ${findings.clinicalPresentation.slice(0, 500)}`
      : '',
    findings.diagnostics ? `Lab/Imaging: ${findings.diagnostics.slice(0, 400)}` : '',
    findings.treatment ? `Treatment (answer accuracy only): ${findings.treatment.slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const anchors = condition.panceAnchors;
  const panceBlock =
    anchors && Object.values(anchors).some(Boolean)
      ? `
    HIGH-YIELD PANCE ANCHORS (curated ground truth — anchor question and distractor accuracy):
    ${anchors.classicPatient ? `Classic Patient: ${anchors.classicPatient}` : ''}
    ${anchors.classicTriad?.length ? `Classic Triad: ${anchors.classicTriad.join(', ')}` : ''}
    ${anchors.firstLineRx ? `First-Line Rx: ${anchors.firstLineRx}` : ''}
    ${anchors.goldStandardDx ? `Gold Standard Dx: ${anchors.goldStandardDx}` : ''}
    ${anchors.bestInitialTest ? `Best Initial Test: ${anchors.bestInitialTest}` : ''}
    Use these to engineer plausible distractors (e.g. correct for similar but not identical scenarios).
    `
      : '';

  const prompt = `
    CONTEXT - Use these clinical findings to build the vignette. Do NOT include condition name or diagnosis in the vignette.
    ${findingsContext}
    ${panceBlock}

    CRITICAL - RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).

    KAPLAN-LEVEL: Prefer third-order question (mechanism, next step, complication management). Each wrong option should be correct for a different patient/scenario. Gold standard vs. initial: For "best initial step" questions, include gold standard as distractor. Next best step: State what has already been done first, then ask for the immediate next action. Pertinent negatives: Include at least 2 that rule out top differentials. Pharmacological contraindications: For therapeutics, include comorbidity that contraindicates first-line (e.g. HTN + gout; otitis + penicillin allergy).

    TASK:
    Generate one high-quality '${type}' question strictly based on the data above.
    
    OUTPUT FORMAT (JSON only): Include rationale and whyIncorrectA/B/C/D for each distractor (explain why wrong for THIS patient; when it would be correct for another scenario).
    {
      "type": "${type}",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "Matches one option exactly",
      "explanation": {
          "rationale": "Why the correct answer is correct.",
          "incorrect": {"A": "Why A is wrong; when correct for another patient", "B": "...", "C": "...", "D": "..."}
      },
      "difficulty": 0.5,
      "sourceSections": ["sectionKey1"]
    }
  `;

  try {
    const result = await gateway.callText(buildNodeGatewayContext(), {
      mode: 'text',
      task: 'generation',
      tier: 'powerful', // matches prior GEMINI_PRO_MODEL = gemini-2.5-pro binding
      endpoint: 'lib/questionGenerator',
      systemPrompt: SYSTEM_INSTRUCTION,
      userPrompt: prompt,
    });

    if (result.blocked) {
      console.warn('Question generation blocked by safety filter');
      return null;
    }

    const text = result.text ?? '';

    // Sanitize markdown code blocks if present (gateway text path does not
    // force responseMimeType: 'application/json', so fences may appear).
    const jsonString = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        'Failed to parse AI response as JSON. Response was:',
        jsonString.substring(0, 200)
      );
      return null;
    }

    const question: GeneratedQuestion = {
      id: uuidv4(),
      conditionId: condition.condition, // simplified for example
      ...parsed,
    };

    // Internal validation before returning
    const validation = validateQuestion(question, condition);
    if (!validation.isValid) {
      console.warn(`Generated question rejected: ${validation.errors.join(', ')}`);
      return null;
    }

    return question;
  } catch (error: any) {
    if (error instanceof GatewayError) {
      console.error(
        `Gateway error during question generation [${error.code}]: ${error.message}`,
        { endpoint: 'lib/questionGenerator', task: 'generation' }
      );
      return null;
    }
    console.error('Error generating question:', error);
    return null;
  }
}

export async function generateQuestionsFromCondition(
  condition: ConditionData,
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];
  const types: QuestionType[] = ['mcq', 'vignette', 'recall'];

  for (let i = 0; i < count; i++) {
    // Rotate types
    const type = types[i % types.length];
    if (type == null) continue;
    const q = await generateSingleQuestion(condition, type);
    if (q) questions.push(q);
  }

  return questions;
}
