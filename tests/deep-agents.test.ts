/**
 * Tests for the Deep Agents harness (lib/agents/deep-agents.ts).
 *
 * Verifies:
 * - Sub-agent delegation (sequential / parallel / supervisor)
 * - Context compaction
 * - Skills system (register, match, prompt building)
 * - MCP tool registry + invocation
 *
 * @module tests/deep-agents.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/agents/unified', async () => {
  const actual = await vi.importActual('@/lib/agents/unified');
  return {
    ...(actual as object),
    invokeUnifiedAgent: vi.fn(),
  };
});

import {
  delegateToSubAgents,
  compactContext,
  registerSkill,
  getSkill,
  listSkills,
  matchSkills,
  buildSkillSystemPrompt,
  registerBuiltInSkills,
  registerMCPTool,
  listMCPTools,
  getMCPTool,
  invokeMCPTool,
} from '@/lib/agents/deep-agents';
import { invokeUnifiedAgent } from '@/lib/agents/unified';

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

function okResult(output: unknown, tokensUsed = 10) {
  return {
    status: 'ok',
    output,
    error: null,
    agent: 'test-agent',
    durationMs: 5,
    telemetry: { tokensUsed },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('delegateToSubAgents()', () => {
  it('sequential: chains output between agents and sums tokens', async () => {
    vi.mocked(invokeUnifiedAgent)
      .mockResolvedValueOnce(okResult('first-output', 10) as never)
      .mockResolvedValueOnce(okResult('second-output', 20) as never);

    const result = await delegateToSubAgents(
      { query: 'initial' },
      ctx,
      {
        strategy: 'sequential',
        subAgents: [
          { name: 'content-audit', description: 'Audit', systemPrompt: 'p1' },
          { name: 'content-enrichment', description: 'Enrich', systemPrompt: 'p2' },
        ],
      },
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.agentName).toBe('content-audit');
    expect(result.results[1]?.agentName).toBe('content-enrichment');
    expect(result.totalTokensUsed).toBe(30);
    expect(result.mergedOutput).toBe('second-output');

    const secondCall = vi.mocked(invokeUnifiedAgent).mock.calls[1]?.[0];
    expect(secondCall?.input).toBe('first-output');
  });

  it('sequential: stops after a failed agent', async () => {
    vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce({
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message: 'boom', cause: 'test' },
      agent: 'content-audit',
      durationMs: 5,
    } as never);

    const result = await delegateToSubAgents({ q: 1 }, ctx, {
      strategy: 'sequential',
      subAgents: [
        { name: 'content-audit', description: 'Audit', systemPrompt: 'p1' },
        { name: 'content-enrichment', description: 'Enrich', systemPrompt: 'p2' },
      ],
    });

    expect(result.results).toHaveLength(1);
    expect(vi.mocked(invokeUnifiedAgent)).toHaveBeenCalledTimes(1);
  });

  it('parallel: invokes all agents with the same input', async () => {
    vi.mocked(invokeUnifiedAgent)
      .mockResolvedValueOnce(okResult('a') as never)
      .mockResolvedValueOnce(okResult('b') as never);

    const result = await delegateToSubAgents({ q: 1 }, ctx, {
      strategy: 'parallel',
      subAgents: [
        { name: 'content-audit', description: 'Audit', systemPrompt: 'p1' },
        { name: 'content-enrichment', description: 'Enrich', systemPrompt: 'p2' },
      ],
    });

    expect(result.results).toHaveLength(2);
    expect(vi.mocked(invokeUnifiedAgent)).toHaveBeenCalledTimes(2);

    const merged = result.mergedOutput as Array<{ agent: string; output: unknown }>;
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.agent).sort()).toEqual(['content-audit', 'content-enrichment']);
  });

  it('supervisor: routes to the named agent and includes supervisor result', async () => {
    vi.mocked(invokeUnifiedAgent)
      .mockResolvedValueOnce(okResult('route to content-enrichment') as never)
      .mockResolvedValueOnce(okResult('enriched') as never);

    const result = await delegateToSubAgents({ q: 1 }, ctx, {
      strategy: 'supervisor',
      subAgents: [
        { name: 'content-audit', description: 'Audit', systemPrompt: 'p1' },
        { name: 'content-enrichment', description: 'Enrich', systemPrompt: 'p2' },
      ],
      supervisorPrompt: 'Route to the best agent',
    });

    expect(result.results).toHaveLength(2);
    const names = result.results.map((r) => r.agentName);
    expect(names).toContain('supervisor');
    expect(names).toContain('content-enrichment');
  });

  it('supervisor: falls back to the first agent when routing is ambiguous', async () => {
    vi.mocked(invokeUnifiedAgent)
      .mockResolvedValueOnce(okResult('no clear routing signal') as never)
      .mockResolvedValueOnce(okResult('audited') as never);

    const result = await delegateToSubAgents({ q: 1 }, ctx, {
      strategy: 'supervisor',
      subAgents: [
        { name: 'content-audit', description: 'Audit', systemPrompt: 'p1' },
        { name: 'content-enrichment', description: 'Enrich', systemPrompt: 'p2' },
      ],
    });

    const routed = result.results.find((r) => r.agentName === 'content-audit');
    expect(routed?.output).toBe('audited');
  });
});

describe('compactContext()', () => {
  it('skips compaction when under the token threshold', async () => {
    const messages = [
      { role: 'user', content: 'short' },
      { role: 'assistant', content: 'ok' },
    ];

    const result = await compactContext(messages, ctx, { maxTokens: 1000 });

    expect(result.compacted).toBe(false);
    expect(result.summary).toBe('');
    expect(result.originalCount).toBe(2);
    expect(result.keptCount).toBe(2);
    expect(vi.mocked(invokeUnifiedAgent)).not.toHaveBeenCalled();
  });

  it('compacts and summarizes when over the threshold', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x'.repeat(500),
    }));

    vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce(
      okResult('compacted summary') as never,
    );

    const result = await compactContext(messages, ctx, {
      maxTokens: 100,
      keepLastN: 3,
    });

    expect(result.compacted).toBe(true);
    expect(result.summary).toBe('compacted summary');
    expect(result.originalCount).toBe(10);
    expect(result.keptCount).toBe(4);

    const call = vi.mocked(invokeUnifiedAgent).mock.calls[0]?.[0];
    expect(call?.name).toBe('feedback-summarizer');
  });

  it('extracts summary from object output', async () => {
    const messages = [
      { role: 'user', content: 'y'.repeat(800) },
      { role: 'assistant', content: 'z'.repeat(800) },
    ];

    vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce(
      okResult({ summary: 'object summary' }) as never,
    );

    const result = await compactContext(messages, ctx, { maxTokens: 100 });

    expect(result.compacted).toBe(true);
    expect(result.summary).toBe('object summary');
  });
});

describe('skills system', () => {
  it('registers, retrieves, and lists skills', () => {
    const skill = {
      name: `test-skill-${Date.now()}`,
      description: 'Test skill',
      triggers: ['zebra', 'zebra-like'],
      systemPrompt: 'Think like a zebra.',
    };

    registerSkill(skill);

    expect(getSkill(skill.name)?.description).toBe('Test skill');
    expect(listSkills().some((s) => s.name === skill.name)).toBe(true);
  });

  it('matches skills by trigger keyword', () => {
    const skill = {
      name: `ddx-skill-${Date.now()}`,
      description: 'DDx skill',
      triggers: ['differential', 'ddx'],
      systemPrompt: 'List differentials.',
    };

    registerSkill(skill);

    const matched = matchSkills('build a differential for this patient');
    expect(matched.some((s) => s.name === skill.name)).toBe(true);
    expect(matchSkills('unrelated query').some((s) => s.name === skill.name)).toBe(false);
  });

  it('buildSkillSystemPrompt returns empty when nothing matches', () => {
    expect(buildSkillSystemPrompt('totally unrelated')).toBe('');
  });

  it('buildSkillSystemPrompt includes matched skill prompt', () => {
    const skill = {
      name: `ebm-skill-${Date.now()}`,
      description: 'EBM skill',
      triggers: ['guideline'],
      systemPrompt: 'Cite the guideline.',
    };

    registerSkill(skill);

    const prompt = buildSkillSystemPrompt('what does the guideline say?');
    expect(prompt).toContain('[SKILL: ebm-skill-');
    expect(prompt).toContain('Cite the guideline.');
  });

  it('registerBuiltInSkills registers all five clinical skills', () => {
    registerBuiltInSkills();

    const names = listSkills().map((s) => s.name);
    for (const expected of [
      'clinical-reasoning',
      'pharmacology-review',
      'evidence-based-medicine',
      'patient-education',
      'board-exam-prep',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe('MCP tool integration', () => {
  it('registers, lists, and retrieves MCP tools', () => {
    const tool = {
      serverName: `test-server-${Date.now()}`,
      toolName: 'list_things',
      description: 'List things',
      inputSchema: {},
    };

    registerMCPTool(tool);

    expect(listMCPTools().some((t) => t.toolName === 'list_things')).toBe(true);
    expect(getMCPTool(tool.serverName, 'list_things')?.description).toBe('List things');
  });

  it('invokeMCPTool returns internal_error for missing tool', async () => {
    const result = await invokeMCPTool('nope', 'nope', {}, ctx);

    expect(result.status).toBe('internal_error');
    expect(result.error?.cause).toBe('mcp_tool_missing');
    expect(result.agent).toBe('mcp:nope/nope');
  });

  it('invokeMCPTool delegates to intent-router for registered tools', async () => {
    const tool = {
      serverName: `live-server-${Date.now()}`,
      toolName: 'run_query',
      description: 'Run a query',
      inputSchema: {},
    };

    registerMCPTool(tool);
    vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce(okResult('query result') as never);

    const result = await invokeMCPTool(tool.serverName, 'run_query', { sql: 'SELECT 1' }, ctx);

    expect(result.output).toBe('query result');

    const call = vi.mocked(invokeUnifiedAgent).mock.calls[0]?.[0];
    expect(call?.name).toBe('intent-router');
    const input = call?.input as { mcpServer: string; mcpTool: string; toolArgs: Record<string, unknown> };
    expect(input.mcpServer).toBe(tool.serverName);
    expect(input.mcpTool).toBe('run_query');
    expect(input.toolArgs).toEqual({ sql: 'SELECT 1' });
  });
});
