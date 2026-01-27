/**
 * POST /api/questions/generate-batch
 * Background generation of questions to seed the pre-generated pool
 * Uses Gemini API to generate questions and stores them in PreGeneratedQuestion table
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

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
      selectedSystem,
      selectedCategory,
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

    // Seed questions into PreGeneratedQuestion table
    const records = normalizedQuestions.map((q, idx) => ({
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
    explanation: string;
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

  const prompt = `You are a board-certified physician and medical education expert writing PANCE-style questions modeled after Kaplan Medical's gold-standard question bank.

Generate ${count} PANCE-style multiple choice questions for: ${system} (${systemDescriptions[system] || system})
Category: ${category}
Difficulty: ${difficulty} - ${difficultyDescriptions[difficulty] || difficulty}

=== CRITICAL FORMATTING RULES (Kaplan Style) ===

1. VIGNETTE STRUCTURE (3-5 sentences):
   - Start with demographics: "A [age]-year-old [sex] [relevant history] presents to [setting]..."
   - Include CHIEF COMPLAINT with duration: "...with a [X]-day history of [symptoms]"
   - Add PERTINENT POSITIVES: specific clinical findings that point toward diagnosis
   - Add PERTINENT NEGATIVES: findings that rule out key differentials
   - Include relevant VITAL SIGNS or LAB VALUES when clinically important

2. QUESTION STEM - Use SECOND-ORDER THINKING:
   - AVOID: "What is the diagnosis?" (first-order recall)
   - PREFER: "What is the most appropriate next step in management?"
   - PREFER: "Which mechanism best explains this patient's presentation?"
   - PREFER: "Which finding would most likely be seen on [imaging/lab]?"
   - PREFER: "What is the most likely underlying pathophysiology?"

3. ANSWER OPTIONS:
   - DO NOT prefix with "A.", "B.", etc. - just the option text
   - Make distractors PLAUSIBLE - they should represent common misconceptions or similar conditions
   - Correct answer should not be obviously longer or more detailed
   - Avoid "all of the above" or "none of the above"

4. CLINICAL DESCRIPTIONS (Describe, Don't Diagnose):
   - WRONG: "A patient with pneumonia presents..."
   - RIGHT: "A patient presents with fever, productive cough, and right lower lobe crackles..."
   - Let the clinical picture speak - don't give away the diagnosis in the vignette

5. EXPLANATION (Educational Value):
   - Explain WHY the correct answer is right with pathophysiology
   - Briefly explain why EACH distractor is wrong
   - Include a memorable clinical pearl or teaching point

Return ONLY a JSON array (no markdown, no code blocks):
[
  {
    "vignette": "A 58-year-old woman with a history of hypertension and type 2 diabetes presents to the emergency department with sudden onset of crushing substernal chest pain radiating to her left arm. She appears diaphoretic and anxious. Vital signs show BP 160/95 mmHg, HR 110 bpm, RR 22/min. ECG shows ST-segment elevation in leads V1-V4.",
    "question": "What is the most appropriate initial management for this patient?",
    "options": ["Immediate cardiac catheterization with PCI", "Administer morphine and nitroglycerin", "Start thrombolytic therapy", "Obtain serial troponins and observe"],
    "correctAnswer": "A",
    "explanation": "This patient presents with an acute STEMI (ST-elevation myocardial infarction) as evidenced by the classic presentation of chest pain, diaphoresis, and ST-elevation in the anterior leads. The most appropriate initial management is immediate percutaneous coronary intervention (PCI) within 90 minutes of presentation (door-to-balloon time). While morphine and nitroglycerin (B) may provide symptomatic relief, they do not address the underlying coronary occlusion. Thrombolytics (C) are second-line when PCI is not available within 120 minutes. Serial troponins and observation (D) would be appropriate for NSTEMI or unstable angina, not STEMI.",
    "tags": ["${system}", "${category}"]
  }
]`;

  try {
    const response = await fetch(
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
      }
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

    // Validate structure
    return questions.filter(
      (q) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.correctAnswer &&
        q.explanation
    );
  } catch (error) {
    logger.error('Error generating questions with Gemini', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
