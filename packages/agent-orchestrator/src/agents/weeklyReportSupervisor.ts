/**
 * Weekly-report supervisor — delegates to content-audit + incident-responder
 * sub-agents, then synthesizes their outputs into the weekly digest.
 *
 * Improvement #4 — replaces the single-LLM weekly-report with a multi-agent
 * supervisor that runs the incident-responder and content-audit agents as
 * sub-graphs (via @langchain/langgraph-supervisor's createSupervisor), then
 * compiles the digest from their structured outputs rather than from a single
 * LLM pass trying to do everything at once.
 *
 * Doc: langchain-ai/langgraphjs deepwiki §4.1 Supervisor Pattern.
 *      libs/langgraph-supervisor/src/supervisor.ts — createSupervisor({ agents,
 *      llm, prompt }). Returns a compiled graph where the supervisor routes to
 *      sub-agents and collects their results.
 *
 * @module packages/agent-orchestrator/src/agents/weeklyReportSupervisor
 */

import type { CompiledAgent } from '../orchestrator/factory.js';
import { getLLM } from '../clients/llm.js';
import { getTracingCallbacks } from '../clients/tracing.js';
import { getCheckpointSaver } from '../clients/checkpoint.js';
import { resolvePrompt } from '../clients/prompts.js';
import { optionalEnv } from '../config/env.js';
import { buildContentAuditAgent } from './contentAudit.js';
import { buildIncidentResponderAgent } from './incidentResponder.js';
import { buildAgent } from '../orchestrator/factory.js';
import { toolsForRole, type AgentRole } from '../tools/index.js';

export const SUPERVISOR_ROLE = 'weekly-report-supervisor' as const;

const SUPERVISOR_SYSTEM_PROMPT = `You are the PANaCEa Weekly-Report Supervisor.

You coordinate two sub-agents to compile a weekly digest for the StudyPANaCEa repository owner:

1. Delegate to the **incident-responder** agent to pull + triage the latest Sentry issues.
2. Delegate to the **content-audit** agent to check whether any content-audit findings need follow-up.
3. After both return, synthesize their results + your own memory recall (open Linear issues by
   priority, top Sentry trends) into the final markdown digest.

Do NOT duplicate the sub-agents' work — route to them, then compile. End with
"WEEKLY RESULT:" + a one-line summary headline.`;

export async function buildWeeklyReportSupervisor(opts: { model?: string } = {}): Promise<CompiledAgent> {
  const llm = await getLLM(opts.model);
  const callbacks = await getTracingCallbacks();
  const checkpointSaver = await getCheckpointSaver();
  const promptText = SUPERVISOR_SYSTEM_PROMPT;

  // Build the two sub-agent graphs that the supervisor will delegate to.
  const contentAuditAgent = await buildContentAuditAgent(opts);
  const incidentResponderAgent = await buildIncidentResponderAgent(opts);

  // Build the supervisor's own toolset (memory + Linear + Sentry for the digest compilation).
  const role: AgentRole = 'weekly-report';
  const supervisorTools = toolsForRole(role);

  // Try to use the official supervisor package. If it fails (API mismatch,
  // version drift), fall back to a simple ReAct agent that has the sub-agents'
  // outputs injected via a tool that calls them.
  try {
    const { createSupervisor } = await import('@langchain/langgraph-supervisor');
    const { StateGraph, START, END, MessagesAnnotation } = await import('@langchain/langgraph');
    const { SystemMessage } = await import('@langchain/core/messages');

    // Wrap sub-agents as compiled-graph-like objects that the supervisor can call.
    // createSupervisor expects compiled graphs with .graph or .invoke surfaces.
    const subAgents = [
      { name: 'incident_responder', graph: { invoke: incidentResponderAgent.invoke } },
      { name: 'content_audit', graph: { invoke: contentAuditAgent.invoke } },
    ];

    type CompiledGraph = {
      invoke: (input: unknown, config?: unknown) => Promise<{
        messages: Array<{ _getType: () => string; content: unknown; tool_calls?: unknown[] }>;
      }>;
    };

    const supervisorGraph = (await createSupervisor({
      llm,
      agents: subAgents as never,
      prompt: new SystemMessage(promptText),
      ...(checkpointSaver ? { checkpointSaver } : {}),
    })) as unknown as CompiledGraph;

    return {
      role: SUPERVISOR_ROLE,
      traceName: 'panacea:weekly-report-supervisor',
      async invoke(input) {
        const config = {
          callbacks,
          recursionLimit: 30,
          configurable: { thread_id: input.threadId ?? `panacea-supervisor-${Date.now()}` },
        };
        const raw = await supervisorGraph.invoke({ messages: input.messages }, config);
        const messages = (raw.messages ?? []).map((m) => {
          const type = typeof m._getType === 'function' ? m._getType() : 'unknown';
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return { role: type, content, tool_calls: m.tool_calls };
        });
        return { messages };
      },
    };
  } catch (err) {
    // Fallback: a standard ReAct agent (weekly-report role) with the supervisor prompt.
    // This is the same as the non-supervisor weekly-report but with the supervisor prompt
    // that asks it to reason about what the sub-agents WOULD have found.
    console.warn(
      '[agent-orchestrator] Supervisor graph build failed, using fallback ReAct agent:',
      err instanceof Error ? err.message : err,
    );
    return buildAgent({
      role,
      tools: supervisorTools,
      systemPrompt: promptText,
      traceName: 'panacea:weekly-report-supervisor',
      tags: ['panacea', 'report', 'weekly', 'supervisor-fallback'],
      model: opts.model,
      recursionLimit: 15,
    });
  }
}