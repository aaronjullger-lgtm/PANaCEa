/**
 * useSystemStatus — lightweight polling of /api/health for the incident banner.
 *
 * Not a full observability hook: intentionally low-traffic (60s interval by
 * default, backoff on failure) and resilient. This runs in every authenticated
 * session, so the cost ceiling matters.
 *
 * Returns a coarse status and the most recent health payload so the banner can
 * tell users *what* is wrong (DB? auth? content?) rather than a generic outage
 * message. The hook does not throw, does not surface fetch errors to the UI;
 * a network failure simply transitions status to `unreachable`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export type SystemStatus = 'unknown' | 'healthy' | 'unhealthy' | 'unreachable';

export interface HealthCheckSummary {
  /** Overall coarse status reported by /api/health. */
  status: SystemStatus;
  /** The first human-readable failure reason, if any (DB, content, etc.). */
  message: string | null;
  /** ISO timestamp of the last successful poll. */
  checkedAt: string | null;
  /** Whether a poll is currently in flight. */
  checking: boolean;
}

interface UseSystemStatusOptions {
  /** Polling interval when the last poll succeeded. Default: 60_000 ms. */
  intervalMs?: number;
  /** Polling interval when the last poll failed/unhealthy (backoff). Default: 30_000 ms. */
  unhealthyIntervalMs?: number;
  /** Start polling immediately on mount. Default: true. */
  pollOnMount?: boolean;
}

interface HealthResponse {
  status?: string;
  checks?: {
    database?: { status?: string; message?: string };
    auth?: { status?: string; message?: string };
    content?: { status?: string; message?: string };
    cache?: { status?: string; message?: string };
  };
  diagnostics?: { timestamp?: string };
}

function pickFirstFailure(payload: HealthResponse | null): string | null {
  if (!payload?.checks) return null;
  for (const [name, check] of Object.entries(payload.checks)) {
    if (!check) continue;
    if (check.status === 'fail') {
      return check.message ? `${name}: ${check.message}` : `${name} check failed`;
    }
  }
  return null;
}

export function useSystemStatus(options: UseSystemStatusOptions = {}): HealthCheckSummary {
  const {
    intervalMs = 60_000,
    unhealthyIntervalMs = 30_000,
    pollOnMount = true,
  } = options;

  const [state, setState] = useState<HealthCheckSummary>({
    status: 'unknown',
    message: null,
    checkedAt: null,
    checking: false,
  });

  // Ref mirror of current status so the interval scheduler can pick the right
  // cadence without re-subscribing every state change.
  const statusRef = useRef<SystemStatus>('unknown');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    // Cancel any in-flight poll before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (mountedRef.current) {
      setState((prev) => ({ ...prev, checking: true }));
    }

    try {
      const response = await fetch(getApiEndpoint('/api/health'), {
        method: 'GET',
        signal: controller.signal,
        // Health check is public; don't send credentials.
        credentials: 'omit',
      });

      // /api/health returns 200 when healthy, 503 when unhealthy — both JSON.
      let payload: HealthResponse | null = null;
      try {
        payload = unwrapApiEnvelope<HealthResponse>(await response.json());
      } catch {
        payload = null;
      }

      const nextStatus: SystemStatus = response.ok
        ? (payload?.status === 'healthy' ? 'healthy' : 'unhealthy')
        : 'unhealthy';

      statusRef.current = nextStatus;
      if (mountedRef.current) {
        setState({
          status: nextStatus,
          message: pickFirstFailure(payload),
          checkedAt: payload?.diagnostics?.timestamp ?? new Date().toISOString(),
          checking: false,
        });
      }
    } catch (err) {
      // Network error, CORS, or offline — surface as "unreachable" so the banner
      // can distinguish between "we said unhealthy" and "couldn't even ask".
      if ((err as { name?: string })?.name === 'AbortError') return;
      statusRef.current = 'unreachable';
      if (mountedRef.current) {
        setState({
          status: 'unreachable',
          message: null,
          checkedAt: new Date().toISOString(),
          checking: false,
        });
      }
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const wait =
      statusRef.current === 'healthy' || statusRef.current === 'unknown'
        ? intervalMs
        : unhealthyIntervalMs;
    timerRef.current = setTimeout(async () => {
      await poll();
      if (mountedRef.current) scheduleNext();
    }, wait);
  }, [intervalMs, unhealthyIntervalMs, poll]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    if (pollOnMount) {
      void (async () => {
        await poll();
        if (!cancelled && mountedRef.current) scheduleNext();
      })();
    }
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [poll, scheduleNext, pollOnMount]);

  return state;
}
