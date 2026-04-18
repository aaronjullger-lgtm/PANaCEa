import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSystemStatus } from '../useSystemStatus';

// Stub the API endpoint helper so tests don't depend on VITE_API_URL.
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: (path: string) => path,
}));

function mockFetchOnce(response: { ok: boolean; status?: number; body: unknown }) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementationOnce(async () => {
      return {
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 503),
        json: async () => response.body,
      } as unknown as Response;
    });
}

describe('useSystemStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in "unknown" state before the first poll resolves', () => {
    // Intentionally never resolve: we just want the initial state.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}) as Promise<Response>
    );

    const { result } = renderHook(() => useSystemStatus({ pollOnMount: false }));
    expect(result.current.status).toBe('unknown');
    expect(result.current.checkedAt).toBeNull();
  });

  it('transitions to "healthy" when the endpoint reports healthy', async () => {
    mockFetchOnce({
      ok: true,
      body: {
        status: 'healthy',
        checks: {
          database: { status: 'pass' },
          auth: { status: 'pass' },
          content: { status: 'pass', systemsCount: 12 },
        },
        diagnostics: { timestamp: '2026-04-17T12:00:00Z' },
      },
    });

    const { result } = renderHook(() => useSystemStatus());

    await waitFor(() => {
      expect(result.current.status).toBe('healthy');
    });

    expect(result.current.message).toBeNull();
    expect(result.current.checkedAt).toBe('2026-04-17T12:00:00Z');
  });

  it('transitions to "unhealthy" with the first failing check as message', async () => {
    mockFetchOnce({
      ok: false,
      status: 503,
      body: {
        status: 'unhealthy',
        checks: {
          database: { status: 'fail', message: 'connection refused' },
          auth: { status: 'pass' },
        },
        diagnostics: { timestamp: '2026-04-17T12:05:00Z' },
      },
    });

    const { result } = renderHook(() => useSystemStatus());

    await waitFor(() => {
      expect(result.current.status).toBe('unhealthy');
    });

    expect(result.current.message).toContain('database');
    expect(result.current.message).toContain('connection refused');
  });

  it('transitions to "unreachable" when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useSystemStatus());

    await waitFor(() => {
      expect(result.current.status).toBe('unreachable');
    });

    // checkedAt is set to the client's "now" when the network itself fails —
    // useful for a "last tried" stamp in the banner.
    expect(result.current.checkedAt).toBeTruthy();
  });

  it('does not poll on mount when pollOnMount=false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderHook(() => useSystemStatus({ pollOnMount: false }));
    // Give microtasks a tick to confirm nothing fires.
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
