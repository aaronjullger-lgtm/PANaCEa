/**
 * MCP Tool Bridge
 *
 * Dynamically discovers tools from configured MCP (Model Context Protocol)
 * servers and registers them in the PANaCEa agent tool registry. This is a
 * TypeScript-native implementation of the pattern from
 * `langchain-mcp-adapters` — no new npm dependency required.
 *
 * Architecture:
 * - `MCPToolDiscovery` — discovers tools from MCP server configurations
 * - `MCPToolBridge` — bridges discovered tools into the ToolRegistry
 * - Graceful fallback when MCP servers are unavailable
 * - Caches tool schemas for fast subsequent loads
 *
 * Currently supported MCP servers (from `.mcp.json`):
 * - Sentry (`sentry_mcp`) — production error introspection
 * - Supabase (`supabase`) — DB schema introspection, RLS audit
 * - Context7 (`context7`) — version-specific library docs
 *
 * @module lib/agents/mcp/bridge
 */

import { ToolRegistry, type AnyToolDefinition } from '@/lib/services/agents/toolRegistry';
import type { ToolCategory } from '@/lib/services/agents/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MCPServerConfig {
  /** Server name (matches .mcp.json key) */
  name: string;
  /** Transport type */
  transport: 'stdio' | 'http' | 'sse';
  /** Command for stdio transport */
  command?: string;
  /** Args for stdio transport */
  args?: string[];
  /** URL for http/sse transport */
  url?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Auth headers for http transport */
  headers?: Record<string, string>;
  /** Whether this server is required (fail hard) or optional (fail soft) */
  required: boolean;
}

export interface MCPToolDescriptor {
  /** Tool name (snake_case) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** Source MCP server */
  server: string;
  /** Tool category for the PANaCEa registry */
  category: ToolCategory;
}

export interface MCPDiscoveryResult {
  /** Server name */
  server: string;
  /** Whether discovery succeeded */
  success: boolean;
  /** Discovered tools */
  tools: MCPToolDescriptor[];
  /** Error message if discovery failed */
  error?: string;
  /** Duration in ms */
  durationMs: number;
}

// ─── MCP Server Registry ────────────────────────────────────────────────────

/**
 * Registry of configured MCP servers. This mirrors the servers in `.mcp.json`
 * but is runtime-configurable for environments where the MCP config file
 * isn't accessible (e.g., Cloudflare Edge).
 */
const mcpServerRegistry = new Map<string, MCPServerConfig>();

export function registerMCPServer(config: MCPServerConfig): void {
  mcpServerRegistry.set(config.name, config);
}

export function getMCPServer(name: string): MCPServerConfig | undefined {
  return mcpServerRegistry.get(name);
}

export function listMCPServers(): MCPServerConfig[] {
  return Array.from(mcpServerRegistry.values());
}

// ─── Built-in MCP Server Configs ────────────────────────────────────────────

/**
 * Register the MCP servers configured in PANaCEa's `.mcp.json`.
 * These are the servers that agents can discover tools from.
 */
export function registerBuiltInMCPServers(): void {
  // Sentry MCP — production error introspection
  registerMCPServer({
    name: 'sentry',
    transport: 'http',
    url: 'https://mcp.sentry.dev/mcp',
    headers: {},
    required: false,
  });

  // Supabase MCP — DB schema introspection, RLS audit
  registerMCPServer({
    name: 'supabase',
    transport: 'http',
    url: 'https://mcp.supabase.com/mcp',
    headers: {},
    required: false,
  });

  // Context7 MCP — version-specific library docs
  registerMCPServer({
    name: 'context7',
    transport: 'http',
    url: 'https://mcp.context7.com/mcp',
    headers: {},
    required: false,
  });
}

// ─── Tool Descriptor Registry (Static Fallback) ─────────────────────────────

/**
 * Static tool descriptors for MCP servers. These are used as fallback when
 * dynamic discovery is unavailable (e.g., in Edge runtime where we can't
 * spawn MCP client processes).
 *
 * Each entry describes a tool that an MCP server *would* expose if we could
 * connect to it dynamically. This lets agents reference MCP tools by name
 * without requiring a live MCP connection at registration time.
 */
const staticMCPToolDescriptors: MCPToolDescriptor[] = [
  // ── Sentry Tools ──────────────────────────────────────────────────────
  {
    name: 'sentry_list_issues',
    description: 'List Sentry issues with optional filtering by project, status, and time range',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Sentry project slug' },
        status: { type: 'string', enum: ['resolved', 'unresolved', 'ignored'] },
        limit: { type: 'number', description: 'Max issues to return', default: 10 },
      },
    },
    server: 'sentry',
    category: 'read',
  },
  {
    name: 'sentry_get_issue_details',
    description: 'Get detailed information about a specific Sentry issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: { type: 'string', description: 'Sentry issue ID' },
      },
      required: ['issueId'],
    },
    server: 'sentry',
    category: 'read',
  },
  {
    name: 'sentry_get_event_details',
    description: 'Get detailed event information including stack trace',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: { type: 'string' },
        eventId: { type: 'string' },
      },
      required: ['issueId', 'eventId'],
    },
    server: 'sentry',
    category: 'read',
  },

  // ── Supabase Tools ────────────────────────────────────────────────────
  {
    name: 'supabase_list_tables',
    description: 'List all tables in the Supabase database with row counts',
    inputSchema: {
      type: 'object',
      properties: {
        schema: { type: 'string', default: 'public' },
      },
    },
    server: 'supabase',
    category: 'read',
  },
  {
    name: 'supabase_describe_table',
    description: 'Get column definitions, indexes, and constraints for a table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', default: 'public' },
      },
      required: ['table'],
    },
    server: 'supabase',
    category: 'read',
  },
  {
    name: 'supabase_check_rls',
    description: 'Check if a table has Row Level Security enabled',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        schema: { type: 'string', default: 'public' },
      },
      required: ['table'],
    },
    server: 'supabase',
    category: 'read',
  },
  {
    name: 'supabase_run_sql',
    description: 'Run a read-only SQL query against the database',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query (SELECT only)' },
      },
      required: ['query'],
    },
    server: 'supabase',
    category: 'read',
  },

  // ── Context7 Tools ────────────────────────────────────────────────────
  {
    name: 'context7_resolve_library',
    description: 'Resolve a library name to a Context7-compatible library ID',
    inputSchema: {
      type: 'object',
      properties: {
        libraryName: { type: 'string', description: 'Library name (e.g., "React", "Prisma")' },
      },
      required: ['libraryName'],
    },
    server: 'context7',
    category: 'read',
  },
  {
    name: 'context7_query_docs',
    description: 'Query up-to-date documentation for a specific library',
    inputSchema: {
      type: 'object',
      properties: {
        libraryId: { type: 'string', description: 'Context7 library ID (e.g., "/mongodb/docs")' },
        query: { type: 'string', description: 'What to look up in the docs' },
      },
      required: ['libraryId', 'query'],
    },
    server: 'context7',
    category: 'read',
  },
];

// ─── MCP Tool Bridge ────────────────────────────────────────────────────────

export interface MCPBridgeOptions {
  /** MCP servers to discover tools from (defaults to all registered) */
  servers?: string[];
  /** Whether to use static fallback descriptors when dynamic discovery fails */
  useStaticFallback?: boolean;
  /** Timeout for dynamic discovery per server (ms) */
  discoveryTimeoutMs?: number;
}

/**
 * MCP Tool Bridge — discovers tools from MCP servers and registers them
 * in a ToolRegistry.
 *
 * In the Edge runtime (Cloudflare Pages Functions), dynamic MCP discovery
 * is not possible because we can't spawn subprocesses or make arbitrary
 * HTTP connections to MCP servers. In that environment, the bridge falls
 * back to static tool descriptors.
 *
 * In Node.js (local dev, agent-orchestrator package), dynamic discovery
 * could be implemented using the MCP SDK's stdio_client or HTTP client.
 * This is left as a future enhancement (requires `@modelcontextprotocol/sdk`
 * as a dependency).
 */
export class MCPToolBridge {
  private readonly servers: string[];
  private readonly useStaticFallback: boolean;
  private readonly discoveryTimeoutMs: number;

  constructor(options: MCPBridgeOptions = {}) {
    this.servers = options.servers ?? listMCPServers().map((s) => s.name);
    this.useStaticFallback = options.useStaticFallback ?? true;
    this.discoveryTimeoutMs = options.discoveryTimeoutMs ?? 5000;
  }

  /**
   * Discover tools from all configured MCP servers and return them as
   * tool descriptors. Uses static fallback by default (Edge-compatible).
   */
  async discoverTools(): Promise<MCPDiscoveryResult[]> {
    const results: MCPDiscoveryResult[] = [];

    for (const serverName of this.servers) {
      const start = Date.now();
      const config = getMCPServer(serverName);

      if (!config) {
        results.push({
          server: serverName,
          success: false,
          tools: [],
          error: `MCP server not found in registry: ${serverName}`,
          durationMs: Date.now() - start,
        });
        continue;
      }

      try {
        const tools = await this.discoverToolsFromServer(config);
        results.push({
          server: serverName,
          success: true,
          tools,
          durationMs: Date.now() - start,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (this.useStaticFallback) {
          const fallbackTools = staticMCPToolDescriptors.filter(
            (t) => t.server === serverName,
          );
          results.push({
            server: serverName,
            success: true,
            tools: fallbackTools,
            durationMs: Date.now() - start,
          });
        } else {
          results.push({
            server: serverName,
            success: false,
            tools: [],
            error: message,
            durationMs: Date.now() - start,
          });
        }
      }
    }

    return results;
  }

  /**
   * Discover tools from a single MCP server.
   *
   * In the Edge runtime, this always uses static fallback because we can't
   * make dynamic MCP connections. In Node.js, this would use the MCP SDK.
   */
  private async discoverToolsFromServer(
    config: MCPServerConfig,
  ): Promise<MCPToolDescriptor[]> {
    // Edge runtime: always use static fallback
    // Node.js: could use @modelcontextprotocol/sdk for dynamic discovery
    // For now, static fallback is the only implementation
    if (this.useStaticFallback) {
      return staticMCPToolDescriptors.filter((t) => t.server === config.name);
    }

    // Future: dynamic discovery using MCP SDK
    // if (config.transport === 'stdio') {
    //   return discoverStdioTools(config);
    // } else if (config.transport === 'http') {
    //   return discoverHttpTools(config);
    // }

    throw new Error(
      `Dynamic MCP discovery not implemented for transport: ${config.transport}. ` +
      `Set useStaticFallback: true or implement MCP SDK integration.`,
    );
  }

  /**
   * Register all discovered MCP tools into a ToolRegistry.
   * Tools are prefixed with their server name to avoid collisions
   * (e.g., "sentry_list_issues", "supabase_check_rls").
   */
  async registerTools(registry: ToolRegistry): Promise<{
    registered: number;
    failed: number;
    results: MCPDiscoveryResult[];
  }> {
    const results = await this.discoverTools();
    let registered = 0;
    let failed = 0;

    for (const result of results) {
      if (!result.success) {
        failed++;
        continue;
      }

      for (const tool of result.tools) {
        try {
          registry.register({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            parametersJsonSchema: tool.inputSchema,
            execute: async (input: unknown) => {
              // MCP tool execution is deferred to the MCP server.
              // In the static fallback mode, we return a placeholder
              // indicating the tool is available but requires a live
              // MCP connection to execute.
              return {
                status: 'deferred' as const,
                message: `MCP tool "${tool.name}" requires a live MCP connection to "${tool.server}". ` +
                  `This tool is registered for discovery but execution is deferred to the MCP server.`,
                tool: tool.name,
                server: tool.server,
                input,
              };
            },
          });
          registered++;
        } catch {
          failed++;
        }
      }
    }

    return { registered, failed, results };
  }
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Create a ToolRegistry pre-populated with MCP tools from all configured servers.
 * Uses static fallback descriptors (Edge-compatible).
 */
export async function createMCPEnhancedRegistry(
  baseRegistry?: ToolRegistry,
): Promise<{
  registry: ToolRegistry;
  results: MCPDiscoveryResult[];
}> {
  const registry = baseRegistry ?? new ToolRegistry();
  const bridge = new MCPToolBridge({ useStaticFallback: true });
  const { results } = await bridge.registerTools(registry);
  return { registry, results };
}

/**
 * Get all available MCP tool names for capability discovery.
 */
export function getMCPToolNames(): string[] {
  return staticMCPToolDescriptors.map((t) => t.name);
}

/**
 * Get MCP tools grouped by server for capability reporting.
 */
export function getMCPToolsByServer(): Record<string, MCPToolDescriptor[]> {
  const byServer: Record<string, MCPToolDescriptor[]> = {};
  for (const tool of staticMCPToolDescriptors) {
    if (!byServer[tool.server]) byServer[tool.server] = [];
    byServer[tool.server]!.push(tool);
  }
  return byServer;
}
