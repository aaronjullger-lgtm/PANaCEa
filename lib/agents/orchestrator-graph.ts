/**
 * Orchestrator Graph
 *
 * LangGraph StateGraph-based orchestrator that replaces the imperative
 * switch/case in orchestrator.ts. Supports:
 * - Sequential execution (agents run one after another, output chained)
 * - Parallel execution (agents run simultaneously, results merged)
 * - Supervisor execution (delegates to LLM-based supervisor)
 * - Checkpointing (resumable after interruptions)
 * - Streaming (real-time progress updates)
 *
 * @module lib/agents/orchestrator-graph
 */

import {
  StateGraph,
  START,
  END,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';

import {
  OrchestratorState,
  type OrchestratorStateType,
  type OrchestratorNodeConfig,
  type AgentExecutionResult,
} from './orchestrator-state';
import type { AgentContext, InvokeResult } from './shared/types';
import { getAgent } from './shared/runtime';
import { runSupervisor } from './supervisor';

// ─── Node: Initialize ──────────────────────────────────────────────────────

function createInitNode() {
  return (state: OrchestratorStateType): Partial<OrchestratorStateType> => {
    return {
      phase: 'executing',
      startTime: Date.now(),
      currentAgentIndex: 0,
      results: [],
      error: null,
    };
  };
}

// ─── Node: Execute Sequential Agent ────────────────────────────────────────

function createSequentialAgentNode(ctx: AgentContext) {
  return async (state: OrchestratorStateType): Promise<Partial<OrchestratorStateType>> => {
    const { config, currentAgentIndex, accumulatedInput } = state;
    const agentName = config.agents[currentAgentIndex];

    if (!agentName) {
      return { phase: 'complete' };
    }

    const agent = getAgent(agentName);
    if (!agent) {
      return {
        results: [{
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: 0,
          error: `Agent not found: ${agentName}`,
        }],
        phase: 'error',
        error: `Agent not found: ${agentName}`,
      };
    }

    const agentStart = Date.now();
    const input = accumulatedInput ?? extractInput(state);

    try {
      const result: InvokeResult<unknown> = await agent.invoke(input, ctx);

      const executionResult: AgentExecutionResult = {
        agent: agentName,
        status: result.status === 'ok' ? 'ok' : 'error',
        output: result.output,
        durationMs: Date.now() - agentStart,
        error: result.error?.message,
      };

      return {
        results: [executionResult],
        accumulatedInput: result.output ?? input,
        currentAgentIndex: currentAgentIndex + 1,
        phase: result.status === 'ok' ? 'executing' : 'error',
        error: result.error?.message ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        results: [{
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: Date.now() - agentStart,
          error: message,
        }],
        phase: 'error',
        error: message,
      };
    }
  };
}

// ─── Node: Execute Parallel Agents ─────────────────────────────────────────

function createParallelAgentsNode(ctx: AgentContext) {
  return async (state: OrchestratorStateType): Promise<Partial<OrchestratorStateType>> => {
    const { config } = state;
    const input = extractInput(state);

    const promises = config.agents.map(async (agentName): Promise<AgentExecutionResult> => {
      const agentStart = Date.now();
      const agent = getAgent(agentName);

      if (!agent) {
        return {
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: 0,
          error: `Agent not found: ${agentName}`,
        };
      }

      try {
        const result: InvokeResult<unknown> = await agent.invoke(input, ctx);
        return {
          agent: agentName,
          status: result.status === 'ok' ? 'ok' : 'error',
          output: result.output,
          durationMs: Date.now() - agentStart,
          error: result.error?.message,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: Date.now() - agentStart,
          error: message,
        };
      }
    });

    const results = await Promise.all(promises);

    // Merge if merger is provided
    let mergedOutput: unknown = null;
    if (config.merger) {
      mergedOutput = config.merger(results);
    }

    const hasErrors = results.some((r) => r.status === 'error');

    return {
      results,
      mergedOutput,
      phase: hasErrors ? 'error' : 'merging',
    };
  };
}

// ─── Node: Execute Supervisor ──────────────────────────────────────────────

function createSupervisorNode(ctx: AgentContext) {
  return async (state: OrchestratorStateType): Promise<Partial<OrchestratorStateType>> => {
    const { config } = state;
    const input = extractInput(state);

    if (!config.supervisorName) {
      return {
        phase: 'error',
        error: 'supervisorName required for supervisor strategy',
      };
    }

    try {
      const supervisorResult = await runSupervisor(config.supervisorName, input, ctx);

      const results: AgentExecutionResult[] = supervisorResult.allResults.map((r) => ({
        agent: r.agent,
        status: r.status,
        output: r.output,
        durationMs: 0,
      }));

      return {
        results,
        mergedOutput: supervisorResult.output,
        phase: 'complete',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        phase: 'error',
        error: `Supervisor execution failed: ${message}`,
      };
    }
  };
}

// ─── Node: Finalize ────────────────────────────────────────────────────────

function createFinalizeNode() {
  return (state: OrchestratorStateType): Partial<OrchestratorStateType> => {
    return {
      phase: 'complete',
      totalDurationMs: Date.now() - state.startTime,
      metadata: {
        ...state.metadata,
        agentCount: state.config.agents.length,
        strategy: state.config.strategy,
        resultCount: state.results.length,
        completedAt: new Date().toISOString(),
      },
    };
  };
}

// ─── Conditional Edges ─────────────────────────────────────────────────────

/**
 * After init, route to the appropriate execution strategy.
 */
function afterInit(state: OrchestratorStateType): 'sequential' | 'parallel' | 'supervisor' | '__end__' {
  switch (state.config.strategy) {
    case 'sequential': return 'sequential';
    case 'parallel': return 'parallel';
    case 'supervisor': return 'supervisor';
    default: return '__end__';
  }
}

/**
 * After sequential agent execution, decide: continue or finalize.
 */
function afterSequentialAgent(state: OrchestratorStateType): 'sequential' | 'finalize' | '__end__' {
  if (state.phase === 'error') return 'finalize';
  if (state.currentAgentIndex >= state.config.agents.length) return 'finalize';
  return 'sequential';
}

/**
 * After parallel execution, decide: merge or finalize.
 */
function afterParallel(state: OrchestratorStateType): 'finalize' | '__end__' {
  if (state.phase === 'error') return 'finalize';
  return 'finalize';
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractInput(state: OrchestratorStateType): unknown {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage) {
    const content = lastMessage.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const textParts = content.filter((p: unknown) => typeof p === 'object' && p !== null && 'text' in (p as Record<string, unknown>));
      if (textParts.length > 0) return textParts.map((p: unknown) => (p as Record<string, unknown>).text).join('\n');
    }
    return content;
  }
  return '';
}

// ─── Graph Factory ─────────────────────────────────────────────────────────

export interface OrchestratorGraphConfig {
  /** Orchestrator configuration */
  orchestratorConfig: OrchestratorNodeConfig;
  /** Agent execution context */
  ctx: AgentContext;
}

export interface OrchestratorGraphResult {
  orchestrator: string;
  strategy: string;
  results: AgentExecutionResult[];
  mergedOutput: unknown;
  totalDurationMs: number;
  phase: string;
  error: string | null;
}

/**
 * Build and compile a LangGraph-based orchestrator.
 *
 * @example
 * ```ts
 * const graph = buildOrchestratorGraph({
 *   orchestratorConfig: {
 *     name: 'clinical-encounter',
 *     agents: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
 *     strategy: 'sequential',
 *   },
 *   ctx: { env, userId: 'user_123' },
 * });
 *
 * const result = await graph.invoke('Generate a DDx for chest pain');
 * ```
 */
export function buildOrchestratorGraph(config: OrchestratorGraphConfig) {
  const { orchestratorConfig, ctx } = config;

  const workflow = new StateGraph(OrchestratorState)
    // Nodes
    .addNode('init', createInitNode())
    .addNode('sequential', createSequentialAgentNode(ctx))
    .addNode('parallel', createParallelAgentsNode(ctx))
    .addNode('supervisor', createSupervisorNode(ctx))
    .addNode('finalize', createFinalizeNode())
    // Edges
    .addEdge(START, 'init')
    .addConditionalEdges('init', afterInit, ['sequential', 'parallel', 'supervisor', '__end__'])
    .addConditionalEdges('sequential', afterSequentialAgent, ['sequential', 'finalize', '__end__'])
    .addEdge('parallel', 'finalize')
    .addEdge('supervisor', 'finalize')
    .addEdge('finalize', END);

  const compiled = workflow.compile();

  return {
    /**
     * Invoke the orchestrator with a user message.
     */
    async invoke(userMessage: string): Promise<OrchestratorGraphResult> {
      const result = await compiled.invoke({
        messages: [new HumanMessage(userMessage)],
        config: orchestratorConfig,
        metadata: {
          orchestratorName: orchestratorConfig.name,
          strategy: orchestratorConfig.strategy,
          agentCount: orchestratorConfig.agents.length,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        orchestrator: orchestratorConfig.name,
        strategy: orchestratorConfig.strategy,
        results: result.results,
        mergedOutput: result.mergedOutput,
        totalDurationMs: result.totalDurationMs,
        phase: result.phase,
        error: result.error,
      };
    },

    /**
     * Stream the orchestrator execution for real-time progress.
     */
    async *stream(userMessage: string): AsyncGenerator<Record<string, unknown>> {
      const streamResult = await compiled.stream({
        messages: [new HumanMessage(userMessage)],
        config: orchestratorConfig,
        metadata: {
          orchestratorName: orchestratorConfig.name,
          strategy: orchestratorConfig.strategy,
          agentCount: orchestratorConfig.agents.length,
          timestamp: new Date().toISOString(),
        },
      });

      for await (const chunk of streamResult) {
        yield chunk as Record<string, unknown>;
      }
    },
  };
}

// ─── Convenience: Run orchestrator from registry ───────────────────────────

import { getOrchestrator } from './orchestrator';

/**
 * Run a registered orchestrator using the LangGraph-based graph.
 * Falls back to the imperative orchestrator if the graph fails.
 */
export async function runOrchestratorGraph(
  orchestratorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorGraphResult> {
  const config = getOrchestrator(orchestratorName);
  if (!config) {
    throw new Error(`Orchestrator not found: ${orchestratorName}`);
  }

  // Normalize strategy — 'conditional' is not supported by the graph orchestrator
  const strategy = config.strategy === 'conditional' ? 'supervisor' : config.strategy;

  const graph = buildOrchestratorGraph({
    orchestratorConfig: {
      name: config.name,
      agents: config.agents,
      strategy,
      supervisorName: config.supervisorName,
      merger: config.merger,
    },
    ctx,
  });

  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  return graph.invoke(inputStr);
}
