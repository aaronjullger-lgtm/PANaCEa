/**
 * Tests for production MCP tool registration (lib/agents/mcp-config.ts).
 *
 * Verifies:
 * - Tool catalog contents (1Password / Supabase / Cloudflare)
 * - registerProductionMCPTools registers all tools exactly once
 * - isMCPRegistered() state
 *
 * @module tests/mcp-config.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRegisterMCPTool } = vi.hoisted(() => ({
  mockRegisterMCPTool: vi.fn(),
}));

vi.mock('@/lib/agents/deep-agents', async () => {
  const actual = await vi.importActual('@/lib/agents/deep-agents');
  return {
    ...(actual as object),
    registerMCPTool: mockRegisterMCPTool,
  };
});

import {
  ONEPASSWORD_TOOLS,
  SUPABASE_TOOLS,
  CLOUDFLARE_TOOLS,
} from '@/lib/agents/mcp-config';

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tool catalogs', () => {
  it('defines three 1Password tools', () => {
    expect(ONEPASSWORD_TOOLS).toHaveLength(3);
    expect(ONEPASSWORD_TOOLS.map((t) => t.toolName)).toEqual([
      'list_vaults',
      'read_secret',
      'list_items',
    ]);
    for (const tool of ONEPASSWORD_TOOLS) {
      expect(tool.serverName).toBe('1password');
    }
  });

  it('defines three Supabase tools', () => {
    expect(SUPABASE_TOOLS).toHaveLength(3);
    expect(SUPABASE_TOOLS.map((t) => t.toolName)).toEqual([
      'query',
      'get_table_info',
      'list_tables',
    ]);
    for (const tool of SUPABASE_TOOLS) {
      expect(tool.serverName).toBe('supabase');
    }
  });

  it('defines five Cloudflare tools', () => {
    expect(CLOUDFLARE_TOOLS).toHaveLength(5);
    expect(CLOUDFLARE_TOOLS.map((t) => t.toolName)).toEqual([
      'list_workers',
      'list_d1_databases',
      'list_kv_namespaces',
      'get_pages_project',
      'list_deployments',
    ]);
    for (const tool of CLOUDFLARE_TOOLS) {
      expect(tool.serverName).toBe('cloudflare');
    }
  });
});

describe('registerProductionMCPTools()', () => {
  it('registers all 11 tools and reports the count', async () => {
    const { registerProductionMCPTools } = await import('@/lib/agents/mcp-config');

    const count = await registerProductionMCPTools();

    expect(count).toBe(11);
    expect(mockRegisterMCPTool).toHaveBeenCalledTimes(11);

    const toolNames = mockRegisterMCPTool.mock.calls.map(([tool]) => `${tool.serverName}/${tool.toolName}`);
    expect(toolNames).toContain('1password/read_secret');
    expect(toolNames).toContain('supabase/query');
    expect(toolNames).toContain('cloudflare/list_workers');
  });

  it('is idempotent — a second call registers nothing new', async () => {
    const { registerProductionMCPTools } = await import('@/lib/agents/mcp-config');

    await registerProductionMCPTools();
    const secondCount = await registerProductionMCPTools();

    expect(secondCount).toBe(0);
    expect(mockRegisterMCPTool).toHaveBeenCalledTimes(11);
  });

  it('flips isMCPRegistered() to true after registration', async () => {
    const { registerProductionMCPTools, isMCPRegistered } = await import('@/lib/agents/mcp-config');

    expect(isMCPRegistered()).toBe(false);

    await registerProductionMCPTools();

    expect(isMCPRegistered()).toBe(true);
  });
});
