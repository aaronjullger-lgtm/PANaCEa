/**
 * Edge Agent Supervisor
 *
 * Coordinates multiple Edge-side agents using LangGraph patterns.
 * Extends the @langchain/langgraph-supervisor pattern for Edge runtime.
 *
 * @module lib/agents/supervisor
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './shared/types';
import { getAgent, listAgents } from './shared/runtime';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SupervisorConfig {
  name: string;
  description: string;
  agentNames: string[];
  /** Routing logic: given input + agent list, return which agent to invoke */
  router: (input: unknown, agents: string[]) => string | null;
  /** Optional: merge outputs from multiple agents */
  merger?: (outputs: Array<{ agent: string; output: unknown }>) => unknown;
}

export interface SupervisorResult {
  supervisor: string;
  routedTo: string;
  output: unknown;
  allResults: Array<{ agent: string; status: 'ok' | 'error'; output: unknown }>;
  durationMs: number;
}

// ─── Supervisor Registry ────────────────────────────────────────────────────

const supervisorRegistry = new Map<string, SupervisorConfig>();

export function registerSupervisor(config: SupervisorConfig): void {
  supervisorRegistry.set(config.name, config);
}

export function getSupervisor(name: string): SupervisorConfig | undefined {
  return supervisorRegistry.get(name);
}

export function listSupervisors(): Array<{
  name: string;
  description: string;
  agentCount: number;
}> {
  return Array.from(supervisorRegistry.values()).map((s) => ({
    name: s.name,
    description: s.description,
    agentCount: s.agentNames.length,
  }));
}

// ─── Supervisor Execution ───────────────────────────────────────────────────

/**
 * Execute a supervisor workflow: route to one or more agents based on config.
 */
export async function runSupervisor(
  supervisorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<SupervisorResult> {
  const config = supervisorRegistry.get(supervisorName);
  if (!config) {
    throw new Error(`Supervisor not found: ${supervisorName}`);
  }

  const start = Date.now();

  // Route to agent(s)
  const targetAgent = config.router(input, config.agentNames);

  if (!targetAgent) {
    return {
      supervisor: supervisorName,
      routedTo: 'none',
      output: null,
      allResults: [],
      durationMs: Date.now() - start,
    };
  }

  // Invoke the target agent
  const agent = getAgent(targetAgent);
  if (!agent) {
    return {
      supervisor: supervisorName,
      routedTo: targetAgent,
      output: null,
      allResults: [{
        agent: targetAgent,
        status: 'error',
        output: { error: `Agent not found: ${targetAgent}` },
      }],
      durationMs: Date.now() - start,
    };
  }

  const result = await agent.invoke(input, ctx);

  return {
    supervisor: supervisorName,
    routedTo: targetAgent,
    output: result.output,
    allResults: [{
      agent: targetAgent,
      status: result.status === 'ok' ? 'ok' : 'error',
      output: result.output,
    }],
    durationMs: Date.now() - start,
  };
}

/**
 * Execute a supervisor that runs ALL agents and merges their outputs.
 */
export async function runBroadcastSupervisor(
  supervisorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<SupervisorResult> {
  const config = supervisorRegistry.get(supervisorName);
  if (!config) {
    throw new Error(`Supervisor not found: ${supervisorName}`);
  }

  const start = Date.now();
  const allResults: SupervisorResult['allResults'] = [];

  // Invoke all agents in parallel
  const promises = config.agentNames.map(async (agentName) => {
    const agent = getAgent(agentName);
    if (!agent) {
      return { agent: agentName, status: 'error' as const, output: { error: `Agent not found: ${agentName}` } };
    }

    const result = await agent.invoke(input, ctx);
    return {
      agent: agentName,
      status: result.status === 'ok' ? 'ok' as const : 'error' as const,
      output: result.output,
    };
  });

  const results = await Promise.all(promises);
  allResults.push(...results);

  // Merge outputs if merger is provided
  const mergedOutput = config.merger
    ? config.merger(results.map((r) => ({ agent: r.agent, output: r.output })))
    : results.map((r) => ({ agent: r.agent, output: r.output }));

  return {
    supervisor: supervisorName,
    routedTo: 'broadcast',
    output: mergedOutput,
    allResults,
    durationMs: Date.now() - start,
  };
}

// ─── Built-in Supervisors ───────────────────────────────────────────────────

/**
 * Clinical Supervisor: routes clinical encounter agents based on input type.
 */
export function registerClinicalSupervisor(): void {
  registerSupervisor({
    name: 'clinical-supervisor',
    description: 'Routes clinical encounters to the appropriate agent based on input type',
    agentNames: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer', 'diagnostic-workup-advisor'],
    router: (input, agents) => {
      const inputStr = JSON.stringify(input).toLowerCase();

      if (inputStr.includes('diagnosis') || inputStr.includes('ddx') || inputStr.includes('differential')) {
        return agents.includes('ddx-generator') ? 'ddx-generator' : null;
      }
      if (inputStr.includes('soap') || inputStr.includes('note') || inputStr.includes('grading')) {
        return agents.includes('soap-note-grader') ? 'soap-note-grader' : null;
      }
      if (inputStr.includes('feedback') || inputStr.includes('summary') || inputStr.includes('review')) {
        return agents.includes('feedback-summarizer') ? 'feedback-summarizer' : null;
      }
      if (inputStr.includes('workup') || inputStr.includes('diagnostic') || inputStr.includes('test')) {
        return agents.includes('diagnostic-workup-advisor') ? 'diagnostic-workup-advisor' : null;
      }

      // Default to ddx-generator
      return agents.includes('ddx-generator') ? 'ddx-generator' : null;
    },
  });
}

/**
 * Ops Supervisor: routes operational agents based on input type.
 */
export function registerOpsSupervisor(): void {
  registerSupervisor({
    name: 'ops-supervisor',
    description: 'Routes operational tasks to the appropriate agent',
    agentNames: ['call-gemini-auditor', 'prompt-contract-validator', 'schema-drift-detector', 'env-var-auditor'],
    router: (input, agents) => {
      const inputStr = JSON.stringify(input).toLowerCase();

      if (inputStr.includes('gemini') || inputStr.includes('api') || inputStr.includes('audit')) {
        return agents.includes('call-gemini-auditor') ? 'call-gemini-auditor' : null;
      }
      if (inputStr.includes('prompt') || inputStr.includes('contract') || inputStr.includes('validation')) {
        return agents.includes('prompt-contract-validator') ? 'prompt-contract-validator' : null;
      }
      if (inputStr.includes('schema') || inputStr.includes('drift') || inputStr.includes('migration')) {
        return agents.includes('schema-drift-detector') ? 'schema-drift-detector' : null;
      }
      if (inputStr.includes('env') || inputStr.includes('environment') || inputStr.includes('config')) {
        return agents.includes('env-var-auditor') ? 'env-var-auditor' : null;
      }

      return null;
    },
  });
}

/**
 * Content Supervisor: broadcasts to all content-related agents and merges results.
 */
export function registerContentSupervisor(): void {
  registerSupervisor({
    name: 'content-supervisor',
    description: 'Runs all content agents and merges their outputs',
    agentNames: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer'],
    router: () => 'broadcast',
    merger: (outputs) => {
      const ddx = outputs.find((o) => o.agent === 'ddx-generator');
      const soap = outputs.find((o) => o.agent === 'soap-note-grader');
      const feedback = outputs.find((o) => o.agent === 'feedback-summarizer');

      return {
        diagnosis: ddx?.output,
        grading: soap?.output,
        feedback: feedback?.output,
        timestamp: new Date().toISOString(),
      };
    },
  });
}
