/**
 * LangChain-Powered Auto-Author Content Generator
 *
 * Drop-in replacement for contentGenerator.ts that routes through
 * LangChain's multi-provider fallback system instead of calling
 * the Google Generative AI SDK directly.
 *
 * Usage:
 *   Import from this module instead of contentGenerator when you want
 *   multi-provider fallback (e.g., Gemini → OpenAI → Anthropic).
 *
 * @module lib/services/autoAuthor/langchainContentGenerator
 * Sprint: LangChain Integration — Sprint 4
 */

import {
  generateConditionContentLC,
  generateLabContentLC,
  generateImagingContentLC,
  generateTreatmentContentLC,
  generatePhysiologyContentLC,
} from '../../langchain/chains/contentGeneration';
import { fromProcessEnv } from '../../langchain/envAdapter';
import { configureLangSmithEnv } from '../../langchain/tracing';
import type { AIEnvKeys } from '../../langchain/models';
import type {
  ContentGenerationOptions,
  ContentGenerationResult,
  GeneratedConditionContent,
  GeneratedLabContent,
  GeneratedImagingContent,
  GeneratedTreatmentContent,
  GeneratedPhysiologyContent,
} from './types';

// ─── Environment Setup ────────────────────────────────────────────────────

let _envInitialized = false;

function getAIEnv(): AIEnvKeys {
  const env = fromProcessEnv();
  if (!_envInitialized) {
    configureLangSmithEnv(env);
    _envInitialized = true;
  }
  return env;
}

// ─── Condition Content ────────────────────────────────────────────────────

/**
 * Generate condition content via LangChain multi-provider routing.
 * API-compatible with the original generateConditionContent().
 */
export async function generateConditionContentMulti(
  _apiKey: string, // kept for API compat; env adapter reads all keys
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  const env = getAIEnv();
  const result = await generateConditionContentLC(env, {
    conditionName: options.conditionName,
    system: options.system,
    subcategory: options.subcategory,
    includeExtendedFields: options.includeExtendedFields,
    temperature: options.temperature,
  });

  return {
    success: result.success,
    content: result.content as GeneratedConditionContent | undefined,
    error: result.error,
    modelUsed: result.modelUsed,
  };
}

// ─── Lab Content ──────────────────────────────────────────────────────────

export async function generateLabContentMulti(
  _apiKey: string,
  name: string,
  _temperature?: number
): Promise<ContentGenerationResult<GeneratedLabContent>> {
  const env = getAIEnv();
  const result = await generateLabContentLC(env, name);
  return {
    success: result.success,
    content: result.content as GeneratedLabContent | undefined,
    error: result.error,
    modelUsed: result.modelUsed,
  };
}

// ─── Imaging Content ──────────────────────────────────────────────────────

export async function generateImagingContentMulti(
  _apiKey: string,
  name: string,
  _temperature?: number
): Promise<ContentGenerationResult<GeneratedImagingContent>> {
  const env = getAIEnv();
  const result = await generateImagingContentLC(env, name);
  return {
    success: result.success,
    content: result.content as GeneratedImagingContent | undefined,
    error: result.error,
    modelUsed: result.modelUsed,
  };
}

// ─── Treatment Content ────────────────────────────────────────────────────

export async function generateTreatmentContentMulti(
  _apiKey: string,
  name: string,
  _temperature?: number
): Promise<ContentGenerationResult<GeneratedTreatmentContent>> {
  const env = getAIEnv();
  const result = await generateTreatmentContentLC(env, name);
  return {
    success: result.success,
    content: result.content as GeneratedTreatmentContent | undefined,
    error: result.error,
    modelUsed: result.modelUsed,
  };
}

// ─── Physiology Content ───────────────────────────────────────────────────

export async function generatePhysiologyContentMulti(
  _apiKey: string,
  name: string,
  _temperature?: number
): Promise<ContentGenerationResult<GeneratedPhysiologyContent>> {
  const env = getAIEnv();
  const result = await generatePhysiologyContentLC(env, name);
  return {
    success: result.success,
    content: result.content as GeneratedPhysiologyContent | undefined,
    error: result.error,
    modelUsed: result.modelUsed,
  };
}

// ─── Batch Generate ───────────────────────────────────────────────────────

export async function batchGenerateContentMulti(
  apiKey: string,
  conditions: ContentGenerationOptions[],
  delayMs: number = 2000
): Promise<ContentGenerationResult[]> {
  const results: ContentGenerationResult[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition == null) continue;
    console.log(`   [${i + 1}/${conditions.length}] Generating: ${condition.conditionName}...`);

    const result = await generateConditionContentMulti(apiKey, condition);
    results.push(result);

    if (i < conditions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
