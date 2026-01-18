#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const MODEL_CANDIDATES = [process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro', 'gemini-2.5-flash'];

async function generateWithFallback(apiKey: string, prompt: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      });

      const result = await model.generateContent(prompt);
      return { text: result.response.text(), modelUsed: modelName };
    } catch (error) {
      lastError = error;
      console.warn(`Gemini model ${modelName} failed, trying fallback...`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Gemini models failed');
}

async function safeCount(query: string): Promise<number | null> {
  try {
    const result = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(query)) || [];
    const countValue = result[0]?.count;
    return countValue !== undefined ? Number(countValue) : 0;
  } catch (error) {
    console.warn(`Skipping check due to query failure: ${query}`);
    return null;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is required for auto-repair recommendations');
    process.exit(1);
  }

  const issues: string[] = [];

  const conditionCount = await safeCount('SELECT COUNT(*) AS count FROM "Condition"');
  if (conditionCount === null) {
    issues.push('Condition table not found or inaccessible');
  } else {
    const missingSystem = await safeCount(
      'SELECT COUNT(*) AS count FROM "Condition" WHERE system IS NULL OR system = \'\''
    );
    if (missingSystem && missingSystem > 0) {
      issues.push(`${missingSystem} condition rows missing system assignment`);
    }
  }

  if (!issues.length) {
    console.log('✅ No repair tasks detected. Database checks passed.');
    return;
  }

  console.log('\n🔧 Issues detected: ');
  issues.forEach((issue) => console.log(` - ${issue}`));

  const prompt = `You are an expert data repair assistant for a medical education platform. Given the following issues, propose safe, deterministic SQL update statements to fix them. Do not invent columns. Return plain text bullet points.
Issues:\n- ${issues.join('\n- ')}`;

  const { text, modelUsed } = await generateWithFallback(apiKey, prompt);
  console.log(`\n🤖 Gemini (${modelUsed}) suggestions:`);
  console.log(text.trim());
}

main()
  .catch((error) => {
    console.error('❌ Auto-repair failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
