/**
 * AI Content Enrichment API - Admin-only endpoint to fill missing MedicalContent fields
 *
 * POST /api/admin/enrich-condition
 * Uses Gemini AI to generate missing content and determine display priority
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// All enrichable fields
const ENRICHABLE_FIELDS = [
  'overview',
  'etiology',
  'pathophysiology',
  'epidemiology',
  'symptoms',
  'physicalExam',
  'diagnostics',
  'treatment',
  'prognosis',
  'complications',
  'differentialDiagnosis',
  'riskFactors',
  'gold_standard_dx',
  'first_line_rx',
  'best_initial_test',
  'classic_patient',
  'buzzwords',
  'clinical_pearls',
  'classic_triad',
  'mnemonic',
] as const;

interface DisplayPriority {
  primary: string;
  secondary?: string;
  tertiary?: string;
  reasoning: string;
}

interface EnrichResult {
  conditionId: string;
  condition: string;
  fieldsUpdated: string[];
  displayPriority: DisplayPriority | null;
  success: boolean;
  error?: string;
}

function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
    if (trimmed.includes('to be generated') || trimmed.includes('content needed')) return true;
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No content in Gemini response');
  }
  return text;
}

function buildEnrichmentPrompt(
  condition: string,
  system: string,
  subcategory: string,
  existingContent: Record<string, unknown>,
  missingFields: string[]
): string {
  return `You are a PANCE exam content expert. Your task is to fill in missing fields for a medical condition in our study database.

CONDITION: ${condition}
SYSTEM: ${system}
SUBCATEGORY: ${subcategory}

EXISTING CONTENT (for context):
${Object.entries(existingContent)
  .filter(([k, v]) => v && !isFieldEmpty(v))
  .map(
    ([k, v]) => `- ${k}: ${typeof v === 'string' ? v.substring(0, 200) + '...' : JSON.stringify(v)}`
  )
  .join('\n')}

FIELDS TO GENERATE:
${missingFields.map((f) => `- ${f}`).join('\n')}

INSTRUCTIONS:
1. For each missing field, provide PANCE-focused, high-yield content
2. If a field does NOT apply to this condition (e.g., no classic triad exists), respond with "N/A - [brief reason]"
3. Be concise but comprehensive - focus on board-testable facts
4. For buzzwords, provide 3-5 pathognomonic terms
5. For clinical_pearls, provide 2-3 high-yield pearls as an array
6. For classic_triad, only include if the condition has a well-known triad (otherwise N/A)

ALSO DETERMINE DISPLAY PRIORITY:
Analyze which feature is MOST important for board recognition of this condition:
- "classic_triad" - If condition has a pathognomonic triad (e.g., Beck's triad for cardiac tamponade)
- "buzzwords" - If condition is best recognized by specific buzzwords (e.g., "chocolate cyst" for endometriosis)
- "classic_patient" - If patient demographics are key (e.g., young female for SLE)
- "gold_standard_dx" - If the diagnostic test is the defining feature
- "physical_exam" - If specific exam findings are pathognomonic (e.g., Chvostek sign)
- "mnemonic" - If a mnemonic is the best way to remember this condition

Return a JSON object with this structure:
{
  "fields": {
    "overview": "...",
    "etiology": "...",
    // ... other requested fields
  },
  "display_priority": {
    "primary": "buzzwords",
    "secondary": "classic_patient",
    "tertiary": "gold_standard_dx",
    "reasoning": "Brief explanation of why this priority order"
  }
}

Return ONLY valid JSON, no markdown code blocks.`;
}

const EnrichConditionSchema = z.object({
  body: z.object({
    conditionId: z.string().min(1),
    fieldsToEnrich: z.array(z.string()).optional(),
    forceRegenerate: z.boolean().optional(),
  }),
});

const EnrichGetSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = withCors();

// GET returns usage info
export const onRequestGet = authenticatedEndpoint(EnrichGetSchema, async (context) => {
  const { auth } = context;
  const logger = createEndpointLogger('/api/admin/enrich-condition');

  logger.info('Usage info requested', { userId: auth.userId });

  return {
    data: {
      endpoint: '/api/admin/enrich-condition',
      method: 'POST',
      description: 'AI-powered content enrichment for MedicalContent entries',
      body: {
        conditionId: 'string (required) - The conditionId to enrich',
        fieldsToEnrich:
          'string[] (optional) - Specific fields to enrich, defaults to all empty fields',
        forceRegenerate: 'boolean (optional) - Regenerate even if field has content',
      },
      enrichableFields: ENRICHABLE_FIELDS,
      rateLimit: 'Admin-only, use responsibly',
    },
  };
});

export const onRequestPost = authenticatedEndpoint(EnrichConditionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/enrich-condition');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check admin role
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      logger.warn('Non-admin attempted content enrichment', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    const { conditionId, fieldsToEnrich, forceRegenerate } = validated.body;

    // Fetch existing content
    const content = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });

    if (!content) {
      logger.info('Condition not found', { conditionId, userId: user.id });

      return {
        data: { error: 'Condition not found' },
        status: 404,
      };
    }

    // Determine which fields need enrichment
    const contentObj = content as unknown as Record<string, unknown>;
    let missingFields: string[];

    if (fieldsToEnrich && fieldsToEnrich.length > 0) {
      // Use specified fields
      missingFields = forceRegenerate
        ? fieldsToEnrich.filter((f) => ENRICHABLE_FIELDS.includes(f as any))
        : fieldsToEnrich.filter(
            (f) => ENRICHABLE_FIELDS.includes(f as any) && isFieldEmpty(contentObj[f])
          );
    } else {
      // Find all empty fields
      missingFields = ENRICHABLE_FIELDS.filter((f) => isFieldEmpty(contentObj[f]));
    }

    if (missingFields.length === 0) {
      logger.info('No fields need enrichment', {
        conditionId,
        userId: user.id,
      });

      return {
        data: {
          conditionId,
          condition: content.condition,
          fieldsUpdated: [],
          displayPriority: null,
          success: true,
          message: 'No fields need enrichment',
        },
      };
    }

    // Check for API key
    if (!env.GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY not configured', { userId: user.id });
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build and send prompt
    const prompt = buildEnrichmentPrompt(
      content.condition,
      content.system,
      content.subcategory,
      contentObj,
      missingFields
    );

    const aiResponse = await callGeminiAPI(prompt, env.GEMINI_API_KEY);

    // Parse AI response
    let parsed: { fields: Record<string, unknown>; display_priority: DisplayPriority };
    try {
      // Clean response (remove markdown code blocks if present)
      const cleaned = aiResponse.replace(/```json\n?|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.error('Failed to parse AI response', {
        userId: user.id,
        conditionId,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });

      return {
        data: {
          error: 'Failed to parse AI response',
          rawResponse: aiResponse.substring(0, 500),
        },
        status: 500,
      };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const fieldsUpdated: string[] = [];

    for (const field of missingFields) {
      const value = parsed.fields?.[field];
      if (value !== undefined) {
        updateData[field] = value;
        fieldsUpdated.push(field);
      }
    }

    // Store display priority in content JSONB
    if (parsed.display_priority) {
      const existingContent = (content.content as Record<string, unknown>) || {};
      updateData.content = {
        ...existingContent,
        display_priority: parsed.display_priority,
      };
    }

    // Update database
    if (Object.keys(updateData).length > 0) {
      await prisma.medicalContent.update({
        where: { conditionId },
        data: {
          ...updateData,
          updatedBy: user.id,
          updatedAt: new Date(),
        },
      });
    }

    const result: EnrichResult = {
      conditionId,
      condition: content.condition,
      fieldsUpdated,
      displayPriority: parsed.display_priority || null,
      success: true,
    };

    logger.info('Content enriched successfully', {
      userId: user.id,
      conditionId,
      fieldsUpdated: fieldsUpdated.length,
    });

    return {
      data: result,
    };
  } catch (error) {
    logger.error('Content enrichment error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to enrich condition');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
