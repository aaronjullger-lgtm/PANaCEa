/**
 * Auto-Author Content Generator
 *
 * Uses the AI Gateway (Sprint 7) to generate medical condition content for
 * PA/PANCE study. Designed to work in Node.js scripts (current) and
 * Cloudflare Workers (future) — the public API still takes an `apiKey`
 * string so the long list of generator scripts don't need to change.
 *
 * Sprint 7 migration notes (AI Gateway):
 *   - Direct `@google/generative-ai` SDK calls replaced with
 *     `gateway.callText()` using task='generation'.
 *   - The previous manual fallback (2.5-pro → 2.5-flash) is superseded by the
 *     gateway's same-provider fallback strategy (default for 'generation').
 *     Note: because 'powerful' sits at the top of the tier ladder, the
 *     gateway doesn't cross-fall to 'balanced' on its own. For content gen
 *     that's the right call — we'd rather surface a GatewayError than
 *     silently downgrade medical content quality to flash.
 *   - Manual retry loop (MAX_RETRIES=2 with exponential backoff) is removed —
 *     `gateway.callText()` handles retryable errors (RATE_LIMITED, 5xx,
 *     timeouts) internally with bounded backoff.
 *   - JSON.parse + required-field validation stays as a defensive layer.
 *     Full Zod schemas for the 5 content shapes would be a bigger refactor;
 *     the existing validator in services/cms/contentValidator.ts is already
 *     the source-of-truth quality gate downstream in the pipeline.
 *   - API keys from Node scripts are wrapped into a minimal GatewayContext
 *     so the gateway's telemetry, cost tracking, and error mapping apply
 *     uniformly to script runs and future edge invocations alike.
 */

import { gateway, GatewayError, type GatewayContext } from '@/lib/ai/aiGateway';
import type {
  GeneratedConditionContent,
  GeneratedLabContent,
  GeneratedImagingContent,
  GeneratedTreatmentContent,
  GeneratedPhysiologyContent,
  ContentGenerationOptions,
  ContentGenerationResult,
} from './types';

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Wrap a bare apiKey into the minimal GatewayContext shape the gateway
 * expects. For Node.js callers we don't have auth/waitUntil — the gateway
 * treats those as optional.
 */
function makeGatewayContext(apiKey: string): GatewayContext {
  return {
    env: { GEMINI_API_KEY: apiKey },
  };
}

/**
 * Call the gateway for a generation task and return clean text.
 * Throws on blocked/empty responses so the caller's try/catch can handle it.
 */
async function generateText(
  apiKey: string,
  endpoint: string,
  prompt: string,
  temperature: number,
  maxOutputTokens: number = DEFAULT_MAX_TOKENS,
): Promise<{ text: string; modelUsed: string }> {
  const result = await gateway.callText(makeGatewayContext(apiKey), {
    mode: 'text',
    task: 'generation',
    endpoint,
    userPrompt: prompt,
    temperature,
    maxOutputTokens,
  });

  if (result.blocked) {
    throw new Error(
      `Content generation blocked by safety filter: ${result.blockReason ?? 'unknown reason'}`,
    );
  }

  const text = (result.text ?? '').trim();
  if (!text) {
    throw new Error('Gateway returned empty content');
  }

  return { text, modelUsed: result.telemetry.modelUsed };
}

/**
 * Clean markdown code fences from AI response.
 */
function stripCodeFences(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/^```json\s*/gm, '')
    .replace(/^```\s*/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * Translate a thrown error into the shape ContentGenerationResult expects.
 * GatewayError carries structured codes we'd like to preserve for observability.
 */
function errorMessage(err: unknown): string {
  if (err instanceof GatewayError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unknown error during content generation';
}

/**
 * Build prompt for Gemini API
 */
function buildContentPrompt(options: ContentGenerationOptions): string {
  const { conditionName, system, subcategory, includeExtendedFields } = options;

  const basePrompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create a comprehensive, clinically accurate study guide entry for: "${conditionName}" (System: ${system}${subcategory ? `, Subcategory: ${subcategory}` : ''}).

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for diagnosis and treatment

${
  includeExtendedFields
    ? `
Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "etiologyPathophysiology": "Brief explanation of underlying mechanism and causes",
  "epidemiology": "Key demographics, prevalence, and population affected",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "examFindings": ["Key physical exam finding 1", "Finding 2", "Finding 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "complications": ["Complication 1", "Complication 2"],
  "prognosis": "Brief prognostic statement with key factors",
  "differentialDiagnosis": ["Similar condition 1", "Similar condition 2", "Similar condition 3"],
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}
`
    : `
Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}
`
}`;

  return basePrompt;
}

/**
 * Generate content for a medical condition using the AI Gateway.
 */
export async function generateConditionContent(
  apiKey: string,
  options: ContentGenerationOptions,
): Promise<ContentGenerationResult> {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  try {
    const prompt = buildContentPrompt(options);
    const { text, modelUsed } = await generateText(
      apiKey,
      '/auto-author/condition',
      prompt,
      options.temperature ?? DEFAULT_TEMPERATURE,
    );

    const cleanedText = stripCodeFences(text);
    const parsed = JSON.parse(cleanedText);

    if (!parsed.overview || !parsed.symptoms || !parsed.diagnosis || !parsed.treatment) {
      throw new Error('Missing required fields in generated content');
    }

    const content: GeneratedConditionContent = {
      overview: parsed.overview,
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [parsed.symptoms],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      diagnosis: parsed.diagnosis,
      treatment: parsed.treatment,
      clinicalPearls: Array.isArray(parsed.clinicalPearls) ? parsed.clinicalPearls : [],
      // Extended fields
      etiologyPathophysiology: parsed.etiologyPathophysiology,
      epidemiology: parsed.epidemiology,
      examFindings: Array.isArray(parsed.examFindings) ? parsed.examFindings : [],
      complications: Array.isArray(parsed.complications) ? parsed.complications : [],
      prognosis: parsed.prognosis,
      differentialDiagnosis: Array.isArray(parsed.differentialDiagnosis)
        ? parsed.differentialDiagnosis
        : [],
    };

    return { success: true, content, modelUsed };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

/**
 * Batch generate content with rate limiting. Gateway handles per-request
 * retries, so the delay here is just cooperative pacing to avoid burning
 * through quota on a long run.
 */
export async function batchGenerateContent(
  apiKey: string,
  conditions: ContentGenerationOptions[],
  delayMs: number = 2000,
): Promise<ContentGenerationResult[]> {
  const results: ContentGenerationResult[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition == null) continue;
    console.log(`   [${i + 1}/${conditions.length}] Generating: ${condition.conditionName}...`);

    const result = await generateConditionContent(apiKey, condition);
    results.push(result);

    if (i < conditions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// ============================================================
// LAB TEST CONTENT GENERATION
// ============================================================

export async function generateLabContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<ContentGenerationResult<GeneratedLabContent>> {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the lab test: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for interpretation

Return this exact JSON structure:
{
  "description": "2-3 sentences explaining what this test measures and its clinical significance",
  "typicalNormalRange": "Normal reference range with units (e.g., '3.5-5.0 mEq/L')",
  "commonAbnormalities": ["Elevated in condition A", "Decreased in condition B", "Abnormal pattern in C"],
  "indications": ["When to order this test 1", "Clinical scenario 2", "Diagnostic purpose 3"]
}`;

  try {
    const { text, modelUsed } = await generateText(
      apiKey,
      '/auto-author/lab',
      prompt,
      temperature,
    );

    const cleanedText = stripCodeFences(text);
    const parsed = JSON.parse(cleanedText);

    if (!parsed.description || !parsed.commonAbnormalities || !parsed.indications) {
      throw new Error('Missing required fields in generated content');
    }

    const content: GeneratedLabContent = {
      description: parsed.description,
      typicalNormalRange: parsed.typicalNormalRange || null,
      commonAbnormalities: Array.isArray(parsed.commonAbnormalities)
        ? parsed.commonAbnormalities
        : [],
      indications: Array.isArray(parsed.indications) ? parsed.indications : [],
    };

    return { success: true, content, modelUsed };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ============================================================
// IMAGING STUDY CONTENT GENERATION
// ============================================================

export async function generateImagingContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<ContentGenerationResult<GeneratedImagingContent>> {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the imaging study: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for clinical use

Return this exact JSON structure:
{
  "description": "2-3 sentences explaining what this imaging modality visualizes and its role in diagnosis",
  "bestFor": ["Clinical scenario 1 where this is first-line", "Condition 2 best diagnosed with this", "Indication 3"],
  "limitations": ["What this study cannot detect", "When to use alternative imaging", "Technical limitation"],
  "radiationRisk": true or false (boolean indicating if ionizing radiation is involved)
}`;

  try {
    const { text, modelUsed } = await generateText(
      apiKey,
      '/auto-author/imaging',
      prompt,
      temperature,
    );

    const cleanedText = stripCodeFences(text);
    const parsed = JSON.parse(cleanedText);

    if (!parsed.description || !parsed.bestFor || !parsed.limitations) {
      throw new Error('Missing required fields in generated content');
    }

    const content: GeneratedImagingContent = {
      description: parsed.description,
      bestFor: Array.isArray(parsed.bestFor) ? parsed.bestFor : [],
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
      radiationRisk: Boolean(parsed.radiationRisk),
    };

    return { success: true, content, modelUsed };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ============================================================
// TREATMENT CONTENT GENERATION
// ============================================================

export async function generateTreatmentContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<ContentGenerationResult<GeneratedTreatmentContent>> {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the treatment/drug: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for clinical practice

Return this exact JSON structure:
{
  "description": "2-3 sentences describing what this treatment is and its general use",
  "mechanismOfAction": "Clear explanation of how this treatment works at the physiological level",
  "commonIndications": ["Primary indication 1", "Secondary use 2", "Off-label use 3"],
  "seriousSideEffects": ["Black box warning or serious adverse effect 1", "Major side effect 2", "Important monitoring parameter 3"]
}`;

  try {
    const { text, modelUsed } = await generateText(
      apiKey,
      '/auto-author/treatment',
      prompt,
      temperature,
    );

    const cleanedText = stripCodeFences(text);
    const parsed = JSON.parse(cleanedText);

    if (
      !parsed.description ||
      !parsed.mechanismOfAction ||
      !parsed.commonIndications ||
      !parsed.seriousSideEffects
    ) {
      throw new Error('Missing required fields in generated content');
    }

    const content: GeneratedTreatmentContent = {
      description: parsed.description,
      mechanismOfAction: parsed.mechanismOfAction,
      commonIndications: Array.isArray(parsed.commonIndications)
        ? parsed.commonIndications
        : [],
      seriousSideEffects: Array.isArray(parsed.seriousSideEffects)
        ? parsed.seriousSideEffects
        : [],
    };

    return { success: true, content, modelUsed };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

// ============================================================
// PHYSIOLOGY CONTENT GENERATION
// ============================================================

export async function generatePhysiologyContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<ContentGenerationResult<GeneratedPhysiologyContent>> {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Explain the physiology concept: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Connect physiology to clinical medicine

Return this exact JSON structure:
{
  "description": "2-3 sentences defining this physiological concept and its normal function",
  "mechanism": "Detailed explanation of the underlying mechanism, pathway, or process",
  "clinicalSignificance": "How this concept relates to disease states, diagnosis, or treatment (2-3 sentences)"
}`;

  try {
    const { text, modelUsed } = await generateText(
      apiKey,
      '/auto-author/physiology',
      prompt,
      temperature,
    );

    const cleanedText = stripCodeFences(text);
    const parsed = JSON.parse(cleanedText);

    if (!parsed.description || !parsed.mechanism || !parsed.clinicalSignificance) {
      throw new Error('Missing required fields in generated content');
    }

    const content: GeneratedPhysiologyContent = {
      description: parsed.description,
      mechanism: parsed.mechanism,
      clinicalSignificance: parsed.clinicalSignificance,
    };

    return { success: true, content, modelUsed };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}
