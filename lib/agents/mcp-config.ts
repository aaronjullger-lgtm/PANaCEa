/**
 * Production MCP Tool Configuration
 *
 * Registers MCP (Model Context Protocol) tools for PANaCEa's production
 * infrastructure. These tools enable AI agents to interact with external
 * services through a standardized interface.
 *
 * Load this at startup via:
 *   import { registerProductionMCPTools } from '@/lib/agents/mcp-config';
 *   await registerProductionMCPTools();
 *
 * Each MCP server requires its own environment variables and may need
 * additional setup (API keys, connection strings, etc.).
 *
 * @module lib/agents/mcp-config
 */

import { registerMCPTool, type MCPToolDefinition } from './deep-agents';

// ─── 1Password MCP Tools ──────────────────────────────────────────────────

const ONEPASSWORD_TOOLS: MCPToolDefinition[] = [
  {
    serverName: '1password',
    toolName: 'list_vaults',
    description: 'List all available 1Password vaults',
    inputSchema: {},
  },
  {
    serverName: '1password',
    toolName: 'read_secret',
    description: 'Read a secret from 1Password using an op:// reference',
    inputSchema: {
      type: 'object',
      properties: {
        reference: {
          type: 'string',
          description: 'op:// reference string (e.g. op://Code/Item Name/field)',
        },
      },
      required: ['reference'],
    },
  },
  {
    serverName: '1password',
    toolName: 'list_items',
    description: 'List items in a 1Password vault',
    inputSchema: {
      type: 'object',
      properties: {
        vault: { type: 'string', description: 'Vault name or ID' },
      },
    },
  },
];

// ─── Supabase MCP Tools ───────────────────────────────────────────────────

const SUPABASE_TOOLS: MCPToolDefinition[] = [
  {
    serverName: 'supabase',
    toolName: 'query',
    description: 'Execute a read-only SQL query against the Supabase database',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL query (SELECT only)' },
      },
      required: ['sql'],
    },
  },
  {
    serverName: 'supabase',
    toolName: 'get_table_info',
    description: 'Get schema information for a database table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
      },
      required: ['table'],
    },
  },
  {
    serverName: 'supabase',
    toolName: 'list_tables',
    description: 'List all tables in the public schema',
    inputSchema: {},
  },
];

// ─── Cloudflare MCP Tools ─────────────────────────────────────────────────

const CLOUDFLARE_TOOLS: MCPToolDefinition[] = [
  {
    serverName: 'cloudflare',
    toolName: 'list_workers',
    description: 'List all Cloudflare Workers in the account',
    inputSchema: {},
  },
  {
    serverName: 'cloudflare',
    toolName: 'list_d1_databases',
    description: 'List all D1 databases',
    inputSchema: {},
  },
  {
    serverName: 'cloudflare',
    toolName: 'list_kv_namespaces',
    description: 'List all KV namespaces',
    inputSchema: {},
  },
  {
    serverName: 'cloudflare',
    toolName: 'get_pages_project',
    description: 'Get details about a Cloudflare Pages project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
      },
      required: ['name'],
    },
  },
  {
    serverName: 'cloudflare',
    toolName: 'list_deployments',
    description: 'List recent deployments for a Pages project',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        limit: { type: 'number', description: 'Max deployments to return (default 10)' },
      },
      required: ['project'],
    },
  },
];

// ─── Registration ─────────────────────────────────────────────────────────

let registered = false;

export async function registerProductionMCPTools(): Promise<number> {
  if (registered) return 0;

  let count = 0;

  for (const tool of [...ONEPASSWORD_TOOLS, ...SUPABASE_TOOLS, ...CLOUDFLARE_TOOLS]) {
    try {
      registerMCPTool(tool);
      count++;
    } catch (err) {
      console.warn(`[mcp-config] Failed to register ${tool.serverName}/${tool.toolName}:`, err instanceof Error ? err.message : String(err));
    }
  }

  registered = true;
  console.log(`[mcp-config] Registered ${count} MCP tools across 3 servers`);
  return count;
}

export function isMCPRegistered(): boolean {
  return registered;
}

export { ONEPASSWORD_TOOLS, SUPABASE_TOOLS, CLOUDFLARE_TOOLS };
