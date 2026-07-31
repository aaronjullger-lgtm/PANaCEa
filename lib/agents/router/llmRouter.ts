/**
 * LLM-Powered Agent Router
 *
 * Replaces keyword-based supervisor routing with semantic intent classification.
 * Uses `routeStructured` from the LangChain router to classify user input into
 * the most appropriate agent, with confidence scoring and fallback chains.
 *
 * Key improvements over keyword-based routing:
 * - Understands clinical context ("chest pain" → ddx-generator, not just "diagnosis")
 * - Handles ambiguous inputs with confidence scoring
 * - Supports multi-agent dispatch for complex queries
 * - Provides explainable routing decisions for observability
 *
 * @module lib/agents/router/llmRouter
 */

import { z } from 'zod';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type { AgentContext } from '../shared/types';

// ─── Routing Decision Schema ────────────────────────────────────────────────

export const AgentRoutingDecision = z.object({
  /** Primary agent to route to */
  agent: z.string().describe('The kebab-case name of the agent best suited for this task'),
  /** Confidence in the routing decision (0-1) */
  confidence: z.number().min(0).max(1).describe('How confident the router is in this decision'),
  /** Brief reasoning for the routing decision (for observability) */
  reasoning: z.string().describe('One-sentence explanation of why this agent was chosen'),
  /** Alternative agents that could also handle this (for fallback) */
  alternatives: z.array(z.string()).describe('Other agents that could handle this task, in preference order'),
  /** Whether multiple agents should be invoked (complex queries) */
  requiresMultiAgent: z.boolean().describe('True if this task requires coordination between multiple agents'),
  /** If multi-agent, which agents and in what order */
  agentSequence: z.array(z.string()).optional().describe('Ordered list of agents for multi-agent workflows'),
});

export type AgentRoutingDecision = z.infer<typeof AgentRoutingDecision>;

// ─── Router Configuration ───────────────────────────────────────────────────

export interface LLMRouterConfig {
  /** Available agents with their descriptions */
  agents: Array<{
    name: string;
    description: string;
    /** Capabilities / keywords for the router to consider */
    capabilities: string[];
  }>;
  /** Minimum confidence threshold to accept a routing decision */
  minConfidence?: number;
  /** Default agent when confidence is below threshold */
  defaultAgent?: string;
  /** System prompt override for the router */
  systemPrompt?: string;
}

// ─── Default Router Prompt ──────────────────────────────────────────────────

const DEFAULT_ROUTER_PROMPT = `You are an intelligent agent router for a clinical education platform (PANaCEa).
Your job is to analyze user requests and route them to the most appropriate specialized agent.

Rules:
1. Match the user's intent to the agent whose capabilities best align
2. For clinical/medical questions, prefer clinical agents over operational ones
3. For ambiguous requests, choose the most general-purpose agent
4. Set confidence based on how clearly the request matches an agent's capabilities
5. For complex multi-step tasks, set requiresMultiAgent=true and specify the agent sequence
6. Be conservative — it's better to route to a general agent with lower confidence than to guess wrong`;

// ─── Router Implementation ──────────────────────────────────────────────────

/**
 * Build the agent capability description for the router prompt.
 */
function buildAgentCatalog(config: LLMRouterConfig): string {
  return config.agents
    .map(
      (a) =>
        `- **${a.name}**: ${a.description}\n  Capabilities: ${a.capabilities.join(', ')}`
    )
    .join('\n');
}

/**
 * Route a user request to the most appropriate agent using LLM-based intent classification.
 *
 * @example
 * ```ts
 * const decision = await routeWithLLM(
 *   'A 45-year-old male presents with crushing chest pain radiating to the left arm.',
 *   { agents: clinicalAgents },
 *   env,
 * );
 * // decision.agent === 'ddx-generator'
 * // decision.confidence === 0.95
 * ```
 */
export async function routeWithLLM(
  userInput: string,
  config: LLMRouterConfig,
  env: AIEnvKeys,
): Promise<AgentRoutingDecision> {
  const agentCatalog = buildAgentCatalog(config);
  const systemPrompt = config.systemPrompt ?? DEFAULT_ROUTER_PROMPT;

  const fullSystemPrompt = `${systemPrompt}

Available agents:
${agentCatalog}

Respond with the agent name (kebab-case), confidence (0-1), reasoning, alternatives, and whether multi-agent coordination is needed.`;

  try {
    const result = await routeStructured(
      'agent-routing',
      env,
      {
        systemPrompt: fullSystemPrompt,
        userPrompt: `Route this request to the appropriate agent: "${userInput}"`,
      },
      AgentRoutingDecision,
      {
        temperature: 0.1, // Low temperature for consistent routing
        maxOutputTokens: 300,
        runName: 'agent-router:classify',
        metadata: {
          availableAgents: config.agents.map((a) => a.name),
          inputLength: userInput.length,
        },
      },
    );

    // Validate the routed agent exists in our catalog
    const agentExists = config.agents.some((a) => a.name === result.output.agent);
    if (!agentExists) {
      // Fall back to default agent if LLM hallucinated an agent name
      const fallback = config.defaultAgent ?? config.agents[0]?.name ?? 'ddx-generator';
      return {
        agent: fallback,
        confidence: 0.1,
        reasoning: `LLM suggested "${result.output.agent}" which is not in the catalog. Falling back to ${fallback}.`,
        alternatives: config.agents.map((a) => a.name),
        requiresMultiAgent: false,
      };
    }

    // Check confidence threshold
    const minConfidence = config.minConfidence ?? 0.3;
    if (result.output.confidence < minConfidence && config.defaultAgent) {
      return {
        ...result.output,
        agent: config.defaultAgent,
        confidence: result.output.confidence,
        reasoning: `${result.output.reasoning} (confidence ${result.output.confidence} below threshold ${minConfidence}, defaulting to ${config.defaultAgent})`,
      };
    }

    return result.output;
  } catch (err) {
    // If LLM routing fails entirely, fall back to first available agent
    const fallback = config.defaultAgent ?? config.agents[0]?.name ?? 'ddx-generator';
    const message = err instanceof Error ? err.message : String(err);
    return {
      agent: fallback,
      confidence: 0,
      reasoning: `LLM routing failed: ${message}. Falling back to ${fallback}.`,
      alternatives: config.agents.map((a) => a.name),
      requiresMultiAgent: false,
    };
  }
}

// ─── Batch Routing ──────────────────────────────────────────────────────────

/**
 * Route multiple independent requests in parallel.
 * Useful for processing a batch of clinical questions through different agents.
 */
export async function routeBatchWithLLM(
  inputs: string[],
  config: LLMRouterConfig,
  env: AIEnvKeys,
): Promise<AgentRoutingDecision[]> {
  return Promise.all(inputs.map((input) => routeWithLLM(input, config, env)));
}

// ─── Agent Catalog Builders ─────────────────────────────────────────────────

/**
 * Build a router config from the agent registry.
 */
export function buildRouterConfigFromRegistry(
  agents: Array<{ name: string; description: string; tier: string }>,
  overrides?: Partial<LLMRouterConfig>,
): LLMRouterConfig {
  return {
    agents: agents.map((a) => ({
      name: a.name,
      description: a.description,
      capabilities: inferCapabilities(a.name, a.description, a.tier),
    })),
    minConfidence: 0.3,
    defaultAgent: agents.find((a) => a.tier === 'encounter')?.name ?? agents[0]?.name,
    ...overrides,
  };
}

/**
 * Infer agent capabilities from name, description, and tier.
 * This is a heuristic — for production, capabilities should be explicitly defined.
 */
function inferCapabilities(name: string, description: string, tier: string): string[] {
  const capabilities: string[] = [tier];

  const keywordMap: Record<string, string[]> = {
    ddx: ['differential diagnosis', 'clinical reasoning', 'diagnostic thinking'],
    soap: ['clinical notes', 'documentation', 'patient assessment'],
    feedback: ['performance review', 'improvement suggestions', 'coaching'],
    diagnostic: ['testing', 'workup', 'lab interpretation'],
    patient: ['history taking', 'physical exam', 'patient interaction'],
    gemini: ['API auditing', 'model evaluation', 'cost analysis'],
    prompt: ['prompt engineering', 'contract validation', 'template review'],
    schema: ['database schema', 'migration analysis', 'drift detection'],
    env: ['environment variables', 'configuration', 'secrets management'],
    tutor: ['teaching', 'explanation', 'Socratic questioning'],
    question: ['question generation', 'content creation', 'exam prep'],
  };

  for (const [keyword, caps] of Object.entries(keywordMap)) {
    if (name.includes(keyword) || description.toLowerCase().includes(keyword)) {
      capabilities.push(...caps);
    }
  }

  // Deduplicate
  return [...new Set(capabilities)];
}

// ─── Context-Aware Routing ──────────────────────────────────────────────────

/**
 * Route with additional context from the agent context (userId, session state, etc.).
 * Enriches the routing prompt with user-specific information for better decisions.
 */
export async function routeWithContext(
  userInput: string,
  config: LLMRouterConfig,
  ctx: AgentContext,
): Promise<AgentRoutingDecision> {
  // Build context addendum for the router
  const contextParts: string[] = [];

  if (ctx.userId) {
    contextParts.push(`Current user ID: ${ctx.userId}`);
  }

  const enrichedInput = contextParts.length > 0
    ? `${contextParts.join('. ')}. Request: "${userInput}"`
    : userInput;

  return routeWithLLM(enrichedInput, config, ctx.env);
}
