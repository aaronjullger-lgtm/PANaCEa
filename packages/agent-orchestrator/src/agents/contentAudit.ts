/**
 * Content-audit agent — runs the StudyPANaCEa daily content audit logic and
 * files Linear issues for any surfaced content gaps or quality regressions.
 *
 * Inputs (from CLI / server): latest audit summary JSON (mock in smoke mode).
 * Outputs: Linear issues filed + decision remembered to Qdrant.
 *
 * @module packages/agent-orchestrator/src/agents/contentAudit
 */

import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';
import { resolvePrompt } from '../clients/prompts.js';
import { CONTENT_AUDIT_SYSTEM_PROMPT } from '../clients/seedPrompts.js';

export { CONTENT_AUDIT_SYSTEM_PROMPT };

const role: AgentRole = 'content-audit';
const PROMPT_NAME = 'panacea-content-audit';

export interface BuildContentAuditOptions {
  /** Override the default LLM model for this agent. */
  model?: string;
}

export function buildContentAuditAgent(opts: BuildContentAuditOptions = {}): Promise<CompiledAgent> {
  return resolvePrompt(PROMPT_NAME).then((systemPrompt) =>
    buildAgent({
      role,
      tools: toolsForRole(role),
      systemPrompt,
      traceName: 'panacea:content-audit',
      tags: ['panacea', 'content', 'audit'],
      model: opts.model,
      recursionLimit: 15,
    }),
  );
}

export const CONTENT_AUDIT_ROLE = role;