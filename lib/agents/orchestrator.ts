/**
 * Agent Team Orchestrator
 *
 * Coordinates multi-agent workflows across Edge (lib/agents/) and Node
 * (packages/agent-orchestrator/) systems. Provides unified tracing,
 * error handling, and result aggregation.
 *
 * Execution is powered by a LangGraph StateGraph (orchestrator-graph.ts)
 * with checkpointing, streaming, and conditional routing. The old
 * hand-rolled sequential/parallel/supervisor dispatch has been replaced
 * by the graph-based pipeline.
 *
 * @module lib/agents/orchestrator
 */

import type { AgentContext } from './shared/types';
import { registerClinicalSupervisor, registerOpsSupervisor, registerContentSupervisor } from './supervisor';
import {
  invokeOrchestratorGraph,
  type OrchestratorGraphConfig,
  type OrchestratorNodeResult,
} from './graphs/orchestrator-graph';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  name: string;
  description: string;
  /** Agents to coordinate */
  agents: string[];
  /** Execution strategy: 'sequential' | 'parallel' | 'supervisor' | 'conditional' */
  strategy: 'sequential' | 'parallel' | 'supervisor' | 'conditional';
  /** Supervisor name if strategy is 'supervisor' */
  supervisorName?: string;
  /** Optional: custom merge function for parallel execution */
  merger?: (results: Array<{ agent: string; output: unknown }>) => unknown;
  /** Optional: custom route function for conditional strategy */
  routeFn?: OrchestratorGraphConfig['routeFn'];
}

export interface OrchestratorResult {
  orchestrator: string;
  strategy: string;
  results: Array<{
    agent: string;
    status: 'ok' | 'error';
    output: unknown;
    durationMs: number;
  }>;
  mergedOutput?: unknown;
  totalDurationMs: number;
  traceId?: string;
}

// ─── Orchestrator Registry ──────────────────────────────────────────────────

const orchestratorRegistry = new Map<string, OrchestratorConfig>();

export function registerOrchestrator(config: OrchestratorConfig): void {
  orchestratorRegistry.set(config.name, config);
}

export function getOrchestrator(name: string): OrchestratorConfig | undefined {
  return orchestratorRegistry.get(name);
}

export function listOrchestrators(): Array<{
  name: string;
  description: string;
  agentCount: number;
  strategy: string;
}> {
  return Array.from(orchestratorRegistry.values()).map((o) => ({
    name: o.name,
    description: o.description,
    agentCount: o.agents.length,
    strategy: o.strategy,
  }));
}

// ─── Orchestrator Execution ─────────────────────────────────────────────────

/**
 * Execute an orchestrator workflow via the LangGraph StateGraph pipeline.
 *
 * All strategies (sequential, parallel, supervisor, conditional) are
 * handled by the unified graph in orchestrator-graph.ts. The graph
 * provides checkpointing, streaming, and consistent error handling.
 */
export async function runOrchestrator(
  orchestratorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  const config = orchestratorRegistry.get(orchestratorName);
  if (!config) {
    throw new Error(`Orchestrator not found: ${orchestratorName}`);
  }

  const start = Date.now();

  // Map OrchestratorConfig → OrchestratorGraphConfig
  const graphConfig: OrchestratorGraphConfig = {
    name: config.name,
    description: config.description,
    agents: config.agents,
    strategy: config.strategy === 'supervisor' ? 'conditional' : config.strategy,
    merger: config.merger
      ? (results: OrchestratorNodeResult[]) => {
          return config.merger!(results.map((r) => ({ agent: r.agent, output: r.output })));
        }
      : undefined,
    routeFn: config.routeFn,
  };

  const graphResult = await invokeOrchestratorGraph({
    config: graphConfig,
    input,
    ctx,
  });

  return {
    orchestrator: config.name,
    strategy: config.strategy,
    results: graphResult.results,
    mergedOutput: graphResult.mergedOutput ?? undefined,
    totalDurationMs: Date.now() - start,
  };
}

// ─── Built-in Orchestrators ─────────────────────────────────────────────────

/**
 * Register all built-in orchestrators.
 */
export function registerBuiltInOrchestrators(): void {
  // Register supervisors first
  registerClinicalSupervisor();
  registerOpsSupervisor();
  registerContentSupervisor();

  // Clinical encounter orchestrator (sequential)
  registerOrchestrator({
    name: 'clinical-encounter',
    description: 'Full clinical encounter: generate DDx, grade SOAP note, provide feedback',
    agents: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
    strategy: 'sequential',
  });

  // Diagnostic workup orchestrator (parallel)
  registerOrchestrator({
    name: 'diagnostic-workup',
    description: 'Run all diagnostic agents in parallel for comprehensive workup',
    agents: ['ddx-generator', 'diagnostic-workup-advisor'],
    strategy: 'parallel',
    merger: (results) => {
      const ddx = results.find((r) => r.agent === 'ddx-generator');
      const workup = results.find((r) => r.agent === 'diagnostic-workup-advisor');
      return {
        differentialDiagnosis: ddx?.output,
        recommendedWorkup: workup?.output,
        timestamp: new Date().toISOString(),
      };
    },
  });

  // Content audit orchestrator (broadcast)
  registerOrchestrator({
    name: 'content-audit-broadcast',
    description: 'Broadcast to all content agents and merge results',
    agents: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
    strategy: 'parallel',
    merger: (results) => ({
      diagnoses: results.find((r) => r.agent === 'ddx-generator')?.output,
      grading: results.find((r) => r.agent === 'soap-note-grader')?.output,
      feedback: results.find((r) => r.agent === 'feedback-summarizer')?.output,
    }),
  });

  // Ops orchestrator (supervisor → conditional)
  registerOrchestrator({
    name: 'ops-supervised',
    description: 'Route operational tasks to appropriate agent via supervisor',
    agents: ['call-gemini-auditor', 'prompt-contract-validator', 'schema-drift-detector', 'env-var-auditor'],
    strategy: 'supervisor',
    supervisorName: 'ops-supervisor',
  });
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Quick invocation of a clinical workflow.
 */
export async function runClinicalWorkflow(
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  return runOrchestrator('clinical-encounter', input, ctx);
}

/**
 * Quick invocation of a diagnostic workup.
 */
export async function runDiagnosticWorkup(
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  return runOrchestrator('diagnostic-workup', input, ctx);
}

/**
 * Quick invocation of ops tasks.
 */
export async function runOpsTask(
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  return runOrchestrator('ops-supervised', input, ctx);
}
