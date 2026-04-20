import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IncidentBanner } from './IncidentBanner';

// Stub the API endpoint resolver so tests don't depend on env.
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: (path: string) => path,
}));

function mockHealth(body: unknown, ok: boolean = true) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      ({
        ok,
        status: ok ? 200 : 503,
        json: async () => body,
      }) as unknown as Response
  );
}

describe('IncidentBanner', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while status is healthy', async () => {
    mockHealth({
      status: 'healthy',
      checks: { database: { status: 'pass' } },
      diagnostics: { timestamp: '2026-04-17T12:00:00Z' },
    });

    const { container } = render(<IncidentBanner />);

    // Give the hook a beat to resolve its first poll. Banner should stay empty.
    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('shows an unhealthy banner with the failing check message', async () => {
    mockHealth(
      {
        status: 'unhealthy',
        checks: {
          database: { status: 'fail', message: 'connection refused' },
        },
        diagnostics: { timestamp: '2026-04-17T12:05:00Z' },
      },
      false
    );

    render(<IncidentBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeNull();
    });

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/PANaCEa is experiencing issues/i);
    expect(banner.textContent).toMatch(/database/i);
    expect(banner.textContent).toMatch(/connection refused/i);
  });

  it('shows an offline banner when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    render(<IncidentBanner />);

    await waitFor(() => {
      const banner = screen.queryByRole('status');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toMatch(/Can't reach PANaCEa servers/i);
    });
  });

  it('can be dismissed by the user', async () => {
    mockHealth(
      {
        status: 'unhealthy',
        checks: { database: { status: 'fail', message: 'db down' } },
      },
      false
    );

    render(<IncidentBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('forceVisible renders the banner regardless of actual status', () => {
    // Don't mock fetch — forceVisible should bypass the poll entirely for the first render.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}) as Promise<Response>
    );

    render(<IncidentBanner forceVisible />);
    expect(screen.queryByRole('status')).not.toBeNull();
  });
});
