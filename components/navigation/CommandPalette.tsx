/**
 * Command Palette Component
 * Provides quick navigation and search functionality across the app
 * Activated with Cmd+K / Ctrl+K
 *
 * Search Features:
 * - Server-side database search with intelligent ranking
 * - Debounced API calls (300ms)
 * - Medical alias matching
 * - Loading states and error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { MODE_REGISTRY } from '@/config/training-modes';
import { NAV_RAIL_ITEMS } from '@/config/navigation';
import { getRecentModeIds, recordRecentMode, MAX_RECENT_MODES } from '@/lib/recentModes';
import { safeFetchJson } from '@/lib/utils/safeFetch';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

const MAX_RECENT = MAX_RECENT_MODES;

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (modeId: string) => void;
  /** When provided, palette shows "Go to X" nav items that call this with path */
  onNavigatePath?: (path: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: 'mode' | 'condition' | 'drug' | 'action';
  action: () => void;
}

interface ApiSearchResult {
  id: string;
  title: string;
  type: 'condition' | 'drug';
  snippet: string;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword';
  score: number;
  metadata?: {
    system?: string;
    drugClass?: string;
    matchedAlias?: string;
  };
}

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNavigatePath,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  const debouncedQuery = useDebounce(query, 300);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Use setTimeout to ensure focus happens after render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSearchError(null);
    }
  }, [isOpen]);

  const [results, setResults] = useState<SearchResult[]>([]);

  /**
   * Fetch search results from server-side API
   */
  const fetchServerResults = useCallback(
    async (searchQuery: string): Promise<ApiSearchResult[]> => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        return [];
      }

      try {
        setSearchError(null);
        const data = await safeFetchJson<{ results?: ApiSearchResult[] }>(
          getApiEndpoint('/api/content/search') + `?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        return data.results || [];
      } catch (error) {
        console.error('Search API error:', error);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
        return [];
      }
    },
    []
  );

  /**
   * Search results effect - triggers on debounced query change
   */
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        // Nav items from canonical config (when path navigation available)
        const navResults: SearchResult[] =
          onNavigatePath ?
            NAV_RAIL_ITEMS.map((item) => ({
              id: `nav-${item.id}`,
              title: `Go to ${item.label}`,
              subtitle: item.path,
              category: 'action' as const,
              action: () => {
                onNavigatePath(item.path);
                onClose();
              },
            }))
          : [];

        const recentIds = getRecentModeIds();
        const modeMap = new Map(MODE_REGISTRY.map((m) => [m.id, m]));
        const recentModes = recentIds
          .map((id) => modeMap.get(id as import('@/config/training-modes').TrainingModeId))
          .filter((m): m is (typeof MODE_REGISTRY)[0] => !!m);
        const recentIdsSet = new Set(recentModes.map((m) => m.id));
        const otherModes = MODE_REGISTRY.filter((m) => !recentIdsSet.has(m.id)).slice(
          0,
          Math.max(0, MAX_RECENT - recentModes.length)
        );
        const modesToShow = [...recentModes, ...otherModes].slice(0, MAX_RECENT);

        const modeResults = modesToShow.map((mode) => ({
          id: mode.id,
          title: mode.label,
          subtitle: recentIdsSet.has(mode.id) ? 'Recently used' : mode.description,
          category: 'mode' as const,
          action: () => {
            recordRecentMode(mode.id);
            onNavigate(mode.id);
            onClose();
          },
        }));

        setResults([...navResults, ...modeResults]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const searchResults: SearchResult[] = [];
      const lowerQuery = debouncedQuery.toLowerCase();

      // Search training modes (client-side, instant)
      MODE_REGISTRY.forEach((mode) => {
        if (
          mode.label.toLowerCase().includes(lowerQuery) ||
          mode.description.toLowerCase().includes(lowerQuery) ||
          mode.id.toLowerCase().includes(lowerQuery)
        ) {
          searchResults.push({
            id: mode.id,
            title: mode.label,
            subtitle: mode.description,
            category: 'mode',
            action: () => {
              recordRecentMode(mode.id);
              onNavigate(mode.id);
              onClose();
            },
          });
        }
      });

      // Search medical content (server-side, database)
      try {
        const apiResults = await fetchServerResults(debouncedQuery);

        apiResults.forEach((result) => {
          const category = result.type === 'condition' ? 'condition' : 'drug';

          searchResults.push({
            id: `${result.type}-${result.id}`,
            title: result.title,
            subtitle: result.snippet,
            category,
            action: () => {
              // Navigate to condition/drug detail with structured ID
              onNavigate(`${result.type}:${result.id}`);
              onClose();
            },
          });
        });
      } catch (error) {
        console.error('Error fetching server results:', error);
      }

      setResults(searchResults.slice(0, 10));
      setIsSearching(false);
    };

    fetchResults();
  }, [debouncedQuery, onNavigate, onNavigatePath, onClose, fetchServerResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mode':
        return 'text-[var(--color-accent)]';
      case 'condition':
        return 'text-data-pass';
      case 'drug':
        return 'text-data-provisional';
      case 'action':
        return 'text-[var(--color-text-secondary)]';
      default:
        return 'text-[var(--color-text-muted)]';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={false}
          animate={{}}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
        />

        {/* Command Palette */}
        <motion.div
          initial={{ scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="relative w-full max-w-2xl bg-[var(--color-bg-primary)] rounded-xl shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden border border-[var(--color-border)]"
        >
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-[var(--color-accent)] mr-3 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-[var(--color-text-muted)] mr-3" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modes, conditions, drugs..."
              aria-label="Search modes, conditions, drugs"
              className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none text-lg"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
              aria-label="Close command palette"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="px-4 py-3 bg-data-fail/10 border-b border-data-fail/30">
              <p className="text-sm text-data-fail flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{searchError}</span>
              </p>
            </div>
          )}

          {/* Results */}
          <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto py-2">
            {isSearching && query.trim().length >= 2 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-[var(--color-accent)]" />
                <p>Searching medical content...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                {query.trim() ? (
                  <>
                    <p className="font-medium mb-1">No results found</p>
                    <p className="text-sm">Try a different search term</p>
                  </>
                ) : (
                  <p>Start typing to search...</p>
                )}
              </div>
            ) : (
              results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={result.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                    index === selectedIndex ? 'bg-[var(--color-bg-tertiary)]' : ''
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium uppercase ${getCategoryColor(result.category)}`}
                      >
                        {result.category}
                      </span>
                      <span className="text-[var(--color-text-primary)] font-medium">
                        {result.title}
                      </span>
                    </div>
                    {result.subtitle && (
                      <div className="text-sm text-[var(--color-text-muted)] mt-1">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded">
                  ↑↓
                </kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded">
                  ↵
                </kbd>{' '}
                Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded">
                  esc
                </kbd>{' '}
                Close
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CommandPalette;
