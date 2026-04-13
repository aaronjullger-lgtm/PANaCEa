/**
 * LangChain Content Generation Chain
 *
 * Replaces direct GoogleGenerativeAI SDK calls in autoAuthor/contentGenerator.ts
 * with LangChain-based routing for multi-provider fallback and tracing.
 *
 * Each content type (condition, lab, imaging, treatment, physiology) gets
 * its own function that delegates to the LangChain router. The prompts
 * and validation logic are preserved from the original implementation.
 *
 * @module lib/langchain/chains/contentGeneration
 * Sprint: LangChain Integration — Sprint 2
 */

import { routeTask } from '../router';
import type { AIEnvKeys } from '../models';
import type { RouteOptions } from '../router';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ContentGenerationResult<T = unknown> {
  success: boolean;
  content?: T;
  error?: string;
  modelUsed?: string;
  provider?: string;
  latencyMs?: number;
}

export interface ContentGenerationOptions {
  conditionName: string;
  system: string;
  subcategory?: string;
  includeExtendedFields?: boolean;
  temperature?: number;
}

// ─── Condition Content ────────────────────────────────────────────────────

export async function generateConditionContentLC(
  env: AIEnvKeys,
  options: ContentGenerationOptions,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const { conditionName, system, subcategory, includeExtendedFields } = options;

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create a comprehensive, clinically accurate study guide entry for: "${conditionName}" (System: ${system}${subcategory ? `, Subcategory: ${subcategory}` : ''}).

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for diagnosis and treatment

${
  includeExtendedFields
    ? `Return this exact JSON structure:
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
}`
    : `Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}`
}`;

  try {
    const result = await routeTask('content-generation', env, {
      userPrompt: prompt,
    }, {
      temperature: options.temperature ?? 0.7,
      runName: `panacea:content-gen:${conditionName}`,
      metadata: { conditionName, system, subcategory, includeExtendedFields },
      ...routeOpts,
    });

    const parsed = parseJsonSafe(result.output);
    if (!parsed || !parsed.overview || !parsed.symptoms || !parsed.diagnosis || !parsed.treatment) {
      return { success: false, error: 'Missing required fields in generated content' };
    }

    // Normalize arrays
    const content = {
      overview: parsed.overview,
      symptoms: ensureArray(parsed.symptoms),
      riskFactors: ensureArray(parsed.riskFactors),
      diagnosis: parsed.diagnosis,
      treatment: parsed.treatment,
      clinicalPearls: ensureArray(parsed.clinicalPearls),
      etiologyPathophysiology: parsed.etiologyPathophysiology,
      epidemiology: parsed.epidemiology,
      examFindings: ensureArray(parsed.examFindings),
      complications: ensureArray(parsed.complications),
      prognosis: parsed.prognosis,
      differentialDiagnosis: ensureArray(parsed.differentialDiagnosis),
    };

    return {
      success: true,
      content,
      modelUsed: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Content generation failed',
    };
  }
}

// ─── Lab Content ──────────────────────────────────────────────────────────

export async function generateLabContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the lab test: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information

Return this exact JSON structure:
{
  "description": "2-3 sentences explaining what this test measures and its clinical significance",
  "typicalNormalRange": "Normal reference range with units (e.g., '3.5-5.0 mEq/L')",
  "commonAbnormalities": ["Elevated in condition A", "Decreased in condition B"],
  "indications": ["When to order this test 1", "Clinical scenario 2"]
}`;

  try {
    const result = await routeTask('content-generation', env, {
      userPrompt: prompt,
    }, {
      temperature: 0.7,
      runName: `panacea:content-gen:lab:${name}`,
      ...routeOpts,
    });

    const parsed = parseJsonSafe(result.output);
    if (!parsed || !parsed.description || !parsed.commonAbnormalities || !parsed.indications) {
      return { success: false, error: 'Missing required fields' };
    }

    return {
      success: true,
      content: {
        description: parsed.description,
        typicalNormalRange: parsed.typicalNormalRange || null,
        commonAbnormalities: ensureArray(parsed.commonAbnormalities),
        indications: ensureArray(parsed.indications),
      },
      modelUsed: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lab content generation failed',
    };
  }
}

// ─── Imaging Content ──────────────────────────────────────────────────────

export async function generateImagingContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the imaging study: "${name}".

Return ONLY a valid JSON object:
{
  "description": "2-3 sentences explaining what this imaging modality visualizes",
  "bestFor": ["Clinical scenario 1 where this is first-line", "Condition 2"],
  "limitations": ["What this study cannot detect", "When to use alternative imaging"],
  "radiationRisk": true or false
}`;

  try {
    const result = await routeTask('content-generation', env, {
      userPrompt: prompt,
    }, {
      temperature: 0.7,
      runName: `panacea:content-gen:imaging:${name}`,
      ...routeOpts,
    });

    const parsed = parseJsonSafe(result.output);
    if (!parsed || !parsed.description || !parsed.bestFor || !parsed.limitations) {
      return { success: false, error: 'Missing required fields' };
    }

    return {
      success: true,
      content: {
        description: parsed.description,
        bestFor: ensureArray(parsed.bestFor),
        limitations: ensureArray(parsed.limitations),
        radiationRisk: Boolean(parsed.radiationRisk),
      },
      modelUsed: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Imaging content generation failed',
    };
  }
}

// ─── Treatment Content ────────────────────────────────────────────────────

export async function generateTreatmentContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the treatment/drug: "${name}".

Return ONLY a valid JSON object:
{
  "description": "2-3 sentences describing what this treatment is",
  "mechanismOfAction": "How this treatment works at the physiological level",
  "commonIndications": ["Primary indication 1", "Secondary use 2"],
  "seriousSideEffects": ["Black box warning 1", "Major side effect 2"]
}`;

  try {
    const result = await routeTask('content-generation', env, {
      userPrompt: prompt,
    }, {
      temperature: 0.7,
      runName: `panacea:content-gen:treatment:${name}`,
      ...routeOpts,
    });

    const parsed = parseJsonSafe(result.output);
    if (!parsed || !parsed.description || !parsed.mechanismOfAction) {
      return { success: false, error: 'Missing required fields' };
    }

    return {
      success: true,
      content: {
        description: parsed.description,
        mechanismOfAction: parsed.mechanismOfAction,
        commonIndications: ensureArray(parsed.commonIndications),
        seriousSideEffects: ensureArray(parsed.seriousSideEffects),
      },
      modelUsed: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Treatment content generation failed',
    };
  }
}

// ─── Physiology Content ───────────────────────────────────────────────────

export async function generatePhysiologyContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Explain the physiology concept: "${name}".

Return ONLY a valid JSON object:
{
  "description": "2-3 sentences defining this physiological concept",
  "mechanism": "Detailed explanation of the underlying mechanism",
  "clinicalSignificance": "How this concept relates to disease states (2-3 sentences)"
}`;

  try {
    const result = await routeTask('content-generation', env, {
      userPrompt: prompt,
    }, {
      temperature: 0.7,
      runName: `panacea:content-gen:physiology:${name}`,
      ...routeOpts,
    });

    const parsed = parseJsonSafe(result.output);
    if (!parsed || !parsed.description || !parsed.mechanism || !parsed.clinicalSignificance) {
      return { success: false, error: 'Missing required fields' };
    }

    return {
      success: true,
      content: {
        description: parsed.description,
        mechanism: parsed.mechanism,
        clinicalSignificance: parsed.clinicalSignificance,
      },
      modelUsed: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Physiology content generation failed',
    };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1]!.trim();

    cleaned = cleaned
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}
