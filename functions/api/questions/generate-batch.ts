/**
 * POST /api/questions/generate-batch
 * Background generation of questions to seed the pre-generated pool
 * Uses Gemini API to generate questions and stores them in PreGeneratedQuestion table
 */

import { z } from 'zod';
import { PANCE_TASK_CATEGORY_PERCENT } from '../../../lib/constants/blueprint';
import { validateDistractors } from '../../../lib/distractorValidation';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { fetchWithTimeout } from '../_shared/timeout';

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

export const onRequestPost = authenticatedEndpoint(GenerateBatchSchema, async (context) => {
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

    // Generate questions using Gemini
    const generatedQuestions = await generateQuestionsWithGemini(
      env.GEMINI_API_KEY,
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

    // Normalize questions and convert correctAnswer letter to correctAnswerIndex
    const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const normalizedQuestions = generatedQuestions.map((q) => ({
      ...q,
      correctAnswerIndex: letterToIndex[q.correctAnswer?.toUpperCase()] ?? 0,
    }));

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
    }));

    const result = await prisma.preGeneratedQuestion.createMany({
      data: records,
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
  apiKey: string,
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

3. ANSWER OPTIONS - KAPLAN-LEVEL DISTRACTORS (5 OPTIONS REQUIRED, PANCE-style):
   - Provide exactly 5 options (A through E). DO NOT prefix with "A.", "B.", etc. - just the option text
   - Every wrong answer must be "the right answer to a different question" - correct for a slightly different patient (e.g. otitis: A = viral/watchful, B = bacterial = answer, C = recurrent/effusion, D = penicillin-allergic, E = another plausible distractor).
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

  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 16384,
          },
        }),
      },
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Gemini API error', { status: response.status, error: errorText });
      return [];
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.error('No text in Gemini response');
      return [];
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonText = text.trim();
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
      logger.error('Invalid questions format - not an array');
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
        (q.options.length === 4 || q.options.length === 5) &&
        q.correctAnswer &&
        hasRationale
      );
    });
  } catch (error) {
    logger.error('Error generating questions with Gemini', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
