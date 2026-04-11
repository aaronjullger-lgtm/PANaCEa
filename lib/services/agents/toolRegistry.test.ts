/**
 * Tests: ToolRegistry + defineTool + buildFunctionDeclarations
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineTool,
  ToolRegistry,
  buildFunctionDeclarations,
} from './toolRegistry';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeReadTool(name = 'read_thing') {
  return defineTool({
    name,
    description: `read a ${name}`,
    inputSchema: z.object({ id: z.string() }),
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    category: 'read',
    execute: async ({ id }) => ({ id }),
  });
}

function makeWriteTool(name = 'write_thing') {
  return defineTool({
    name,
    description: `write a ${name}`,
    inputSchema: z.object({ id: z.string() }),
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    category: 'write',
    execute: async ({ id }) => ({ id }),
  });
}

describe('ToolRegistry.register', () => {
  it('accepts valid snake_case names', () => {
    const registry = new ToolRegistry();
    expect(() => registry.register(makeReadTool('valid_name'))).not.toThrow();
    expect(() => registry.register(makeReadTool('a1_b2_c3'))).not.toThrow();
  });

  it('rejects non-snake_case names', () => {
    const registry = new ToolRegistry();
    expect(() =>
      registry.register(makeReadTool('BadName'))
    ).toThrow(/snake_case/);
    expect(() =>
      registry.register(makeReadTool('1leading_digit'))
    ).toThrow(/snake_case/);
    expect(() =>
      registry.register(makeReadTool('has-dash'))
    ).toThrow(/snake_case/);
    expect(() =>
      registry.register(makeReadTool('has space'))
    ).toThrow(/snake_case/);
  });

  it('replaces an existing tool with the same name', () => {
    const registry = new ToolRegistry();
    const a = makeReadTool('same');
    const b = makeReadTool('same');
    registry.register(a);
    registry.register(b);
    expect(registry.list().length).toBe(1);
    expect(registry.get('same')).toBe(b);
  });
});

describe('ToolRegistry.select', () => {
  it('returns only the requested tools in order', () => {
    const registry = new ToolRegistry([
      makeReadTool('alpha'),
      makeReadTool('beta'),
      makeReadTool('gamma'),
    ]);
    const selected = registry.select(['gamma', 'alpha']);
    expect(selected.map((t) => t.name)).toEqual(['gamma', 'alpha']);
  });

  it('throws when a requested tool is missing', () => {
    const registry = new ToolRegistry([makeReadTool('alpha')]);
    expect(() => registry.select(['alpha', 'missing'])).toThrow(
      /Unknown tool: "missing"/
    );
  });

  it('throws when a tool is in a disallowed category', () => {
    const registry = new ToolRegistry([
      makeReadTool('safe_read'),
      makeWriteTool('risky_write'),
    ]);
    expect(() =>
      registry.select(['safe_read', 'risky_write'], ['read'])
    ).toThrow(/category "write".*not allowed/);
  });

  it('allows write tools when explicitly permitted', () => {
    const registry = new ToolRegistry([
      makeReadTool('safe_read'),
      makeWriteTool('risky_write'),
    ]);
    const selected = registry.select(
      ['safe_read', 'risky_write'],
      ['read', 'write']
    );
    expect(selected.map((t) => t.name)).toEqual(['safe_read', 'risky_write']);
  });

  it('defaults to read + compute categories when no filter is given', () => {
    const registry = new ToolRegistry([
      makeReadTool('ok'),
      makeWriteTool('no'),
    ]);
    expect(() => registry.select(['ok'])).not.toThrow();
    expect(() => registry.select(['no'])).toThrow();
  });
});

describe('ToolRegistry.hasAll / list / get', () => {
  it('hasAll returns true only when every name is present', () => {
    const registry = new ToolRegistry([
      makeReadTool('a'),
      makeReadTool('b'),
    ]);
    expect(registry.hasAll(['a'])).toBe(true);
    expect(registry.hasAll(['a', 'b'])).toBe(true);
    expect(registry.hasAll(['a', 'b', 'c'])).toBe(false);
  });

  it('list returns every registered tool', () => {
    const registry = new ToolRegistry([
      makeReadTool('a'),
      makeReadTool('b'),
    ]);
    expect(registry.list().map((t) => t.name).sort()).toEqual(['a', 'b']);
  });
});

describe('buildFunctionDeclarations', () => {
  it('returns an empty array for an empty tool list', () => {
    expect(buildFunctionDeclarations([])).toEqual([]);
  });

  it('wraps declarations in the Gemini tools[] shape', () => {
    const tool = makeReadTool('one_tool');
    const decls = buildFunctionDeclarations([tool]);
    expect(decls).toHaveLength(1);
    const entry = decls[0] as { functionDeclarations: Array<Record<string, unknown>> };
    expect(entry.functionDeclarations).toHaveLength(1);
    const fd = entry.functionDeclarations[0] as {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
    expect(fd.name).toBe('one_tool');
    expect(fd.description).toContain('read');
    expect(fd.parameters).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    });
  });
});
