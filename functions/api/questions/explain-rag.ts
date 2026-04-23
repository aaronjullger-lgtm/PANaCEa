/**
 * POST /api/questions/explain-rag
 *
 * Generates a RAG-grounded explanation for why an answer is wrong,
 * what the correct answer is, and the underlying clinical reasoning.
 *
 * Uses retrieved clinical reference content to ground explanations,
 * with KV caching to avoid redundant Gemini calls for the same
 * question + answer combo.
 *
 * Pipeline:
 *   1. Check KV cache for existing explanation
 *   2. If miss: retrieve clinical context via RAG
 *   3. Build explanation prompt with correct/wrong answer context
 *   4. Generate via Gemini with clinical grounding rules
 *   5. Cache result in KV (24h TTL)
 *   6. Return structured explanation with source citations
 *
 * @see lib/services/ragContextService.ts — RAG retrieval layer
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import {
  retrieveForExplanation,
  formatContextForPrompt,
  assessRetrievalQuality,
} from '../../../lib/services/ragContextService';

const GEMINI_MODEL = 'gemini-2.0-flash';
const CACHE_TTL_SECONDS = 86400; // 24 hours

const BodySchema = z.object({
  questionId: z.string().min(1).max(100),
  questionText: z.string().min(1).max(5000),
  selectedAnswer: z.string().min(1).max(1000),
  correctAnswer: z.string().min(1).max(1000),
  system: z.string().min(1).max(100),
  allOptions: z.array(z.string()).min(2).max(6).optional(),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string; CACHE?: KVNamespace };

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): RAG explanation
// pipeline invokes Gemini + vector retrieval; 25 rpm 'ai' bucket is correct.
export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
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
  const { questionId, questionText, selectedAnswer, correctAnswer, system, allOptions } = validated;

  try {
    // 1. Check KV cache
    const cacheKey = `explain-rag:${questionId}:${selectedAnswer}`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { data: { ...parsed, cached: true } };
        } catch {
          // Corrupted cache — fall through to generate
        }
      }
    }

    // 2. Retrieve clinical context via RAG
    const ragContext = await retrieveForExplanation(
      questionText,
      selectedAnswer,
      correctAnswer,
      system,
      prisma,
      apiKey
    );
    const quality = assessRetrievalQuality(ragContext);
    const formattedContext = formatContextForPrompt(ragContext, 2500);

    // 3. Build explanation prompt
    const systemInstruction = `You are a clinical educator generating evidence-based explanations for PA students after they answer a question incorrectly. Your explanations must teach the underlying concept, not just state the right answer.

CRITICAL RULES:
- Ground ALL clinical claims in the provided reference context.
- NEVER hallucinate clinical details not present in the context.
- Explain WHY the student's answer is incorrect for THIS specific patient.
- Explain WHY the correct answer fits THIS patient's presentation.
- Include a concise "clinical pearl" that helps prevent this mistake in the future.
- If the wrong answer would be correct in a different scenario, mention that scenario.
- Use clear, direct language appropriate for a PA-S2 student.`;

    const optionContext = allOptions
      ? `\nAll answer choices: ${allOptions.join(', ')}`
      : '';

    const prompt = `${formattedContext}

QUESTION: ${questionText}
${optionContext}
STUDENT SELECTED: ${selectedAnswer}
CORRECT ANSWER: ${correctAnswer}
ORGAN SYSTEM: ${system}

Generate a structured explanation in JSON format:
{
  "whyCorrect": "Why ${correctAnswer} is the best answer for this patient (2-3 sentences, cite clinical evidence)",
  "whyWrong": "Why ${selectedAnswer} is incorrect in this scenario (2-3 sentences, be specific to patient presentation)",
  "whenWrongWouldBeRight": "A brief clinical scenario where ${selectedAnswer} WOULD be the correct answer (1-2 sentences, or null if not applicable)",
  "clinicalPearl": "A memorable teaching point that helps distinguish these concepts (1 sentence)",
  "keyDistinction": "The single most important clinical feature that differentiates the correct from incorrect answer",
  "relatedConcepts": ["concept1", "concept2"]
}

Return ONLY valid JSON. No markdown fences.`;

    // 4. Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4, // Lower temp for factual explanations
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[explain-rag] Gemini error:', errText.slice(0, 300));
      return { status: 502, error: 'Explanation generation failed' };
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return { status: 502, error: 'Empty response from explanation model' };
    }

    // 5. Parse response
    let explanation: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      explanation = JSON.parse(cleaned);
    } catch {
      console.error('[explain-rag] JSON parse error:', rawText.slice(0, 200));
      return { status: 502, error: 'Invalid JSON from explanation model' };
    }

    // 6. Build response with RAG metadata
    const sourceChunkIds = [...new Set(ragContext.chunks.map((c) => c.sourceId))];
    const result = {
      explanation,
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
      cached: false,
    };

    // 7. Cache in KV (fire and forget)
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL_SECONDS,
        });
      } catch (cacheErr) {
        console.warn('[explain-rag] KV cache write failed:', cacheErr);
      }
    }

    return { data: result };
  } catch (error) {
    console.error('[explain-rag]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'RAG explanation generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
