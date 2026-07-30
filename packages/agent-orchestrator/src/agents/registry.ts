/**
 * Agent registry — single source of truth mapping role → builder + metadata.
 *
 * The CLI, server, and dashboard all import from here so adding a new agent is
 * a one-line registration + a system prompt, not edits across N surfaces.
 *
 * @module packages/agent-orchestrator/src/agents/registry
 */

import type { AgentRole } from '../tools/index.js';
import type { CompiledAgent } from '../orchestrator/factory.js';
import { buildContentAuditAgent, CONTENT_AUDIT_ROLE } from './contentAudit.js';
import { buildPRTriageAgent, PR_TRIAGE_ROLE } from './prTriage.js';
import { buildIncidentResponderAgent, INCIDENT_RESPONDER_ROLE } from './incidentResponder.js';
import { buildContentEnrichmentAgent, CONTENT_ENRICHMENT_ROLE } from './contentEnrichment.js';
import { buildWeeklyReportAgent, WEEKLY_REPORT_ROLE } from './weeklyReport.js';
import { buildWeeklyReportSupervisor, SUPERVISOR_ROLE } from './weeklyReportSupervisor.js';

export interface AgentDef {
  role: AgentRole;
  name: string;
  description: string;
  /** Default input shape hints (used by the dashboard UI). */
  inputHint: string;
  build: (opts: { model?: string }) => Promise<CompiledAgent>;
}

export const AGENT_REGISTRY: Record<AgentRole, AgentDef> = {
  'content-audit': {
    role: CONTENT_AUDIT_ROLE,
    name: 'Content Audit',
    description: 'Reviews the daily content-audit summary and files Linear issues for actionable findings.',
    inputHint: 'Audit summary JSON (findings array). Omit for smoke mode (mock data).',
    build: (opts) => buildContentAuditAgent(opts),
  },
  'pr-triage': {
    role: PR_TRIAGE_ROLE,
    name: 'PR Triage',
    description: 'Analyzes a GitHub PR diff and posts a structured review with approved/comment/request-changes.',
    inputHint: 'PR number (e.g. 1234).',
    build: (opts) => buildPRTriageAgent(opts),
  },
  'incident-responder': {
    role: INCIDENT_RESPONDER_ROLE,
    name: 'Incident Responder',
    description: 'Pulls Sentry issues, triages by severity, files Linear issues, (optionally) triggers n8n on-call.',
    inputHint: 'Optional Sentry query string. Defaults to is:unresolved.',
    build: (opts) => buildIncidentResponderAgent(opts),
  },
  'content-enrichment': {
    role: CONTENT_ENRICHMENT_ROLE,
    name: 'Content Enrichment',
    description: 'Proposes structured enrichment candidates for a condition from a provided source + memory.',
    inputHint: 'Free-text brief: condition name + new guideline/source URL.',
    build: (opts) => buildContentEnrichmentAgent(opts),
  },
  'weekly-report': {
    role: WEEKLY_REPORT_ROLE,
    name: 'Weekly Report',
    description: 'Aggregates the week\'s agent runs + Linear + Sentry into a digest for the repo owner.',
    inputHint: 'Optional ISO week range (YYYY-Www). Defaults to current week.',
    build: (opts) => buildWeeklyReportAgent(opts),
  },
  'weekly-report-supervisor': {
    role: SUPERVISOR_ROLE,
    name: 'Weekly Report (Supervisor)',
    description: 'Multi-agent supervisor that delegates to incident-responder + content-audit sub-agents, then synthesizes the digest.',
    inputHint: 'Optional ISO week range (YYYY-Www). Defaults to current week.',
    build: (opts) => buildWeeklyReportSupervisor(opts),
  },
};

export const ALL_ROLES = Object.keys(AGENT_REGISTRY) as AgentRole[];

export function describeAgents(): Array<{ role: AgentRole; name: string; description: string; inputHint: string }> {
  return ALL_ROLES.map((r) => ({
    role: r,
    name: AGENT_REGISTRY[r].name,
    description: AGENT_REGISTRY[r].description,
    inputHint: AGENT_REGISTRY[r].inputHint,
  }));
}