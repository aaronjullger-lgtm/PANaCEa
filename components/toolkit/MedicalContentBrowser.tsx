/**
 * MedicalContentBrowser - Modern medical content library browser
 *
 * Refactored from ClinicalLibrary.tsx to use:
 * - MedicalContentCard with professional dark mode aesthetic
 * - ContentGrid responsive layout
 * - Type-safe MedicalContentDisplay interface
 * - Unified badge system (SystemBadge, YieldBadge)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, AlertCircle, RefreshCw, ArrowLeft, Filter, Search } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { MedicalContentCard } from '@/components/ui/cards';
import { ContentGrid, ContentGridHeader, LoadingOverlay } from '@/components/ui/layouts';
import { ErrorState } from '@/components/ui/ErrorState';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface MedicalContentBrowserProps {
  onSelectCondition?: (conditionId: string) => void;
  /** Pre-fill system filter when opening from toolkit (e.g. system grid) */
  initialSystem?: string | null;
  /** Optional search query from toolkit header (when Clinical tab is active) */
  searchQuery?: string;
}

interface FilterState {
  system?: string | null;
  subcategory?: string | null;
  search?: string;
}

/**
 * FilterBar - System and search filters
 */
const FilterBar: React.FC<{
  systems: string[];
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}> = ({ systems, filters, onFilterChange }) => {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, search: searchInput });
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* System Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
        <select
          value={filters.system || ''}
          onChange={(e) => onFilterChange({ ...filters, system: e.target.value || null })}
          className="px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <option value="">All Systems</option>
          {systems.map((system) => (
            <option key={system} value={system}>
              {system}
            </option>
          ))}
        </select>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search conditions..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
        {(filters.search || filters.system) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              onFilterChange({ system: null, subcategory: null, search: '' });
            }}
            className="px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 text-[var(--color-text-secondary)] rounded-lg text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
};

/**
 * MedicalContentBrowser Component
 */
export const MedicalContentBrowser: React.FC<MedicalContentBrowserProps> = ({
  onSelectCondition,
  initialSystem = null,
  searchQuery: externalSearchQuery,
}) => {
  const { getToken, isSignedIn } = useAuth();

  // State
  const [content, setContent] = useState<Partial<MedicalContentDisplay>[]>([]);
  const [selectedContent, setSelectedContent] = useState<Partial<MedicalContentDisplay> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    system: initialSystem ?? undefined,
    search: externalSearchQuery ?? undefined,
  });
  const [availableSystems, setAvailableSystems] = useState<string[]>([]);

  // Sync external search query (from toolkit header) into filters
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setFilters((prev) => ({ ...prev, search: externalSearchQuery || undefined }));
    }
  }, [externalSearchQuery]);

  // Fetch available systems from API
  useEffect(() => {
    const fetchSystems = async () => {
      if (!isSignedIn) return;

      try {
        const token = await getToken();
        const response = await fetch('/api/content/systems', {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          // API returns array of { id, label, count } (GET /api/content/systems)
          const systems = (await response.json()) as Array<{
            id?: string;
            label?: string;
            system?: string;
          }>;
          setAvailableSystems(
            systems.map((s) => s.id ?? s.label ?? s.system ?? '').filter(Boolean)
          );
        }
      } catch (err) {
        console.warn('[MedicalContentBrowser] Failed to fetch systems:', err);
      }
    };

    fetchSystems();
  }, [getToken, isSignedIn]);

  // Fetch content from API
  const fetchContent = useCallback(async () => {
    if (!isSignedIn) {
      setError('Please sign in to access clinical content');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.system) params.append('system', filters.system);
      if (filters.subcategory) params.append('subcategory', filters.subcategory);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', '100');

      const token = await getToken();
      const response = await fetch(`/api/content/library?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to access clinical content');
        }
        throw new Error(`Failed to fetch content: ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        console.warn('[MedicalContentBrowser] Empty response from API');
        setContent([]);
        return;
      }

      const data = JSON.parse(text);
      setContent(data.content || []);
    } catch (err) {
      console.error('[MedicalContentBrowser] Error fetching content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load clinical data');
    } finally {
      setLoading(false);
    }
  }, [filters, getToken, isSignedIn]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setSelectedContent(null);
  };

  const handleSelectCondition = (item: Partial<MedicalContentDisplay>) => {
    setSelectedContent(item);
    if (onSelectCondition && item.id) {
      onSelectCondition(item.id);
    }
  };

  const handleBack = () => {
    setSelectedContent(null);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <ContentGridHeader
          title="Medical Content Library"
          subtitle={`${content.length} conditions available`}
          actions={
            !selectedContent && (
              <button
                type="button"
                onClick={fetchContent}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )
          }
          filters={
            !selectedContent && (
              <FilterBar
                systems={availableSystems}
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            )
          }
        />

        {/* Error State */}
        {error && (
          <div className="mb-6">
            <ErrorState title="Failed to load content" message={error} onRetry={fetchContent} />
          </div>
        )}

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {/* Master View: Grid of cards */}
          {!selectedContent && !error && (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {loading ? (
                <LoadingOverlay message="Loading medical content..." />
              ) : (
                <ContentGrid
                  columns={{ default: 1, md: 2, lg: 3 }}
                  gap={6}
                  emptyState={
                    <ErrorState
                      title="No conditions found"
                      message="Try adjusting your filters or search terms"
                      onRetry={() =>
                        handleFilterChange({ system: null, subcategory: null, search: '' })
                      }
                    />
                  }
                >
                  {content.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCondition(item)}
                      className="cursor-pointer"
                    >
                      <MedicalContentCard content={item} compact />
                    </div>
                  ))}
                </ContentGrid>
              )}
            </motion.div>
          )}

          {/* Detail View: Selected card */}
          {selectedContent && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to library</span>
              </button>

              {/* Full Detail Card */}
              <div className="flex justify-center">
                <MedicalContentCard content={selectedContent} compact={false} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MedicalContentBrowser;
