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

import { registerBuiltInOrchestrators } from './orchestrator';

registerBuiltInOrchestrators();

export { listAgents, invokeAgent, getAgent, clearRegistryForTests };
export { registerBuiltInOrchestrators, runOrchestrator, listOrchestrators } from './orchestrator';
export type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
  AgentTier,
} from './shared/types';
