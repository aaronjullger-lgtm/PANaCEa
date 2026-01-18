#!/usr/bin/env tsx

import { GoogleGenerativeAI } from '@google/generative-ai';

const FLASH_MODELS = [process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash', 'gemini-2.0-flash'];

const PRO_MODELS = [process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro', 'gemini-1.5-pro'];

interface VerifyResult {
  ok: boolean;
  model: string;
  durationMs?: number;
  error?: string;
  sample?: string;
}

async function verifyModel(genAI: GoogleGenerativeAI, model: string): Promise<VerifyResult> {
  const started = Date.now();
  try {
    const generativeModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature: 0 },
    });

    const result = await generativeModel.generateContent(
      'Return a single JSON object {"status":"ok"} to confirm the model is reachable.'
    );

    const text = result.response.text().trim();
    return {
      ok: true,
      model,
      durationMs: Date.now() - started,
      sample: text.slice(0, 120),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, model, error: message };
  }
}

async function verifyWithFallback(
  genAI: GoogleGenerativeAI,
  label: string,
  candidates: string[]
): Promise<VerifyResult> {
  let lastFailure: VerifyResult | null = null;

  for (const candidate of candidates) {
    const result = await verifyModel(genAI, candidate);
    if (result.ok) {
      console.log(`✅ ${label} model available: ${candidate} (${result.durationMs}ms)`);
      return result;
    }
    console.warn(`⚠️  ${label} model failed: ${candidate} -> ${result.error}`);
    lastFailure = result;
  }

  return (
    lastFailure || {
      ok: false,
      model: candidates[0] || 'unknown',
      error: 'No candidates were provided',
    }
  );
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is required to verify models');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('\n🔍 Verifying Gemini model availability...\n');

  const flashResult = await verifyWithFallback(genAI, 'Flash', FLASH_MODELS);
  const proResult = await verifyWithFallback(genAI, 'Pro', PRO_MODELS);

  if (flashResult.ok && proResult.ok) {
    console.log('\n✅ Verification complete: primary models are reachable.');
    process.exit(0);
  }

  console.error('\n❌ Verification failed. At least one model is unavailable.');
  if (!flashResult.ok) {
    console.error(`Flash failure (${flashResult.model}): ${flashResult.error}`);
  }
  if (!proResult.ok) {
    console.error(`Pro failure (${proResult.model}): ${proResult.error}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error('Unexpected error during model verification', error);
  process.exit(1);
});
