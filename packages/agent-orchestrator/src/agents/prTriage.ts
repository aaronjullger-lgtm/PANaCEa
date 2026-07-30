/**
 * PR-triage agent — analyzes a GitHub PR's diff and posts a structured review.
 *
 * Inputs: PR number (CLI argv or server POST).
 * Outputs: GitHub PR review comment + optional Linear issue for follow-up bugs.
 *
 * @module packages/agent-orchestrator/src/agents/prTriage
 */

import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';
import { resolvePrompt } from '../clients/prompts.js';
import { PR_TRIAGE_SYSTEM_PROMPT } from '../clients/seedPrompts.js';

export { PR_TRIAGE_SYSTEM_PROMPT };

const role: AgentRole = 'pr-triage';
const PROMPT_NAME = 'panacea-pr-triage';

export function buildPRTriageAgent(opts: { model?: string } = {}): Promise<CompiledAgent> {
  return resolvePrompt(PROMPT_NAME).then((systemPrompt) =>
    buildAgent({
      role,
      tools: toolsForRole(role),
      systemPrompt,
      traceName: 'panacea:pr-triage',
      tags: ['panacea', 'github', 'pr-triage'],
      model: opts.model,
      recursionLimit: 18,
    }),
  );
}

export const PR_TRIAGE_ROLE = role;