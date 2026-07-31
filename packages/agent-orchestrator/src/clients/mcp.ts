import { tool as langchainTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';

interface McpServerConfig {
  name: string;
  transport: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpListToolsResult {
  tools: McpToolSchema[];
}

interface McpCallToolResult {
  content: Array<{ type: 'text' | 'image' | 'resource'; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type McpSessionId = string | undefined;

function jsonSchemaToZod(schema: McpToolSchema['inputSchema']): z.ZodObject<z.ZodRawShape> {
  const entries: Array<[string, z.ZodType<unknown>]> = [];
  const properties = schema.properties ?? {};
  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as { type?: string; description?: string; enum?: string[] };
    let zodType: z.ZodType<unknown>;
    if (propSchema.enum && propSchema.enum.length > 0) {
      zodType = z.enum(propSchema.enum as [string, ...string[]]);
    } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
      zodType = z.number();
    } else if (propSchema.type === 'boolean') {
      zodType = z.boolean();
    } else {
      zodType = z.string();
    }
    if (propSchema.description) zodType = zodType.describe(propSchema.description);
    entries.push([key, zodType]);
  }
  return z.object(Object.fromEntries(entries) as z.ZodRawShape);
}

async function mcpRequest(
  url: string,
  method: string,
  params?: Record<string, unknown>,
  sessionId?: McpSessionId,
  headers?: Record<string, string>,
): Promise<McpJsonRpcResponse> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  });

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    ...headers,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: reqHeaders,
    body,
  });

  if (!res.ok) {
    throw new Error(`MCP server ${url} returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }

  const json = (await res.json()) as McpJsonRpcResponse;
  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }
  return json;
}

async function mcpInitialize(
  url: string,
  headers?: Record<string, string>,
): Promise<McpSessionId> {
  const res = await mcpRequest(
    url,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'panacea-orchestrator', version: '0.1.0' },
    },
    undefined,
    headers,
  );

  const result = res.result as { protocolVersion?: string; capabilities?: Record<string, unknown> } | undefined;
  if (!result) throw new Error(`MCP initialize failed for ${url}: no result`);

  await mcpRequest(url, 'notifications/initialized', undefined, undefined, headers);
  return undefined;
}

async function mcpListTools(
  url: string,
  sessionId: McpSessionId,
  headers?: Record<string, string>,
): Promise<McpToolSchema[]> {
  const res = await mcpRequest(url, 'tools/list', undefined, sessionId, headers);
  const result = res.result as McpListToolsResult | undefined;
  return result?.tools ?? [];
}

async function mcpCallTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionId: McpSessionId,
  headers?: Record<string, string>,
): Promise<McpCallToolResult> {
  const res = await mcpRequest(
    url,
    'tools/call',
    { name: toolName, arguments: args },
    sessionId,
    headers,
  );
  return res.result as McpCallToolResult;
}

export class McpClient {
  private servers: Map<string, { config: McpServerConfig; sessionId: McpSessionId; tools: McpToolSchema[] }> = new Map();

  async connect(config: McpServerConfig): Promise<void> {
    if (this.servers.has(config.name)) return;

    try {
      const sessionId = await mcpInitialize(config.url, config.headers);
      const tools = await mcpListTools(config.url, sessionId, config.headers);
      this.servers.set(config.name, { config, sessionId, tools });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mcp-client] Failed to connect to MCP server "${config.name}" at ${config.url}: ${msg}`);
    }
  }

  async connectAll(configs: McpServerConfig[]): Promise<void> {
    await Promise.all(configs.map((c) => this.connect(c)));
  }

  getTools(): StructuredToolInterface[] {
    const allTools: StructuredToolInterface[] = [];
    for (const [serverName, server] of this.servers) {
      for (const mcpTool of server.tools) {
        const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);
        const toolName = `mcp_${serverName}_${mcpTool.name}`;

        const lcTool = langchainTool(
          async (input: Record<string, unknown>): Promise<string> => {
            try {
              const result = await mcpCallTool(
                server.config.url,
                mcpTool.name,
                input,
                server.sessionId,
                server.config.headers,
              );
              if (result.isError) {
                const errorText = result.content
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text ?? '')
                  .join('\n');
                return `MCP tool error: ${errorText || 'unknown error'}`;
              }
              return result.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text ?? '')
                .join('\n');
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return `MCP tool "${toolName}" failed: ${msg}`;
            }
          },
          {
            name: toolName,
            description: mcpTool.description ?? `MCP tool from ${serverName}: ${mcpTool.name}`,
            schema: zodSchema,
          },
        );
        allTools.push(lcTool);
      }
    }
    return allTools;
  }

  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  getToolCount(): number {
    let count = 0;
    for (const server of this.servers.values()) {
      count += server.tools.length;
    }
    return count;
  }
}

let _defaultClient: McpClient | null = null;

export function getMcpClient(): McpClient {
  if (!_defaultClient) _defaultClient = new McpClient();
  return _defaultClient;
}

export async function initMcpClient(configs: McpServerConfig[]): Promise<McpClient> {
  const client = getMcpClient();
  await client.connectAll(configs);
  return client;
}
