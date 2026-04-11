/**
 * Tests: runAgent (control loop)
 *
 * Strategy: mock `callGemini` at the ai-service boundary so we exercise
 * the real runner → client → parser chain without touching the network
 * or Gemini. Each test queues a sequence of `callGemini` responses, runs
 * the agent, and asserts on the final result + transcript.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ─── Mock callGemini before importing anything that consumes it ─────────────

const callGeminiMock = vi.fn();

vi.mock('../../../functions/api/_shared/ai-service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../functions/api/_shared/ai-service')
  >('../../../functions/api/_shared/ai-service');
  return {
    ...actual,
    callGemini: (...args: unknown[]) => callGeminiMock(...args),
  };
});

// These imports must come AFTER vi.mock so the mock is installed.
import { runAgent } from './agentRunner';
import { ToolRegistry, defineTool } from './toolRegistry';
import type { ToolExecutionContext } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a fake Gemini `raw` payload with only text (run completes). */
function textResponse(text: string, usage = { input: 5, output: 3, total: 8 }) {
  return {
    text,
    raw: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: usage.input,
        candidatesTokenCount: usage.output,
        totalTokenCount: usage.total,
      },
    },
  };
}

/** Build a fake Gemini `raw` payload containing one or more function calls. */
function functionCallResponse(
  calls: Array<{ name: string; args: Record<string, unknown> }>,
  leadingText = ''
) {
  const parts: Array<Record<string, unknown>> = [];
  if (leadingText) parts.push({ text: leadingText });
  for (const c of calls) parts.push({ functionCall: c });
  return {
    text: leadingText,
    raw: {
      candidates: [{ content: { parts } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 2,
        totalTokenCount: 12,
      },
    },
  };
}

/** Build a safety-blocked Gemini response. */
function safetyBlockedResponse() {
  return {
    text: '',
    raw: {
      promptFeedback: { blockReason: 'SAFETY' },
      candidates: [],
      usageMetadata: {
        promptTokenCount: 4,
        candidatesTokenCount: 0,
        totalTokenCount: 4,
      },
    },
  };
}

/** Build a ToolRegistry preloaded with lookup_thing + fail_thing. */
function buildRegistry(lookupHandler: (args: { id: string }) => Promise<unknown>) {
  const lookup = defineTool({
    name: 'lookup_thing',
    description: 'look up a thing by id',
    inputSchema: z.object({ id: z.string() }),
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    category: 'read' as const,
    execute: async ({ id }) => lookupHandler({ id }),
  });
  const fail = defineTool({
    name: 'fail_thing',
    description: 'always throws',
    inputSchema: z.object({}),
    parametersJsonSchema: { type: 'object', properties: {} },
    category: 'read' as const,
    execute: async () => {
      throw new Error('intentional failure');
    },
  });
  return new ToolRegistry([lookup, fail]);
}

function baseContext(): ToolExecutionContext {
  return {
    userId: 'user_test',
    env: { GEMINI_API_KEY: 'test-key', DATABASE_URL: 'postgres://test' },
  };
}

function baseGeminiContext() {
  return {
    env: { GEMINI_API_KEY: 'test-key' } as {
      GEMINI_API_KEY: string;
      [key: string]: unknown;
    },
    auth: { userId: 'user_test' },
  };
}

beforeEach(() => {
  callGeminiMock.mockReset();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('runAgent — happy paths', () => {
  it('completes on a single text-only turn', async () => {
    callGeminiMock.mockResolvedValueOnce(textResponse('Final answer.'));
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Explain this.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(result.finalText).toBe('Final answer.');
    expect(result.iterations).toBe(1);
    expect(callGeminiMock).toHaveBeenCalledOnce();
    // user seed + model turn
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.role).toBe('user');
    expect(result.steps[1]?.role).toBe('model');
    expect(result.tokensUsed.total).toBe(8);
  });

  it('dispatches one tool call then completes on the follow-up turn', async () => {
    callGeminiMock
      .mockResolvedValueOnce(
        functionCallResponse([{ name: 'lookup_thing', args: { id: 'abc' } }])
      )
      .mockResolvedValueOnce(textResponse('Looked it up: abc.'));
    const registry = buildRegistry(async ({ id }) => ({ found: id }));

    const result = await runAgent({
      userMessage: 'Look it up.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(result.finalText).toBe('Looked it up: abc.');
    expect(result.iterations).toBe(2);
    expect(callGeminiMock).toHaveBeenCalledTimes(2);

    const toolStep = result.steps.find((s) => s.role === 'tool');
    expect(toolStep).toBeDefined();
    const part = toolStep?.parts[0];
    expect(part && 'ok' in part ? part.ok : undefined).toBe(true);
    expect(
      part && 'output' in part
        ? (part.output as { found: string }).found
        : undefined
    ).toBe('abc');
  });

  it('accumulates token usage across multiple turns', async () => {
    callGeminiMock
      .mockResolvedValueOnce(
        functionCallResponse([{ name: 'lookup_thing', args: { id: 'x' } }])
      )
      .mockResolvedValueOnce(textResponse('Done.'));
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    // Turn 1: 10/2/12. Turn 2: 5/3/8. Totals: 15/5/20.
    expect(result.tokensUsed).toEqual({ input: 15, output: 5, total: 20 });
  });
});

describe('runAgent — error handling', () => {
  it('returns a safety_block stop reason when Gemini blocks output', async () => {
    callGeminiMock.mockResolvedValueOnce(safetyBlockedResponse());
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'A dangerous prompt.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('safety_block');
    expect(result.finalText).toBe('');
    expect(result.error?.code).toBe('SAFETY_BLOCK');
  });

  it('surfaces tool errors to the model and lets it recover', async () => {
    callGeminiMock
      .mockResolvedValueOnce(
        functionCallResponse([{ name: 'fail_thing', args: {} }])
      )
      .mockResolvedValueOnce(textResponse('Sorry, the tool broke.'));
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Try the failing tool.',
      registry,
      config: { allowedTools: ['fail_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(result.finalText).toBe('Sorry, the tool broke.');

    const toolStep = result.steps.find((s) => s.role === 'tool');
    expect(toolStep).toBeDefined();
    const part = toolStep?.parts[0];
    expect(part && 'ok' in part ? part.ok : undefined).toBe(false);
    expect(part && 'error' in part ? part.error : undefined).toContain(
      'intentional failure'
    );
  });

  it('rejects invalid tool arguments via Zod before calling execute', async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));
    const strict = defineTool({
      name: 'lookup_thing',
      description: 'needs id:string',
      inputSchema: z.object({ id: z.string() }),
      parametersJsonSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      category: 'read',
      execute: executeSpy,
    });
    const registry = new ToolRegistry([strict]);

    callGeminiMock
      .mockResolvedValueOnce(
        // Gemini sends an integer where a string is required.
        functionCallResponse([
          { name: 'lookup_thing', args: { id: 42 as unknown as string } },
        ])
      )
      .mockResolvedValueOnce(textResponse('Recovered.'));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(executeSpy).not.toHaveBeenCalled();
    const toolStep = result.steps.find((s) => s.role === 'tool');
    const part = toolStep?.parts[0];
    expect(part && 'ok' in part ? part.ok : undefined).toBe(false);
    expect(part && 'error' in part ? part.error : undefined).toMatch(
      /Invalid arguments/
    );
  });

  it('bails with max_iterations when the model keeps calling tools', async () => {
    // Every turn asks for another tool call, no final text.
    callGeminiMock.mockResolvedValue(
      functionCallResponse([{ name: 'lookup_thing', args: { id: 'loop' } }])
    );
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Loop forever.',
      registry,
      config: { allowedTools: ['lookup_thing'], maxIterations: 3 },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('max_iterations');
    expect(result.iterations).toBe(3);
    expect(result.error?.code).toBe('MAX_ITERATIONS');
  });

  it('returns model_error when callGemini throws', async () => {
    callGeminiMock.mockRejectedValueOnce(new Error('network down'));
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Try me.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('model_error');
    expect(result.error?.code).toBe('GEMINI_CALL_FAILED');
    expect(result.error?.message).toContain('network down');
  });

  it('fails fast with model_error when a requested tool is not registered', async () => {
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: { allowedTools: ['does_not_exist'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('model_error');
    expect(result.error?.code).toBe('TOOL_SELECTION_FAILED');
    expect(callGeminiMock).not.toHaveBeenCalled();
  });
});

describe('runAgent — parallel tool calls', () => {
  it('executes multiple function calls in one turn in parallel', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const lookup = defineTool({
      name: 'lookup_thing',
      description: 'slow lookup',
      inputSchema: z.object({ id: z.string() }),
      parametersJsonSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      category: 'read',
      execute: async ({ id }) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent--;
        return { id };
      },
    });
    const registry = new ToolRegistry([lookup]);

    callGeminiMock
      .mockResolvedValueOnce(
        functionCallResponse([
          { name: 'lookup_thing', args: { id: 'a' } },
          { name: 'lookup_thing', args: { id: 'b' } },
          { name: 'lookup_thing', args: { id: 'c' } },
        ])
      )
      .mockResolvedValueOnce(textResponse('all done'));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(maxConcurrent).toBeGreaterThanOrEqual(2);
  });

  it('caps parallel tool calls at maxToolCallsPerIteration', async () => {
    const executeSpy = vi.fn(async ({ id }: { id: string }) => ({ id }));
    const lookup = defineTool({
      name: 'lookup_thing',
      description: 'cap test',
      inputSchema: z.object({ id: z.string() }),
      parametersJsonSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      category: 'read',
      execute: executeSpy,
    });
    const registry = new ToolRegistry([lookup]);

    callGeminiMock
      .mockResolvedValueOnce(
        functionCallResponse([
          { name: 'lookup_thing', args: { id: '1' } },
          { name: 'lookup_thing', args: { id: '2' } },
          { name: 'lookup_thing', args: { id: '3' } },
          { name: 'lookup_thing', args: { id: '4' } },
        ])
      )
      .mockResolvedValueOnce(textResponse('capped'));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: {
        allowedTools: ['lookup_thing'],
        maxToolCallsPerIteration: 2,
      },
      toolContext: baseContext(),
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('completed');
    expect(executeSpy).toHaveBeenCalledTimes(2);
  });
});

describe('runAgent — abort signal', () => {
  it('returns aborted when the signal is already fired', async () => {
    const controller = new AbortController();
    controller.abort();
    const registry = buildRegistry(async ({ id }) => ({ id }));

    const result = await runAgent({
      userMessage: 'Go.',
      registry,
      config: { allowedTools: ['lookup_thing'] },
      toolContext: { ...baseContext(), signal: controller.signal },
      geminiContext: baseGeminiContext(),
    });

    expect(result.stopReason).toBe('aborted');
    expect(callGeminiMock).not.toHaveBeenCalled();
  });
});
