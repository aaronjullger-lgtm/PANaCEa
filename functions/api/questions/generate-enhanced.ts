/**
 * POST /api/questions/generate-enhanced
 * Generate high-quality PANCE questions using rich database context.
 * Uses Gemini API with condition data, linked entities, and PANCE task focus.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GenerationRequestSchema = z.object({
  body: z.object({
    context: z.string().min(1),
    conditionId: z.string().min(1),
    conditionName: z.string().min(1),
    system: z.string().min(1),
    task: z.string().min(1),
    difficulty: z.enum(['easier', 'same', 'harder']),
  }),
});

const TASK_INSTRUCTIONS: Record<string, string> = {
  'Formulating Diagnosis': `Create a question that tests the ability to formulate a diagnosis. The question should present a clinical vignette and ask "What is the most likely diagnosis?" or similar. Focus on pattern recognition from history, physical exam, and key findings.`,

  'History Taking/PE': `Create a question that tests knowledge of history taking or physical examination. Ask about expected findings on physical exam, or which history questions would be most helpful. Examples: "Which physical exam finding would you expect?" or "Which history finding is most consistent with this diagnosis?"`,

  'Using Diagnostic Studies': `Create a question that tests the appropriate use of diagnostic studies. Ask about the best initial test, most appropriate diagnostic study, or interpretation of lab/imaging results. Focus on test selection and result interpretation.`,

  'Clinical Intervention': `Create a question that tests clinical intervention skills. Ask about immediate management, procedural interventions, or clinical decision-making. Examples: "What is the most appropriate next step in management?" or "Which intervention should be performed first?"`,

  'Pharmaceutical Therapeutics': `Create a question that tests pharmaceutical knowledge. Ask about first-line medications, drug mechanisms, contraindications, or adverse effects. Focus on treatment selection and medication management.`,

  'Health Maintenance': `Create a question about preventive medicine, screening recommendations, or health maintenance. Ask about appropriate screening intervals, vaccination schedules, or lifestyle modifications for prevention.`,

  'Applying Science Concepts': `Create a question that tests understanding of underlying pathophysiology, anatomy, or basic science. Ask about the mechanism of disease, anatomical considerations, or scientific basis for clinical findings.`,
};

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easier: `Generate an EASIER question suitable for building foundational knowledge:
- Use classic textbook presentation
- Clear, unambiguous clinical findings
- Straightforward question stem
- One obviously correct answer
- Common conditions only`,

  same: `Generate a PANCE-LEVEL question matching real exam difficulty:
- Realistic clinical vignette with relevant details
- May include subtle findings or red herrings
- Plausible distractors that test understanding
- Second-order thinking required (diagnosis → management)
- Mix of common and moderately uncommon presentations`,

  harder: `Generate a HARDER question above typical PANCE difficulty:
- Complex patient with comorbidities
- Atypical presentations or "zebra" conditions
- Multi-step reasoning required
- May test mechanism of action or pathophysiology
- Requires integration of multiple concepts`,
};

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerationRequestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate-enhanced');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      context: conditionContext,
      conditionId,
      conditionName,
      system,
      task,
      difficulty,
    } = validated.body;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Build the generation prompt
    const taskInstruction = TASK_INSTRUCTIONS[task] || TASK_INSTRUCTIONS['Formulating Diagnosis'];
    const difficultyInstruction =
      DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS['same'];

    const prompt = `You are a PANCE exam question writer creating a high-quality multiple-choice question.

## Condition Information
${conditionContext}

## Question Requirements
${taskInstruction}

${difficultyInstruction}

## Output Format
Generate a JSON object with this exact structure (no markdown, no backticks):
{
  "vignette": "A clinical scenario with patient demographics, chief complaint, relevant history, and findings. 2-4 sentences.",
  "question": "A single clear question stem asking what was specified in the task focus.",
  "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
  "correctAnswerIndex": 0,
  "rationale": "Explanation of why the correct answer is correct and why each distractor is incorrect. Use <b> for key terms.",
  "pearls": ["Pearl 1 about this condition", "Pearl 2 - high-yield fact", "Pearl 3 - clinical tip"]
}

CRITICAL RULES:
1. The vignette MUST be a realistic clinical scenario with age, gender, and relevant details
2. All 4 options must be plausible for this clinical picture
3. The correct answer must be definitively correct based on the provided context
4. Distractors should represent common misconceptions or related conditions
5. The rationale must explain why each option is correct or incorrect
6. Include 2-3 high-yield clinical pearls
7. Do NOT include any markdown formatting or code blocks
8. Return ONLY the JSON object`;

    // Generate question
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let questionData;
    try {
      // Clean the response - remove any markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      questionData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.error('Failed to parse generated question', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        raw: responseText.slice(0, 500),
        userId: auth.userId,
      });
      throw new Error('Failed to parse generated question');
    }

    // Validate required fields
    if (
      !questionData.vignette ||
      !questionData.question ||
      !questionData.options ||
      questionData.correctAnswerIndex === undefined ||
      !questionData.rationale
    ) {
      logger.error('Generated question missing required fields', {
        fields: Object.keys(questionData),
        userId: auth.userId,
      });
      throw new Error('Generated question missing required fields');
    }

    // Generate unique ID
    const questionId = `enh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Optionally store in database for future use
    try {
      await prisma.question.create({
        data: {
          id: questionId,
          vignette: questionData.vignette,
          question: `${questionData.vignette}\n\n${questionData.question}`,
          options: questionData.options,
          correctAnswer: ['A', 'B', 'C', 'D'][questionData.correctAnswerIndex] || 'A',
          explanation: questionData.rationale,
          system: system,
          difficulty: difficulty,
          source: 'enhanced-generation',
          tags: { conditionId, conditionName, task },
        },
      });
    } catch (dbError) {
      // Non-critical - log but don't fail
      logger.warn('Failed to store question', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        userId: auth.userId,
      });
    }

    logger.info('Enhanced question generated', {
      userId: auth.userId,
      questionId,
      conditionId,
      system,
      task,
      difficulty,
    });

    return {
      data: {
        success: true,
        question: {
          id: questionId,
          vignette: questionData.vignette,
          question: questionData.question,
          options: questionData.options.map((opt: string) => opt.replace(/^[A-D]\.\s*/, '')),
          correctAnswerIndex: questionData.correctAnswerIndex,
          rationale: questionData.rationale,
          pearls: questionData.pearls || [],
          conditionId,
          conditionName,
          system,
          task,
          difficulty,
        },
      },
    };
  } catch (error) {
    logger.error('Error generating enhanced question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate enhanced question');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
