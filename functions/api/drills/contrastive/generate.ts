
import { GoogleGenerativeAI } from '@google/generative-ai';

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { buildContrastivePrompt, GeneratedContrastiveQuestion } from '../../../../lib/contrastiveDrillGenerator';
import type { CloudflareContext } from '../../_shared/types';

interface Env {
    DATABASE_URL: string;
    GEMINI_API_KEY: string;
}

// Function to call Gemini
async function generateWithGemini(apiKey: string, prompt: string): Promise<GeneratedContrastiveQuestion> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(jsonStr) as GeneratedContrastiveQuestion;
    } catch (e) {
        console.error("Failed to parse LLM response", text);
        throw new Error("Invalid JSON from LLM");
    }
}

export async function onRequestPost(context: CloudflareContext<Env>) {
    const { request, env } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;
    const body = await request.json() as any;
    const { setId, conditionIndex } = body;

    if (!env.GEMINI_API_KEY) {
        return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    try {
        prisma = createEdgePrismaClient(env.DATABASE_URL);

        const set = await prisma.contrastiveSet.findUnique({ where: { id: setId } });
        if (!set) return Response.json({ error: 'Set not found' }, { status: 404 });

        if (conditionIndex < 0 || conditionIndex >= set.conditionIds.length) {
            return Response.json({ error: 'Invalid condition index' }, { status: 400 });
        }

        const targetConditionId = set.conditionIds[conditionIndex];

        let targetConditionName = targetConditionId;
        const condition = await prisma.condition.findUnique({ where: { id: targetConditionId } });
        if (condition) targetConditionName = condition.name;
        else {
            const content = await prisma.medicalContent.findUnique({ where: { id: targetConditionId } });
            if (content) targetConditionName = content.condition;
        }

        const otherConditionNames: string[] = [];
        for (const id of set.conditionIds) {
            if (id === targetConditionId) continue;
            let name = id;
            const c = await prisma.condition.findUnique({ where: { id } });
            if (c) name = c.name;
            else {
                const mc = await prisma.medicalContent.findUnique({ where: { id } });
                if (mc) name = mc.condition;
            }
            otherConditionNames.push(name);
        }

        const prompt = buildContrastivePrompt(set, targetConditionName, otherConditionNames);

        const generated = await generateWithGemini(env.GEMINI_API_KEY, prompt);

        return Response.json({
            question: generated.vignette,
            vignette: generated.vignette,
            correctCondition: targetConditionName,
            distinguishingCues: generated.keyDistinguishers,
            whyNotOthers: generated.whyNotOthers
        });
    } catch (error) {
        console.error("LLM Generation failed:", error);
        return Response.json({ error: 'Failed to generate question', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    } finally {
        await safePrismaDisconnect(prisma);
    }
}
