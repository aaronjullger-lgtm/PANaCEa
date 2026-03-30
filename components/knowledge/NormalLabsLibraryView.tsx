/**
 * Normal Labs Library View - Full-page reference for Clinical Library
 *
 * Fetches from /api/reference/normal-labs (same as NormalLabsPanel).
 * Used in Knowledge Base Hub Lab Reference tab as "Normal Ranges" sub-view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Beaker, ChevronDown, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NormalLabEntry } from '@/components/session/NormalLabsPanel';

const CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'CBC', label: 'CBC' },
  { id: 'BMP', label: 'BMP' },
  { id: 'LFT', label: 'LFT' },
  { id: 'Coagulation', label: 'Coagulation' },
  { id: 'Lipid Panel', label: 'Lipids' },
  { id: 'Thyroid', label: 'Thyroid' },
  { id: 'Cardiac Markers', label: 'Cardiac' },
  { id: 'Urinalysis', label: 'Urinalysis' },
];

function formatRange(entry: NormalLabEntry): string {
  if (entry.normalRangeText) return entry.normalRangeText;
  if (entry.normalRangeLow != null && entry.normalRangeHigh != null) {
    return `${entry.normalRangeLow}–${entry.normalRangeHigh}`;
  }
  if (entry.normalRangeLow != null) return `≥${entry.normalRangeLow}`;
  if (entry.normalRangeHigh != null) return `≤${entry.normalRangeHigh}`;
  return '—';
}

export const NormalLabsLibraryView: React.FC = () => {
  const { getToken } = useAuth();
  const [labs, setLabs] = useState<NormalLabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const res = await fetch(`/api/reference/normal-labs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: { data?: NormalLabEntry[]; labs?: NormalLabEntry[] } };
      setLabs(json?.data?.data ?? json?.data?.labs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load normal labs');
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, category]);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--color-text-muted)]">
        <RefreshCw className="w-6 h-6 animate-spin mr-3" />
        <span>Loading normal lab values…</span>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load normal labs" description={error} action={{ label: 'Try Again', onClick: fetchLabs }} />;
  }

  return (
    <div className="space-y-6">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="normal-labs-category" className="text-sm font-medium text-[var(--color-text-primary)]">
          Category:
        </label>
        <div className="relative">
          <select
            id="normal-labs-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id || 'all'} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
            aria-hidden
          />
        </div>
      </div>

      {/* Content */}
      {labs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
          No normal lab values available for this category. Try selecting a different category or check back later.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {labs.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-[var(--color-text-primary)]">
                  {entry.labTestName}
                </span>
                {entry.isHighYield && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                    High yield
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-sm text-[var(--color-text-muted)] flex items-center gap-2">
                <Beaker className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                <span className="font-medium text-[var(--color-text-primary)]">{formatRange(entry)}</span>
                {entry.units && <span>{entry.units}</span>}
                {(entry.sex || entry.ageGroup) && (
                  <span className="text-xs">
                    ({[entry.sex, entry.ageGroup].filter(Boolean).join(', ')})
                  </span>
                )}
              </div>
              {entry.clinicalNotes && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {entry.clinicalNotes}
                </p>
              )}
              {entry.commonCauses && entry.commonCauses.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{entry.commonCauses.slice(0, 3).join('; ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
