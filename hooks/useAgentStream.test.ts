import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentStream, type UseAgentStreamReturn } from './useAgentStream';

// Mock getApiEndpoint
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: (path: string) => path,
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createSSEStream(events: Array<{ event: string; data: unknown }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function createMockResponse(events: Array<{ event: string; data: unknown }>, ok = true): Response {
  return {
    ok,
    body: createSSEStream(events),
    json: async () => ({ error: 'test error' }),
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(events, ok),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => '',
    bytes: async () => new Uint8Array(),
  } as unknown as Response;
}

describe('useAgentStream', () => {
  const mockGetToken = vi.fn().mockResolvedValue('test-token');

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with idle status', () => {
    const { result } = renderHook(() => useAgentStream(mockGetToken));
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.steps).toEqual([]);
  });

  it('sets connecting status when send is called', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse([]));
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'test', input: { q: 'hello' } });
    });

    expect(mockGetToken).toHaveBeenCalled();
    const call = mockFetch.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      })
    );
  });

  it('processes agent_started event', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse([{ event: 'agent_started', data: { agent: 'clinical-explorer' } }])
    );
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'clinical-explorer', input: {} });
    });

    expect(result.current.status).toBe('started');
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0]?.event).toBe('agent_started');
  });

  it('processes agent_completed event', async () => {
    const completedData = {
      agent: 'clinical-explorer',
      status: 'ok',
      output: { finalText: 'Done!' },
      durationMs: 1500,
    };
    mockFetch.mockResolvedValueOnce(
      createMockResponse([
        { event: 'agent_started', data: { agent: 'clinical-explorer' } },
        { event: 'agent_completed', data: completedData },
      ])
    );
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'clinical-explorer', input: {} });
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.result).toEqual(completedData);
    expect(result.current.steps).toHaveLength(2);
  });

  it('processes agent_error event', async () => {
    const errorData = {
      agent: 'clinical-explorer',
      status: 'model_error',
      error: { status: 'model_error', message: 'Gemini failed' },
      durationMs: 500,
    };
    mockFetch.mockResolvedValueOnce(
      createMockResponse([
        { event: 'agent_started', data: { agent: 'clinical-explorer' } },
        { event: 'agent_error', data: errorData },
      ])
    );
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'clinical-explorer', input: {} });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Gemini failed');
    expect(result.current.steps).toHaveLength(2);
  });

  it('handles missing token', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'test', input: {} });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('You need to be signed in to use the agent.');
  });

  it('handles non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse([], false));
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'test', input: {} });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('test error');
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'test', input: {} });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Network failure');
  });

  it('abort resets state', async () => {
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.abort();
    });

    expect(result.current.status).toBe('idle');
  });

  it('clears previous error on new send', async () => {
    mockFetch.mockRejectedValueOnce(new Error('First fail'));
    const { result } = renderHook(() => useAgentStream(mockGetToken));

    await act(async () => {
      result.current.send({ agent: 'test', input: {} });
    });
    expect(result.current.status).toBe('error');

    mockFetch.mockResolvedValueOnce(
      createMockResponse([{ event: 'agent_started', data: { agent: 'test' } }])
    );

    await act(async () => {
      result.current.send({ agent: 'test', input: {} });
    });
    expect(result.current.status).toBe('started');
    expect(result.current.error).toBeNull();
  });
});
