/**
 * API Endpoint: /api/drills/contrastive/generate
 * Generates a contrastive learning question using Gemini AI
 */

import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { authenticatedEndpoint, withCors, AuthenticatedContext, ValidatedContext } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import {
  buildContrastivePrompt,
  GeneratedContrastiveQuestion,
} from '../../../../lib/contrastiveDrillGenerator';

const ContrastiveGenerateSchema = z.object({
  body: z.object({
    setId: z.string().min(1, 'setId is required'),
    conditionIndex: z.number().int().min(0, 'conditionIndex must be non-negative'),
  }),
});

type ContrastiveGenerateInput = z.infer<typeof ContrastiveGenerateSchema>;

export const onRequestOptions = withCors();

/**
 * Call Gemini to generate a contrastive question
 */
async function generateWithGemini(
  apiKey: string,
  prompt: string
): Promise<GeneratedContrastiveQuestion> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Clean up markdown code blocks if present
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

export const onRequestPost = authenticatedEndpoint(
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
        const content = await prisma.medicalContent.findUnique({ where: { id: targetConditionId } });
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

      const prompt = buildContrastivePrompt(set, targetConditionName, otherConditionNames);

      logger.info('Generating contrastive question', {
        userId: auth.userId,
        setId,
        targetCondition: targetConditionName,
      });

      const generated = await generateWithGemini(env.GEMINI_API_KEY, prompt);

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