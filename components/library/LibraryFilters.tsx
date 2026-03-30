/**
 * LibraryFilters - Filter controls for Clinical Library
 *
 * Features:
 * - System selector (dropdown)
 * - Search input (debounced)
 * - Clear filters button
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Filter } from 'lucide-react';

interface LibraryFiltersProps {
  onFilterChange: (filters: {
    system?: string | null;
    subcategory?: string | null;
    search?: string;
  }) => void;
  systems: string[];
  currentSystem?: string | null;
  currentSearch?: string;
}

export const LibraryFilters: React.FC<LibraryFiltersProps> = ({
  onFilterChange,
  systems,
  currentSystem,
  currentSearch,
}) => {
  const [search, setSearch] = useState(currentSearch || '');
  const debounceTimeout = useRef<number | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = window.setTimeout(() => {
      onFilterChange({ search: search.trim() || undefined });
    }, 300);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [search]);

  const handleSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({ system: value || null });
  };

  const handleClearFilters = () => {
    setSearch('');
    onFilterChange({ system: null, subcategory: null, search: undefined });
  };

  const hasActiveFilters = currentSystem || search.trim();

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* System Selector */}
      <div className="relative flex-1">
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <select
          aria-label="Filter by body system"
          value={currentSystem || ''}
          onChange={handleSystemChange}
          className="w-full pl-10 pr-4 py-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-category-practice)] focus:border-transparent"
        >
          <option value="">All Systems</option>
          {systems.map((system) => (
            <option key={system} value={system}>
              {system}
            </option>
          ))}
        </select>
      </div>

      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conditions..."
          aria-label="Search conditions"
          className="w-full pl-10 pr-4 py-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-category-practice)] focus:border-transparent"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="px-4 py-2 min-h-[44px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span className="hidden md:inline">Clear</span>
        </button>
      )}
    </div>
  );
};
