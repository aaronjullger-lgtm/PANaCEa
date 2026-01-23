/**
 * GET /api/ddx/comparison
 *
 * Generates a distinguishing-features table between conditions using Gemini.
 * Caches the result in MedicalContent.content.comparisons with a sorted key.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ComparisonSchema = z.object({
  query: z.object({
    conditions: z.string().optional(),
    ids: z.string().optional(),
  }),
});

interface ComparisonResult {
  features: string[];
  distinguishers: string[];
  generatedAt: string;
  source: 'gemini' | 'fallback';
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ComparisonSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/ddx/comparison');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const rawIds = validated.query?.conditions || validated.query?.ids;
    const conditionIds = rawIds
      ? rawIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    if (conditionIds.length < 2) {
      return { data: { error: 'At least two condition IDs required' }, status: 400 };
    }

    if (conditionIds.length > 5) {
      return { data: { error: 'Maximum of five conditions supported' }, status: 400 };
    }

    const medicalContent = await prisma.medicalContent.findMany({
      where: { id: { in: conditionIds } },
      select: {
        id: true,
        condition: true,
        system: true,
        content: true,
        buzzwords: true,
        symptoms: true,
        pathophysiology: true,
        gold_standard_dx: true,
        best_initial_test: true,
        first_line_rx: true,
        classic_patient: true,
      },
    });

    if (medicalContent.length !== conditionIds.length) {
      return { data: { error: 'One or more conditions not found' }, status: 404 };
    }

    const cacheKey = conditionIds
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .join('|');
    const cachedContent = (medicalContent[0].content as Record<string, unknown> | null) || {};
    const cachedComparisons =
      (cachedContent.comparisons as Record<string, ComparisonResult> | undefined) || {};
    const cached = cachedComparisons[cacheKey];
    if (cached) {
      logger.info('Returning cached comparison', { userId: auth.userId, cacheKey });
      return { data: { comparison: cached, cached: true } };
    }

    const prompt = buildComparisonPrompt(medicalContent);
    let comparison: ComparisonResult;

    if (env.GEMINI_API_KEY) {
      const aiText = await generateWithGemini(env.GEMINI_API_KEY, prompt);
      comparison = parseComparison(aiText, medicalContent);
    } else {
      comparison = buildFallbackComparison(medicalContent);
    }

    // Cache comparison on all involved MedicalContent rows
    await Promise.all(
      medicalContent.map(
        async (mc: { id: string; condition: string; system: string; content: unknown }) => {
          const contentJson = (mc.content as Record<string, unknown> | null) || {};
          const comparisons =
            (contentJson.comparisons as Record<string, ComparisonResult> | undefined) || {};
          comparisons[cacheKey] = comparison;
          return prisma!.medicalContent.update({
            where: { id: mc.id },
            data: { content: { ...contentJson, comparisons } },
          });
        }
      )
    );

    logger.info('Generated new comparison', { userId: auth.userId, conditionIds });
    return { data: { comparison, cached: false } };
  } catch (error) {
    logger.error('Comparison generation error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate comparison');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function buildComparisonPrompt(
  medicalContent: Array<{
    id: string;
    condition: string;
    system: string;
    buzzwords: string[] | null;
    symptoms?: string | null;
    pathophysiology?: string | null;
    gold_standard_dx?: string | null;
    best_initial_test?: string | null;
    first_line_rx?: string | null;
    classic_patient?: string | null;
  }>
) {
  const lines = medicalContent.map((mc) => {
    const buzz = mc.buzzwords?.slice(0, 5).join(', ') || 'n/a';
    return `- ${mc.condition} (system: ${mc.system}). Buzzwords: ${buzz}. Key features: ${mc.symptoms || 'n/a'}. Pathophys: ${mc.pathophysiology || 'n/a'}. Gold standard: ${mc.gold_standard_dx || 'n/a'}. First line rx: ${mc.first_line_rx || 'n/a'}.`;
  });

  return `You are a clinical reasoning tutor. Given the following conditions, produce a JSON object with keys "features" and "distinguishers".
- "features": shared or easily confused findings (3-6 bullet strings)
- "distinguishers": the most reliable differentiators, tests, or classic patient patterns (3-8 bullet strings)
Keep answers concise (<30 words each), specific, and clinically actionable.
Conditions:\n${lines.join('\n')}`;
}

async function generateWithGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseComparison(
  raw: string,
  medicalContent: Array<{ condition: string; system?: string }>
): ComparisonResult {
  try {
    const parsed = JSON.parse(raw);
    const features = Array.isArray(parsed.features) ? parsed.features.map(String) : [];
    const distinguishers = Array.isArray(parsed.distinguishers)
      ? parsed.distinguishers.map(String)
      : [];
    if (features.length || distinguishers.length) {
      return { features, distinguishers, generatedAt: new Date().toISOString(), source: 'gemini' };
    }
  } catch {
    // JSON parse failed, use fallback
  }
  return buildFallbackComparison(
    medicalContent.map((item) => ({ condition: item.condition, system: item.system || 'Unknown' }))
  );
}

function buildFallbackComparison(
  medicalContent: Array<{ condition: string; system: string }>
): ComparisonResult {
  const names = medicalContent.map((mc) => mc.condition);
  return {
    features: [`No AI output available. Conditions compared: ${names.join(', ')}.`],
    distinguishers: [
      'Review diagnostic gold standards and classic presentations for each condition.',
    ],
    generatedAt: new Date().toISOString(),
    source: 'fallback',
  };
}
