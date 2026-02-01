/**
 * UserCountCard – Admin dashboard stat card for total user count
 *
 * Fetches GET /api/debug/god-mode and displays { ok, userCount, timestamp }.
 * Uses CSS variables for dark/light theme. No SWR in project – useEffect + fetch.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, AlertCircle } from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface GodModeResponse {
  ok: boolean;
  userCount: number | null;
  timestamp?: string;
  error?: string;
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function UserCountCard() {
  const [data, setData] = useState<GodModeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const url = getApiEndpoint('/api/debug/god-mode');
      const res = await fetch(url);
      const json: GodModeResponse = await res.json();

      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setData(json);
        return;
      }

      setData(json);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Request failed';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  if (loading && !data) {
    return (
      <div
        className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] shadow-sm p-6"
        aria-busy="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-[var(--color-accent)]/20 rounded-lg">
            <Users className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
        </div>
        <SkeletonLoader variant="rectangular" height="3rem" className="mb-2" />
        <SkeletonLoader variant="text" width="60%" height="0.875rem" />
      </div>
    );
  }

  if (error && !data?.userCount) {
    return (
      <div
        className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 ring-1 ring-data-fail/50"
        role="alert"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-data-fail/20 rounded-lg">
            <AlertCircle className="w-6 h-6 text-data-fail" />
          </div>
          <button
            type="button"
            onClick={fetchCount}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Retry"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <p className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">—</p>
        <p className="text-sm text-data-fail mb-2">Users</p>
        <p className="text-xs text-[var(--color-text-muted)]">{error}</p>
      </div>
    );
  }

  const count = data?.userCount ?? 0;
  const ok = data?.ok ?? false;

  return (
    <div
      className={`bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 ${ok ? '' : 'ring-1 ring-data-fail/50'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-[var(--color-accent)]/20 rounded-lg">
          <Users className="w-6 h-6 text-[var(--color-accent)]" />
        </div>
        <button
          type="button"
          onClick={fetchCount}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          aria-label="Refresh count"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums mb-1">
        {count.toLocaleString()}
      </p>
      <p className="text-sm text-[var(--color-text-muted)] mb-1">Users</p>
      <p className="text-xs text-[var(--color-text-muted)]">{formatTimestamp(data?.timestamp)}</p>
    </div>
  );
}
