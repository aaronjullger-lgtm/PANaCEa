/**
 * Normal Labs Panel - Slide-out reference during quiz session
 *
 * Fetches from /api/reference/normal-labs and displays normal ranges by category.
 * Design: right-side drawer, semantic tokens, per .cursor/rules/ui-design-system.mdc
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Beaker, X, ChevronDown } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import { normalizeApiItems } from '@/lib/utils/normalizeApiResponse';
import { unwrapApiEnvelope, getApiEnvelopeError } from '@/lib/utils/apiEnvelope';

export interface NormalLabEntry {
  id: string;
  labTestName: string;
  category: string;
  normalRangeLow: number | null;
  normalRangeHigh: number | null;
  normalRangeText: string | null;
  units: string | null;
  siUnits: string | null;
  sex: string | null;
  ageGroup: string | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  clinicalNotes: string | null;
  commonCauses: string[];
  isHighYield: boolean;
}

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

interface NormalLabsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRange(entry: NormalLabEntry): string {
  if (entry.normalRangeText) return entry.normalRangeText;
  if (entry.normalRangeLow != null && entry.normalRangeHigh != null) {
    return `${entry.normalRangeLow}–${entry.normalRangeHigh}`;
  }
  if (entry.normalRangeLow != null) return `≥${entry.normalRangeLow}`;
  if (entry.normalRangeHigh != null) return `≤${entry.normalRangeHigh}`;
  return '—';
}

export const NormalLabsPanel: React.FC<NormalLabsPanelProps> = ({ isOpen, onClose }) => {
  const { getToken } = useAuth();
  const [labs, setLabs] = useState<NormalLabEntry[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(getApiEnvelopeError(errJson) || `HTTP ${res.status}`);
      }
      const json = unwrapApiEnvelope(await res.json());
      // Middleware unwraps handler's { data: X } → body is X directly,
      // so the endpoint returns { success, data: [...] }. Use shared
      // normalizer to stay resilient to legacy shapes.
      setLabs(normalizeApiItems(json) as NormalLabEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load normal labs');
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, category]);

  useEffect(() => {
    if (isOpen) fetchLabs();
  }, [isOpen, fetchLabs]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[var(--color-overlay)]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-[0_10px_40px_-10px_rgba(15,23,42,0.5)] flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Normal Labs reference"
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Normal Labs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex-shrink-0 p-3 border-b border-[var(--color-border)]">
          <label htmlFor="normal-labs-category" className="sr-only">
            Filter by category
          </label>
          <div className="relative">
            <select
              id="normal-labs-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id || 'all'} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" aria-hidden />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading && (
            <div
              className="flex items-center justify-center py-12 text-[var(--color-text-muted)] text-sm"
              role="status"
              aria-live="polite"
            >
              <InlineSpinner size="md" className="mr-2" />
              Loading…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50 p-4 text-sm text-[var(--color-text-muted)]">
              {error}
              <button
                type="button"
                onClick={() => fetchLabs()}
                className="mt-2 text-[var(--color-accent)] hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && labs.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
              No normal lab values available for this category.
            </p>
          )}
          {!loading && !error && labs.length > 0 && (
            <ul className="space-y-3">
              {labs.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-[var(--color-text-primary)] text-sm">
                      {entry.labTestName}
                    </span>
                    {entry.isHighYield && (
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                        High yield
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {formatRange(entry)}
                    </span>
                    {entry.units && <span className="ml-1">{entry.units}</span>}
                    {(entry.sex || entry.ageGroup) && (
                      <span className="ml-1">
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
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {entry.commonCauses.slice(0, 3).join('; ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default NormalLabsPanel;
