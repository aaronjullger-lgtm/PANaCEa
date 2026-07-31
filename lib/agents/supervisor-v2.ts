/**
 * Upgraded Agent Supervisor with LLM-Powered Routing
 *
 * Extends the original keyword-based supervisor with semantic intent classification.
 * Falls back to keyword routing when LLM routing is unavailable (no API keys).
 *
 * Key improvements:
 * - LLM-based intent classification for accurate agent selection
 * - Confidence scoring with fallback chains
 * - Multi-agent dispatch for complex queries
 * - Graceful degradation to keyword routing
 * - Full observability via LangSmith tracing
 *
 * @module lib/agents/supervisor-v2
 */

import type { AgentContext } from './shared/types';
import { getAgent, listAgents } from './shared/runtime';
import {
  routeWithLLM,
  routeWithContext,
  buildRouterConfigFromRegistry,
  type LLMRouterConfig,
  type AgentRoutingDecision,
} from './router/llmRouter';
import { isModelAvailable } from '@/lib/langchain/models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SupervisorV2Config {
  name: string;
  description: string;
  /** Agent names this supervisor can route to */
  agentNames: string[];
  /** LLM router configuration */
  routerConfig?: Partial<LLMRouterConfig>;
  /** Fallback keyword-based router (used when LLM is unavailable) */
  keywordRouter?: (input: unknown, agents: string[]) => string | null;
  /** Optional: merge outputs from multiple agents */
  merger?: (outputs: Array<{ agent: string; output: unknown }>) => unknown;
  /** Whether to prefer LLM routing (default: true) */
  preferLLM?: boolean;
}

export interface SupervisorV2Result {
  supervisor: string;
  routedTo: string | string[];
  output: unknown;
  allResults: Array<{ agent: string; status: 'ok' | 'error'; output: unknown; durationMs: number }>;
  routingDecision?: AgentRoutingDecision;
  routingMethod: 'llm' | 'keyword' | 'fallback';
  durationMs: number;
  traceId?: string;
}

// ─── Supervisor V2 Registry ────────────────────────────────────────────────

const supervisorV2Registry = new Map<string, SupervisorV2Config>();

export function registerSupervisorV2(config: SupervisorV2Config): void {
  supervisorV2Registry.set(config.name, config);
}

export function getSupervisorV2(name: string): SupervisorV2Config | undefined {
  return supervisorV2Registry.get(name);
}

export function listSupervisorsV2(): Array<{
  name: string;
  description: string;
  agentCount: number;
  routingMethod: string;
}> {
  return Array.from(supervisorV2Registry.values()).map((s) => ({
    name: s.name,
    description: s.description,
    agentCount: s.agentNames.length,
    routingMethod: s.preferLLM !== false ? 'llm-primary' : 'keyword',
  }));
}

// ─── Supervisor V2 Execution ───────────────────────────────────────────────

/**
 * Execute a supervisor V2 workflow with LLM-powered routing.
 * Falls back to keyword routing when LLM is unavailable.
 */
export async function runSupervisorV2(
  supervisorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<SupervisorV2Result> {
  const config = supervisorV2Registry.get(supervisorName);
  if (!config) {
    throw new Error(`Supervisor V2 not found: ${supervisorName}`);
  }

  const start = Date.now();
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

  // Determine routing method
  const useLLM = config.preferLLM !== false && isModelAvailable('gemini-2.0-flash', ctx.env);

  let routingDecision: AgentRoutingDecision | undefined;
  let routingMethod: SupervisorV2Result['routingMethod'] = 'fallback';
  let targetAgents: string[] = [];

  if (useLLM) {
    try {
      // Build router config from agent registry
      const allAgents = listAgents();
      const agents = allAgents.filter((a: { name: string; description: string; tier: string }) => config.agentNames.includes(a.name));
      const routerConfig = buildRouterConfigFromRegistry(agents, {
        minConfidence: 0.3,
        defaultAgent: config.agentNames[0],
        ...config.routerConfig,
      });

      routingDecision = await routeWithContext(inputStr, routerConfig, ctx);
      routingMethod = 'llm';

      // Determine target agents
      if (routingDecision.requiresMultiAgent && routingDecision.agentSequence) {
        targetAgents = routingDecision.agentSequence.filter((a: string) => config.agentNames.includes(a));
      } else {
        targetAgents = [routingDecision.agent];
      }

      // Validate at least one agent was selected
      if (targetAgents.length === 0) {
        targetAgents = [config.agentNames[0]!];
        routingMethod = 'fallback';
      }
    } catch {
      // LLM routing failed — fall through to keyword
      routingMethod = 'fallback';
    }
  }

  // Fallback to keyword routing
  if (routingMethod === 'fallback') {
    if (config.keywordRouter) {
      const keywordTarget = config.keywordRouter(input, config.agentNames);
      if (keywordTarget) {
        targetAgents = [keywordTarget];
        routingMethod = 'keyword';
      }
    }

    // Last resort: use first agent
    if (targetAgents.length === 0 && config.agentNames[0]) {
      targetAgents = [config.agentNames[0]];
    }
  }

  // Execute agents
  const allResults: SupervisorV2Result['allResults'] = [];

  if (targetAgents.length === 1) {
    // Single agent — invoke directly
    const agentName = targetAgents[0]!;
    const agentStart = Date.now();
    const agent = getAgent(agentName);

    if (!agent) {
      allResults.push({
        agent: agentName,
        status: 'error',
        output: { error: `Agent not found: ${agentName}` },
        durationMs: Date.now() - agentStart,
      });
    } else {
      const result = await agent.invoke(input, ctx);
      allResults.push({
        agent: agentName,
        status: result.status === 'ok' ? 'ok' : 'error',
        output: result.output,
        durationMs: Date.now() - agentStart,
      });
    }
  } else {
    // Multiple agents — invoke in parallel
    const promises = targetAgents.map(async (agentName) => {
      const agentStart = Date.now();
      const agent = getAgent(agentName);

      if (!agent) {
        return {
          agent: agentName,
          status: 'error' as const,
          output: { error: `Agent not found: ${agentName}` },
          durationMs: Date.now() - agentStart,
        };
      }

      const result = await agent.invoke(input, ctx);
      return {
        agent: agentName,
        status: result.status === 'ok' ? 'ok' as const : 'error' as const,
        output: result.output,
        durationMs: Date.now() - agentStart,
      };
    });

    const results = await Promise.all(promises);
    allResults.push(...results);
  }

  // Merge outputs
  const mergedOutput = config.merger
    ? config.merger(allResults.map((r) => ({ agent: r.agent, output: r.output })))
    : allResults.length === 1
      ? allResults[0]?.output
      : allResults.map((r) => ({ agent: r.agent, output: r.output }));

  return {
    supervisor: supervisorName,
    routedTo: targetAgents.length === 1 ? targetAgents[0]! : targetAgents,
    output: mergedOutput,
    allResults,
    routingDecision,
    routingMethod,
    durationMs: Date.now() - start,
  };
}

/**
 * Execute a supervisor V2 that runs ALL agents and merges their outputs.
 */
export async function runBroadcastSupervisorV2(
  supervisorName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<SupervisorV2Result> {
  const config = supervisorV2Registry.get(supervisorName);
  if (!config) {
    throw new Error(`Supervisor V2 not found: ${supervisorName}`);
  }

  const start = Date.now();
  const allResults: SupervisorV2Result['allResults'] = [];

  // Invoke all agents in parallel
  const promises = config.agentNames.map(async (agentName) => {
    const agentStart = Date.now();
    const agent = getAgent(agentName);

    if (!agent) {
      return {
        agent: agentName,
        status: 'error' as const,
        output: { error: `Agent not found: ${agentName}` },
        durationMs: Date.now() - agentStart,
      };
    }

    const result = await agent.invoke(input, ctx);
    return {
      agent: agentName,
      status: result.status === 'ok' ? 'ok' as const : 'error' as const,
      output: result.output,
      durationMs: Date.now() - agentStart,
    };
  });

  const results = await Promise.all(promises);
  allResults.push(...results);

  // Merge outputs
  const mergedOutput = config.merger
    ? config.merger(results.map((r) => ({ agent: r.agent, output: r.output })))
    : results.map((r) => ({ agent: r.agent, output: r.output }));

  return {
    supervisor: supervisorName,
    routedTo: config.agentNames,
    output: mergedOutput,
    allResults,
    routingMethod: 'keyword',
    durationMs: Date.now() - start,
  };
}

// ─── Built-in Supervisor V2 Registrations ──────────────────────────────────

/**
 * Register the clinical supervisor with LLM-powered routing.
 */
export function registerClinicalSupervisorV2(): void {
  registerSupervisorV2({
    name: 'clinical-supervisor-v2',
    description: 'LLM-powered clinical encounter router — understands medical context',
    agentNames: [
      'ddx-generator',
      'soap-note-grader',
      'feedback-summarizer',
      'diagnostic-workup-advisor',
      'standardized-patient',
      'intent-router',
    ],
    preferLLM: true,
    keywordRouter: (input, agents) => {
      // Fallback keyword router
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
      if (inputStr.includes('patient') || inputStr.includes('history') || inputStr.includes('exam')) {
        return agents.includes('standardized-patient') ? 'standardized-patient' : null;
      }
      return agents.includes('ddx-generator') ? 'ddx-generator' : null;
    },
  });
}

/**
 * Register the ops supervisor with LLM-powered routing.
 */
export function registerOpsSupervisorV2(): void {
  registerSupervisorV2({
    name: 'ops-supervisor-v2',
    description: 'LLM-powered ops task router — understands infrastructure context',
    agentNames: [
      'call-gemini-auditor',
      'prompt-contract-validator',
      'schema-drift-detector',
      'env-var-auditor',
    ],
    preferLLM: true,
    keywordRouter: (input, agents) => {
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
 * Register all built-in supervisor V2 instances.
 */
export function registerAllSupervisorsV2(): void {
  registerClinicalSupervisorV2();
  registerOpsSupervisorV2();
}
