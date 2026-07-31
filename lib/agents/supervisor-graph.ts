/**
 * LLM-Based Supervisor Graph
 *
 * Replaces keyword-based routing in supervisor.ts with LLM-driven semantic
 * routing. The supervisor uses a lightweight model (gemini-2.0-flash) to
 * analyze the user's input and select the most appropriate agent from the
 * available pool.
 *
 * Architecture:
 *   START → routeNode (LLM decides which agent) → agentNode (invoke agent) → END
 *
 * The routeNode uses a structured output schema to force the LLM to pick
 * exactly one agent and provide reasoning. This is more reliable than
 * keyword matching for clinical/ops/content routing.
 *
 * @module lib/agents/supervisor-graph
 */

import {
  StateGraph,
  START,
  END,
} from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

import {
  SupervisorState,
  type SupervisorStateType,
  type AgentCapability,
} from './supervisor-state';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type { AgentContext, InvokeResult } from './shared/types';
import { getAgent } from './shared/runtime';

// ─── Routing Schema ────────────────────────────────────────────────────────

/**
 * Structured output schema for the LLM router.
 * Forces the LLM to pick exactly one agent and provide reasoning.
 */
const RoutingDecisionSchema = z.object({
  agent: z.string().describe('The name of the selected agent (must match an available agent name)'),
  confidence: z.number().min(0).max(1).describe('Confidence in this routing decision (0-1)'),
  reasoning: z.string().describe('Brief explanation of why this agent was selected'),
});

type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// ─── Routing Prompt ────────────────────────────────────────────────────────

function buildRoutingSystemPrompt(agents: AgentCapability[]): string {
  const agentDescriptions = agents
    .map(
      (a) =>
        `- **${a.name}**: ${a.description}\n  Capabilities: ${a.capabilities.join(', ')}\n  Examples: ${a.examples.join('; ')}`,
    )
    .join('\n\n');

  return `You are an intelligent agent router for PANaCEa, a clinical education platform.
Your job is to analyze the user's input and select the SINGLE most appropriate agent to handle it.

Available agents:
${agentDescriptions}

Rules:
1. Select exactly ONE agent that best matches the user's intent
2. If the input is about clinical encounters (diagnosis, SOAP notes, feedback), prefer clinical agents
3. If the input is about operations (auditing, validation, schema), prefer ops agents
4. If the input is about content (generation, enrichment, audit), prefer content agents
5. Provide a confidence score (0-1) and brief reasoning for your choice
6. If no agent clearly matches, pick the closest one with low confidence`;
}

// ─── Graph Nodes ───────────────────────────────────────────────────────────

/**
 * Route node: uses LLM to decide which agent to invoke.
 */
function createRouteNode(env: AIEnvKeys) {
  return async (state: SupervisorStateType): Promise<Partial<SupervisorStateType>> => {
    const agents = state.availableAgents;
    if (agents.length === 0) {
      return {
        status: 'error',
        error: 'No agents available for routing',
      };
    }

    // If only one agent, route directly (no LLM call needed)
    if (agents.length === 1) {
      return {
        selectedAgent: agents[0]!.name,
        routingConfidence: 1.0,
        routingReasoning: 'Only one agent available — auto-selected',
        status: 'executing',
      };
    }

    try {
      const userMessage = state.messages[state.messages.length - 1];
      const userContent = typeof userMessage?.content === 'string'
        ? userMessage.content
        : JSON.stringify(userMessage?.content ?? '');

      const systemPrompt = buildRoutingSystemPrompt(agents);

      const decision = await routeStructured(
        'supervisor-routing',
        env,
        {
          systemPrompt,
          userPrompt: userContent,
        },
        RoutingDecisionSchema,
        {
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      );

      // Validate the selected agent exists
      const selectedAgent = agents.find((a) => a.name === decision.output.agent);
      if (!selectedAgent) {
        return {
          status: 'error',
          error: `LLM selected unknown agent "${decision.output.agent}". Available: ${agents.map((a) => a.name).join(', ')}`,
          routingReasoning: decision.output.reasoning,
        };
      }

      return {
        selectedAgent: decision.output.agent,
        routingConfidence: decision.output.confidence,
        routingReasoning: decision.output.reasoning,
        status: 'executing',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        error: `Routing failed: ${message}`,
      };
    }
  };
}

/**
 * Agent node: invokes the selected agent with the user's input.
 */
function createAgentNode(ctx: AgentContext) {
  return async (state: SupervisorStateType): Promise<Partial<SupervisorStateType>> => {
    const agentName = state.selectedAgent;
    if (!agentName) {
      return { status: 'error', error: 'No agent selected' };
    }

    const agent = getAgent(agentName);
    if (!agent) {
      return {
        status: 'error',
        error: `Agent not found in registry: ${agentName}`,
      };
    }

    try {
      const userMessage = state.messages[state.messages.length - 1];
      const input = userMessage?.content ?? '';

      const result: InvokeResult<unknown> = await agent.invoke(input, ctx);

      return {
        agentOutput: result.output,
        status: result.status === 'ok' ? 'complete' : 'error',
        error: result.error?.message ?? null,
        metadata: {
          agentName,
          agentTier: agent.tier,
          durationMs: result.durationMs,
          routingConfidence: state.routingConfidence,
          routingReasoning: state.routingReasoning,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        error: `Agent execution failed: ${message}`,
      };
    }
  };
}

// ─── Conditional Edge ──────────────────────────────────────────────────────

/**
 * After routing, decide whether to execute the agent or end with an error.
 */
function afterRouting(state: SupervisorStateType): 'agent' | '__end__' {
  if (state.status === 'error') return '__end__';
  if (state.selectedAgent) return 'agent';
  return '__end__';
}

// ─── Graph Factory ─────────────────────────────────────────────────────────

export interface SupervisorGraphConfig {
  /** Available agents with their capabilities */
  agents: AgentCapability[];
  /** Supervisor name for tracing */
  supervisorName: string;
  /** AI environment keys */
  env: AIEnvKeys;
  /** Agent execution context */
  ctx: AgentContext;
}

export interface SupervisorGraphResult {
  selectedAgent: string | null;
  routingConfidence: number;
  routingReasoning: string;
  output: unknown;
  status: 'complete' | 'error';
  error: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Build and compile an LLM-based supervisor graph.
 *
 * @example
 * ```ts
 * const graph = buildSupervisorGraph({
 *   agents: [
 *     { name: 'ddx-generator', description: 'Generates differential diagnoses', ... },
 *     { name: 'soap-note-grader', description: 'Grades SOAP notes', ... },
 *   ],
 *   supervisorName: 'clinical-supervisor',
 *   env,
 *   ctx: { env, userId: 'user_123' },
 * });
 *
 * const result = await graph.invoke('I need a differential diagnosis for chest pain');
 * ```
 */
export function buildSupervisorGraph(config: SupervisorGraphConfig) {
  const workflow = new StateGraph(SupervisorState)
    .addNode('route', createRouteNode(config.env))
    .addNode('agent', createAgentNode(config.ctx))
    .addEdge(START, 'route')
    .addConditionalEdges('route', afterRouting, ['agent', '__end__'])
    .addEdge('agent', END);

  const compiled = workflow.compile();

  return {
    /**
     * Invoke the supervisor with a user message.
     */
    async invoke(userMessage: string): Promise<SupervisorGraphResult> {
      const result = await compiled.invoke({
        messages: [new HumanMessage(userMessage)],
        availableAgents: config.agents,
        supervisorName: config.supervisorName,
        metadata: {
          supervisorName: config.supervisorName,
          agentCount: config.agents.length,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        selectedAgent: result.selectedAgent,
        routingConfidence: result.routingConfidence,
        routingReasoning: result.routingReasoning,
        output: result.agentOutput,
        status: result.status === 'complete' ? 'complete' : 'error',
        error: result.error,
        metadata: result.metadata,
      };
    },

    /**
     * Stream the supervisor execution for real-time updates.
     */
    async *stream(userMessage: string): AsyncGenerator<Record<string, unknown>> {
      const streamResult = await compiled.stream({
        messages: [new HumanMessage(userMessage)],
        availableAgents: config.agents,
        supervisorName: config.supervisorName,
        metadata: {
          supervisorName: config.supervisorName,
          agentCount: config.agents.length,
          timestamp: new Date().toISOString(),
        },
      });

      for await (const chunk of streamResult) {
        yield chunk as Record<string, unknown>;
      }
    },
  };
}

// ─── Pre-built Capability Descriptors ──────────────────────────────────────

/**
 * Clinical encounter agent capabilities.
 */
export const CLINICAL_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    name: 'ddx-generator',
    description: 'Generates differential diagnoses from clinical presentations',
    capabilities: ['differential diagnosis', 'DDx', 'clinical reasoning', 'symptom analysis'],
    examples: ['Generate DDx for chest pain', 'What are the differentials for acute abdominal pain?'],
  },
  {
    name: 'soap-note-grader',
    description: 'Grades and provides feedback on SOAP notes',
    capabilities: ['SOAP note', 'clinical documentation', 'note grading', 'documentation feedback'],
    examples: ['Grade this SOAP note', 'Review my clinical documentation'],
  },
  {
    name: 'feedback-summarizer',
    description: 'Summarizes clinical feedback and provides actionable recommendations',
    capabilities: ['feedback', 'summary', 'recommendations', 'performance review'],
    examples: ['Summarize my OSCE feedback', 'What should I improve based on my performance?'],
  },
  {
    name: 'diagnostic-workup-advisor',
    description: 'Recommends diagnostic workup based on clinical presentation',
    capabilities: ['diagnostic workup', 'lab tests', 'imaging', 'clinical guidelines'],
    examples: ['What labs should I order for suspected PE?', 'Recommended imaging for abdominal pain'],
  },
];

/**
 * Operations agent capabilities.
 */
export const OPS_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    name: 'call-gemini-auditor',
    description: 'Audits Gemini API calls for correctness, cost, and rate limits',
    capabilities: ['Gemini API', 'API audit', 'cost analysis', 'rate limiting'],
    examples: ['Audit Gemini API usage', 'Check API call patterns'],
  },
  {
    name: 'prompt-contract-validator',
    description: 'Validates prompt contracts against expected schemas',
    capabilities: ['prompt validation', 'schema checking', 'contract testing'],
    examples: ['Validate prompt contracts', 'Check prompt schema compliance'],
  },
  {
    name: 'schema-drift-detector',
    description: 'Detects schema drift between Prisma schema and database',
    capabilities: ['schema drift', 'database migration', 'Prisma', 'schema validation'],
    examples: ['Check for schema drift', 'Validate database schema'],
  },
  {
    name: 'env-var-auditor',
    description: 'Audits environment variables for consistency and security',
    capabilities: ['environment variables', 'config audit', 'security check'],
    examples: ['Audit environment variables', 'Check for missing env vars'],
  },
];

/**
 * Content agent capabilities.
 */
export const CONTENT_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    name: 'ddx-generator',
    description: 'Generates clinical content including differential diagnoses',
    capabilities: ['content generation', 'clinical content', 'medical education'],
    examples: ['Generate cardiology content', 'Create a clinical scenario'],
  },
  {
    name: 'soap-note-grader',
    description: 'Reviews and grades clinical content quality',
    capabilities: ['content review', 'quality assessment', 'clinical accuracy'],
    examples: ['Review this clinical content', 'Assess content quality'],
  },
  {
    name: 'feedback-summarizer',
    description: 'Summarizes content feedback and improvement suggestions',
    capabilities: ['content feedback', 'improvement suggestions', 'content audit'],
    examples: ['Summarize content audit findings', 'What content needs improvement?'],
  },
];
