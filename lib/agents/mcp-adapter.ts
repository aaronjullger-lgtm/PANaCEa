/**
 * MCP Tool Adapter for Edge Agents
 *
 * Bridges Model Context Protocol (MCP) tools into PANaCEa's Edge agent
 * infrastructure. Uses @langchain/langchain-mcp-adapters to convert
 * MCP server tools into LangChain-compatible StructuredTools that
 * Edge agents can use.
 *
 * This enables Edge agents to access external tools (filesystem,
 * web search, database queries) through MCP servers without
 * importing Node-only dependencies.
 *
 * @module lib/agents/mcp-adapter
 */

import type { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  serverName: string;
}

export interface MCPAdapterConfig {
  serverUrl: string;
  serverName: string;
  tools?: string[];
}

let _mcpTools: StructuredTool[] | null = null;
let _mcpLoadError: string | null = null;

async function loadMCPTools(config: MCPAdapterConfig): Promise<StructuredTool[]> {
  if (_mcpTools) return _mcpTools;
  if (_mcpLoadError) return [];

  try {
    // Dynamic import — only resolves when @langchain/langchain-mcp-adapters is installed
    const mcpModule = await import('@langchain/langchain-mcp-adapters');
    const { MultiServerMCPClient } = mcpModule as {
      MultiServerMCPClient: new (configs: Record<string, { transport: string; url: string }>) => {
        getTools: () => Promise<StructuredTool[]>;
      };
    };

    const client = new MultiServerMCPClient({
      [config.serverName]: {
        transport: 'streamable_http',
        url: config.serverUrl,
      },
    });

    const tools = await client.getTools();

    if (config.tools && config.tools.length > 0) {
      _mcpTools = tools.filter((t: StructuredTool) => config.tools!.includes(t.name));
    } else {
      _mcpTools = tools;
    }

    return _mcpTools as StructuredTool[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _mcpLoadError = msg;
    console.debug('[MCPAdapter] MCP tools unavailable:', msg);
    return [];
  }
}

export async function getMCPTools(config: MCPAdapterConfig): Promise<StructuredTool[]> {
  return loadMCPTools(config);
}

export async function getMCPToolDescriptors(config: MCPAdapterConfig): Promise<MCPToolDescriptor[]> {
  const tools = await loadMCPTools(config);
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.schema as z.ZodType,
    serverName: config.serverName,
  }));
}

export function clearMCPCache(): void {
  _mcpTools = null;
  _mcpLoadError = null;
}
