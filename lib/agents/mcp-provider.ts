/**
 * MCP Tool Provider for Edge Agents
 *
 * Wires MCP (Model Context Protocol) tools into PANaCEa's Edge agent
 * infrastructure. Agents can discover and invoke tools from configured
 * MCP servers — filesystem access, web search, database queries, etc.
 *
 * Uses the existing mcp-adapter.ts for transport and provides a
 * registry-compatible tool surface that agents consume via the
 * standard ToolRegistry pattern.
 *
 * @module lib/agents/mcp-provider
 */

import type { StructuredTool } from '@langchain/core/tools';
import { getMCPTools, getMCPToolDescriptors, clearMCPCache, type MCPAdapterConfig } from './mcp-adapter';
import type { AgentContext } from './shared/types';

export interface MCPProviderConfig {
  servers: MCPAdapterConfig[];
  refreshIntervalMs?: number;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  serverName: string;
  inputSchema: Record<string, unknown>;
}

let _providerCache: { tools: StructuredTool[]; infos: MCPToolInfo[]; loadedAt: number } | null = null;

export async function initializeMCPProvider(config: MCPProviderConfig): Promise<MCPToolInfo[]> {
  if (_providerCache && Date.now() - _providerCache.loadedAt < (config.refreshIntervalMs ?? 300_000)) {
    return _providerCache.infos;
  }

  const allTools: StructuredTool[] = [];
  const allInfos: MCPToolInfo[] = [];

  for (const server of config.servers) {
    try {
      const tools = await getMCPTools(server);
      const descriptors = await getMCPToolDescriptors(server);

      allTools.push(...tools);
      allInfos.push(
        ...descriptors.map((d) => ({
          name: `${server.serverName}__${d.name}`,
          description: `[${server.serverName}] ${d.description}`,
          serverName: server.serverName,
          inputSchema: (d.inputSchema._def as unknown as Record<string, unknown>) ?? {},
        })),
      );
    } catch (err) {
      console.warn(`[MCPProvider] Failed to load tools from ${server.serverName}:`, err);
    }
  }

  _providerCache = { tools: allTools, infos: allInfos, loadedAt: Date.now() };
  return allInfos;
}

export function getMCPToolInfos(): MCPToolInfo[] {
  return _providerCache?.infos ?? [];
}

export function getMCPToolByName(name: string): StructuredTool | undefined {
  return _providerCache?.tools.find((t) => t.name === name);
}

export function clearMCPProviderCache(): void {
  _providerCache = null;
  clearMCPCache();
}

export async function invokeMCPTool(
  toolName: string,
  args: unknown,
  _ctx: AgentContext,
): Promise<{ ok: boolean; output: unknown; error?: string }> {
  const tool = getMCPToolByName(toolName);
  if (!tool) {
    return { ok: false, output: null, error: `MCP tool not found: ${toolName}` };
  }

  try {
    const result = await tool.invoke(args as Record<string, unknown>);
    return { ok: true, output: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, output: null, error: message };
  }
}
