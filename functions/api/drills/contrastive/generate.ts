/**
 * API Endpoint: /api/drills/contrastive/generate
 * Generates a contrastive learning question using Gemini AI
 *
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai` SDK
 * usage with `gateway.callText()` using task='generation', tier='balanced'
 * (gemini-2.5-flash — same model as before). Routes contrastive distractor
 * synthesis through the central gateway for telemetry + cost tracking +
 * standardized safety handling.
 */

import { z } from 'zod';

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  aiEndpoint,
  withCors,
  AuthenticatedContext,
  ValidatedContext,
} from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import {
  buildContrastivePrompt,
  GeneratedContrastiveQuestion,
} from '../../../../lib/contrastiveDrillGenerator';
import {
  gateway,
  GatewayError,
  GatewayContext,
  toGatewayContext,
} from '../../../../lib/ai/aiGateway';

const ContrastiveGenerateSchema = z.object({
  body: z.object({
    setId: z.string().min(1, 'setId is required'),
    conditionIndex: z.number().int().min(0, 'conditionIndex must be non-negative'),
  }),
});

type ContrastiveGenerateInput = z.infer<typeof ContrastiveGenerateSchema>;

export const onRequestOptions = withCors();

/**
 * Call the AI gateway to generate a contrastive question.
 * Returns `null` when generation was blocked by the safety filter so the caller
 * can surface a 422; throws `GatewayError` for transport/provider failures so
 * the outer handler can map to appropriate HTTP status codes.
 */
async function generateWithGemini(
  ctx: GatewayContext,
  prompt: string
): Promise<GeneratedContrastiveQuestion | null> {
  const result = await gateway.callText(ctx, {
    mode: 'text',
    task: 'generation',
    tier: 'balanced', // gemini-2.5-flash — preserves prior endpoint model
    endpoint: '/api/drills/contrastive/generate',
    userPrompt: prompt,
  });

  if (result.blocked) {
    return null;
  }

  const text = result.text ?? '';
  // Clean up markdown code blocks if present — the gateway's text path does
  // not set responseMimeType=application/json so fences can slip through.
  const jsonStr = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(jsonStr) as GeneratedContrastiveQuestion;
  } catch (e) {
    console.error('Failed to parse LLM response', text);
    throw new Error('Invalid JSON from LLM');
  }
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): calls Gemini 2.5
// flash to synthesize contrastive-learning distractors. 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(
  ContrastiveGenerateSchema,
  async (context: AuthenticatedContext & ValidatedContext<ContrastiveGenerateInput>) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/drills/contrastive/generate');
    const { setId, conditionIndex } = validated.body;

    if (!env.GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY not configured', { userId: auth.userId });
      return {
        status: 500,
        error: 'AI service not configured',
      };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const set = await prisma.contrastiveSet.findUnique({ where: { id: setId } });
      if (!set) {
        logger.warn('Contrastive set not found', { setId, userId: auth.userId });
        return {
          status: 404,
          error: 'Set not found',
        };
      }

      if (conditionIndex < 0 || conditionIndex >= set.conditionIds.length) {
        logger.warn('Invalid condition index', { setId, conditionIndex, userId: auth.userId });
        return {
          status: 400,
          error: 'Invalid condition index',
        };
      }

      const targetConditionId = set.conditionIds[conditionIndex];

      // Resolve target condition name
      let targetConditionName = targetConditionId;
      const condition = await prisma.condition.findUnique({ where: { id: targetConditionId } });
      if (condition) {
        targetConditionName = condition.name;
      } else {
        const content = await prisma.medicalContent.findUnique({
          where: { id: targetConditionId },
        });
        if (content) {
          targetConditionName = content.condition;
        }
      }

      // Resolve other condition names
      const otherConditionNames: string[] = [];
      for (const id of set.conditionIds) {
        if (id === targetConditionId) continue;
        let name = id;
        const c = await prisma.condition.findUnique({ where: { id } });
        if (c) {
          name = c.name;
        } else {
          const mc = await prisma.medicalContent.findUnique({ where: { id } });
          if (mc) {
            name = mc.condition;
          }
        }
        otherConditionNames.push(name);
      }

      const nameForPrompt: string = targetConditionName ?? targetConditionId ?? 'Unknown';
      const prompt = buildContrastivePrompt(set, nameForPrompt, otherConditionNames);

      logger.info('Generating contrastive question', {
        userId: auth.userId,
        setId,
        targetCondition: nameForPrompt,
      });

      let generated: GeneratedContrastiveQuestion | null;
      try {
        generated = await generateWithGemini(toGatewayContext(context), prompt);
      } catch (err) {
        if (err instanceof GatewayError) {
          logger.error('Gateway error during contrastive generation', {
            code: err.code,
            retryable: err.retryable,
            requestId: err.requestId,
            traceId: err.traceId,
            userId: auth.userId,
            setId,
          });
          const status =
            err.code === 'RATE_LIMITED'
              ? 429
              : err.code === 'UNAUTHORIZED' || err.code === 'MISSING_API_KEY'
                ? 500
                : err.code === 'BAD_REQUEST'
                  ? 400
                  : 502;
          return {
            status,
            error: `Generation failed: ${err.code}`,
          };
        }
        throw err;
      }

      if (!generated) {
        logger.warn('Contrastive generation blocked by safety filter', {
          userId: auth.userId,
          setId,
        });
        return {
          status: 422,
          error: 'Generation blocked by safety filter',
        };
      }

      logger.info('Contrastive question generated successfully', {
        userId: auth.userId,
        setId,
      });

      return {
        data: {
          question: generated.vignette,
          vignette: generated.vignette,
          correctCondition: targetConditionName,
          distinguishingCues: generated.keyDistinguishers,
          whyNotOthers: generated.whyNotOthers,
        },
      };
    } catch (error) {
      logger.error('LLM Generation failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
        setId,
      });
      return {
        status: 500,
        error: 'Failed to generate question',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
