/**
 * Encounter-only agent registry — PRODUCTION SAFE.
 *
 * Imports ONLY encounter-tier agents. No ops-tier module is loaded, so no
 * Node-only `fs`/`path`/`process.cwd()` code enters the Cloudflare edge
 * bundle. This is the registry that `functions/api/agents/invoke.ts` and
 * any other production endpoint MUST import.
 *
 * For scripts/CI that need the ops-tier agents, import `@/lib/agents/registry`
 * (the full registry) instead.
 *
 * @module lib/agents/registry.encounter
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
import './graphs/preceptor';

export { listAgents, invokeAgent, getAgent, clearRegistryForTests };
export type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
  AgentTier,
} from './shared/types';