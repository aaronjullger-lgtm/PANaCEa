/**
 * Lab Reference View - Normal Values & Clinical Differentials
 *
 * Uses NormalLabValue + LabTest from the database.
 * Provides category filtering (BMP, CBC, LFT, etc.) and search.
 *
 * Data source: /api/labs/tests (LabTest schema with normal ranges, differentials)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Search, Beaker, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/layouts';
import { Card } from '@/components/ui/card';
import { CardGrid } from '@/components/ui/layouts/CardGrid';
import { ErrorState } from '@/components/ui/ErrorState';

interface LabTest {
  id: string;
  name: string;
  category: string;
  conventionalRange?: string | null;
  siRange?: string | null;
  siUnits?: string | null;
  increaseIndicates: string[];
  decreaseIndicates: string[];
  commonAbnormalities: string[];
  boardYieldFacts: string[];
  clinicalPearls: string[];
  criticalValues?: Record<string, unknown> | null;
  isHighYield: boolean;
}

const LAB_CATEGORIES = [
  { id: 'all', label: 'All Labs' },
  { id: 'BMP', label: 'Basic Metabolic Panel' },
  { id: 'CBC', label: 'Complete Blood Count' },
  { id: 'LFT', label: 'Liver Function Tests' },
  { id: 'Coagulation', label: 'Coagulation' },
  { id: 'Endocrine', label: 'Endocrine' },
  { id: 'Cardiac', label: 'Cardiac Markers' },
  { id: 'Renal', label: 'Renal Function' },
  { id: 'Lipids', label: 'Lipid Panel' },
  { id: 'Other', label: 'Other' },
];

export const LabReferenceView: React.FC = () => {
  const { getToken, isSignedIn } = useAuth();
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLab, setExpandedLab] = useState<string | null>(null);

  const fetchLabs = useCallback(async () => {
    if (!isSignedIn) {
      setError('Please sign in to access lab reference');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('query', searchQuery);

      const url = `/api/labs/tests${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: unknown[] };
      setLabs((json.data ?? []) as typeof labs);
    } catch (err) {
      console.error('[LabReferenceView] fetch error', err);
      setError(err instanceof Error ? err.message : 'Failed to load lab tests');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  const filteredLabs = useMemo(() => {
    if (selectedCategory === 'all') return labs;
    return labs.filter((lab) => lab.category === selectedCategory);
  }, [labs, selectedCategory]);

  if (loading) {
    return (
      <div className="relative min-h-[400px]">
        <LoadingOverlay message="Loading lab reference..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load lab reference" message={error} onRetry={fetchLabs} />;
  }

  return (
    <div className="space-y-6">
      {/* Category Filters + Search - sticky on scroll */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border)]/50 space-y-4">
        <div className="flex flex-wrap gap-2">
        {LAB_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]'
            }`}
          >
            {cat.label}
          </button>
        ))}
        </div>

        {/* Search */}
        <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search labs (e.g., 'sodium', 'troponin', 'CBC')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-[var(--color-text-muted)])] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Clear
          </button>
        )}
        </div>
      </div>

      {/* Lab Test Cards */}
      <CardGrid columns={{ default: 1, md: 2 }}>
        {filteredLabs.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-muted)] col-span-full">
            {searchQuery ? 'No labs found matching your search' : 'No labs available'}
          </div>
        ) : (
          filteredLabs.map((lab) => {
            const isExpanded = expandedLab === lab.id;
            return (
              <Card
                key={lab.id}
                className="overflow-hidden hover:border-accent/50 transition-colors"
              >
                <button
                  onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Beaker className="w-5 h-5 text-accent flex-shrink-0" />
                      <h3 className="font-bold text-text-primary truncate">
                        {lab.name}
                      </h3>
                      {lab.isHighYield && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-data-provisional/20 text-data-provisional rounded">
                          High Yield
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {lab.conventionalRange || lab.siRange || 'Normal range varies'}
                      {lab.siUnits && ` ${lab.siUnits}`}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-bg-tertiary rounded text-text-[var(--color-text-muted)] flex-shrink-0">
                    {lab.category}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-4 border-t border-[var(--color-border)] animate-fade-in">
                    {/* Clinical Differentials */}
                    {lab.increaseIndicates.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-data-fail" />
                          <h4 className="text-sm font-semibold text-text-primary">
                            Increased In
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {lab.increaseIndicates.map((cause, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-text-secondary ml-4"
                            >
                              • {cause}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lab.decreaseIndicates.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-data-pass" />
                          <h4 className="text-sm font-semibold text-text-primary">
                            Decreased In
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {lab.decreaseIndicates.map((cause, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-text-secondary ml-4"
                            >
                              • {cause}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lab.commonAbnormalities.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-data-provisional" />
                          <h4 className="text-sm font-semibold text-text-primary">
                            Common Findings
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {lab.commonAbnormalities.map((finding, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-text-secondary ml-4"
                            >
                              • {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lab.clinicalPearls.length > 0 && (
                      <div className="bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-text-primary mb-2">
                          Clinical Pearls
                        </h4>
                        <ul className="space-y-1">
                          {lab.clinicalPearls.map((pearl, idx) => (
                            <li key={idx} className="text-sm text-text-secondary">
                              • {pearl}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lab.criticalValues && (
                      <div className="bg-data-fail/5 border border-data-fail/20 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-data-fail mb-1">
                          Critical Values
                        </h4>
                        <div className="text-sm text-text-secondary">
                          {typeof lab.criticalValues === 'string'
                            ? lab.criticalValues
                            : JSON.stringify(lab.criticalValues)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </CardGrid>

      {/* Refresh Button */}
      {!loading && (
        <div className="flex justify-center pt-4">
          <button
            onClick={fetchLabs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      )}
    </div>
  );
};
