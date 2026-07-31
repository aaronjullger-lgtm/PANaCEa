/**
 * Deep Agents Harness — TypeScript-native sub-agent delegation
 *
 * Implements the Deep Agents pattern (sub-agents, context compaction, skills)
 * on top of PANaCEa's existing LangGraph agent infrastructure. Follows the
 * same architectural principles as the Python deepagents library but adapted
 * for TypeScript + Cloudflare Edge runtime.
 *
 * Key patterns:
 * - Sub-agent delegation: spawn agents with isolated context windows
 * - Context compaction: summarize long threads, offload to storage
 * - Skills system: load reusable behaviors on demand
 * - MCP tool integration: connect external tools via Model Context Protocol
 *
 * @module lib/agents/deep-agents
 */

import type { AgentContext, InvokeResult } from './shared/types';
import { invokeUnifiedAgent } from './unified';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SubAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
  model?: string;
  maxTokens?: number;
}

export interface SubAgentResult {
  agentName: string;
  output: unknown;
  tokensUsed: number;
  durationMs: number;
  contextCompacted: boolean;
}

export interface DelegationOptions {
  subAgents: SubAgentConfig[];
  strategy: 'sequential' | 'parallel' | 'supervisor';
  supervisorPrompt?: string;
  maxContextTokens?: number;
  compactionThreshold?: number;
}

export interface DelegationResult {
  results: SubAgentResult[];
  mergedOutput: unknown;
  totalTokensUsed: number;
  totalDurationMs: number;
  compactionEvents: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  triggers: string[];
  systemPrompt: string;
  tools?: string[];
  model?: string;
}

export interface ContextCompactionConfig {
  maxTokens: number;
  summaryModel: string;
  keepLastN: number;
  compactionPrompt: string;
}

// ─── Sub-Agent Delegation ──────────────────────────────────────────────────

export async function delegateToSubAgents(
  input: unknown,
  ctx: AgentContext,
  options: DelegationOptions,
): Promise<DelegationResult> {
  const start = Date.now();
  const results: SubAgentResult[] = [];
  let totalTokens = 0;
  let compactionEvents = 0;

  switch (options.strategy) {
    case 'sequential':
      await executeSequentialDelegation(input, ctx, options, results, {
        addTokens: (n) => { totalTokens += n; },
        addCompaction: () => { compactionEvents++; },
      });
      break;

    case 'parallel':
      await executeParallelDelegation(input, ctx, options, results, {
        addTokens: (n) => { totalTokens += n; },
        addCompaction: () => { compactionEvents++; },
      });
      break;

    case 'supervisor':
      await executeSupervisedDelegation(input, ctx, options, results, {
        addTokens: (n) => { totalTokens += n; },
        addCompaction: () => { compactionEvents++; },
      });
      break;
  }

  return {
    results,
    mergedOutput: mergeResults(results, options.strategy),
    totalTokensUsed: totalTokens,
    totalDurationMs: Date.now() - start,
    compactionEvents,
  };
}

async function executeSequentialDelegation(
  input: unknown,
  ctx: AgentContext,
  options: DelegationOptions,
  results: SubAgentResult[],
  counters: { addTokens: (n: number) => void; addCompaction: () => void },
): Promise<void> {
  let currentInput = input;

  for (const subAgent of options.subAgents) {
    const agentStart = Date.now();

    const result = await invokeUnifiedAgent({
      name: subAgent.name,
      input: currentInput,
      ctx,
      trace: {
        name: `deep-agent/${subAgent.name}`,
        tags: ['deep-agents', 'sub-agent', 'sequential'],
        metadata: { parentDelegation: 'sequential' },
      },
    });

    results.push({
      agentName: subAgent.name,
      output: result.output,
      tokensUsed: (result.telemetry?.tokensUsed as number) ?? 0,
      durationMs: Date.now() - agentStart,
      contextCompacted: false,
    });

    counters.addTokens((result.telemetry?.tokensUsed as number) ?? 0);

    if (result.output) {
      currentInput = result.output;
    }

    if (result.status !== 'ok') break;
  }
}

async function executeParallelDelegation(
  input: unknown,
  ctx: AgentContext,
  options: DelegationOptions,
  results: SubAgentResult[],
  counters: { addTokens: (n: number) => void; addCompaction: () => void },
): Promise<void> {
  const promises = options.subAgents.map(async (subAgent) => {
    const agentStart = Date.now();

    const result = await invokeUnifiedAgent({
      name: subAgent.name,
      input,
      ctx,
      trace: {
        name: `deep-agent/${subAgent.name}`,
        tags: ['deep-agents', 'sub-agent', 'parallel'],
        metadata: { parentDelegation: 'parallel' },
      },
    });

    counters.addTokens((result.telemetry?.tokensUsed as number) ?? 0);

    return {
      agentName: subAgent.name,
      output: result.output,
      tokensUsed: (result.telemetry?.tokensUsed as number) ?? 0,
      durationMs: Date.now() - agentStart,
      contextCompacted: false,
    };
  });

  const parallelResults = await Promise.all(promises);
  results.push(...parallelResults);
}

async function executeSupervisedDelegation(
  input: unknown,
  ctx: AgentContext,
  options: DelegationOptions,
  results: SubAgentResult[],
  counters: { addTokens: (n: number) => void; addCompaction: () => void },
): Promise<void> {
  const supervisorPrompt = options.supervisorPrompt ??
    `You are a supervisor agent. Analyze the input and decide which sub-agent(s) to invoke.
Available sub-agents: ${options.subAgents.map(a => `${a.name}: ${a.description}`).join(', ')}.
Respond with the agent name(s) to invoke and any routing instructions.`;

  const supervisorStart = Date.now();

  const supervisorResult = await invokeUnifiedAgent({
    name: 'intent-router',
    input: {
      userMessage: JSON.stringify(input),
      systemPrompt: supervisorPrompt,
      availableAgents: options.subAgents.map(a => a.name),
    },
    ctx,
    trace: {
      name: 'deep-agent/supervisor',
      tags: ['deep-agents', 'supervisor'],
    },
  });

  counters.addTokens((supervisorResult.telemetry?.tokensUsed as number) ?? 0);

  const routedAgent = extractRoutedAgent(supervisorResult.output, options.subAgents);

  if (routedAgent) {
    const agentStart = Date.now();
    const result = await invokeUnifiedAgent({
      name: routedAgent.name,
      input,
      ctx,
      trace: {
        name: `deep-agent/${routedAgent.name}`,
        tags: ['deep-agents', 'sub-agent', 'supervised'],
      },
    });

    results.push({
      agentName: routedAgent.name,
      output: result.output,
      tokensUsed: (result.telemetry?.tokensUsed as number) ?? 0,
      durationMs: Date.now() - agentStart,
      contextCompacted: false,
    });

    counters.addTokens((result.telemetry?.tokensUsed as number) ?? 0);
  }

  results.push({
    agentName: 'supervisor',
    output: supervisorResult.output,
    tokensUsed: (supervisorResult.telemetry?.tokensUsed as number) ?? 0,
    durationMs: Date.now() - supervisorStart,
    contextCompacted: false,
  });
}

function extractRoutedAgent(
  supervisorOutput: unknown,
  subAgents: SubAgentConfig[],
): SubAgentConfig | null {
  if (!supervisorOutput) return null;
  const outputStr = typeof supervisorOutput === 'string'
    ? supervisorOutput
    : JSON.stringify(supervisorOutput);

  for (const agent of subAgents) {
    if (outputStr.includes(agent.name)) return agent;
  }
  return subAgents[0] ?? null;
}

function mergeResults(
  results: SubAgentResult[],
  strategy: string,
): unknown {
  if (strategy === 'sequential') {
    return results[results.length - 1]?.output ?? null;
  }
  return results.map((r) => ({
    agent: r.agentName,
    output: r.output,
    tokensUsed: r.tokensUsed,
    durationMs: r.durationMs,
  }));
}

// ─── Context Compaction ────────────────────────────────────────────────────

const DEFAULT_COMPACTION_CONFIG: ContextCompactionConfig = {
  maxTokens: 8000,
  summaryModel: 'gemini-2.0-flash',
  keepLastN: 4,
  compactionPrompt:
    'Summarize the key clinical findings, decisions, and reasoning from this conversation. ' +
    'Preserve differential diagnoses, lab values, vital signs, and medication orders. ' +
    'Be concise but complete — the summary replaces the full conversation history.',
};

export async function compactContext(
  messages: Array<{ role: string; content: string }>,
  ctx: AgentContext,
  config?: Partial<ContextCompactionConfig>,
): Promise<{
  summary: string;
  compacted: boolean;
  originalCount: number;
  keptCount: number;
}> {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };
  const estimatedTokens = estimateTokenCount(messages);

  if (estimatedTokens <= cfg.maxTokens) {
    return {
      summary: '',
      compacted: false,
      originalCount: messages.length,
      keptCount: messages.length,
    };
  }

  const toCompact = messages.slice(0, -cfg.keepLastN);
  const toKeep = messages.slice(-cfg.keepLastN);

  const conversationText = toCompact
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const result = await invokeUnifiedAgent({
    name: 'feedback-summarizer',
    input: {
      userMessage: `${cfg.compactionPrompt}\n\nConversation:\n${conversationText.slice(0, 16000)}`,
    },
    ctx,
    trace: {
      name: 'deep-agent/context-compaction',
      tags: ['deep-agents', 'compaction'],
    },
  });

  const summary = typeof result.output === 'string'
    ? result.output
    : (result.output as Record<string, unknown>)?.summary as string ?? '';

  return {
    summary,
    compacted: true,
    originalCount: messages.length,
    keptCount: toKeep.length + 1,
  };
}

function estimateTokenCount(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((sum, m) => sum + m.content.length * 0.25, 0);
}

// ─── Skills System ─────────────────────────────────────────────────────────

const skillRegistry = new Map<string, SkillDefinition>();

export function registerSkill(skill: SkillDefinition): void {
  skillRegistry.set(skill.name, skill);
}

export function getSkill(name: string): SkillDefinition | undefined {
  return skillRegistry.get(name);
}

export function listSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

export function matchSkills(input: string): SkillDefinition[] {
  const inputLower = input.toLowerCase();
  return Array.from(skillRegistry.values()).filter((skill) =>
    skill.triggers.some((trigger) => inputLower.includes(trigger.toLowerCase())),
  );
}

export function buildSkillSystemPrompt(input: string): string {
  const matched = matchSkills(input);
  if (matched.length === 0) return '';

  return matched
    .map((skill) => `[SKILL: ${skill.name}]\n${skill.systemPrompt}`)
    .join('\n\n');
}

// ─── Built-in Clinical Skills ──────────────────────────────────────────────

export function registerBuiltInSkills(): void {
  registerSkill({
    name: 'clinical-reasoning',
    description: 'Structured clinical reasoning using the dual-process theory framework',
    triggers: ['diagnosis', 'differential', 'ddx', 'what could this be', 'workup'],
    systemPrompt:
      'Use dual-process clinical reasoning: System 1 (pattern recognition) for rapid assessment, ' +
      'then System 2 (analytical) for verification. List the top 3 differential diagnoses with ' +
      'supporting and refuting evidence for each. Include a diagnostic workup plan.',
  });

  registerSkill({
    name: 'pharmacology-review',
    description: 'Medication review with mechanism, dosing, interactions, and monitoring',
    triggers: ['medication', 'drug', 'prescribe', 'dose', 'side effect', 'interaction'],
    systemPrompt:
      'For each medication: state the mechanism of action, standard dosing, ' +
      'key adverse effects, drug-drug interactions, and required monitoring. ' +
      'Include pregnancy/lactation considerations and renal/hepatic dose adjustments.',
  });

  registerSkill({
    name: 'evidence-based-medicine',
    description: 'Apply EBM principles: PICO framing, evidence appraisal, guideline integration',
    triggers: ['evidence', 'guideline', 'study', 'trial', 'recommendation', 'uspstf'],
    systemPrompt:
      'Frame clinical questions using PICO (Population, Intervention, Comparison, Outcome). ' +
      'Cite relevant guidelines (USPSTF, ACC/AHA, IDSA, etc.) with strength of recommendation. ' +
      'Note the level of evidence supporting each recommendation.',
  });

  registerSkill({
    name: 'patient-education',
    description: 'Generate patient-friendly explanations at appropriate health literacy levels',
    triggers: ['explain to patient', 'patient education', 'counseling', 'teach back'],
    systemPrompt:
      'Generate patient education at a 6th-grade reading level. Use the teach-back method: ' +
      'explain the concept, then provide a question the patient can answer to confirm understanding. ' +
      'Include red-flag symptoms that should prompt immediate care.',
  });

  registerSkill({
    name: 'board-exam-prep',
    description: 'PANCE/PANRE-focused question analysis with blueprint mapping',
    triggers: ['pance', 'panre', 'board', 'exam', 'blueprint', 'test-taking'],
    systemPrompt:
      'Map this content to the NCCPA PANCE blueprint: identify the organ system, task category, ' +
      'and cognitive level. Highlight high-yield board pearls. Note common distractor patterns ' +
      'and test-taking strategies specific to this content area.',
  });
}

// ─── MCP Tool Integration ──────────────────────────────────────────────────

export interface MCPToolDefinition {
  serverName: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const mcpToolRegistry = new Map<string, MCPToolDefinition>();

export function registerMCPTool(tool: MCPToolDefinition): void {
  mcpToolRegistry.set(`${tool.serverName}/${tool.toolName}`, tool);
}

export function listMCPTools(): MCPToolDefinition[] {
  return Array.from(mcpToolRegistry.values());
}

export function getMCPTool(serverName: string, toolName: string): MCPToolDefinition | undefined {
  return mcpToolRegistry.get(`${serverName}/${toolName}`);
}

export async function invokeMCPTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const tool = getMCPTool(serverName, toolName);
  if (!tool) {
    return {
      status: 'internal_error',
      output: null,
      error: {
        status: 'internal_error',
        message: `MCP tool not found: ${serverName}/${toolName}`,
        cause: 'mcp_tool_missing',
      },
      agent: `mcp:${serverName}/${toolName}`,
      durationMs: 0,
    };
  }

  return invokeUnifiedAgent({
    name: 'intent-router',
    input: {
      mcpServer: serverName,
      mcpTool: toolName,
      toolArgs: args,
      toolDescription: tool.description,
    },
    ctx,
    trace: {
      name: `mcp/${serverName}/${toolName}`,
      tags: ['mcp', serverName, toolName],
    },
  });
}
