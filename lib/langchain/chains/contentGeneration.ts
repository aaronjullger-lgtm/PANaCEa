/**
 * LangChain Content Generation Chain
 *
 * Replaces direct GoogleGenerativeAI SDK calls in autoAuthor/contentGenerator.ts
 * with LangChain-based routing for multi-provider fallback and tracing.
 *
 * Uses LCEL-inspired composition: ChatPromptTemplate → routeTask → Zod parse.
 * All 5 content types delegate to a single `generateContent` helper,
 * differentiated only by their prompt template and Zod schema.
 *
 * @module lib/langchain/chains/contentGeneration
 * Sprint: LangChain Integration — Sprint 2
 */

import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { routeTask } from '../router';
import { parseJsonResponse } from '../router';
import type { AIEnvKeys } from '../models';
import type { RouteOptions, RouteResult } from '../router';

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

// ─── Shared system prompt (constant across all content types) ────────────

const CONTENT_GEN_SYSTEM_PROMPT = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for diagnosis and treatment`;

// ─── Generic content generation helper (LCEL-inspired) ─────────────────────

/**
 * Generate structured medical content using a reusable pipeline.
 *
 * This is the LCEL-inspired core: ChatPromptTemplate → routeTask → Zod parse.
 * All 5 content-type functions delegate here with their specific
 * prompt template and schema.
 */
async function generateContent<T>(
  env: AIEnvKeys,
  taskType: string,
  promptTemplate: ChatPromptTemplate,
  schema: z.ZodType<T>,
  templateVars: Record<string, string>,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult<T>> {
  try {
    // Step 1: Format prompt via ChatPromptTemplate (type-safe, no injection)
    const { messages } = await promptTemplate.invoke(templateVars);
    const systemPrompt = messages[0]?.content as string ?? '';
    const userPrompt = messages[1]?.content as string ?? '';

    // Step 2: Route through multi-provider fallback
    const result: RouteResult<string> = await routeTask(taskType, env, {
      systemPrompt,
      userPrompt,
    }, routeOpts);

    // Step 3: Parse + validate with Zod
    const parsed = parseJsonSafe(result.output);
    if (!parsed) {
      return { success: false, error: 'Failed to parse generated content as JSON' };
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: `Content validation failed: ${validated.error.issues.map(i => i.path.join('.')).join(', ')}`,
      };
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

// ─── Prompt Templates ──────────────────────────────────────────────────────

const conditionPrompt = ChatPromptTemplate.fromMessages([
  ['system', CONTENT_GEN_SYSTEM_PROMPT],
  ['human', `Create a comprehensive, clinically accurate study guide entry for: "{conditionName}" (System: {system}{subcategoryClause}).

{jsonStructure}`],
]);

const labPrompt = ChatPromptTemplate.fromMessages([
  ['system', CONTENT_GEN_SYSTEM_PROMPT],
  ['human', `Create comprehensive clinical details for the lab test: "{name}".

Return this exact JSON structure:
{{
  "description": "2-3 sentences explaining what this test measures and its clinical significance",
  "typicalNormalRange": "Normal reference range with units (e.g., '3.5-5.0 mEq/L')",
  "commonAbnormalities": ["Elevated in condition A", "Decreased in condition B"],
  "indications": ["When to order this test 1", "Clinical scenario 2"]
}}`],
]);

const imagingPrompt = ChatPromptTemplate.fromMessages([
  ['system', CONTENT_GEN_SYSTEM_PROMPT],
  ['human', `Create comprehensive clinical details for the imaging study: "{name}".

Return ONLY a valid JSON object:
{{
  "description": "2-3 sentences explaining what this imaging modality visualizes",
  "bestFor": ["Clinical scenario 1 where this is first-line", "Condition 2"],
  "limitations": ["What this study cannot detect", "When to use alternative imaging"],
  "radiationRisk": true or false
}}`],
]);

const treatmentPrompt = ChatPromptTemplate.fromMessages([
  ['system', CONTENT_GEN_SYSTEM_PROMPT],
  ['human', `Create comprehensive clinical details for the treatment/drug: "{name}".

Return ONLY a valid JSON object:
{{
  "description": "2-3 sentences describing what this treatment is",
  "mechanismOfAction": "How this treatment works at the physiological level",
  "commonIndications": ["Primary indication 1", "Secondary use 2"],
  "seriousSideEffects": ["Black box warning 1", "Major side effect 2"]
}}`],
]);

const physiologyPrompt = ChatPromptTemplate.fromMessages([
  ['system', CONTENT_GEN_SYSTEM_PROMPT],
  ['human', `Explain the physiology concept: "{name}".

Return ONLY a valid JSON object:
{{
  "description": "2-3 sentences defining this physiological concept",
  "mechanism": "Detailed explanation of the underlying mechanism",
  "clinicalSignificance": "How this concept relates to disease states (2-3 sentences)"
}}`],
]);

// ─── JSON structure templates for condition content ────────────────────────

const EXTENDED_JSON_STRUCTURE = `Return this exact JSON structure:
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
}`;

const BASIC_JSON_STRUCTURE = `Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}`;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate condition content via LangChain multi-provider routing.
 * API-compatible with the original generateConditionContent().
 */
export async function generateConditionContentLC(
  env: AIEnvKeys,
  options: ContentGenerationOptions,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  const { conditionName, system, subcategory, includeExtendedFields } = options;

  return generateContent(
    env,
    'content-generation',
    conditionPrompt,
    ConditionContentSchema,
    {
      conditionName,
      system,
      subcategoryClause: subcategory ? `, Subcategory: ${subcategory}` : '',
      jsonStructure: includeExtendedFields ? EXTENDED_JSON_STRUCTURE : BASIC_JSON_STRUCTURE,
    },
    {
      temperature: options.temperature ?? 0.7,
      runName: `panacea:content-gen:${conditionName}`,
      metadata: { conditionName, system, subcategory, includeExtendedFields },
      ...routeOpts,
    }
  );
}

/**
 * Generate lab content via LangChain multi-provider routing.
 */
export async function generateLabContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  return generateContent(
    env,
    'content-generation',
    labPrompt,
    LabContentSchema,
    { name },
    {
      temperature: 0.7,
      runName: `panacea:content-gen:lab:${name}`,
      ...routeOpts,
    }
  );
}

/**
 * Generate imaging content via LangChain multi-provider routing.
 */
export async function generateImagingContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  return generateContent(
    env,
    'content-generation',
    imagingPrompt,
    ImagingContentSchema,
    { name },
    {
      temperature: 0.7,
      runName: `panacea:content-gen:imaging:${name}`,
      ...routeOpts,
    }
  );
}

/**
 * Generate treatment content via LangChain multi-provider routing.
 */
export async function generateTreatmentContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  return generateContent(
    env,
    'content-generation',
    treatmentPrompt,
    TreatmentContentSchema,
    { name },
    {
      temperature: 0.7,
      runName: `panacea:content-gen:treatment:${name}`,
      ...routeOpts,
    }
  );
}

/**
 * Generate physiology content via LangChain multi-provider routing.
 */
export async function generatePhysiologyContentLC(
  env: AIEnvKeys,
  name: string,
  routeOpts: RouteOptions = {}
): Promise<ContentGenerationResult> {
  return generateContent(
    env,
    'content-generation',
    physiologyPrompt,
    PhysiologyContentSchema,
    { name },
    {
      temperature: 0.7,
      runName: `panacea:content-gen:physiology:${name}`,
      ...routeOpts,
    }
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    return parseJsonResponse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
