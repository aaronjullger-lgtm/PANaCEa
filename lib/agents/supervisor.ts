/**
 * Edge Agent Supervisor
 *
 * Coordinates multiple Edge-side agents using LangGraph patterns.
 * Extends the @langchain/langgraph-supervisor pattern for Edge runtime.
 *
 * Supports both synchronous keyword-based routing and asynchronous
 * LLM-based semantic routing via `supervisor-llm.ts`.
 *
 * @module lib/agents/supervisor
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './shared/types';
import { getAgent, listAgents } from './shared/runtime';
import type { AIEnvKeys } from '@/lib/langchain/models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SupervisorConfig {
  name: string;
  description: string;
  agentNames: string[];
  /**
   * Routing logic: given input + agent list, return which agent to invoke.
   *
   * Supports both sync (keyword-based) and async (LLM-based) routers.
   * - Sync: `(input, agents) => 'ddx-generator'`
   * - Async: `async (input, agents, env) => 'ddx-generator'`
   *
   * Return 'broadcast' to invoke all agents in parallel.
   * Return null if no agent matches.
   */
  router: (
    input: unknown,
    agents: string[],
    env?: AIEnvKeys,
  ) => string | null | Promise<string | null>;
  /** Optional: merge outputs from multiple agents (used with 'broadcast' routing) */
  merger?: (outputs: Array<{ agent: string; output: unknown }>) => unknown;
  /** Optional: agent descriptions for LLM-based routing */
  agentDescriptions?: Record<string, string>;
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

  const targetAgent = await Promise.resolve(config.router(input, config.agentNames, ctx.env));

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

import { createSupervisorRouter } from './supervisor-llm';

const CLINICAL_AGENT_DESCRIPTIONS: Record<string, string> = {
  'ddx-generator': 'Generates differential diagnoses from clinical presentations, symptoms, and patient history',
  'soap-note-grader': 'Grades SOAP notes for clinical accuracy, completeness, and proper medical documentation',
  'feedback-summarizer': 'Summarizes clinical performance feedback into actionable improvement insights',
  'diagnostic-workup-advisor': 'Recommends diagnostic tests, labs, and imaging based on clinical presentations',
};

const OPS_AGENT_DESCRIPTIONS: Record<string, string> = {
  'call-gemini-auditor': 'Audits Gemini API calls for correctness, cost, and response quality',
  'prompt-contract-validator': 'Validates AI prompt templates against defined contracts and schemas',
  'schema-drift-detector': 'Detects database schema drift between Prisma schema and actual database state',
  'env-var-auditor': 'Audits environment variables for missing, misconfigured, or insecure settings',
};

/**
 * Clinical Supervisor: routes clinical encounter agents using LLM intent
 * classification with keyword fallback.
 */
export function registerClinicalSupervisor(): void {
  const llmRouter = createSupervisorRouter({
    agentNames: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer', 'diagnostic-workup-advisor'],
    agentDescriptions: CLINICAL_AGENT_DESCRIPTIONS,
    domain: 'clinical',
  });

  registerSupervisor({
    name: 'clinical-supervisor',
    description: 'Routes clinical encounters to the appropriate agent using LLM intent classification with keyword fallback',
    agentNames: ['ddx-generator', 'soap-note-grader', 'feedback-summarizer', 'diagnostic-workup-advisor'],
    agentDescriptions: CLINICAL_AGENT_DESCRIPTIONS,
    router: async (input, agents, env) => {
      // Try LLM routing when env is available
      if (env?.GEMINI_API_KEY || env?.DEEPSEEK_API_KEY || env?.OPENAI_API_KEY) {
        const llmResult = await llmRouter(input, agents, env!);
        if (llmResult) return llmResult;
      }

      // Keyword fallback
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
      return agents.includes('ddx-generator') ? 'ddx-generator' : null;
    },
  });
}

/**
 * Ops Supervisor: routes operational agents using LLM intent classification
 * with keyword fallback.
 */
export function registerOpsSupervisor(): void {
  const llmRouter = createSupervisorRouter({
    agentNames: ['call-gemini-auditor', 'prompt-contract-validator', 'schema-drift-detector', 'env-var-auditor'],
    agentDescriptions: OPS_AGENT_DESCRIPTIONS,
    domain: 'operations',
  });

  registerSupervisor({
    name: 'ops-supervisor',
    description: 'Routes operational tasks to the appropriate agent using LLM intent classification with keyword fallback',
    agentNames: ['call-gemini-auditor', 'prompt-contract-validator', 'schema-drift-detector', 'env-var-auditor'],
    agentDescriptions: OPS_AGENT_DESCRIPTIONS,
    router: async (input, agents, env) => {
      if (env?.GEMINI_API_KEY || env?.DEEPSEEK_API_KEY || env?.OPENAI_API_KEY) {
        const llmResult = await llmRouter(input, agents, env!);
        if (llmResult) return llmResult;
      }

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
