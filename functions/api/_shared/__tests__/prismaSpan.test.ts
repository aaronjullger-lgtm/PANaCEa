import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOW_QUERY_MS, withPrismaSpan } from '../prismaSpan';

// Minimal fake of Prisma's extension runtime. We don't need a real Prisma
// client to unit-test the extension's behavior — we just need to invoke the
// wrapped `$allOperations` handler with the same shape Prisma would pass.
type Handler = (params: {
  model: string | undefined;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

function extractHandler(): Handler {
  // withPrismaSpan returns a Prisma extension factory. We can't just call it —
  // it needs a client. So we inspect its produced extension definition by
  // stubbing `$extends` to capture the handler.
  let captured: Handler | undefined;

  const mockClient = {
    $extends(def: any) {
      if (def?.query?.$allModels?.$allOperations) {
        captured = def.query.$allModels.$allOperations as Handler;
      }
      return mockClient;
    },
  };

  const extension = withPrismaSpan();
  // Prisma's defineExtension returns a function that takes a client and
  // returns an extended client. Call it with our mock to capture the handler.
  (extension as unknown as (c: typeof mockClient) => typeof mockClient)(mockClient);

  if (!captured) {
    throw new Error('Failed to capture $allOperations handler');
  }
  return captured;
}

describe('prismaSpan extension', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a prisma_span log on successful queries', async () => {
    const handler = extractHandler();
    const result = await handler({
      model: 'User',
      operation: 'findUnique',
      args: { where: { id: 1 } },
      query: async () => ({ id: 1, name: 'test' }),
    });

    expect(result).toEqual({ id: 1, name: 'test' });
    expect(logSpy).toHaveBeenCalledTimes(1);

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({
      event: 'prisma_span',
      model: 'User',
      operation: 'findUnique',
      success: true,
    });
    expect(typeof logged.durationMs).toBe('number');
    expect(typeof logged.timestamp).toBe('string');
  });

  it('emits prisma_slow_query when duration exceeds threshold', async () => {
    const handler = extractHandler();

    // Force a slow query via a custom query that waits past the threshold.
    // Using real setTimeout so the duration is measurable.
    await handler({
      model: 'Question',
      operation: 'findMany',
      args: {},
      query: async () => {
        await new Promise((r) => setTimeout(r, SLOW_QUERY_MS + 20));
        return [];
      },
    });

    // One prisma_span (console.log) + one prisma_slow_query (console.warn)
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const slow = JSON.parse(warnSpy.mock.calls[0]![0] as string);
    expect(slow.event).toBe('prisma_slow_query');
    expect(slow.model).toBe('Question');
    expect(slow.operation).toBe('findMany');
    expect(slow.durationMs).toBeGreaterThanOrEqual(SLOW_QUERY_MS);
  });

  it('emits prisma_error and rethrows on failure', async () => {
    const handler = extractHandler();
    const err = new Error('connection lost');

    await expect(
      handler({
        model: 'ReviewLog',
        operation: 'create',
        args: {},
        query: async () => {
          throw err;
        },
      })
    ).rejects.toBe(err);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(warnSpy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({
      event: 'prisma_error',
      model: 'ReviewLog',
      operation: 'create',
      success: false,
      error: 'connection lost',
    });
  });

  it('truncates long error messages to 300 chars', async () => {
    const handler = extractHandler();
    const longMsg = 'x'.repeat(500);

    await expect(
      handler({
        model: 'Question',
        operation: 'update',
        args: {},
        query: async () => {
          throw new Error(longMsg);
        },
      })
    ).rejects.toThrow();

    const logged = JSON.parse(warnSpy.mock.calls[0]![0] as string);
    expect((logged.error as string).length).toBe(300);
  });

  it('falls back to "unknown" when model is undefined (raw queries)', async () => {
    const handler = extractHandler();
    await handler({
      model: undefined,
      operation: '$queryRaw',
      args: [],
      query: async () => [],
    });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(logged.model).toBe('unknown');
    expect(logged.operation).toBe('$queryRaw');
  });

  it('does not throw when console.log/warn is unavailable', async () => {
    // Simulate the console being unavailable — some edge runtimes replace it.
    const handler = extractHandler();
    logSpy.mockImplementation(() => {
      throw new Error('console disabled');
    });

    // Should still succeed because emit() swallows logging errors.
    const result = await handler({
      model: 'User',
      operation: 'findFirst',
      args: {},
      query: async () => ({ id: 1 }),
    });
    expect(result).toEqual({ id: 1 });
  });
});
