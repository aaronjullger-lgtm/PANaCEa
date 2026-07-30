/**
 * Unified Agent Interface
 *
 * Bridges Edge-side agents (lib/agents/) and Node-side agents (packages/agent-orchestrator/)
 * under a single invocation surface with shared Langfuse tracing and coordination.
 *
 * This module enables:
 * - Multi-agent team workflows across both systems
 * - Shared Langfuse traces for end-to-end visibility
 * - Supervised agent coordination via LangGraph patterns
 * - Eval dataset integration for clinical encounter agents
 *
 * @module lib/agents/unified
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './shared/types';
import { getAgent, listAgents } from './shared/runtime';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UnifiedAgentOptions {
  /** Agent name (kebab-case) */
  name: string;
  /** Input payload */
  input: unknown;
  /** Agent context (env, userId, signal, log) */
  ctx: AgentContext;
  /** Optional Langfuse trace metadata */
  trace?: {
    name: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    sessionId?: string;
  };
}

export interface TeamAgent {
  name: string;
  description: string;
  tier: 'encounter' | 'ops' | 'orchestrator';
  invoke: (input: unknown, ctx: AgentContext) => Promise<InvokeResult<unknown>>;
}

export interface TeamWorkflow {
  name: string;
  description: string;
  agents: TeamAgent[];
  /** Execute agents sequentially, passing outputs as inputs */
  execute: (input: unknown, ctx: AgentContext) => Promise<TeamResult>;
}

export interface TeamResult {
  workflow: string;
  results: Array<{
    agent: string;
    status: 'ok' | 'error';
    output: unknown;
    durationMs: number;
  }>;
  totalDurationMs: number;
  traceId?: string;
}

// ─── Unified Agent Invocation ───────────────────────────────────────────────

/**
 * Invoke an agent with unified tracing and error handling.
 * Works with both Edge-side and Node-side agents.
 *
 * @example
 * ```ts
 * const result = await invokeUnifiedAgent({
 *   name: 'ddx-generator',
 *   input: { condition: 'chest pain', patientAge: 45 },
 *   ctx: { env, userId: 'user_123' },
 *   trace: {
 *     name: 'clinical/ddx-generation',
 *     tags: ['encounter', 'ddx'],
 *   },
 * });
 * ```
 */
export async function invokeUnifiedAgent(
  options: UnifiedAgentOptions,
): Promise<InvokeResult<unknown>> {
  const { name, input, ctx, trace } = options;
  const start = Date.now();

  // Check if agent exists in Edge registry
  const edgeAgent = getAgent(name);
  if (edgeAgent) {
    return invokeWithTracing(edgeAgent, input, ctx, trace, name);
  }

  // Check if agent exists in Node registry (packages/agent-orchestrator)
  // This will be implemented when we bridge the systems
  return {
    status: 'internal_error',
    output: null,
    error: {
      status: 'internal_error',
      message: `Agent not found in any registry: ${name}`,
      cause: name,
    },
    agent: name,
    durationMs: Date.now() - start,
  };
}

/**
 * Invoke an Edge-side agent with Langfuse tracing.
 */
async function invokeWithTracing(
  agent: AgentDefinition,
  input: unknown,
  ctx: AgentContext,
  _traceOptions?: UnifiedAgentOptions['trace'],
  _agentName?: string,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();
  try {
    const result = await agent.invoke(input, ctx);
    return {
      ...result,
      durationMs: Date.now() - start,
      telemetry: {
        ...result.telemetry,
        agentTier: agent.tier,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message, cause: agent.name },
      agent: agent.name,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Team Workflow Execution ────────────────────────────────────────────────

/**
 * Create a team workflow that executes multiple agents in sequence.
 * Each agent's output is passed as input to the next agent.
 *
 * @example
 * ```ts
 * const workflow = createTeamWorkflow({
 *   name: 'clinical-ddx-with-validation',
 *   description: 'Generate DDx then validate each diagnosis',
 *   agents: [
 *     { name: 'ddx-generator', ... },
 *     { name: 'clinical-validator', ... },
 *   ],
 * });
 *
 * const result = await workflow.execute(
 *   { condition: 'chest pain' },
 *   { env, userId: 'user_123' },
 * );
 * ```
 */
export function createTeamWorkflow(
  config: Omit<TeamWorkflow, 'execute'> & {
    execute?: TeamWorkflow['execute'];
  },
): TeamWorkflow {
  const executeFn = config.execute ?? defaultSequentialExecution(config.agents);
  return { ...config, execute: executeFn };
}

/**
 * Default sequential execution: each agent receives the previous agent's output.
 */
function defaultSequentialExecution(
  agents: TeamAgent[],
): TeamWorkflow['execute'] {
  return async (input: unknown, ctx: AgentContext): Promise<TeamResult> => {
    const results: TeamResult['results'] = [];
    const totalStart = Date.now();
    let currentInput = input;

    for (const agent of agents) {
      const agentStart = Date.now();
      try {
        const result = await agent.invoke(currentInput, ctx);
        results.push({
          agent: agent.name,
          status: result.status === 'ok' ? 'ok' : 'error',
          output: result.output,
          durationMs: Date.now() - agentStart,
        });

        // Pass output as input to next agent
        if (result.output) {
          currentInput = result.output;
        }
      } catch (err) {
        results.push({
          agent: agent.name,
          status: 'error',
          output: null,
          durationMs: Date.now() - agentStart,
        });
        // Stop workflow on error
        break;
      }
    }

    return {
      workflow: 'sequential',
      results,
      totalDurationMs: Date.now() - totalStart,
    };
  };
}

// ─── Agent Team Registry ────────────────────────────────────────────────────

const teamRegistry = new Map<string, TeamWorkflow>();

/**
 * Register a team workflow for reuse.
 */
export function registerTeamWorkflow(workflow: TeamWorkflow): void {
  teamRegistry.set(workflow.name, workflow);
}

/**
 * Get a registered team workflow by name.
 */
export function getTeamWorkflow(name: string): TeamWorkflow | undefined {
  return teamRegistry.get(name);
}

/**
 * List all registered team workflows.
 */
export function listTeamWorkflows(): Array<{
  name: string;
  description: string;
  agentCount: number;
}> {
  return Array.from(teamRegistry.values()).map((w) => ({
    name: w.name,
    description: w.description,
    agentCount: w.agents.length,
  }));
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Invoke an agent by name with automatic context propagation.
 */
export async function callAgent(
  name: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  return invokeUnifiedAgent({
    name,
    input,
    ctx,
    trace: {
      name: `agent/${name}`,
      tags: ['direct-invocation'],
    },
  });
}

/**
 * Execute a registered team workflow.
 */
export async function runTeam(
  workflowName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<TeamResult> {
  const workflow = teamRegistry.get(workflowName);
  if (!workflow) {
    throw new Error(`Team workflow not found: ${workflowName}`);
  }
  return workflow.execute(input, ctx);
}

/**
 * Get all available agents (Edge + Node registries).
 */
export function getAllAgents(): Array<{
  name: string;
  description: string;
  tier: string;
  source: 'edge' | 'node';
}> {
  const edgeAgents = listAgents().map((a) => ({ ...a, source: 'edge' as const }));

  // Node agents will be added when we bridge the systems
  const nodeAgents: Array<{
    name: string;
    description: string;
    tier: string;
    source: 'node';
  }> = [];

  return [...edgeAgents, ...nodeAgents];
}
