/**
 * PANaCEa Agent Framework — public surface
 *
 * Import from this file in consumers:
 *
 *   import { runAgent, createDefaultToolRegistry } from '@/lib/services/agents';
 */

export * from './types';
export {
  defineTool,
  ToolRegistry,
  buildFunctionDeclarations,
} from './toolRegistry';
export { runAgent, type RunAgentArgs } from './agentRunner';
export {
  CLINICAL_STUDY_AGENT_PROMPT,
  CLINICAL_STUDY_AGENT_PROMPT_COMPACT,
  buildUserContextAddendum,
} from './prompts';
export {
  parseGeminiTurn,
  runAgentTurn,
  buildFunctionResponseTurn,
  type ParsedTurn,
  type AgentContent,
  type AgentTurnContext,
  type AgentTurnRequest,
  type GeminiPart,
} from './geminiAgentClient';
export {
  createDefaultToolRegistry,
  DEFAULT_TOOL_NAMES,
  clinicalLibrarySearchTool,
  userProgressSummaryTool,
  fsrsDueCountTool,
} from './tools';
export { logAgentTelemetry, summarizeTelemetry } from './telemetry';
export type { AgentTelemetryEntry } from './telemetry';
