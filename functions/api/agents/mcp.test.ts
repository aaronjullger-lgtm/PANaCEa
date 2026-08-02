import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockMcpServerInstance: { handleRequest: ReturnType<typeof vi.fn>; config?: unknown } = {
    handleRequest: vi.fn(),
  };
  const mockMcpServerCtor = vi.fn(function (this: unknown, config: unknown) {
    mockMcpServerInstance.config = config;
    return mockMcpServerInstance;
  });
  return {
    mockPrisma: { $disconnect: vi.fn().mockResolvedValue(undefined) },
    mockCreateEdgePrismaClient: vi.fn(),
    mockSafePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
    mockMcpServerCtor,
    mockMcpServerInstance,
  };
});

const mockPrisma = hoisted.mockPrisma;
const mockCreateEdgePrismaClient = hoisted.mockCreateEdgePrismaClient;
const mockSafePrismaDisconnect = hoisted.mockSafePrismaDisconnect;
const mockMcpServerCtor = hoisted.mockMcpServerCtor;
const mockMcpServerInstance = hoisted.mockMcpServerInstance;

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: hoisted.mockCreateEdgePrismaClient,
  safePrismaDisconnect: hoisted.mockSafePrismaDisconnect,
}));

vi.mock('@/lib/agents/mcp/server', () => ({
  McpServer: hoisted.mockMcpServerCtor,
}));

// Import after mocks
import { onRequestPost } from './mcp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(body: unknown): any {
  return {
    request: {
      json: vi.fn().mockResolvedValue(body),
    },
    env: { DATABASE_URL: 'prisma://accelerate.example.com/?api_key=test' },
  };
}

async function readJson(response: Response): Promise<any> {
  return JSON.parse(await response.text());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateEdgePrismaClient.mockReturnValue(mockPrisma);
  mockMcpServerInstance.handleRequest.mockReset();
  mockMcpServerInstance.handleRequest.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: { ok: true } });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('functions/api/agents/mcp.ts onRequestPost', () => {
  it('creates the Prisma Edge client from DATABASE_URL', async () => {
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'ping' });
    await onRequestPost(context);

    expect(mockCreateEdgePrismaClient).toHaveBeenCalledWith(
      'prisma://accelerate.example.com/?api_key=test',
    );
  });

  it('passes the Prisma client into the McpServer tool context', async () => {
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'ping' });
    await onRequestPost(context);

    const config = (mockMcpServerInstance as any).config;
    expect(config.toolContext.prisma).toBe(mockPrisma);
    expect(config.toolContext.userId).toBe('mcp-system');
    expect(config.toolContext.env.DATABASE_URL).toBe(
      'prisma://accelerate.example.com/?api_key=test',
    );
  });

  it('returns the JSON-RPC response from the server', async () => {
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    expect(mockMcpServerInstance.handleRequest).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    expect(await readJson(response)).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } });
  });

  it('returns 202 for notifications (server returns null)', async () => {
    mockMcpServerInstance.handleRequest.mockResolvedValue(null);
    const context = makeContext({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const response = await onRequestPost(context);

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
  });

  it('returns 400 with JSON-RPC parse error for invalid JSON bodies', async () => {
    const context = makeContext(null);
    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32700);
  });

  it('returns 500 with JSON-RPC internal error when the server throws', async () => {
    mockMcpServerInstance.handleRequest.mockRejectedValue(new Error('boom'));
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'tools/call' });
    const response = await onRequestPost(context);

    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body.error.code).toBe(-32603);
    expect(body.error.message).toContain('boom');
  });

  it('disconnects Prisma in finally on success', async () => {
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'ping' });
    await onRequestPost(context);

    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('disconnects Prisma in finally on error', async () => {
    mockMcpServerInstance.handleRequest.mockRejectedValue(new Error('boom'));
    const context = makeContext({ jsonrpc: '2.0', id: 1, method: 'tools/call' });
    await onRequestPost(context);

    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
