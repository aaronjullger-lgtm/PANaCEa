/**
 * Public entrypoint for @panacea/agent-orchestrator.
 *
 * Imports of this package should go through here so internal restructuring never
 * breaks downstream consumers (the CLI, the dashboard, tests, future cron jobs).
 *
 * @module @panacea/agent-orchestrator
 */

export * from './config/env.js';
export * from './clients/tracing.js';
export * from './clients/llm.js';
export * from './clients/qdrant.js';
export * from './clients/linear.js';
export * from './clients/github.js';
export * from './clients/sentry.js';
export * from './clients/integrations.js';
export * from './tools/index.js';
export {
  panaceaToolToLangChain,
  panaceaToolsToLangChain,
  mergeTools,
  type PanaceaToolDefinition,
  type AnyPanaceaTool,
  type ToolExecutionContext as PanaceaToolContext,
} from './tools/from-registry.js';
export * from './orchestrator/factory.js';
export * from './orchestrator/subAgentBuilder.js';
// Both modules export finalResponse (subAgentBuilder mirrors factory); the
// explicit re-export resolves the star-export ambiguity (TS2308).
export { finalResponse } from './orchestrator/factory.js';
export * from './agents/registry.js';
export { buildContentAuditAgent, CONTENT_AUDIT_SYSTEM_PROMPT, CONTENT_AUDIT_ROLE } from './agents/contentAudit.js';
export { buildPRTriageAgent, PR_TRIAGE_SYSTEM_PROMPT, PR_TRIAGE_ROLE } from './agents/prTriage.js';
export { buildIncidentResponderAgent, INCIDENT_RESPONDER_SYSTEM_PROMPT, INCIDENT_RESPONDER_ROLE } from './agents/incidentResponder.js';
export { buildContentEnrichmentAgent, CONTENT_ENRICHMENT_SYSTEM_PROMPT, CONTENT_ENRICHMENT_ROLE } from './agents/contentEnrichment.js';
export { buildWeeklyReportAgent, WEEKLY_REPORT_SYSTEM_PROMPT, WEEKLY_REPORT_ROLE } from './agents/weeklyReport.js';