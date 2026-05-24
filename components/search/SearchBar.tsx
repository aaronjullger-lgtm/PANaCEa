/**
 * SearchBar — Reusable search input with autocomplete, recent searches, and filter chips.
 *
 * Features:
 * - Debounced autocomplete suggestions (custom or fetcher-based)
 * - Recent searches from localStorage (per `storageKey`)
 * - Optional filter chips displayed below the input
 * - Clear button + keyboard navigation (Escape to close, Arrow keys to navigate)
 * - Accessible: ARIA combobox pattern, screen-reader announcements
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, X, Clock, ArrowRight } from 'lucide-react';

export interface SearchSuggestion {
  id: string;
  label: string;
  subtitle?: string;
}

export interface SearchFilter {
  id: string;
  label: string;
  active: boolean;
}

interface SearchBarProps {
  /** Controlled value */
  value: string;
  /** Called when the value changes (typing) */
  onChange: (value: string) => void;
  /** Called when a suggestion is selected or Enter pressed */
  onSelect: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Custom suggestions (used when fetcher not provided) */
  suggestions?: SearchSuggestion[];
  /** Async fetcher for suggestions (takes query, returns suggestions) */
  fetcher?: (query: string) => Promise<SearchSuggestion[]>;
  /** Debounce delay for fetcher (ms, default 250) */
  debounceMs?: number;
  /** Maximum recent searches to show (default 5) */
  maxRecent?: number;
  /** localStorage key for recent searches (default 'search.recent') */
  storageKey?: string;
  /** Optional filter chips */
  filters?: SearchFilter[];
  /** Called when a filter chip is toggled */
  onToggleFilter?: (filterId: string) => void;
  /** Additional class */
  className?: string;
  /** Whether to show the search icon */
  showIcon?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/** Read recent searches from localStorage */
function getRecentSearches(key: string, max: number): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, max);
  } catch {
    return [];
  }
}

/** Save a search term to localStorage */
function saveRecentSearch(key: string, term: string, max: number): string[] {
  try {
    const existing = getRecentSearches(key, max);
    const filtered = existing.filter((s) => s.toLowerCase() !== term.toLowerCase());
    const updated = [term, ...filtered].slice(0, max);
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Search...',
  suggestions: staticSuggestions,
  fetcher,
  debounceMs = 250,
  maxRecent = 5,
  storageKey = 'search.recent',
  filters,
  onToggleFilter,
  className = '',
  showIcon = true,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [asyncSuggestions, setAsyncSuggestions] = useState<SearchSuggestion[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches(storageKey, maxRecent)
  );

  // Async fetcher with debounce
  useEffect(() => {
    if (!fetcher || !value.trim()) {
      setAsyncSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsFetching(true);
      try {
        const results = await fetcher(value.trim());
        setAsyncSuggestions(results.slice(0, 8));
      } catch {
        setAsyncSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetcher, debounceMs]);

  // Compute display suggestions
  const displaySuggestions = useMemo(() => {
    if (value.trim() && (asyncSuggestions.length > 0 || staticSuggestions)) {
      const source = asyncSuggestions.length > 0 ? asyncSuggestions : (staticSuggestions ?? []);
      const query = value.trim().toLowerCase();
      return source.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          (s.subtitle && s.subtitle.toLowerCase().includes(query))
      );
    }
    // When input is empty, show static suggestions (if provided) or recent searches
    if (!value.trim()) {
      if (staticSuggestions && staticSuggestions.length > 0) {
        return staticSuggestions;
      }
      if (recentSearches.length > 0) {
        return recentSearches.map((term) => ({
          id: `recent-${term}`,
          label: term,
          subtitle: 'Recent',
        }));
      }
    }
    return [];
  }, [value, asyncSuggestions, staticSuggestions, recentSearches]);

  const hasSuggestions = displaySuggestions.length > 0;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!hasSuggestions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < displaySuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : displaySuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < displaySuggestions.length) {
            handleSelect(displaySuggestions[activeIndex].label);
          } else if (value.trim()) {
            handleSelect(value.trim());
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, hasSuggestions, displaySuggestions, activeIndex, value]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (term: string) => {
      onChange(term);
      onSelect(term);
      const updated = saveRecentSearch(storageKey, term, maxRecent);
      setRecentSearches(updated);
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    },
    [onChange, onSelect, storageKey, maxRecent]
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClear = useCallback(() => {
    onChange('');
    onSelect('');
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [onChange, onSelect]);

  const handleBlur = useCallback(() => {
    // Delay close to allow click on suggestion
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <label className="relative block">
        {showIcon && (
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen && hasSuggestions}
          aria-controls={hasSuggestions ? 'search-suggestions-list' : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && displaySuggestions[activeIndex]
              ? `search-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          className={`w-full rounded-2xl border py-3.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
            showIcon ? 'pl-11 pr-12' : 'pl-4 pr-12'
          }`}
          style={{
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
            background:
              'color-mix(in srgb, var(--color-bg-secondary) 76%, var(--color-bg-primary) 24%)',
          }}
        />
        {/* Clear / Loading */}
        {isFetching ? (
          <span className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-text-muted)] border-t-transparent" />
          </span>
        ) : value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>

      {/* Suggestions dropdown */}
      {isOpen && hasSuggestions && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border bg-[var(--color-bg-secondary)] shadow-2xl"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
          }}
        >
          <ul
            ref={listRef}
            id="search-suggestions-list"
            role="listbox"
            className="max-h-72 overflow-y-auto py-2"
          >
            {displaySuggestions.map((suggestion, idx) => (
              <li
                key={suggestion.id}
                id={`search-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  idx === activeIndex
                    ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(suggestion.label);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {suggestion.subtitle === 'Recent' ? (
                  <Clock className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
                ) : (
                  <Search className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{suggestion.label}</span>
                  {suggestion.subtitle && suggestion.subtitle !== 'Recent' && (
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {suggestion.subtitle}
                    </span>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100" />
              </li>
            ))}
          </ul>

          {/* Recent searches hint */}
          {!value.trim() && recentSearches.length > 0 && !staticSuggestions && (
            <div className="border-t px-4 py-2 text-xs text-[var(--color-text-muted)]"
              style={{ borderColor: 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)' }}
            >
              Recent searches — use ↑↓ to navigate, ↵ to select, esc to close
            </div>
          )}
        </div>
      )}

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onToggleFilter?.(filter.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filter.active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'border-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_74%,var(--color-bg-primary)_26%)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              aria-pressed={filter.active}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Screen reader live region for results count */}
      <div className="sr-only" aria-live="polite">
        {hasSuggestions
          ? `${displaySuggestions.length} suggestion${displaySuggestions.length === 1 ? '' : 's'} available`
          : value.trim()
            ? 'No suggestions found'
            : ''}
      </div>
    </div>
  );
};

export default SearchBar;
