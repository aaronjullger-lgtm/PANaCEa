/**
 * LLM-Based Supervisor Router
 *
 * Replaces keyword string-matching in supervisor routing with semantic
 * intent classification via a lightweight LLM call. Falls back to
 * keyword matching when the LLM is unavailable or times out.
 *
 * Design decisions:
 * - Uses the cheapest available model (gemini-2.0-flash or deepseek-v4-flash)
 * - Caches classifications for identical inputs (TTL: 5 min)
 * - Timeout at 3s — if the LLM doesn't respond, fall back to keywords
 * - Structured output via Zod schema ensures valid agent names
 *
 * @module lib/agents/supervisor-llm
 */

import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AIEnvKeys } from '@/lib/langchain/models';
import { createModel, isModelAvailable } from '@/lib/langchain/models';
import type { ModelName } from '@/lib/langchain/config';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IntentClassification {
  /** Selected agent name (must exist in the provided agent list) */
  agent: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Human-readable reasoning (for debugging/tracing) */
  reasoning: string;
  /** Whether this was classified by LLM or fell back to keywords */
  source: 'llm' | 'keyword-fallback' | 'cache';
}

export interface LLMRouterConfig {
  /** Agent names available for routing */
  agentNames: string[];
  /** Descriptions of each agent (used in the LLM prompt) */
  agentDescriptions: Record<string, string>;
  /** Domain context for the supervisor (e.g., 'clinical', 'ops', 'content') */
  domain: string;
  /** Minimum confidence threshold to accept LLM classification */
  minConfidence?: number;
  /** Cache TTL in ms (default: 5 min) */
  cacheTtlMs?: number;
}

// ─── Classification Cache ──────────────────────────────────────────────────

interface CacheEntry {
  result: IntentClassification;
  timestamp: number;
}

const classificationCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(input: unknown, agentNames: string[]): string {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  return `${inputStr.slice(0, 200)}::${agentNames.sort().join(',')}`;
}

function getCachedClassification(key: string, ttlMs: number): IntentClassification | null {
  const entry = classificationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    classificationCache.delete(key);
    return null;
  }
  return { ...entry.result, source: 'cache' };
}

function setCachedClassification(key: string, result: IntentClassification): void {
  classificationCache.set(key, { result, timestamp: Date.now() });

  // Prune cache if it grows too large (> 500 entries)
  if (classificationCache.size > 500) {
    const oldestKeys = Array.from(classificationCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, 100)
      .map(([k]) => k);
    for (const k of oldestKeys) classificationCache.delete(k);
  }
}

// ─── LLM Intent Classification ─────────────────────────────────────────────

const IntentSchema = z.object({
  agent: z.string().describe('The name of the agent to route to'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Brief reasoning for the classification'),
});

const CLASSIFIER_SYSTEM_PROMPT = `You are an intent classifier for a multi-agent clinical education system.
Your job is to route user requests to the most appropriate specialized agent.

Rules:
1. Choose EXACTLY ONE agent from the provided list
2. Provide a confidence score (0.0-1.0) reflecting how certain you are
3. If no agent clearly matches, pick the best available and set confidence < 0.5
4. Be decisive — do not return multiple agents or "none"
5. Return ONLY valid JSON matching the schema`;

/**
 * Build the user prompt for the classifier with agent descriptions.
 */
function buildClassifierPrompt(input: unknown, config: LLMRouterConfig): string {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

  const agentList = config.agentNames
    .map((name) => {
      const desc = config.agentDescriptions[name] ?? 'No description available';
      return `- **${name}**: ${desc}`;
    })
    .join('\n');

  return `Domain: ${config.domain}

Available agents:
${agentList}

User request:
"""
${inputStr.slice(0, 2000)}
"""

Classify this request to the most appropriate agent. Return JSON with: agent, confidence, reasoning.`;
}

/**
 * Classify intent using an LLM. Returns null if LLM is unavailable or fails.
 */
async function classifyWithLLM(
  input: unknown,
  config: LLMRouterConfig,
  env: AIEnvKeys,
): Promise<IntentClassification | null> {
  // Pick the cheapest available model for classification
  const classifierModel = pickClassifierModel(env);
  if (!classifierModel) return null;

  try {
    const model = createModel(classifierModel, env, {
      temperature: 0.1, // Low temperature for deterministic classification
      maxOutputTokens: 256, // Classification responses are tiny
    });

    const structuredModel = model.withStructuredOutput(IntentSchema);

    const result = await Promise.race([
      structuredModel.invoke([
        new SystemMessage(CLASSIFIER_SYSTEM_PROMPT),
        new HumanMessage(buildClassifierPrompt(input, config)),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM classification timed out')), 3000)
      ),
    ]);

    // Validate the returned agent exists in our list
    if (!config.agentNames.includes(result.agent)) {
      console.warn(
        `[Supervisor LLM] Classifier returned unknown agent "${result.agent}". ` +
        `Valid agents: ${config.agentNames.join(', ')}. Falling back to keywords.`
      );
      return null;
    }

    return {
      agent: result.agent,
      confidence: result.confidence,
      reasoning: result.reasoning,
      source: 'llm',
    };
  } catch (err) {
    console.warn(
      `[Supervisor LLM] Classification failed:`,
      err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    );
    return null;
  }
}

/**
 * Pick the cheapest available model for intent classification.
 * Classification is a tiny task — use the cheapest model that's available.
 */
function pickClassifierModel(env: AIEnvKeys): ModelName | null {
  // Preference order: cheapest first
  const preference: ModelName[] = [
    'deepseek-v4-flash',  // $0.07/$0.14 per 1M — ultra cheap
    'gemini-2.0-flash',   // $0.10/$0.40 per 1M
    'gpt-4o-mini',        // $0.15/$0.60 per 1M
    'openrouter-free',    // $0/$0 — free tier
  ];

  for (const model of preference) {
    if (isModelAvailable(model, env)) return model;
  }

  return null;
}

// ─── Keyword Fallback Router ────────────────────────────────────────────────

/**
 * Keyword-based routing — the existing behavior, extracted for reuse.
 * Returns null if no keyword match is found.
 */
function classifyWithKeywords(
  input: unknown,
  config: LLMRouterConfig,
): IntentClassification | null {
  const inputStr = JSON.stringify(input).toLowerCase();

  // Build keyword → agent mapping from agent descriptions
  const keywordMap: Record<string, string[]> = {
    'ddx-generator': ['diagnosis', 'ddx', 'differential', 'what could this be', 'likely condition'],
    'soap-note-grader': ['soap', 'note', 'grading', 'assessment', 'plan', 'subjective', 'objective'],
    'feedback-summarizer': ['feedback', 'summary', 'review', 'performance', 'evaluate'],
    'diagnostic-workup-advisor': ['workup', 'diagnostic test', 'lab', 'imaging', 'what test', 'order'],
    'standardized-patient': ['patient', 'encounter', 'simulation', 'osce', 'roleplay'],
    'intent-router': ['route', 'classify', 'intent', 'categorize'],
    'spbench-grader': ['spbench', 'standardized patient benchmark', 'sp grade'],
    'call-gemini-auditor': ['gemini', 'api audit', 'call audit', 'model audit'],
    'prompt-contract-validator': ['prompt', 'contract', 'validation', 'template'],
    'schema-drift-detector': ['schema', 'drift', 'migration', 'database change'],
    'env-var-auditor': ['env', 'environment', 'config', 'variable', 'secret'],
  };

  let bestMatch: { agent: string; score: number } | null = null;

  for (const [agent, keywords] of Object.entries(keywordMap)) {
    if (!config.agentNames.includes(agent)) continue;

    const score = keywords.filter((kw) => inputStr.includes(kw)).length;
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { agent, score };
    }
  }

  if (!bestMatch) return null;

  // Normalize score to confidence (max keywords per agent is ~5)
  const confidence = Math.min(bestMatch.score / 3, 0.8);

  return {
    agent: bestMatch.agent,
    confidence,
    reasoning: `Keyword match: ${bestMatch.score} keywords matched for ${bestMatch.agent}`,
    source: 'keyword-fallback',
  };
}

// ─── Main Router Factory ────────────────────────────────────────────────────

/**
 * Create an LLM-powered router function for use in supervisor configs.
 *
 * @example
 * ```ts
 * const router = createLLMRouter({
 *   agentNames: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
 *   agentDescriptions: {
 *     'ddx-generator': 'Generates differential diagnoses from clinical presentations',
 *     'soap-note-grader': 'Grades SOAP notes for clinical accuracy and completeness',
 *     'feedback-summarizer': 'Summarizes clinical feedback into actionable insights',
 *   },
 *   domain: 'clinical',
 * });
 *
 * // Use in supervisor config:
 * registerSupervisor({
 *   name: 'clinical-supervisor',
 *   agentNames: [...],
 *   router: (input, agents) => router(input, env),
 * });
 * ```
 */
export function createLLMRouter(config: LLMRouterConfig) {
  const minConfidence = config.minConfidence ?? 0.5;
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  return async (
    input: unknown,
    env: AIEnvKeys,
  ): Promise<IntentClassification> => {
    // 1. Check cache
    const cacheKey = getCacheKey(input, config.agentNames);
    const cached = getCachedClassification(cacheKey, cacheTtlMs);
    if (cached) return cached;

    // 2. Try LLM classification
    const llmResult = await classifyWithLLM(input, config, env);

    if (llmResult && llmResult.confidence >= minConfidence) {
      setCachedClassification(cacheKey, llmResult);
      return llmResult;
    }

    // 3. Fall back to keywords
    const keywordResult = classifyWithKeywords(input, config);

    if (keywordResult) {
      setCachedClassification(cacheKey, keywordResult);
      return keywordResult;
    }

    // 4. Ultimate fallback: return first available agent
    const fallback: IntentClassification = {
      agent: config.agentNames[0] ?? 'unknown',
      confidence: 0.1,
      reasoning: 'No classification possible — returning default agent',
      source: 'keyword-fallback',
    };
    setCachedClassification(cacheKey, fallback);
    return fallback;
  };
}

/**
 * Create a supervisor router function compatible with the existing
 * `SupervisorConfig.router` signature: `(input, agents) => string | null`.
 *
 * This is a drop-in replacement for the keyword-based routers in
 * `supervisor.ts`.
 */
export function createSupervisorRouter(config: LLMRouterConfig) {
  const llmRouter = createLLMRouter(config);

  return async (
    input: unknown,
    agents: string[],
    env: AIEnvKeys,
  ): Promise<string | null> => {
    // If only one agent, no routing needed
    if (agents.length <= 1) return agents[0] ?? null;

    const classification = await llmRouter(input, env);

    // Verify the classified agent is in the available list
    if (agents.includes(classification.agent)) {
      return classification.agent;
    }

    // If LLM returned an agent not in the list, fall back to first available
    console.warn(
      `[Supervisor LLM] Classified agent "${classification.agent}" not in available list. ` +
      `Available: ${agents.join(', ')}. Returning first available.`
    );
    return agents[0] ?? null;
  };
}

// ─── Clear Cache (for testing) ─────────────────────────────────────────────

export function clearClassificationCache(): void {
  classificationCache.clear();
}

export function getClassificationCacheSize(): number {
  return classificationCache.size;
}
