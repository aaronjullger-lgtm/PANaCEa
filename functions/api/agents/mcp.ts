/**
 * PANaCEa MCP Server Endpoint
 *
 * Cloudflare Pages Function that serves the PANaCEa MCP server over HTTP.
 * Implements the MCP streamable HTTP transport.
 *
 * Endpoint: POST /api/agents/mcp
 * Protocol: JSON-RPC 2.0 over HTTP
 *
 * @module functions/api/agents/mcp
 */

import { McpServer } from '@/lib/agents/mcp/server';
import type { ToolExecutionContext } from '@/lib/services/agents/types';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// ─── CORS Headers ───────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// ─── Handler ────────────────────────────────────────────────────────────────

export async function onRequestPost(
  context: EventContext<Record<string, string>, string, Record<string, unknown>>,
): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    // Parse request body
    const body = await context.request.json().catch(() => null);
    if (!body) {
      return jsonResponse(
        { jsonrpc: '2.0', id: 0, error: { code: -32700, message: 'Parse error' } },
        400,
      );
    }

    // Create tool execution context
    const toolContext: ToolExecutionContext = {
      prisma,
      env: (context.env ?? {}) as Record<string, unknown>,
      userId: 'mcp-system', // MCP tools are system-level, not user-scoped
    };

    // Create MCP server and handle request
    const server = new McpServer({ toolContext });
    const result = await server.handleRequest(body);

    if (result === null) {
      // Notification — return 202 Accepted with no body
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }

    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MCP Endpoint] Error:', message);
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: 0,
        error: { code: -32603, message: `Internal error: ${message}` },
      },
      500,
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

/**
 * Handle CORS preflight.
 */
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
