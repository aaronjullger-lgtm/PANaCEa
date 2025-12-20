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
import { MODE_REGISTRY } from '../config/training-modes';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (modeId: string) => void;
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
  const fetchServerResults = useCallback(async (searchQuery: string): Promise<ApiSearchResult[]> => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    try {
      setSearchError(null);
      const response = await fetch(
        `/api/content/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Search failed');
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Search API error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      return [];
    }
  }, []);

  /**
   * Search results effect - triggers on debounced query change
   */
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        // Show popular modes when no query
        setResults(MODE_REGISTRY.slice(0, 8).map(mode => ({
          id: mode.id,
          title: mode.label,
          subtitle: mode.description,
          category: 'mode' as const,
          action: () => {
            onNavigate(mode.id);
            onClose();
          },
        })));
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const searchResults: SearchResult[] = [];
      const lowerQuery = debouncedQuery.toLowerCase();

      // Search training modes (client-side, instant)
      MODE_REGISTRY.forEach(mode => {
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
              onNavigate(mode.id);
              onClose();
            },
          });
        }
      });

      // Search medical content (server-side, database)
      try {
        const apiResults = await fetchServerResults(debouncedQuery);
        
        apiResults.forEach(result => {
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
  }, [debouncedQuery, onNavigate, onClose, fetchServerResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
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
        return 'text-blue-600 dark:text-blue-400';
      case 'condition':
        return 'text-green-600 dark:text-green-400';
      case 'drug':
        return 'text-purple-600 dark:text-purple-400';
      case 'action':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Command Palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-blue-500 mr-3 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-slate-400 mr-3" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modes, conditions, drugs..."
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none text-lg"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{searchError}</span>
              </p>
            </div>
          )}

          {/* Results */}
          <div
            ref={resultsRef}
            className="max-h-[60vh] overflow-y-auto py-2"
          >
            {isSearching && query.trim().length >= 2 ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
                <p>Searching medical content...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    index === selectedIndex
                      ? 'bg-slate-50 dark:bg-slate-700/50'
                      : ''
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium uppercase ${getCategoryColor(result.category)}`}>
                        {result.category}
                      </span>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {result.title}
                      </span>
                    </div>
                    {result.subtitle && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded">↵</kbd> Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded">esc</kbd> Close
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CommandPalette;
