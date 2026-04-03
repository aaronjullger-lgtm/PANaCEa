/**
 * Elaboration Drill — Grading Endpoint
 * POST /api/drills/elaboration/grade
 *
 * Uses Gemini to grade a student's free-text explanation of WHY a clinical
 * fact is true. Returns a 0-3 score with feedback and the model explanation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

const gradeSchema = z.object({
  fact: z.string().min(5),
  studentExplanation: z.string().min(10),
  gradingRubric: z.array(z.string()),
});

export const onRequestPost = authenticatedEndpoint(gradeSchema, async (context) => {
  const { fact, studentExplanation, gradingRubric } = context.validated;
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      status: 500,
      data: { error: 'Gemini API key not configured' },
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.3 },
    });

    const rubricList = gradingRubric.map((r, i) => `${i + 1}. ${r}`).join('\n');

    const prompt = `You are grading a PA student's explanation of a clinical mechanism.

CLINICAL FACT: "${fact}"

STUDENT'S EXPLANATION: "${studentExplanation}"

GRADING RUBRIC — the explanation should address these key concepts:
${rubricList}

SCORING (0-3):
- 0: No relevant content or completely incorrect
- 1: Partially correct — identifies the general topic but misses the mechanism
- 2: Correct mechanism but missing important details from the rubric
- 3: Complete — correctly explains the mechanism with clinical relevance

Respond ONLY with valid JSON:
{
  "score": <0-3>,
  "feedback": "<2-3 sentence feedback for the student>",
  "missingConcepts": ["<concept from rubric not addressed>", ...],
  "modelExplanation": "<complete correct explanation in 3-5 sentences>"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        status: 200,
        data: {
          score: 1,
          maxScore: 3,
          feedback: 'Unable to grade — please try again.',
          missingConcepts: [],
          modelExplanation: '',
        },
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      score: number;
      feedback: string;
      missingConcepts: string[];
      modelExplanation: string;
    };

    // Clamp score to valid range
    const score = Math.max(0, Math.min(3, Math.round(parsed.score)));

    return {
      status: 200,
      data: {
        score,
        maxScore: 3,
        feedback: parsed.feedback || 'No feedback available.',
        missingConcepts: parsed.missingConcepts || [],
        modelExplanation: parsed.modelExplanation || '',
      },
    };
  } catch (error) {
    console.error('[elaboration/grade] Gemini grading failed:', error);
    return {
      status: 200,
      data: {
        score: 0,
        maxScore: 3,
        feedback: 'Grading failed — please try again.',
        missingConcepts: [],
        modelExplanation: '',
      },
    };
  }
});
