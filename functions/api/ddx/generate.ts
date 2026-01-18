/**
 * DDx Generation API
 * GET /api/ddx/generate?topic=Cardiology
 * 
 * Generates differential diagnosis problems using AI
 * CRITICAL: AI generation endpoint - protect against cost abuse
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { callGeminiText } from '../../../services/geminiService';
import { GEMINI_FLASH_MODEL } from '../../../src/constants';

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
  query: z.object({
    topic: z.string().min(1).max(100).optional().default('Cardiology'),
  }),
});

async function generateDdxProblem(prisma: any, topic: string): Promise<DdxProblem> {
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

  const distractors = await prisma.medicalContent.findMany({
    where: {
      system: topic,
      status: 'published',
      title: { not: correctCondition.title },
    },
    take: 3,
    select: { title: true },
  });

  const allConditionTitles = [correctCondition.title, ...distractors.map((d) => d.title)];

  const prompt = `
You are a medical education expert creating a differential diagnosis (DDx) problem.
The primary diagnosis is: "${correctCondition.title}".
The differential diagnoses to consider are: ${distractors.map((d) => `"${d.title}"`).join(', ')}.

Based on the following context for the primary diagnosis, generate a clinical vignette.
Context for ${correctCondition.title}: ${JSON.stringify(correctCondition.content)}

Instructions:
1. Create a classic but challenging clinical vignette for a patient presenting with "${correctCondition.title}". The vignette should be detailed enough to suggest the correct diagnosis but also contain features that could plausibly point to the distractors.
2. For EACH of the 4 conditions (${allConditionTitles.join(', ')}), write a concise rationale explaining why it is or is not the most likely diagnosis based on the vignette you created.

Return a single, valid JSON object with the following structure, and no other text:
{
  "vignette": "A 65-year-old male presents with...",
  "rationales": {
    "${correctCondition.title}": "This is the most likely diagnosis because...",
    "${distractors[0].title}": "While possible, this is less likely because...",
    "${distractors[1].title}": "This diagnosis is not supported by the findings of...",
    "${distractors[2].title}": "This can be ruled out due to..."
  }
}
  `.trim();

  const responseText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.7);
  const responseJson = JSON.parse(responseText.match(/\{[\s\S]*\}/)![0]);

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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(GenerateDdxSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/ddx/generate');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const topic = validated.query.topic;

    logger.info('Generating DDx problem', {
      userId: auth.userId,
      topic,
    });

    const ddxProblem = await generateDdxProblem(prisma, topic);

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
      topic: validated.query.topic,
    });
    throw new Error('Failed to generate DDx problem');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
