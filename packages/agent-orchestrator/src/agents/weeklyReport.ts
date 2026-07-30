/**
 * Weekly-report agent — aggregates the week's agent runs (Qdrant memory),
 * open Linear issues, and Sentry trends into a digest email/dashboard payload.
 *
 * Inputs: ISO date range (CLI argv or server payload).
 * Outputs: a structured weekly digest remembered to Qdrant and remembered as
 * a Linear project-update-ish long decision (no email send directly — that
 * is the human's call; the agent produces the content).
 *
 * @module packages/agent-orchestrator/src/agents/weeklyReport
 */

import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';
import { resolvePrompt } from '../clients/prompts.js';
import { WEEKLY_REPORT_SYSTEM_PROMPT } from '../clients/seedPrompts.js';

export { WEEKLY_REPORT_SYSTEM_PROMPT };

const role: AgentRole = 'weekly-report';
const PROMPT_NAME = 'panacea-weekly-report';

export function buildWeeklyReportAgent(opts: { model?: string } = {}): Promise<CompiledAgent> {
  return resolvePrompt(PROMPT_NAME).then((systemPrompt) =>
    buildAgent({
      role,
      tools: toolsForRole(role),
      systemPrompt,
      traceName: 'panacea:weekly-report',
      tags: ['panacea', 'report', 'weekly'],
      model: opts.model,
      recursionLimit: 15,
    }),
  );
}

export const WEEKLY_REPORT_ROLE = role;