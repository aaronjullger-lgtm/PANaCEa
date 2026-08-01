/**
 * Central agent registry.
 *
 * Importing this module side-effect-imports every agent definition so they
 * self-register at load time. Callers do
 * `import { listAgents, invokeAgent } from '@/lib/agents/registry'` and get
 * the full menu without referencing individual agent modules.
 *
 * @module lib/agents/registry
 */

import {
  listAgents,
  invokeAgent,
  getAgent,
  clearRegistryForTests,
} from './shared/runtime';

import './encounter/standardizedPatient';
import './encounter/intentRouter';
import './encounter/spbenchGrader';
import './encounter/ddxGenerator';
import './encounter/diagnosticWorkupAdvisor';
import './encounter/feedbackSummarizer';
import './encounter/soapNoteGrader';
import './ops/callGeminiAuditor';
import './ops/promptContractValidator';
import './ops/schemaDriftDetector';
import './ops/envVarAuditor';

// Side-effect import: registers preceptor-pimping (tutor-intent target for user-supervisor-v2)
import './graphs/preceptor';

import { registerBuiltInOrchestrators } from './orchestrator';
import { registerAllSupervisorsV2 } from './supervisor-v2';
import { registerUserSupervisorV2 } from './userSupervisor';
import { registerBuiltInSkills } from './deep-agents';
import { configureBridge } from './bridge';

registerBuiltInOrchestrators();
registerAllSupervisorsV2();
registerUserSupervisorV2();
registerBuiltInSkills();

// Auto-configure bridge from env if orchestrator URL is available
// In Edge runtime, this reads from context.env; in Node, from process.env
try {
  const orchestratorUrl = typeof process !== 'undefined'
    ? process.env.AGENT_ORCHESTRATOR_URL
    : undefined;

  if (orchestratorUrl) {
    configureBridge({
      orchestratorBaseUrl: orchestratorUrl,
      enabled: true,
      timeoutMs: 10_000,
    });
  }
} catch {
  // process.env not available in Edge runtime — bridge configured via
  // configureBridge() called from the health-check endpoint instead
}

export { listAgents, invokeAgent, getAgent, clearRegistryForTests };
export { registerBuiltInOrchestrators, runOrchestrator, listOrchestrators } from './orchestrator';

// V2 Supervisor (LLM-powered routing)
export {
  registerSupervisorV2,
  runSupervisorV2,
  runBroadcastSupervisorV2,
  listSupervisorsV2,
  registerAllSupervisorsV2,
} from './supervisor-v2';
export type { SupervisorV2Config, SupervisorV2Result } from './supervisor-v2';

// User Supervisor (student-facing intent routing)
export {
  registerUserSupervisorV2,
  routeUserIntent,
  runUserSupervisor,
  classifyUserIntent,
  userIntentKeywordRouter,
  buildUserRouterConfig,
  USER_INTENTS,
  USER_INTENT_AGENTS,
} from './userSupervisor';
export type { UserIntent, UserRoutingDecision, UserSupervisorResult } from './userSupervisor';

// LLM Router
export {
  routeWithLLM,
  routeWithContext,
  routeBatchWithLLM,
  buildRouterConfigFromRegistry,
} from './router/llmRouter';
export type { LLMRouterConfig, AgentRoutingDecision } from './router/llmRouter';

// Subagent Delegation
export {
  delegateToSubagents,
  delegateSequential,
  runClinicalEncounterSubagents,
  runDiagnosticWorkupSubagents,
  runOpsAuditSubagents,
} from './subagent';
export type { SubagentConfig, SubagentResult, SubagentDelegationResult } from './subagent';

// Observability
export {
  withTracing,
  createOrchestratorTrace,
  createSupervisorTrace,
  createSubagentTrace,
  agentMetrics,
} from './observability';
export type { AgentTraceConfig, AgentTraceSpan, AgentMetrics } from './observability';

// Agent Protocol Types
export * from './protocol';

export type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
  AgentTier,
} from './shared/types';
