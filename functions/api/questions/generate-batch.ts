/**
 * POST /api/questions/generate-batch
 * Background generation of questions to seed the pre-generated pool
 * Uses Gemini API to generate questions and stores them in PreGeneratedQuestion table
 *
 * Sprint 7 (AI Gateway migration): Replaced direct `fetchWithTimeout` calls to
 * `generativelanguage.googleapis.com` with `gateway.callText()` using
 * task='generation'. Behaviour preserved:
 *   - `tier: 'fast'` pins the default model to gemini-2.0-flash (matches the
 *     previous hard-coded endpoint). Cost profile unchanged for the batch path.
 *   - `fallback: 'same_provider'` (task default) replaces the old 3-attempt
 *     manual retry loop; the gateway handles transient 429/5xx + tier bumps
 *     uniformly with other question-generation callers.
 *   - `maxOutputTokens: 16384` preserved for large 10–50-question batches.
 * Telemetry (requestId, traceId, modelUsed, costUsd) is now captured centrally
 * by the gateway rather than being a blind spot on this endpoint.
 */

import { z } from 'zod';
import { PANCE_TASK_CATEGORY_PERCENT } from '../../../lib/constants/blueprint';
import { validateDistractors } from '../../../lib/distractorValidation';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { computeSemanticHash } from '../../../lib/utils/semanticHash';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';
import {
  gateway,
  GatewayError,
  toGatewayContext,
  type GatewayContext,
} from '../../../lib/ai/aiGateway';

// Flattened schema for body parsing (no nested 'body' object)
const GenerateBatchSchema = z.object({
  system: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  count: z.number().int().min(1).max(50).optional(),
});

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

const SYSTEMS = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
];

export const onRequestOptions = withCors();

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory):
// - Batch generation fans out 10-50 Gemini calls per invocation; the
//   authenticated stack's 300 rpm default would let a client chew through a
//   month of quota in minutes. aiEndpoint pins this to 25 rpm on the 'ai' bucket.
export const onRequestPost = aiEndpoint(GenerateBatchSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate-batch');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, category, difficulty, count } = validated;

    const selectedSystem = system ?? SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)];
    const selectedCategory = category ?? 'general';
    const selectedDifficulty: string = difficulty ?? 'medium';
    const requestedCount = Math.min(count ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

    // Check API key
    if (!env.GEMINI_API_KEY) {
      logger.error('Gemini API key not configured');
      throw new Error('Gemini API key not configured');
    }

    // Generate questions using Gemini (via AI gateway)
    const generatedQuestions = await generateQuestionsWithGemini(
      toGatewayContext(context),
      selectedSystem ?? '',
      selectedCategory ?? '',
      selectedDifficulty,
      requestedCount,
      logger
    );

    if (generatedQuestions.length === 0) {
      logger.info('No questions generated', { userId: auth.userId, system: selectedSystem });
      return {
        data: {
          success: false,
          message: 'No questions generated',
          generated: 0,
        },
      };
    }

    // Normalize questions: resolve correctAnswer letter/text to correctAnswerIndex.
    // Critical: NEVER fall back to 0/A silently — malformed rows get persisted to the pool
    // and served to every user, damaging FSRS trust. Skip unresolvable questions instead.
    const normalizedQuestions = generatedQuestions
      .map((q) => {
        if (!Array.isArray(q.options) || q.options.length === 0) {
          logger.warn('Skipping generated question with no options', {
            system: selectedSystem,
          });
          return null;
        }
        if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) {
          logger.warn('Skipping generated question with missing correctAnswer', {
            system: selectedSystem,
          });
          return null;
        }
        const correctAnswerIndex = resolveCorrectAnswerIndex(q.correctAnswer, q.options);
        if (correctAnswerIndex === null) {
          logger.warn(
            'Skipping generated question — correctAnswer does not resolve to any option',
            { system: selectedSystem, correctAnswer: q.correctAnswer },
          );
          return null;
        }
        return { ...q, correctAnswerIndex };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    if (normalizedQuestions.length === 0) {
      logger.info('All generated questions failed correctAnswer resolution', {
        userId: auth.userId,
        system: selectedSystem,
        total: generatedQuestions.length,
      });
      return {
        data: {
          success: false,
          message: 'No questions had resolvable correct answers',
          generated: 0,
        },
      };
    }

    // Sprint 9: Gate by distractor validation (score >= 70)
    const DISTRACTOR_THRESHOLD = 70;
    const withDistractorScore = normalizedQuestions.map((q) => ({
      q,
      validation: validateDistractors({
        id: '',
        question: q.question ?? '',
        options: q.options ?? [],
        correctAnswer: q.correctAnswer ?? 'A',
      }),
    }));
    const passed = withDistractorScore.filter((x) => x.validation.score >= DISTRACTOR_THRESHOLD);
    const failedCount = withDistractorScore.length - passed.length;
    if (failedCount > 0) {
      logger.info('Questions gated by distractor validation', {
        failed: failedCount,
        total: withDistractorScore.length,
        threshold: DISTRACTOR_THRESHOLD,
      });
    }
    const toInsert = passed.map((x) => x.q);

    // Seed questions into PreGeneratedQuestion table (only those passing distractor gate)
    const records = toInsert.map((q, idx) => ({
      id: `pregen-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      questionType: selectedCategory,
      system: selectedSystem,
      difficulty: selectedDifficulty,
      questionData: q,
      generatedAt: new Date(),
      // Phase 4: populate taxonomy + dedup columns at creation time
      questionOrder: (q as any).questionOrder ?? 'third',
      taskCategory: (q as any).taskCategory ?? selectedCategory,
      semanticHash: computeSemanticHash((q as any).question ?? ''),
    }));

    // Phase 4: dedup — skip questions whose semanticHash already exists in the pool
    const hashValues = records
      .map((r) => r.semanticHash)
      .filter((h): h is string => typeof h === 'string' && h.length > 0);
    const existingHashSet =
      hashValues.length > 0
        ? new Set(
            (
              await prisma.preGeneratedQuestion.findMany({
                where: { semanticHash: { in: hashValues } },
                select: { semanticHash: true },
              })
            ).map((d) => d.semanticHash ?? '')
          )
        : new Set<string>();
    const dedupedRecords =
      existingHashSet.size > 0
        ? records.filter((r) => !existingHashSet.has(r.semanticHash ?? ''))
        : records;
    if (dedupedRecords.length < records.length) {
      logger.info('Deduped questions by semanticHash', {
        removed: records.length - dedupedRecords.length,
        kept: dedupedRecords.length,
      });
    }

    const result = await prisma.preGeneratedQuestion.createMany({
      data: dedupedRecords,
      skipDuplicates: true,
    });

    logger.info('Questions generated', {
      userId: auth.userId,
      generated: result.count,
      system: selectedSystem,
      category: selectedCategory,
      difficulty: selectedDifficulty,
    });

    return {
      data: {
        success: true,
        generated: result.count,
        system: selectedSystem,
        category: selectedCategory,
        difficulty: selectedDifficulty,
      },
    };
  } catch (error) {
    logger.error('Error generating batch questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate batch questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

async function generateQuestionsWithGemini(
  ctx: GatewayContext,
  system: string,
  category: string,
  difficulty: string,
  count: number,
  logger: any
): Promise<
  Array<{
    question: string;
    vignette?: string;
    options: string[];
    correctAnswer: string;
    rationale?: {
      bottomLine?: string;
      whyCorrect: string;
      whyIncorrectA?: string;
      whyIncorrectB?: string;
      whyIncorrectC?: string;
      whyIncorrectD?: string;
      clinicalPearl?: string;
      highYieldImageOrTable?: string;
    };
    explanation?: string;
    tags?: string[];
  }>
> {
  const systemDescriptions: Record<string, string> = {
    CV: 'Cardiovascular system - heart, blood vessels, circulation',
    PULM: 'Pulmonary/Respiratory system - lungs, airways, breathing',
    GI: 'Gastrointestinal system - digestive tract, liver, pancreas',
    NEURO: 'Neurological system - brain, spinal cord, peripheral nerves',
    MSK: 'Musculoskeletal system - bones, joints, muscles',
    DERM: 'Dermatology - skin, hair, nails',
    HEME: 'Hematology/Oncology - blood, lymph, malignancies',
    ENDO: 'Endocrine system - hormones, thyroid, adrenal, diabetes',
    HEENT: 'Head, Eyes, Ears, Nose, Throat',
    RENAL: 'Renal/Genitourinary - kidneys, bladder, electrolytes',
    REPRO: 'Reproductive system - male and female reproductive health',
    PSYCH: 'Psychiatry - mental health, behavioral conditions',
    ID: 'Infectious Disease - bacterial, viral, fungal, parasitic',
    GU: 'Genitourinary - urinary tract, reproductive system',
  };

  const difficultyDescriptions: Record<string, string> = {
    easy: 'straightforward concepts, clear presentations, common conditions',
    medium: 'moderate complexity, some nuance required, typical PANCE-style',
    hard: 'complex cases, atypical presentations, differential diagnosis challenges',
  };

  // Task area distribution per NCCPA Blueprint (approximate counts for batch)
  const taskAllocations: string[] = [];
  for (const [taskKey, pct] of Object.entries(PANCE_TASK_CATEGORY_PERCENT)) {
    const n = Math.round(count * (pct / 100));
    if (n > 0) {
      const label = taskKey.replace(/_/g, ' ');
      taskAllocations.push(`${n} ${label}`);
    }
  }
  const taskMixInstruction =
    taskAllocations.length > 0
      ? `Vary question types per NCCPA task mix: ${taskAllocations.join(', ')}.`
      : 'Vary question types: diagnosis (~18%), history & physical (~16%), clinical intervention (~16%), pharmaceutical (~15%), health maintenance (~11%), diagnostic lab (~10%).';

  const redFlagInstruction =
    count >= 10
      ? `Include a subtle red-flag scenario in 1-2 questions: a benign chief complaint with a single subtle finding that changes management (e.g. back pain + urinary incontinence → cauda equina; chest pain + JVD → tamponade). Do not make the red flag obvious; it should require careful reading.`
      : '';

  const prompt = `You are a board-certified physician and medical education expert writing PANCE-style questions modeled after Kaplan Medical's gold-standard question bank.

Generate ${count} PANCE-style multiple choice questions for: ${system} (${systemDescriptions[system] || system})
Category: ${category}
Difficulty: ${difficulty} - ${difficultyDescriptions[difficulty] || difficulty}

=== CRITICAL FORMATTING RULES (Kaplan Style) ===

1. VIGNETTE STRUCTURE (3-5 sentences) – Vignette Evolution:
   - Start with demographics: "A [age]-year-old [sex] [relevant history] presents to [setting]..."
   - Include CHIEF COMPLAINT with duration: "...with a [X]-day history of [symptoms]"
   - Add PERTINENT POSITIVES: specific clinical findings that point toward diagnosis
   - PERTINENT NEGATIVES (MANDATORY - at least 2): Include at least 2 pertinent negatives that rule out top differentials. Example: "No JVD (rules out tamponade). No pain on inspiration (rules out pleuritis)." or "No tenderness to palpation (rules out costochondritis). No pain with breathing (rules out pleuritis)."
   - VITALS AS CLUES: Vitals must not be filler. Use relative baselines when relevant: e.g. "BP 110/70" in a patient "normally hypertensive (160/90)" = relative hypotension. Include relevant VITAL SIGNS or LAB VALUES that support or contradict the diagnosis or add meaningful context.

2. QUESTION STEM - Use THIRD-ORDER / "DOUBLE JUMP" (Kaplan-Level):
   - AVOID: "What is the diagnosis?" (first-order recall)
   - PREFER third-order: Vignette → Diagnosis → Complication/next step → Answer. Example: "A patient has a circular rash. What is the mechanism of action of the first-line treatment for the likely complication if left untreated?" → Answer: "Inhibits 30S ribosomal subunit" (Lyme → Doxy → mechanism).
   - PREFER: "What is the mechanism of [first-line treatment]?" or "What is the most appropriate next step in management?"
   - PREFER: "Which finding would most likely be seen on [imaging/lab] if [complication] develops?"
   - Correct answer should not be obviously longer or more detailed

3. ANSWER OPTIONS - KAPLAN-LEVEL DISTRACTORS (4 OPTIONS REQUIRED, PANCE-style):
   - Provide exactly 4 options (A through D). DO NOT prefix with "A.", "B.", etc. - just the option text
   - Every wrong answer must be "the right answer to a different question" - correct for a slightly different patient (e.g. otitis: A = viral/watchful, B = bacterial = answer, C = recurrent/effusion, D = penicillin-allergic).
   - BAD: Obviously wrong options (e.g. chemotherapy for simple otitis). GOOD: Each distractor appropriate for a different scenario.
   - Avoid "all of the above" or "none of the above"

4. UNCALCULATED LABS: Provide raw BMP (Na, Cl, HCO3, etc.) in a table only; do NOT state "anion gap 20" or other derived values—the student must calculate.

5. HIDDEN IMAGE: When an image/radiograph is referenced or shown, do NOT state the finding or diagnosis in text. Use only scenario + "Radiograph is shown" (e.g. "Patient fell on outstretched hand. Radiograph is shown.").

6. RAW PATIENT DATA (NEVER Give Away the Answer):
   - NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).
   - WRONG: "A patient with pneumonia presents..." or "A patient with iron deficiency anemia..."
   - RIGHT: "A 45-year-old male with fatigue. Labs: Hgb 9.2 g/dL, MCV 72 fL, ferritin 10 ng/mL."
   - RIGHT: "A patient presents with fever, productive cough, and right lower lobe crackles on exam."
   - Let the clinical picture speak - the student must interpret findings; do not name the diagnosis in the vignette.

7. STANDARDIZED RATIONALE (5-section object, NCCPA-style): Each question MUST have a "rationale" object (not "explanation" string): bottomLine (one sentence: diagnosis + treatment), whyCorrect (walk through vignette findings → diagnosis → answer; include pathophysiology when relevant), whyIncorrectA/B/C/D/E (why a student might choose it; why wrong for THIS patient; when it WOULD be correct for another scenario), clinicalPearl (memorable hook), highYieldImageOrTable ("N/A" or brief description).

8. GOLD STANDARD vs. INITIAL (Classic PANCE Trap): For questions asking "best initial step" or "most appropriate next test," include the definitive/gold standard test as a distractor. The rationale MUST clarify why that test is incorrect for this step (e.g. "Gold standard for diagnosis but not the initial test;" "Correct for confirmatory workup, not first step").

9. NEXT BEST STEP: For "next step in management" questions, establish what has already been done. State completed work first, then ask for the immediate next action. Example: "EKG shows ST elevation in II, III, aVF. Aspirin and heparin given. What is the most appropriate next step?" — not "What is the first step?" when workup has already started.

10. PHARMACOLOGICAL CONTRAINDICATIONS: For therapeutics questions, include a comorbid condition that contraindicates first-line treatment when appropriate. Example: HTN + gout (avoid thiazides; use ACEi/ARB); otitis + penicillin allergy (use macrolide, not amoxicillin).

11. TASK AREA DISTRIBUTION: ${taskMixInstruction}

12. RED FLAG RECOGNITION: ${redFlagInstruction || 'Optional: include a subtle red flag in 1 question if appropriate.'}

Return ONLY a JSON array (no markdown, no code blocks):
[
  {
    "vignette": "A 58-year-old woman with a history of hypertension and type 2 diabetes presents to the emergency department with sudden onset of crushing substernal chest pain radiating to her left arm. She appears diaphoretic and anxious. Vital signs show BP 160/95 mmHg, HR 110 bpm, RR 22/min. ECG shows ST-segment elevation in leads V1-V4.",
    "question": "What is the most appropriate initial management for this patient?",
    "options": ["Immediate cardiac catheterization with PCI", "Administer morphine and nitroglycerin", "Start thrombolytic therapy", "Obtain serial troponins and observe", "Place on telemetry and hold anticoagulation"],
    "correctAnswer": "A",
    "rationale": {
      "bottomLine": "The diagnosis is acute STEMI, and the treatment is emergent PCI (or thrombolytics if PCI unavailable).",
      "whyCorrect": "This patient has acute STEMI with classic presentation (chest pain, diaphoresis, ST-elevation V1-V4). Primary PCI within 90 minutes is the gold standard.",
      "whyIncorrectB": "Morphine and nitroglycerin provide symptomatic relief but do not address coronary occlusion.",
      "whyIncorrectC": "Thrombolytics are second-line when PCI unavailable within 120 minutes.",
      "whyIncorrectD": "Serial troponins are for NSTEMI/unstable angina workup, not acute STEMI.",
      "whyIncorrectE": "Telemetry is supportive but does not address acute coronary occlusion.",
      "clinicalPearl": "Door-to-balloon time goal is <90 minutes for STEMI.",
      "highYieldImageOrTable": "N/A"
    },
    "tags": ["${system}", "${category}"]
  }
]`;

  // AI Gateway: task='generation' + tier='fast' pins gemini-2.0-flash (the
  // prior behaviour of this endpoint). `same_provider` fallback is the task
  // default and replaces the previous 3-attempt manual retry loop — the
  // gateway transparently handles transient 429/5xx + tier bumps and
  // standardizes telemetry across all question-generation callers.
  let rawText: string;
  let modelUsed: string;
  try {
    const result = await gateway.callText(ctx, {
      mode: 'text',
      task: 'generation',
      tier: 'fast',
      endpoint: '/api/questions/generate-batch',
      userPrompt: prompt,
      temperature: 0.8,
      maxOutputTokens: 16384,
    });
    if (result.blocked) {
      logger.error('Gemini blocked batch generation', {
        reason: result.blockReason ?? 'unknown',
        modelUsed: result.telemetry.modelUsed,
      });
      return [];
    }
    rawText = (result.text ?? '').trim();
    modelUsed = result.telemetry.modelUsed;
  } catch (error) {
    if (error instanceof GatewayError) {
      logger.error('Gateway error during batch generation', {
        code: error.code,
        retryable: error.retryable,
        requestId: error.requestId,
        traceId: error.traceId,
      });
    } else {
      logger.error('Unexpected error during batch generation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }

  try {
    if (!rawText) {
      logger.error('No text in Gemini response', { modelUsed });
      return [];
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonText = rawText;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const questions = JSON.parse(jsonText);

    if (!Array.isArray(questions)) {
      logger.error('Invalid questions format - not an array', { modelUsed });
      return [];
    }

    // Validate structure: rationale (structured) or explanation (legacy flat) required
    return questions.filter((q) => {
      const hasRationale =
        (q.rationale && typeof q.rationale === 'object' && 'whyCorrect' in q.rationale) ||
        (q.explanation && typeof q.explanation === 'string');
      return (
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.correctAnswer &&
        hasRationale
      );
    });
  } catch (error) {
    logger.error('Error parsing questions from Gemini', {
      error: error instanceof Error ? error.message : String(error),
      modelUsed,
    });
    return [];
  }
}
