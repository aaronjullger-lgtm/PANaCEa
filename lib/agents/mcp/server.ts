/**
 * PANaCEa MCP (Model Context Protocol) Server
 *
 * Exposes PANaCEa's agent tools as MCP tools consumable by any MCP-compatible
 * client (Claude Desktop, Cursor, Continue, etc.). Implements the MCP 2024-11-05
 * specification over HTTP (streamable HTTP transport).
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST
 * Methods: initialize, tools/list, tools/call, resources/list, prompts/list
 *
 * Edge-runtime safe: no Node.js APIs, no filesystem access.
 *
 * @module lib/agents/mcp/server
 */

import { z } from 'zod';
import type { ToolExecutionContext } from '@/lib/services/agents/types';
import { createDefaultToolRegistry, type AnyToolDefinition } from '@/lib/services/agents/toolRegistry';

// ─── JSON-RPC 2.0 Types ────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ─── MCP Protocol Constants ─────────────────────────────────────────────────

const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'panacea-mcp';
const SERVER_VERSION = '1.0.0';

// ─── MCP Tool Schema Conversion ─────────────────────────────────────────────

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Convert a PANaCEa ToolDefinition to an MCP-compatible tool schema.
 */
function toMcpTool(tool: AnyToolDefinition): McpTool {
  const schema = tool.parametersJsonSchema as Record<string, unknown> | undefined;
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: (schema?.properties as Record<string, unknown>) ?? {},
      required: (schema?.required as string[]) ?? [],
    },
  };
}

// ─── MCP Resource Schema ────────────────────────────────────────────────────

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const MCP_RESOURCES: McpResource[] = [
  {
    uri: 'panacea://blueprint/nccpa-2025',
    name: 'NCCPA 2025 Blueprint',
    description: 'Current NCCPA PANCE blueprint with organ system weights',
    mimeType: 'application/json',
  },
  {
    uri: 'panacea://fsrs/parameters',
    name: 'FSRS Parameters',
    description: 'Current FSRS v6 scheduling parameters',
    mimeType: 'application/json',
  },
  {
    uri: 'panacea://content/health',
    name: 'Content Health Summary',
    description: 'Aggregate content health metrics across the question bank',
    mimeType: 'application/json',
  },
];

// ─── MCP Prompt Schema ──────────────────────────────────────────────────────

interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

const MCP_PROMPTS: McpPrompt[] = [
  {
    name: 'audit-blueprint-coverage',
    description: 'Audit question bank coverage against the NCCPA blueprint',
    arguments: [
      { name: 'system', description: 'Organ system to audit (e.g. Cardiovascular). Omit for all.', required: false },
    ],
  },
  {
    name: 'check-content-health',
    description: 'Check content health metrics for the question bank',
    arguments: [
      { name: 'minScore', description: 'Minimum health score threshold (0-1)', required: false },
    ],
  },
  {
    name: 'verify-condition',
    description: 'Verify clinical accuracy of a medical condition entry',
    arguments: [
      { name: 'conditionId', description: 'Condition ID to verify', required: true },
    ],
  },
];

// ─── Error Codes ────────────────────────────────────────────────────────────

const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_ERROR: -32002,
} as const;

// ─── Server Implementation ──────────────────────────────────────────────────

export interface McpServerConfig {
  /** Tool execution context (Prisma client, env, etc.) */
  toolContext: ToolExecutionContext;
  /** Optional: restrict which tools are exposed. Default: all 10 tools. */
  allowedTools?: string[];
  /** Optional: server name override */
  name?: string;
  /** Optional: server version override */
  version?: string;
}

/**
 * MCP Server — handles JSON-RPC requests and dispatches to PANaCEa tools.
 *
 * Usage:
 * ```ts
 * const server = new McpServer({ toolContext: { prisma, env } });
 * const response = await server.handleRequest(jsonRpcBody);
 * ```
 */
export class McpServer {
  private readonly toolRegistry: ReturnType<typeof createDefaultToolRegistry>;
  private readonly config: McpServerConfig;
  private initialized = false;
  private clientVersion: string | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.toolRegistry = createDefaultToolRegistry();
  }

  /**
   * Handle a single JSON-RPC request. Returns a JSON-RPC response.
   * For notifications (no id), returns null.
   */
  async handleRequest(body: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    // Parse and validate JSON-RPC request
    const request = this.parseRequest(body);
    if (!request) return null; // notification or parse error already handled

    // Batch requests
    if (Array.isArray(body)) {
      const requests = body as unknown[];
      const responses: JsonRpcResponse[] = [];
      for (const item of requests) {
        const req = this.parseRequest(item);
        if (req) {
          responses.push(await this.dispatch(req));
        }
      }
      return responses.length > 0 ? responses : null;
    }

    return this.dispatch(request);
  }

  private parseRequest(body: unknown): JsonRpcRequest | null {
    if (typeof body !== 'object' || body === null) {
      return null; // notifications don't require a response
    }

    const req = body as Record<string, unknown>;

    if (req.jsonrpc !== '2.0') {
      throw this.errorResponse(
        (req.id as number | string) ?? 0,
        ERROR_CODES.INVALID_REQUEST,
        'Invalid JSON-RPC version'
      );
    }

    // Notification (no id) — don't respond
    if (req.id === undefined || req.id === null) return null;

    return {
      jsonrpc: '2.0',
      id: req.id as number | string,
      method: req.method as string,
      params: req.params as Record<string, unknown> | undefined,
    };
  }

  private async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'notifications/initialized':
          return { jsonrpc: '2.0', id: request.id, result: {} };
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return await this.handleToolsCall(request);
        case 'resources/list':
          return this.handleResourcesList(request);
        case 'resources/read':
          return await this.handleResourcesRead(request);
        case 'prompts/list':
          return this.handlePromptsList(request);
        case 'prompts/get':
          return this.handlePromptsGet(request);
        case 'ping':
          return { jsonrpc: '2.0', id: request.id, result: {} };
        default:
          return this.errorResponse(
            request.id,
            ERROR_CODES.METHOD_NOT_FOUND,
            `Method not found: ${request.method}`
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MCP Server] Error handling ${request.method}:`, message);
      return this.errorResponse(request.id, ERROR_CODES.INTERNAL_ERROR, message);
    }
  }

  // ─── Method Handlers ────────────────────────────────────────────────────

  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params ?? {};
    this.clientVersion = (params.protocolVersion as string) ?? MCP_VERSION;
    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: this.config.name ?? SERVER_NAME,
          version: this.config.version ?? SERVER_VERSION,
        },
      },
    };
  }

  private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
    const allTools = this.toolRegistry.list();
    const allowedNames = this.config.allowedTools
      ? new Set(this.config.allowedTools)
      : null;

    const tools = allTools
      .filter((t) => !allowedNames || allowedNames.has(t.name))
      .map(toMcpTool);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools },
    };
  }

  private async handleToolsCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params ?? {};
    const toolName = params.name as string | undefined;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

    if (!toolName) {
      return this.errorResponse(request.id, ERROR_CODES.INVALID_PARAMS, 'Missing tool name');
    }

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return this.errorResponse(
        request.id,
        ERROR_CODES.TOOL_NOT_FOUND,
        `Tool not found: ${toolName}`
      );
    }

    // Check allowed tools
    if (this.config.allowedTools && !this.config.allowedTools.includes(toolName)) {
      return this.errorResponse(
        request.id,
        ERROR_CODES.TOOL_NOT_FOUND,
        `Tool not available: ${toolName}`
      );
    }

    try {
      // Validate input with Zod schema
      const validatedInput = tool.inputSchema
        ? (tool.inputSchema as z.ZodType).parse(toolArgs)
        : toolArgs;

      // Execute the tool
      const result = await tool.execute(validatedInput, this.config.toolContext);

      // Format as MCP tool result
      const content = typeof result === 'string'
        ? [{ type: 'text' as const, text: result }]
        : [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }];

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content,
          isError: false,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Zod validation errors
      if (err instanceof z.ZodError) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text' as const, text: `Validation error: ${message}` }],
            isError: true,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text' as const, text: `Tool execution error: ${message}` }],
          isError: true,
        },
      };
    }
  }

  private handleResourcesList(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { resources: MCP_RESOURCES },
    };
  }

  private async handleResourcesRead(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params ?? {};
    const uri = params.uri as string | undefined;

    if (!uri) {
      return this.errorResponse(request.id, ERROR_CODES.INVALID_PARAMS, 'Missing resource URI');
    }

    // Handle known resources
    switch (uri) {
      case 'panacea://blueprint/nccpa-2025': {
        const { NCCPA_2025_BLUEPRINT } = await import('@/lib/services/agents/tools/blueprintCoverageCheck');
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(NCCPA_2025_BLUEPRINT, null, 2),
            }],
          },
        };
      }
      default:
        return this.errorResponse(
          request.id,
          ERROR_CODES.METHOD_NOT_FOUND,
          `Resource not found: ${uri}`
        );
    }
  }

  private handlePromptsList(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { prompts: MCP_PROMPTS },
    };
  }

  private handlePromptsGet(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params ?? {};
    const name = params.name as string | undefined;

    if (!name) {
      return this.errorResponse(request.id, ERROR_CODES.INVALID_PARAMS, 'Missing prompt name');
    }

    const prompt = MCP_PROMPTS.find((p) => p.name === name);
    if (!prompt) {
      return this.errorResponse(request.id, ERROR_CODES.METHOD_NOT_FOUND, `Prompt not found: ${name}`);
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Run the "${prompt.name}" prompt with the provided arguments.`,
            },
          },
        ],
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private errorResponse(id: number | string, code: number, message: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
  }
}

/**
 * Create a pre-configured MCP server with the default tool registry.
 */
export function createMcpServer(config: McpServerConfig): McpServer {
  return new McpServer(config);
}

/**
 * Re-export for the MCP endpoint.
 */
export { NCCPA_2025_BLUEPRINT } from '@/lib/services/agents/tools/blueprintCoverageCheck';
