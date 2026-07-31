/**
 * PANaCEa MCP Tools Integration
 *
 * Loads tools from PANaCEa's MCP servers (1Password, Cloudflare, AIDesigner,
 * Context7) and converts them to LangChain-compatible tools for use in agents.
 *
 * Uses `@langchain/mcp-adapters` (JS) which provides `MultiServerMCPClient`
 * and `loadMcpTools` — the same API as the Python package.
 *
 * MCP Servers configured in PANaCEa:
 * - 1Password: secrets management (op:// references)
 * - Cloudflare: Workers, Pages, D1, KV, R2 management
 * - AIDesigner: UI generation and design tools
 * - Context7: documentation lookup
 *
 * @module lib/langchain/mcp
 */

import type { StructuredToolInterface } from '@langchain/core/tools';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface McpServerConfig {
  /** Transport type */
  transport: 'stdio' | 'http' | 'sse';
  /** For stdio: command to run */
  command?: string;
  /** For stdio: command arguments */
  args?: string[];
  /** For http/sse: server URL */
  url?: string;
  /** Optional headers for http/sse transport */
  headers?: Record<string, string>;
  /** Server display name */
  name?: string;
}

export interface McpToolsResult {
  tools: StructuredToolInterface[];
  serverNames: string[];
  errors: string[];
}

// ─── MCP Server Registry ──────────────────────────────────────────────────

/**
 * PANaCEa's configured MCP servers.
 *
 * These match the MCP servers configured in the project's MCP setup
 * (see .mcp.json or the agent's MCP configuration).
 *
 * Note: In production (Cloudflare Edge), stdio transport is NOT available.
 * Only http/sse transports work in Edge runtime. The 1Password MCP uses
 * a local script (scripts/mcp-1password.js) which is stdio-only and
 * therefore NOT available in Edge functions.
 */
export const PANACEA_MCP_SERVERS: Record<string, McpServerConfig> = {
  // 1Password — secrets management (stdio only, local dev only)
  '1password': {
    transport: 'stdio',
    command: 'node',
    args: ['scripts/mcp-1password.js'],
    name: '1Password',
  },

  // Cloudflare — infrastructure management (http)
  'cloudflare': {
    transport: 'http',
    url: 'https://api.cloudflare.com/client/v4',
    name: 'Cloudflare',
  },

  // AIDesigner — UI generation (http)
  'aidesigner': {
    transport: 'http',
    url: 'https://api.aidesigner.ai/mcp',
    name: 'AIDesigner',
  },

  // Context7 — documentation lookup (http)
  'context7': {
    transport: 'http',
    url: 'https://context7.com/api/mcp',
    name: 'Context7',
  },
};

// ─── Edge-Safe Server Filter ──────────────────────────────────────────────

/**
 * Filter MCP servers to only those available in the current runtime.
 *
 * In Cloudflare Edge Functions:
 * - stdio transport is NOT available (no child_process)
 * - Only http/sse transports work
 *
 * In Node.js (local dev, CLI, scripts):
 * - All transports are available
 */
export function filterEdgeSafeServers(
  servers: Record<string, McpServerConfig>,
  isEdge: boolean,
): Record<string, McpServerConfig> {
  if (!isEdge) return servers;

  const filtered: Record<string, McpServerConfig> = {};
  for (const [key, config] of Object.entries(servers)) {
    if (config.transport !== 'stdio') {
      filtered[key] = config;
    }
  }
  return filtered;
}

// ─── MCP Client Factory ───────────────────────────────────────────────────

/**
 * Load MCP tools from configured servers.
 *
 * Uses @langchain/mcp-adapters MultiServerMCPClient to connect to multiple
 * MCP servers and load their tools as LangChain StructuredTool instances.
 *
 * In Edge runtime, stdio-based servers are automatically skipped.
 *
 * @param isEdge - Whether running in Cloudflare Edge (disables stdio servers)
 * @param serverFilter - Optional list of server names to include (default: all available)
 * @returns Loaded tools and metadata
 *
 * @example
 * ```ts
 * // In a Node.js script:
 * const { tools } = await loadPanaceaMcpTools();
 *
 * // In a Cloudflare Function:
 * const { tools } = await loadPanaceaMcpTools(true);
 * ```
 */
export async function loadPanaceaMcpTools(
  isEdge = false,
  serverFilter?: string[],
): Promise<McpToolsResult> {
  const errors: string[] = [];
  const serverNames: string[] = [];
  const allTools: StructuredToolInterface[] = [];

  // Filter servers for Edge compatibility
  const availableServers = filterEdgeSafeServers(PANACEA_MCP_SERVERS, isEdge);

  // Apply server filter if provided
  const serversToLoad = serverFilter
    ? Object.fromEntries(
        Object.entries(availableServers).filter(([key]) => serverFilter.includes(key)),
      )
    : availableServers;

  if (Object.keys(serversToLoad).length === 0) {
    return { tools: [], serverNames: [], errors: ['No MCP servers available in this runtime'] };
  }

  try {
    // Dynamic import — @langchain/mcp-adapters may not be available in all environments
    const { MultiServerMCPClient } = await import('@langchain/mcp-adapters');

    // Build client config from server registry
    const clientConfig: Record<string, Record<string, unknown>> = {};
    for (const [key, config] of Object.entries(serversToLoad)) {
      const entry: Record<string, unknown> = {
        transport: config.transport,
      };
      if (config.command) entry.command = config.command;
      if (config.args) entry.args = config.args;
      if (config.url) entry.url = config.url;
      if (config.headers) entry.headers = config.headers;
      clientConfig[key] = entry;
    }

    const client = new MultiServerMCPClient(clientConfig);
    const tools = await client.getTools();

    serverNames.push(...Object.keys(serversToLoad));
    allTools.push(...tools);

    // Close client connections
    try {
      await client.close();
    } catch {
      // Best-effort cleanup
    }

    return { tools: allTools, serverNames, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to load MCP tools: ${message}`);

    // If MultiServerMCPClient fails, try individual server loading
    for (const [key, config] of Object.entries(serversToLoad)) {
      try {
        const tools = await loadSingleMcpServer(config);
        allTools.push(...tools);
        serverNames.push(key);
      } catch (serverError) {
        const msg = serverError instanceof Error ? serverError.message : String(serverError);
        errors.push(`Server "${key}" failed: ${msg}`);
      }
    }

    return { tools: allTools, serverNames, errors };
  }
}

/**
 * Load tools from a single MCP server.
 * Fallback when MultiServerMCPClient is unavailable.
 */
async function loadSingleMcpServer(config: McpServerConfig): Promise<StructuredToolInterface[]> {
  try {
    const { loadMcpTools } = await import('@langchain/mcp-adapters');

    if (config.transport === 'stdio' && config.command) {
      // Stdio transport — requires Node.js child_process
      const { ClientSession } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/stdio.js'
      );

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      });

      const session = new ClientSession(
        { name: 'panacea-mcp-client', version: '1.0.0' },
        { capabilities: {} },
      );

      await transport.start();
      await session.connect(transport);
      await session.initialize();

      const tools = await loadMcpTools(session);
      return tools;
    }

    if ((config.transport === 'http' || config.transport === 'sse') && config.url) {
      // HTTP/SSE transport
      const { ClientSession } = await import('@modelcontextprotocol/sdk/client/index.js');

      // For HTTP transport, use streamable HTTP client
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );

      const transport = new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });

      const session = new ClientSession(
        { name: 'panacea-mcp-client', version: '1.0.0' },
        { capabilities: {} },
      );

      await transport.start();
      await session.connect(transport);
      await session.initialize();

      const tools = await loadMcpTools(session);
      return tools;
    }

    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[PanaceaMCP] Failed to load server "${config.name ?? 'unknown'}": ${message}`);
    return [];
  }
}

// ─── Tool Name Prefixing ──────────────────────────────────────────────────

/**
 * Add a server prefix to tool names to avoid collisions when loading
 * tools from multiple MCP servers.
 *
 * @example
 * ```ts
 * const prefixed = prefixMcpTools(tools, '1password');
 * // Tool "read_secret" becomes "1password__read_secret"
 * ```
 */
export function prefixMcpTools(
  tools: StructuredToolInterface[],
  serverName: string,
): StructuredToolInterface[] {
  return tools.map((tool) => {
    const originalName = tool.name;
    const prefixedName = `${serverName}__${originalName}`;

    // Create a wrapper that delegates to the original tool
    return {
      ...tool,
      name: prefixedName,
      description: `[${serverName}] ${tool.description}`,
    } as StructuredToolInterface;
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────

/**
 * Check which MCP servers are available in the current runtime.
 * Useful for health endpoints and debugging.
 */
export async function checkMcpHealth(isEdge = false): Promise<{
  available: string[];
  unavailable: string[];
  errors: string[];
}> {
  const available: string[] = [];
  const unavailable: string[] = [];
  const allErrors: string[] = [];

  const servers = filterEdgeSafeServers(PANACEA_MCP_SERVERS, isEdge);

  for (const [key, config] of Object.entries(servers)) {
    try {
      const tools = await loadSingleMcpServer(config);
      if (tools.length > 0) {
        available.push(key);
      } else {
        unavailable.push(key);
        allErrors.push(`Server "${key}" returned 0 tools`);
      }
    } catch (error) {
      unavailable.push(key);
      const msg = error instanceof Error ? error.message : String(error);
      allErrors.push(`Server "${key}": ${msg}`);
    }
  }

  return { available, unavailable, errors: allErrors };
}
