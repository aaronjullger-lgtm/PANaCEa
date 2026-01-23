/**
 * POST /api/questions/generate-batch
 * Background generation of questions to seed the pre-generated pool
 * Uses Gemini API to generate questions and stores them in PreGeneratedQuestion table
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const GenerateBatchSchema = z.object({
  body: z.object({
    system: z.string().optional(),
    category: z.string().optional(),
    difficulty: z.string().optional(),
    count: z.number().int().min(1).max(50).optional(),
  }),
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
    const { system, category, difficulty, count } = validated.body;

    const selectedSystem = system || SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)];
    const selectedCategory = category || 'general';
    const selectedDifficulty = difficulty || 'medium';
    const requestedCount = Math.min(count || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

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

    // Seed questions into PreGeneratedQuestion table
    const records = generatedQuestions.map((q, idx) => ({
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

  const prompt = `Generate ${count} unique PANCE-style medical multiple choice questions for the ${system} (${systemDescriptions[system] || system}) system.

Category: ${category}
Difficulty: ${difficulty} - ${difficultyDescriptions[difficulty] || difficulty}

Requirements:
1. Each question should have a brief clinical vignette (2-4 sentences) presenting a realistic patient scenario
2. The question stem should be clear and test clinical decision-making
3. Provide exactly 4 answer options (A, B, C, D)
4. Include one correct answer and three plausible distractors
5. The explanation should be educational and explain why the correct answer is right and why others are wrong
6. Questions should be appropriate for PA certification exam preparation

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "vignette": "Brief clinical scenario...",
    "question": "What is the most appropriate next step?",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation...",
    "tags": ["${system}", "${category}"]
  }
]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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
