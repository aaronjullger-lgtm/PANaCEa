import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Loader2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { LibraryCard } from '../library/LibraryCard';
import { ContextWidget } from '../library/ContextWidget';
import { LibraryFilters } from '../library/LibraryFilters';

interface ClinicalLibraryProps {
  onSelectCondition?: (conditionId: string) => void;
}


const shimmer = 'bg-gradient-to-r from-transparent via-white/10 to-transparent';

export const ClinicalLibrary: React.FC<ClinicalLibraryProps> = ({ onSelectCondition }) => {
  // State
  const [content, setContent] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<{
    system?: string | null;
    subcategory?: string | null;
    search?: string;
  }>({});

  // Unique systems from loaded content
  const uniqueSystems = Array.from(new Set(content.map(c => c.system))).filter(Boolean).sort();

  // Fetch content from API
  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.system) params.append('system', filters.system);
      if (filters.subcategory) params.append('subcategory', filters.subcategory);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', '100');

      const response = await fetch(`/api/content/library?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to access clinical content');
        }
        throw new Error(`Failed to fetch content: ${response.status}`);
      }

      // Defensive JSON parsing to handle empty responses
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.warn('[ClinicalLibrary] Empty response from API, returning empty array');
        setContent([]);
        return;
      }

      try {
        const data = JSON.parse(text);
        setContent(data.content || []);
      } catch (parseError) {
        console.error('[ClinicalLibrary] JSON parse error for URL:', `/api/content/library?${params.toString()}`, parseError);
        throw new Error('Invalid JSON response from server');
      }
    } catch (err) {
      console.error('[ClinicalLibrary] Error fetching content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load clinical data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setSelectedContent(null); // Reset detail view when filters change
  };

  const handleSelectCondition = (item: any) => {
    setSelectedContent(item);
  };

  const handleBack = () => {
    setSelectedContent(null);
  };

  return (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl p-4 md:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Clinical Knowledge Browser</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Comprehensive medical content from database
            </p>
          </div>
        </div>

        {/* Filters */}
        {!selectedContent && (
          <LibraryFilters
            onFilterChange={handleFilterChange}
            systems={uniqueSystems}
            currentSystem={filters.system}
            currentSearch={filters.search}
          />
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={fetchContent}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 transition-colors text-xs font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)] mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading clinical content...</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <AnimatePresence mode="wait">
          {/* Master View: Grid of conditions */}
          {!selectedContent && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {content.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[var(--color-text-muted)]">
                    No conditions found matching your filters.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {content.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectCondition(item)}
                        className="group text-left bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors">
                            {item.condition}
                          </h4>
                          {item.pance_yield && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                item.pance_yield === 'HIGH'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : item.pance_yield === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {item.pance_yield}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
                          <span className="px-2 py-0.5 bg-[var(--color-bg-secondary)] rounded">
                            {item.system}
                          </span>
                          {item.subcategory && <span>• {item.subcategory}</span>}
                        </div>
                        {item.definition && (
                          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                            {typeof item.definition === 'string'
                              ? item.definition
                              : JSON.stringify(item.definition)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Stats Footer */}
                  <div className="mt-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-center">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      Showing <span className="font-semibold text-[var(--color-text-primary)]">{content.length}</span> conditions
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Detail View: Selected condition */}
          {selectedContent && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to list
              </button>

              {/* Main Content Card */}
              <LibraryCard content={selectedContent} />

              {/* Context Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ContextWidget conditionId={selectedContent.conditionId || selectedContent.id} type="pharm" />
                <ContextWidget conditionId={selectedContent.conditionId || selectedContent.id} type="physio" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default ClinicalLibrary;
