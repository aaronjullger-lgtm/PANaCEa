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

import { z } from 'zod';
import { routeTask } from '../router';
import { parseJsonResponse } from '../router';
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

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const ConditionContentSchema = z.object({
  overview: z.string(),
  symptoms: z.array(z.string()),
  riskFactors: z.array(z.string()).optional(),
  diagnosis: z.string(),
  treatment: z.string(),
  clinicalPearls: z.array(z.string()),
  etiologyPathophysiology: z.string().optional(),
  epidemiology: z.string().optional(),
  examFindings: z.array(z.string()).optional(),
  complications: z.array(z.string()).optional(),
  prognosis: z.string().optional(),
  differentialDiagnosis: z.array(z.string()).optional(),
});

const LabContentSchema = z.object({
  description: z.string(),
  typicalNormalRange: z.string().nullable(),
  commonAbnormalities: z.array(z.string()),
  indications: z.array(z.string()),
});

const ImagingContentSchema = z.object({
  description: z.string(),
  bestFor: z.array(z.string()),
  limitations: z.array(z.string()),
  radiationRisk: z.boolean(),
});

const TreatmentContentSchema = z.object({
  description: z.string(),
  mechanismOfAction: z.string(),
  commonIndications: z.array(z.string()),
  seriousSideEffects: z.array(z.string()),
});

const PhysiologyContentSchema = z.object({
  description: z.string(),
  mechanism: z.string(),
  clinicalSignificance: z.string(),
});

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
    if (!parsed) {
      return { success: false, error: 'Failed to parse generated content as JSON' };
    }

    // Validate with Zod schema
    const validated = ConditionContentSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Content validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}` };
    }

    return {
      success: true,
      content: validated.data,
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
    if (!parsed) {
      return { success: false, error: 'Failed to parse lab content as JSON' };
    }

    const validated = LabContentSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Lab validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}` };
    }

    return {
      success: true,
      content: validated.data,
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
    if (!parsed) {
      return { success: false, error: 'Failed to parse imaging content as JSON' };
    }

    const validated = ImagingContentSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Imaging validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}` };
    }

    return {
      success: true,
      content: validated.data,
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
    if (!parsed) {
      return { success: false, error: 'Failed to parse treatment content as JSON' };
    }

    const validated = TreatmentContentSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Treatment validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}` };
    }

    return {
      success: true,
      content: validated.data,
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
    if (!parsed) {
      return { success: false, error: 'Failed to parse physiology content as JSON' };
    }

    const validated = PhysiologyContentSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Physiology validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}` };
    }

    return {
      success: true,
      content: validated.data,
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

/**
 * Shared JSON parser: strips code fences, normalizes smart quotes,
 * removes trailing commas, then attempts JSON.parse.
 *
 * Centralized here to avoid duplication across chain files.
 */
function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    return parseJsonResponse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
