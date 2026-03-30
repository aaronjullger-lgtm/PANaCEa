/**
 * GenericReferenceView<T>
 *
 * A config-driven, reusable reference browser that can render ANY clinical
 * entity type. Pass a ReferenceViewConfig to stand up a full-featured
 * browsable view for procedures, imaging studies, ECG patterns, anatomy,
 * special tests, physiology concepts, physical exam findings, guidelines, etc.
 *
 * Features:
 *   - Search with debounce
 *   - System-code filtering (14 organ systems)
 *   - Category filtering (per-entity)
 *   - Card grid with expandable detail
 *   - High-yield filter toggle
 *   - Loading, error, and empty states
 *   - Keyboard navigation (/ to search)
 *
 * Usage:
 *   <GenericReferenceView config={procedureConfig} />
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  Star,
  X,
  RefreshCw,
  AlertCircle,
  Keyboard,
} from 'lucide-react';

// ============================================================================
// RESPONSIVE HOOK
// ============================================================================

function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// ============================================================================
// TYPES
// ============================================================================

export interface FilterField {
  key: string;
  label: string;
  options?: string[];
  /** If true, options are auto-derived from the data */
  autoDerive?: boolean;
  /** Function to extract the filter value from an item */
  accessor: (item: any) => string | undefined;
}

export interface ReferenceViewConfig<T> {
  entityName: string;
  entityNameSingular: string;
  entitySlug: string;
  icon: React.ElementType;
  accentColor: string;

  /** API endpoint base (e.g., "/api/reference/procedures") */
  apiEndpoint: string;

  /** Card renderer — receives the item */
  cardRenderer: (item: T, isExpanded: boolean) => React.ReactNode;

  /** Optional detail renderer for expanded view */
  detailRenderer?: (item: T) => React.ReactNode;

  /** Filtering config */
  filters?: FilterField[];

  /** Key to extract a searchable name */
  getDisplayName: (item: T) => string;

  /** Key to extract a secondary label */
  getSubtitle?: (item: T) => string | undefined;

  /** Key to extract a unique ID */
  getId: (item: T) => string;

  /** Optional: check if item is high-yield */
  isHighYield?: (item: T) => boolean;

  /** Search fields to match against */
  searchFields: ((item: T) => string | undefined)[];

  /** Optional: get PANCE yield score for sorting */
  getPanceYield?: (item: T) => number | undefined;

  /** Grid columns config */
  gridColumns?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface GenericReferenceViewProps<T> {
  config: ReferenceViewConfig<T>;
  onBack?: () => void;
}

export default function GenericReferenceView<T>({
  config,
  onBack,
}: GenericReferenceViewProps<T>) {
  const { getToken } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'highYield' | 'panceYield'>('name');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isMobile = useIsMobile();
  const Icon = config.icon;

  // ---- Keyboard shortcut: / to focus search, ? to toggle help ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ---- Fetch data ----
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        const res = await fetch(config.apiEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();
        // Normalize response: endpoints return { data: { success, data: [] } } or { data: { success, labs: [] } }
        const payload = json.data ?? json;
        const items = Array.isArray(payload) ? payload : (payload.data ?? payload.labs ?? []);
        if (!cancelled) setData(Array.isArray(items) ? items : []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [config.apiEndpoint, getToken]);

  // ---- Auto-derive filter options from data ----
  const derivedFilters = useMemo(() => {
    if (!config.filters) return [];
    return config.filters.map((f) => {
      if (f.autoDerive && !f.options) {
        const vals = new Set<string>();
        for (const item of data) {
          const val = f.accessor(item);
          if (val) vals.add(val);
        }
        return { ...f, options: Array.from(vals).sort() };
      }
      return f;
    });
  }, [config.filters, data]);

  // ---- Filtered + sorted data ----
  const filtered = useMemo(() => {
    const result = data.filter((item) => {
      if (highYieldOnly && config.isHighYield && !config.isHighYield(item)) return false;
      for (const f of derivedFilters) {
        const selectedVal = filterValues[f.key];
        if (selectedVal && selectedVal !== 'all') {
          const itemVal = f.accessor(item);
          if (itemVal !== selectedVal) return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return config.searchFields.some((fn) => fn(item)?.toLowerCase().includes(q));
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'highYield') {
        const aHY = config.isHighYield?.(a) ? 1 : 0;
        const bHY = config.isHighYield?.(b) ? 1 : 0;
        if (bHY !== aHY) return bHY - aHY;
      }
      if (sortBy === 'panceYield' && config.getPanceYield) {
        const aY = config.getPanceYield(a) ?? 0;
        const bY = config.getPanceYield(b) ?? 0;
        if (bY !== aY) return bY - aY;
      }
      return config.getDisplayName(a).localeCompare(config.getDisplayName(b));
    });

    return result;
  }, [data, highYieldOnly, filterValues, searchQuery, derivedFilters, config, sortBy]);

  // ---- Keyboard navigation for cards ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const item = filtered[focusedIndex];
        if (item) {
          const id = config.getId(item);
          setExpandedId((prev) => (prev === id ? null : id));
        }
      } else if (e.key === 'Escape') {
        if (expandedId) {
          setExpandedId(null);
        } else {
          setFocusedIndex(-1);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [focusedIndex, filtered, expandedId, config]);

  // Reset focus when filters change
  useEffect(() => { setFocusedIndex(-1); }, [searchQuery, filterValues, highYieldOnly, sortBy]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} />
        Loading {config.entityName.toLowerCase()}...
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: '#ef4444', marginBottom: 12 }} />
        <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Failed to load {config.entityName.toLowerCase()}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* ---- HEADER ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
            cursor: 'pointer', color: 'var(--color-text-primary)',
          }}>
            <ArrowLeft size={18} />
          </button>
        )}
        <Icon size={24} style={{ color: config.accentColor }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {config.entityName}
        </h2>
        <span aria-live="polite" role="status" style={{
          fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
          background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
        }}>
          {filtered.length} of {data.length}
        </span>
        <button
          onClick={() => setShowShortcuts((prev) => !prev)}
          title="Keyboard shortcuts (?)"
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}
        >
          <Keyboard size={16} />
        </button>
      </div>

      {/* ---- KEYBOARD SHORTCUTS OVERLAY ---- */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <div style={{
              padding: '14px 18px', borderRadius: 12,
              background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 24px',
              fontSize: 13, color: 'var(--color-text-secondary)',
            }}>
              {[
                ['/', 'Focus search'],
                ['?', 'Toggle this help'],
                ['j / \u2193', 'Next card'],
                ['k / \u2191', 'Previous card'],
                ['Enter', 'Expand/collapse card'],
                ['Escape', 'Close detail / unfocus'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <kbd style={{
                    fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}>{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- SEARCH + FILTERS ---- */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {/* Search */}
        <div style={{
          flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <input
            ref={searchInputRef}
            type="text"
            role="searchbox"
            aria-label={`Search ${config.entityName.toLowerCase()}`}
            placeholder={`Search ${config.entityName.toLowerCase()}... (press /)`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--color-text-primary)',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label="Clear search"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Dynamic filter dropdowns */}
        {derivedFilters.map((f) => (
          <select
            key={f.key}
            value={filterValues[f.key] || 'all'}
            aria-label={`Filter by ${f.label}`}
            onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            style={{
              padding: '8px 12px', borderRadius: 10, fontSize: 13,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)', cursor: 'pointer', minWidth: 130,
            }}
          >
            <option value="all">All {f.label}</option>
            {f.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ))}

        {/* Sort dropdown */}
        <select
          value={sortBy}
          aria-label="Sort order"
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 13,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >
          <option value="name">Sort: A → Z</option>
          <option value="highYield">Sort: High Yield First</option>
          {config.getPanceYield && <option value="panceYield">Sort: PANCE Yield</option>}
        </select>

        {/* High-yield toggle */}
        {config.isHighYield && (
          <button
            onClick={() => setHighYieldOnly((prev) => !prev)}
            aria-pressed={highYieldOnly}
            aria-label="Filter to high-yield items only"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: highYieldOnly ? `2px solid ${config.accentColor}` : '1px solid var(--color-border)',
              background: highYieldOnly ? `${config.accentColor}18` : 'var(--color-bg-secondary)',
              color: highYieldOnly ? config.accentColor : 'var(--color-text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <Star size={14} fill={highYieldOnly ? config.accentColor : 'none'} />
            High Yield
          </button>
        )}
      </div>

      {/* ---- CARD GRID ---- */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--color-text-secondary)',
        }}>
          <Search size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--color-text-primary)' }}>
            No {config.entityName.toLowerCase()} found
          </p>
          <p style={{ fontSize: 13 }}>
            {searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'Try adjusting your filters.'}
          </p>
          {(searchQuery || highYieldOnly || Object.values(filterValues).some((v) => v && v !== 'all')) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setHighYieldOnly(false);
                setFilterValues({});
              }}
              style={{
                marginTop: 12, padding: '8px 16px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                color: config.accentColor, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div role="list" aria-label={`${config.entityName} list`} style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : (config.gridColumns || 'repeat(auto-fill, minmax(280px, 1fr))'),
          gap: isMobile ? 10 : 14,
        }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => {
              const id = config.getId(item);
              const isExpanded = expandedId === id;
              const isFocused = focusedIndex === idx;

              return (
                <motion.div
                  key={id}
                  role="listitem"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={config.getDisplayName(item)}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => { setExpandedId(isExpanded ? null : id); setFocusedIndex(idx); }}
                  style={{
                    borderRadius: 12,
                    border: isExpanded
                      ? `2px solid ${config.accentColor}`
                      : isFocused
                        ? `2px solid ${config.accentColor}80`
                        : '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: isExpanded
                      ? `0 0 0 3px ${config.accentColor}20`
                      : isFocused
                        ? `0 0 0 3px ${config.accentColor}15`
                        : 'none',
                    gridColumn: isExpanded && config.detailRenderer ? '1 / -1' : undefined,
                  }}
                >
                  {/* Card header with expand chevron */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {config.cardRenderer(item, isExpanded)}
                    </div>
                    {config.detailRenderer && (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}
                      >
                        <ChevronRight size={16} />
                      </motion.div>
                    )}
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && config.detailRenderer && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: '0 16px 16px',
                          borderTop: '1px solid var(--color-border)',
                          paddingTop: 16,
                        }}>
                          {config.detailRenderer(item)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
