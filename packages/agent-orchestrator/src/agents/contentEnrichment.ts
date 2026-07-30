/**
 * Content-enrichment agent — Gemini + Qdrant RAG to ingest new study
 * references / drug updates and surface enrichment candidates.
 *
 * Inputs: a free-text brief (condition name + new guideline / source URL).
 * Outputs: a structured enrichment candidate remembered to Qdrant + a Linear
 * issue if the enrichment needs a human content Doctor to apply it.
 *
 * @module packages/agent-orchestrator/src/agents/contentEnrichment
 */

import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';
import { resolvePrompt } from '../clients/prompts.js';
import { CONTENT_ENRICHMENT_SYSTEM_PROMPT } from '../clients/seedPrompts.js';

export { CONTENT_ENRICHMENT_SYSTEM_PROMPT };

const role: AgentRole = 'content-enrichment';
const PROMPT_NAME = 'panacea-content-enrichment';

export function buildContentEnrichmentAgent(opts: { model?: string } = {}): Promise<CompiledAgent> {
  return resolvePrompt(PROMPT_NAME).then((systemPrompt) =>
    buildAgent({
      role,
      tools: toolsForRole(role),
      systemPrompt,
      traceName: 'panacea:content-enrichment',
      tags: ['panacea', 'content', 'enrichment'],
      model: opts.model,
      recursionLimit: 12,
    }),
  );
}

export const CONTENT_ENRICHMENT_ROLE = role;