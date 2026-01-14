/**
 * GET /api/ddx/comparison
 *
 * Generates a distinguishing-features table between conditions using Gemini.
 * Caches the result in MedicalContent.content.comparisons with a sorted key.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY?: string;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });

export const onRequestOptions = () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });

interface ComparisonResult {
  features: string[];
  distinguishers: string[];
  generatedAt: string;
  source: 'gemini' | 'fallback';
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { request, env } = context;
    const auth = await authenticateRequest(request, env);
    if (!auth?.userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const rawIds = url.searchParams.get('conditions') || url.searchParams.get('ids');
    const conditionIds = rawIds
      ? rawIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    if (conditionIds.length < 2) {
      return jsonResponse({ error: 'At least two condition IDs required' }, 400);
    }

    if (conditionIds.length > 5) {
      return jsonResponse({ error: 'Maximum of five conditions supported' }, 400);
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

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
      return jsonResponse({ error: 'One or more conditions not found' }, 404);
    }

    const cacheKey = conditionIds.slice().sort().join('|');

    // Check cache on the first condition entry
    const cachedContent = (medicalContent[0].content as Record<string, unknown> | null) || {};
    const cachedComparisons = (cachedContent.comparisons as Record<string, ComparisonResult> | undefined) || {};
    const cached = cachedComparisons[cacheKey];
    if (cached) {
      return jsonResponse({ comparison: cached, cached: true });
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
      medicalContent.map(async (mc) => {
        const contentJson = (mc.content as Record<string, unknown> | null) || {};
        const comparisons = (contentJson.comparisons as Record<string, ComparisonResult> | undefined) || {};
        comparisons[cacheKey] = comparison;
        return prisma!.medicalContent.update({
          where: { id: mc.id },
          data: { content: { ...contentJson, comparisons } },
        });
      })
    );

    return jsonResponse({ comparison, cached: false });
  } catch (error) {
    console.error('comparison generation error:', error);
    return jsonResponse({ error: 'Failed to generate comparison' }, 500);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

function buildComparisonPrompt(medicalContent: Array<{ id: string; condition: string; system: string; buzzwords: string[] | null; symptoms?: string | null; pathophysiology?: string | null; gold_standard_dx?: string | null; best_initial_test?: string | null; first_line_rx?: string | null; classic_patient?: string | null }>) {
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}

function parseComparison(raw: string, medicalContent: Array<{ condition: string; system?: string }>): ComparisonResult {
  try {
    const parsed = JSON.parse(raw);
    const features = Array.isArray(parsed.features) ? parsed.features.map(String) : [];
    const distinguishers = Array.isArray(parsed.distinguishers) ? parsed.distinguishers.map(String) : [];
    if (features.length || distinguishers.length) {
      return {
        features,
        distinguishers,
        generatedAt: new Date().toISOString(),
        source: 'gemini',
      };
    }
  } catch (error) {
    console.warn('Failed to parse Gemini comparison response; falling back', error);
  }

  return buildFallbackComparison(
    medicalContent.map(item => ({
      condition: item.condition,
      system: item.system || 'Unknown',
    }))
  );
}

function buildFallbackComparison(medicalContent: Array<{ condition: string; system: string }>): ComparisonResult {
  const names = medicalContent.map((mc) => mc.condition);
  return {
    features: [`No AI output available. Conditions compared: ${names.join(', ')}.`],
    distinguishers: ['Review diagnostic gold standards and classic presentations for each condition.'],
    generatedAt: new Date().toISOString(),
    source: 'fallback',
  };
}
