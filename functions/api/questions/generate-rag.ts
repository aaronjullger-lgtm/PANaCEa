/**
 * POST /api/questions/generate-rag
 *
 * Generates PANCE-style questions grounded in clinical reference content
 * via retrieval-augmented generation (RAG).
 *
 * Pipeline:
 *   1. Retrieve relevant clinical content from MedicalContent via pgvector
 *   2. Build grounded prompt with retrieved context
 *   3. Generate questions via Gemini with strict grounding instructions
 *   4. Return questions with source citations and retrieval quality metrics
 *
 * @see lib/services/ragContextService.ts — RAG retrieval layer
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import {
  retrieveForQuestionGeneration,
  formatContextForPrompt,
  assessRetrievalQuality,
} from '../../../lib/services/ragContextService';

const GEMINI_MODEL = 'gemini-2.0-flash';

const BodySchema = z.object({
  conditionName: z.string().min(1).max(200),
  system: z.string().min(1).max(100),
  count: z.number().int().min(1).max(5).optional().default(1),
  questionType: z.enum(['mcq', 'vignette', 'recall']).optional().default('vignette'),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, [
      'GEMINI_API_KEY',
      'DATABASE_URL',
    ]);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const apiKey = env.GEMINI_API_KEY!;
  const { conditionName, system, count, questionType } = validated;

  try {
    // 1. Retrieve clinical context via RAG
    const ragContext = await retrieveForQuestionGeneration(conditionName, system, prisma, apiKey);
    const quality = assessRetrievalQuality(ragContext);
    const formattedContext = formatContextForPrompt(ragContext, 3000);

    // 2. Build grounded generation prompt
    const systemInstruction = `You are a board-certified physician and experienced NBME item-writer creating PANCE-style clinical questions for PA students.

CRITICAL RULES:
- Generate questions ONLY from the provided clinical reference context below.
- NEVER hallucinate clinical details not present in the context.
- NEVER state the diagnosis or condition name in the vignette stem. Use raw patient data only.
- If the context is insufficient to create a clinically accurate question, return {"insufficient": true}.
- Each wrong answer must be correct for a slightly different patient scenario.
- Prefer third-order questions (mechanism, next step, complication management).
- Include at least 2 pertinent negatives that rule out top differentials.`;

    const prompt = `${formattedContext}

TASK: Generate ${count} high-quality '${questionType}' question(s) about ${conditionName} (${system}) strictly based on the clinical reference context above.

OUTPUT FORMAT (JSON array):
[{
  "type": "${questionType}",
  "question": "Clinical vignette with raw patient data only...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "Matches one option exactly",
  "explanation": {
    "rationale": "Why the correct answer is correct, citing specific clinical evidence.",
    "incorrect": {"A": "Why wrong for THIS patient; when correct", "B": "...", "C": "...", "D": "..."}
  },
  "difficulty": 0.5,
  "sourceSections": ["pathophysiology", "treatment"],
  "sourceConditions": ["${conditionName}"]
}]

Return ONLY valid JSON. No markdown fences.`;

    // 3. Call Gemini for generation
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-rag] Gemini error:', errText.slice(0, 300));
      return { status: 502, error: 'Question generation failed' };
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return { status: 502, error: 'Empty response from generation model' };
    }

    // 4. Parse response
    let questions: unknown[];
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      questions = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.error('[generate-rag] JSON parse error:', rawText.slice(0, 200));
      return { status: 502, error: 'Invalid JSON from generation model' };
    }

    // 5. Attach RAG metadata
    const sourceChunkIds = [...new Set(ragContext.chunks.map((c) => c.sourceId))];

    return {
      data: {
        questions,
        ragMetadata: {
          sourceChunkIds,
          retrievalQuality: quality.grade,
          retrievalMessage: quality.message,
          isGrounded: ragContext.isGrounded,
          chunksUsed: ragContext.chunks.length,
          avgSimilarity:
            ragContext.retrievalScores.length > 0
              ? ragContext.retrievalScores.reduce((a, b) => a + b, 0) /
                ragContext.retrievalScores.length
              : 0,
        },
      },
    };
  } catch (error) {
    console.error('[generate-rag]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'RAG question generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
