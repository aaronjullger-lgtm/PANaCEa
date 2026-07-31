/**
 * Agent Team Orchestrator
 *
 * Coordinates multi-agent workflows across Edge (lib/agents/) and Node
 * (packages/agent-orchestrator/) systems. Provides unified tracing,
 * error handling, and result aggregation.
 *
 * @module lib/agents/orchestrator
 */

import type { AgentContext, InvokeResult } from './shared/types';
import { invokeUnifiedAgent, createTeamWorkflow, runTeam, type TeamWorkflow, type TeamResult } from './unified';
import { runSupervisor, runBroadcastSupervisor, registerClinicalSupervisor, registerOpsSupervisor, registerContentSupervisor } from './supervisor';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  name: string;
  description: string;
  /** Agents to coordinate */
  agents: string[];
  /** Execution strategy: 'sequential' | 'parallel' | 'supervisor' */
  strategy: 'sequential' | 'parallel' | 'supervisor';
  /** Supervisor name if strategy is 'supervisor' */
  supervisorName?: string;
  /** Optional: custom merge function for parallel execution */
  merger?: (results: Array<{ agent: string; output: unknown }>) => unknown;
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
 * Execute an orchestrator workflow with full tracing.
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

  let result: OrchestratorResult;

  switch (config.strategy) {
    case 'sequential':
      result = await executeSequential(config, input, ctx);
      break;
    case 'parallel':
      result = await executeParallel(config, input, ctx);
      break;
    case 'supervisor':
      result = await executeSupervisor(config, input, ctx);
      break;
    default:
      throw new Error(`Unknown strategy: ${config.strategy}`);
  }

  result.totalDurationMs = Date.now() - start;
  return result;
}

/**
 * Sequential execution: agents run one after another.
 */
async function executeSequential(
  config: OrchestratorConfig,
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  const results: OrchestratorResult['results'] = [];
  let currentInput = input;

  for (const agentName of config.agents) {
    const agentStart = Date.now();

    const result = await invokeUnifiedAgent({
      name: agentName,
      input: currentInput,
      ctx,
      trace: {
        name: `orchestrator/${agentName}`,
        tags: ['sequential'],
      },
    });

    results.push({
      agent: agentName,
      status: result.status === 'ok' ? 'ok' : 'error',
      output: result.output,
      durationMs: Date.now() - agentStart,
    });

    // Pass output as input to next agent
    if (result.output) {
      currentInput = result.output;
    }

    // Stop on error
    if (result.status !== 'ok') {
      break;
    }
  }

  return {
    orchestrator: config.name,
    strategy: 'sequential',
    results,
    mergedOutput: results[results.length - 1]?.output,
    totalDurationMs: 0,
  };
}

/**
 * Parallel execution: agents run simultaneously.
 */
async function executeParallel(
  config: OrchestratorConfig,
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  const promises = config.agents.map(async (agentName) => {
    const agentStart = Date.now();

    const result = await invokeUnifiedAgent({
      name: agentName,
      input,
      ctx,
      trace: {
        name: `orchestrator/${agentName}`,
        tags: ['parallel'],
      },
    });

    return {
      agent: agentName,
      status: result.status === 'ok' ? 'ok' as const : 'error' as const,
      output: result.output,
      durationMs: Date.now() - agentStart,
    };
  });

  const results = await Promise.all(promises);

  // Merge outputs if merger is provided
  let mergedOutput: unknown;
  if (config.merger) {
    mergedOutput = config.merger(results.map((r) => ({ agent: r.agent, output: r.output })));
  } else {
    mergedOutput = results.map((r) => ({ agent: r.agent, output: r.output }));
  }

  return {
    orchestrator: config.name,
    strategy: 'parallel',
    results,
    mergedOutput,
    totalDurationMs: 0,
  };
}

/**
 * Supervisor execution: delegates to a registered supervisor.
 */
async function executeSupervisor(
  config: OrchestratorConfig,
  input: unknown,
  ctx: AgentContext,
): Promise<OrchestratorResult> {
  const supervisorName = config.supervisorName;
  if (!supervisorName) {
    throw new Error('supervisorName required for supervisor strategy');
  }

  const supervisorResult = await runSupervisor(supervisorName, input, ctx);

  return {
    orchestrator: config.name,
    strategy: 'supervisor',
    results: supervisorResult.allResults.map((r) => ({
      ...r,
      durationMs: 0,
    })),
    mergedOutput: supervisorResult.output,
    totalDurationMs: 0,
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

  // Ops orchestrator (supervisor)
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
