/**
 * Command Palette Component
 * Provides quick navigation and search functionality across the app
 * Activated with Cmd+K / Ctrl+K
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import { MODE_REGISTRY } from '../config/training-modes';
import { searchConditions } from '../src/lib/conditionSearch';
import { searchDrugs } from '../src/lib/drugSearch';

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

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show popular modes when no query
      return MODE_REGISTRY.slice(0, 8).map(mode => ({
        id: mode.id,
        title: mode.label,
        subtitle: mode.description,
        category: 'mode' as const,
        action: () => {
          onNavigate(mode.id);
          onClose();
        },
      }));
    }

    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search training modes
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

    // Search conditions (limit to top 5)
    try {
      const conditionResults = searchConditions(query, 5);
      conditionResults.forEach(result => {
        searchResults.push({
          id: `condition-${result.id}`,
          title: result.name,
          subtitle: `${result.system} - View condition details`,
          category: 'condition',
          action: () => {
            // This would navigate to condition detail
            console.log('Navigate to condition:', result.id);
            onClose();
          },
        });
      });
    } catch (error) {
      console.error('Error searching conditions:', error);
    }

    // Search drugs (limit to top 5)
    try {
      const drugResults = searchDrugs(query, 5);
      drugResults.forEach(result => {
        searchResults.push({
          id: `drug-${result.id}`,
          title: result.brandName || result.genericName,
          subtitle: `${result.genericName} - ${result.class}`,
          category: 'drug',
          action: () => {
            // This would navigate to drug detail
            console.log('Navigate to drug:', result.id);
            onClose();
          },
        });
      });
    } catch (error) {
      console.error('Error searching drugs:', error);
    }

    return searchResults.slice(0, 10);
  }, [query, onNavigate, onClose]);

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
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
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
            <Search className="w-5 h-5 text-slate-400 mr-3" />
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

          {/* Results */}
          <div
            ref={resultsRef}
            className="max-h-[60vh] overflow-y-auto py-2"
          >
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                No results found for "{query}"
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
