import type { Context } from 'hono';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { callGeminiText } from '../../../services/geminiService'; // Assuming shared Gemini utility
import { GEMINI_FLASH_MODEL } from '../../../src/constants';

export interface DdxProblem {
  vignette: string;
  diagnoses: {
    name: string;
    isCorrect: boolean;
  }[];
  rationales: {
    [diagnosisName:string]: string;
  };
  correctDiagnosis: string;
}

async function generateDdxProblem(prisma: any, topic: string = 'Cardiology'): Promise<DdxProblem> {
    const conditionCount = await prisma.medicalContent.count({ where: { system: topic, status: 'published' }});
    if (conditionCount < 4) {
        throw new Error(`Not enough content for topic "${topic}" to generate a DDx problem.`);
    }
    
    const skip = Math.floor(Math.random() * conditionCount);
    const correctCondition = await prisma.medicalContent.findFirst({
        where: { system: topic, status: 'published' },
        skip: skip,
        select: { title: true, content: true }
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
        select: { title: true }
    });

    const allConditionTitles = [correctCondition.title, ...distractors.map(d => d.title)];

    const prompt = `
        You are a medical education expert creating a differential diagnosis (DDx) problem.
        The primary diagnosis is: "${correctCondition.title}".
        The differential diagnoses to consider are: ${distractors.map(d => `"${d.title}"`).join(', ')}.

        Based on the following context for the primary diagnosis, generate a clinical vignette.
        Context for ${correctCondition.title}: ${JSON.stringify(correctCondition.content)}

        Instructions:
        1.  Create a classic but challenging clinical vignette for a patient presenting with "${correctCondition.title}". The vignette should be detailed enough to suggest the correct diagnosis but also contain features that could plausibly point to the distractors.
        2.  For EACH of the 4 conditions (${allConditionTitles.join(', ')}), write a concise rationale explaining why it is or is not the most likely diagnosis based on the vignette you created.
        
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
    `;

    const responseText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.7);
    const responseJson = JSON.parse(responseText.match(/\{[\s\S]*\}/)![0]);

    const diagnoses = allConditionTitles.map(name => ({
        name,
        isCorrect: name === correctCondition.title,
    })).sort(() => Math.random() - 0.5); // Shuffle options

    return {
        vignette: responseJson.vignette,
        diagnoses,
        rationales: responseJson.rationales,
        correctDiagnosis: correctCondition.title,
    };
}


export const onRequestGet = async (context: Context) => {
  const { env } = context;
  const auth = await authenticateRequest(context.req, env);
  if (!auth.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const topic = context.req.query('topic') || 'Cardiology';

  try {
    const ddxProblem = await generateDdxProblem(prisma, topic);
    return new Response(JSON.stringify(ddxProblem), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating DDx problem:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: 'Failed to generate DDx problem', details: errorMessage }), { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};
