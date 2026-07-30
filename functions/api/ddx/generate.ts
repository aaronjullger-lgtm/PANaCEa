/**
 * DDx Generation API
 * GET /api/ddx/generate?topic=Cardiology
 *
 * Generates differential diagnosis problems using AI
 * CRITICAL: AI generation endpoint - protect against cost abuse
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { aiGenerateObject } from '@/lib/ai-sdk/helpers';
import type { AIProviderEnv } from '@/lib/ai-sdk/providers';

export interface DdxProblem {
  vignette: string;
  diagnoses: {
    name: string;
    isCorrect: boolean;
  }[];
  rationales: {
    [diagnosisName: string]: string;
  };
  correctDiagnosis: string;
}

const GenerateDdxSchema = z.object({
  topic: z.string().min(1).max(100).optional().default('Cardiology'),
});

const DdxOutputSchema = z.object({
  vignette: z.string().describe('Clinical vignette describing the patient presentation'),
  rationales: z.record(z.string(), z.string()).describe('Map of diagnosis name to rationale'),
});

async function generateDdxProblem(prisma: any, topic: string, env: AIProviderEnv): Promise<DdxProblem> {
  const conditionCount = await prisma.medicalContent.count({
    where: { system: topic, status: 'published' },
  });

  if (conditionCount < 4) {
    throw new Error(`Not enough content for topic "${topic}" to generate a DDx problem.`);
  }

  const skip = Math.floor(Math.random() * conditionCount);
  const correctCondition = await prisma.medicalContent.findFirst({
    where: { system: topic, status: 'published' },
    skip: skip,
    select: { title: true, content: true },
  });

  if (!correctCondition) {
    throw new Error(`No conditions found for topic: ${topic}`);
  }

  type DistractorResult = { title: string };

  const distractors: DistractorResult[] = await prisma.medicalContent.findMany({
    where: {
      system: topic,
      status: 'published',
      title: { not: correctCondition.title },
    },
    take: 3,
    select: { title: true },
  });

  const allConditionTitles = [
    correctCondition.title,
    ...distractors.map((d: DistractorResult) => d.title),
  ];

  const distractor0 = distractors[0];
  const distractor1 = distractors[1];
  const distractor2 = distractors[2];

  if (!distractor0 || !distractor1 || !distractor2) {
    throw new Error(`Not enough distractors found for topic.`);
  }

  const prompt = `
Create a differential diagnosis (DDx) problem.
Primary diagnosis: "${correctCondition.title}".
Differential diagnoses: ${distractors.map((d) => `"${d.title}"`).join(', ')}.

Context for ${correctCondition.title}: ${JSON.stringify(correctCondition.content)}

1. Write a classic but challenging clinical vignette for "${correctCondition.title}" that suggests the correct diagnosis but also contains features plausibly pointing to the distractors.
2. For EACH of the 4 conditions (${allConditionTitles.join(', ')}), write a concise rationale explaining why it is or is not the most likely diagnosis based on the vignette.
  `.trim();

  const { object: responseJson } = await aiGenerateObject(env, {
    model: 'gemini-2.0-flash',
    system: 'You are a medical education expert creating differential diagnosis problems.',
    prompt,
    schema: DdxOutputSchema,
    schemaName: 'ddx_problem',
    schemaDescription: 'A clinical vignette with differential diagnosis rationales',
    temperature: 0.7,
    endpoint: '/api/ddx/generate',
  });

  const diagnoses = allConditionTitles
    .map((name) => ({
      name,
      isCorrect: name === correctCondition.title,
    }))
    .sort(() => Math.random() - 0.5); // Shuffle options

  return {
    vignette: responseJson.vignette,
    diagnoses,
    rationales: responseJson.rationales,
    correctDiagnosis: correctCondition.title,
  };
}

export const onRequestGet = aiEndpoint(
  GenerateDdxSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/ddx/generate');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const topic = validated.topic;

      logger.info('Generating DDx problem', {
        userId: auth.userId,
        topic,
      });

      const ddxProblem = await generateDdxProblem(prisma, topic, env);

      logger.info('DDx problem generated successfully', {
        userId: auth.userId,
        topic,
        correctDiagnosis: ddxProblem.correctDiagnosis,
        diagnosesCount: ddxProblem.diagnoses.length,
      });

      return {
        data: ddxProblem,
      };
    } catch (error) {
      logger.error('Error generating DDx problem', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
        topic: validated.topic,
      });
      throw new Error('Failed to generate DDx problem');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 10 }
);
