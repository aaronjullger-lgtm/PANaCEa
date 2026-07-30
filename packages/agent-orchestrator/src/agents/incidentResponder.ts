/**
 * Incident-responder agent — reads Sentry issues, triages severity, files
 * Linear issues, and (optionally) triggers an n8n on-call workflow.
 *
 * Inputs: time window / query string (default: latest unresolved).
 * Outputs: Linear issues for actionable incidents + a triage summary.
 *
 * @module packages/agent-orchestrator/src/agents/incidentResponder
 */

import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';
import { resolvePrompt } from '../clients/prompts.js';
import { INCIDENT_RESPONDER_SYSTEM_PROMPT } from '../clients/seedPrompts.js';

export { INCIDENT_RESPONDER_SYSTEM_PROMPT };

const role: AgentRole = 'incident-responder';
const PROMPT_NAME = 'panacea-incident-responder';

export function buildIncidentResponderAgent(opts: { model?: string } = {}): Promise<CompiledAgent> {
  return resolvePrompt(PROMPT_NAME).then((systemPrompt) =>
    buildAgent({
      role,
      tools: toolsForRole(role),
      systemPrompt,
      traceName: 'panacea:incident-responder',
      tags: ['panacea', 'sentry', 'incident'],
      model: opts.model,
      recursionLimit: 20,
    }),
  );
}

export const INCIDENT_RESPONDER_ROLE = role;