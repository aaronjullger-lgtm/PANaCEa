/**
 * Tests: parseGeminiTurn + buildFunctionResponseTurn
 *
 * Scope: the wire-format parsing layer. We do not exercise `runAgentTurn`
 * here — that is covered indirectly by the agentRunner tests which mock
 * `callGemini` at the boundary.
 */

import { describe, it, expect } from 'vitest';
import {
  parseGeminiTurn,
  buildFunctionResponseTurn,
} from './geminiAgentClient';

describe('parseGeminiTurn', () => {
  it('extracts text-only turns', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello there.' }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 3,
        totalTokenCount: 15,
      },
    });
    expect(parsed.text).toBe('Hello there.');
    expect(parsed.functionCalls).toEqual([]);
    expect(parsed.blocked).toBe(false);
    expect(parsed.usage).toEqual({ input: 12, output: 3, total: 15 });
  });

  it('concatenates multiple text parts', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Part one. ' },
              { text: 'Part two.' },
            ],
          },
        },
      ],
    });
    expect(parsed.text).toBe('Part one. Part two.');
  });

  it('extracts function calls alongside text', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Let me look that up. ' },
              {
                functionCall: {
                  name: 'clinical_library_search',
                  args: { query: 'pericarditis', limit: 5 },
                },
              },
            ],
          },
        },
      ],
    });
    expect(parsed.text).toBe('Let me look that up. ');
    expect(parsed.functionCalls).toEqual([
      {
        name: 'clinical_library_search',
        args: { query: 'pericarditis', limit: 5 },
      },
    ]);
  });

  it('handles multiple parallel function calls', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: 'tool_a', args: { x: 1 } } },
              { functionCall: { name: 'tool_b', args: { y: 2 } } },
            ],
          },
        },
      ],
    });
    expect(parsed.functionCalls).toHaveLength(2);
    expect(parsed.functionCalls[0]).toEqual({ name: 'tool_a', args: { x: 1 } });
    expect(parsed.functionCalls[1]).toEqual({ name: 'tool_b', args: { y: 2 } });
  });

  it('defaults missing args to an empty object', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: 'no_args_tool' } }],
          },
        },
      ],
    });
    expect(parsed.functionCalls).toEqual([
      { name: 'no_args_tool', args: {} },
    ]);
  });

  it('skips "thought" parts so internal reasoning never leaks', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'INTERNAL: should be hidden' },
              { text: 'Public answer.' },
            ],
          },
        },
      ],
    });
    expect(parsed.text).toBe('Public answer.');
  });

  it('reports safety blocks via promptFeedback', () => {
    const parsed = parseGeminiTurn({
      promptFeedback: { blockReason: 'SAFETY' },
      candidates: [],
    });
    expect(parsed.blocked).toBe(true);
    expect(parsed.blockReason).toBe('SAFETY');
    expect(parsed.text).toBe('');
    expect(parsed.functionCalls).toEqual([]);
  });

  it('is defensive against empty/undefined input', () => {
    expect(parseGeminiTurn(undefined).text).toBe('');
    expect(parseGeminiTurn({}).text).toBe('');
    expect(parseGeminiTurn({ candidates: [] }).text).toBe('');
    expect(parseGeminiTurn({ candidates: [{}] }).text).toBe('');
  });

  it('defaults usage to zeros when not provided', () => {
    const parsed = parseGeminiTurn({
      candidates: [{ content: { parts: [{ text: 'hi' }] } }],
    });
    expect(parsed.usage).toEqual({ input: 0, output: 0, total: 0 });
  });

  it('ignores malformed function call parts without a name', () => {
    const parsed = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { args: { orphan: true } } }, // missing name
              { text: 'ok' },
            ],
          },
        },
      ],
    });
    expect(parsed.functionCalls).toHaveLength(0);
    expect(parsed.text).toBe('ok');
  });
});

describe('buildFunctionResponseTurn', () => {
  it('packs multiple tool results into a single user turn', () => {
    const turn = buildFunctionResponseTurn([
      { name: 'tool_a', response: { result: { value: 1 } } },
      { name: 'tool_b', response: { error: 'boom' } },
    ]);
    expect(turn.role).toBe('user');
    expect(turn.parts).toHaveLength(2);
    expect(turn.parts[0]).toEqual({
      functionResponse: {
        name: 'tool_a',
        response: { result: { value: 1 } },
      },
    });
    expect(turn.parts[1]).toEqual({
      functionResponse: {
        name: 'tool_b',
        response: { error: 'boom' },
      },
    });
  });

  it('returns an empty parts array for no results', () => {
    const turn = buildFunctionResponseTurn([]);
    expect(turn.role).toBe('user');
    expect(turn.parts).toEqual([]);
  });
});
