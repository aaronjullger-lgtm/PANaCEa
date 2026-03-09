/**
 * ClinicalReferenceLibrary - Hierarchical Medical Reference Browser
 *
 * Redesigned for PA students doing targeted condition review:
 * - Persistent sidebar for System → Subcategory navigation
 * - Enhanced condition cards with quick-hit previews
 * - Slide-over detail panel (non-blocking)
 * - High Yield Only filter
 * - Keyboard navigation support
 */

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Bookmark,
  HelpCircle,
} from 'lucide-react';
import { LibrarySidebar } from './LibrarySidebar';
import { LibraryBreadcrumb } from './LibraryBreadcrumb';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { EnhancedConditionCard } from './EnhancedConditionCard';
import { VirtualizedConditionList } from './VirtualizedConditionList';
import { SmartConditionView } from '@/config/lazyComponents';
import { computeConditionRetrievability } from '@/lib/fsrs/retrievability';
import { defaultParameters } from '@/lib/fsrs';
import { LoadingOverlay } from '@/components/ui/layouts';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from '@/lib/toast';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import { useConditionBookmarks } from './hooks/useConditionBookmarks';
import { useRecentConditions } from './hooks/useRecentConditions';
import { useDebounce } from './MasteryRing';
import type { MedicalContentDisplay } from '@/types/medical-content';

const LIBRARY_SEARCH_DEBOUNCE_MS = 350;

interface SystemOption {
  id: string;
  label: string;
  count: number;
}

interface SubcategoryData {
  subcategory: string;
  count: number;
}

interface ClinicalReferenceLibraryProps {
  onExit?: () => void;
}

export const ClinicalReferenceLibrary: React.FC<ClinicalReferenceLibraryProps> = ({ onExit }) => {
  const { getToken, isSignedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation state
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [activeSystem, setActiveSystem] = useState<string>('all');
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryDebounced = useDebounce(searchQuery.trim(), LIBRARY_SEARCH_DEBOUNCE_MS);

  // Content state
  const [content, setContent] = useState<Partial<MedicalContentDisplay>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, {
    stability: number | null;
    lastReviewAt: string | null;
    fsrsParams: number[] | null;
  }>>({});

  // Detail panel state
  const [selected, setSelected] = useState<Partial<MedicalContentDisplay> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Expansion state for subcategories (show more than default 4)
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set());
  const ITEMS_PER_SUBCATEGORY = 3; // Show top 3 highest yield by default

  // Refs for keyboard navigation and focus
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailPanelCloseRef = useRef<HTMLButtonElement>(null);
  const hasRestoredFromUrlRef = useRef(false);

  // Keyboard shortcuts help
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Semantic search (RAG): when user types, search by embedding + optional 1-sentence answer
  const {
    results: _semanticResults,
    answer: semanticAnswer,
    loading: semanticLoading,
    error: semanticError,
    askedForAnswer,
  } = useSemanticSearch(searchQuery, { requestAnswer: true, limit: 20 });

  const isSearchMode = searchQuery.trim().length > 0;

  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } =
    useConditionBookmarks();
  const { recentConditions, addRecentCondition, removeRecentCondition, clearRecentConditions } =
    useRecentConditions();

  // Systems loading state
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);

  // Fetch systems
  const fetchSystems = useCallback(async () => {
    if (!isSignedIn) {
      setSystems([]);
      setSystemsLoading(false);
      return;
    }
    setSystemsLoading(true);
    setSystemsError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/content/systems', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Systems fetch failed: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSystems(data);
      } else {
        console.error('[ClinicalReferenceLibrary] systems response is not an array:', data);
        setSystems([]);
      }
    } catch (err) {
      console.error('[ClinicalReferenceLibrary] systems fetch failed', err);
      const msg = err instanceof Error ? err.message : 'Failed to load systems';
      setSystemsError(msg);
      toast.error(msg);
    } finally {
      setSystemsLoading(false);
    }
  }, [getToken, isSignedIn]);

  // Fetch content
  const fetchContent = useCallback(async () => {
    if (!isSignedIn) {
      const msg = 'Please sign in to access clinical content';
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeSystem && activeSystem !== 'all') params.append('system', activeSystem);
      if (activeSubcategory) params.append('subcategory', activeSubcategory);
      if (highYieldOnly) params.append('highYield', 'true');
      if (searchQueryDebounced) params.append('search', searchQueryDebounced);

      const token = await getToken();
      const res = await fetch(`/api/content/library?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to access clinical content');
        throw new Error(`Failed to fetch content: ${res.status}`);
      }

      const text = await res.text();
      if (!text || !text.trim()) {
        setContent([]);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server');
      }
      const data = parsed as { content?: unknown[] };
      setContent(Array.isArray(data?.content) ? data.content : []);
    } catch (err) {
      console.error('[ClinicalReferenceLibrary] content fetch failed', err);
      const msg = err instanceof Error ? err.message : 'Failed to load clinical data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeSystem, activeSubcategory, highYieldOnly, searchQueryDebounced, getToken, isSignedIn]);

  // Fetch user progress map (stability & last review) for retrievability computation
  const fetchProgressMap = useCallback(async () => {
    if (!isSignedIn) {
      setProgressMap({});
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch('/api/user/progress-map', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Failed to fetch progress map: ${res.status}`);
      }
      const data = await res.json();
      if (data && typeof data === 'object') {
        setProgressMap(data?.progressMap ?? {});
      }
    } catch (err) {
      console.error('[ClinicalReferenceLibrary] progress map fetch failed', err);
      // Silent fail - retrievability badges will just not appear
    }
  }, [getToken, isSignedIn]);

  // Initial load
  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  // Read URL on mount and when URL changes (e.g. back/forward): system, subcategory, highYield
  useLayoutEffect(() => {
    const sys = searchParams.get('system');
    const subcat = searchParams.get('subcategory');
    const hy = searchParams.get('highYield');

    if (sys && sys !== 'all') setActiveSystem(sys);
    if (subcat) setActiveSubcategory(subcat);
    if (hy === 'true' || hy === '1') setHighYieldOnly(true);
  }, [searchParams]);

  // Write URL when state changes (preserve tab and other params)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (activeSystem && activeSystem !== 'all') next.set('system', activeSystem);
    else next.delete('system');
    if (activeSubcategory) next.set('subcategory', activeSubcategory);
    else next.delete('subcategory');
    if (highYieldOnly) next.set('highYield', 'true');
    else next.delete('highYield');
    if (selected?.id) next.set('condition', selected.id);
    else next.delete('condition');

    const str = next.toString();
    const current = searchParams.toString();
    if (str !== current) setSearchParams(next, { replace: true });
  }, [activeSystem, activeSubcategory, highYieldOnly, selected?.id, searchParams, setSearchParams]);

  // Restore selected condition from URL when content loads
  useEffect(() => {
    const cond = searchParams.get('condition');
    if (!cond || hasRestoredFromUrlRef.current || displayContent.length === 0) return;
    const idx = displayContent.findIndex((c) => c.id === cond);
    if (idx >= 0) {
      const item = displayContent[idx];
      if (item) {
        setSelected(item);
        setSelectedIndex(idx);
        addRecentCondition(item);
        hasRestoredFromUrlRef.current = true;
      }
    }
  }, [displayContent, searchParams, addRecentCondition]);

  useEffect(() => {
    fetchContent();
    setSelected(null);
    setSelectedIndex(-1);
  }, [fetchContent]);

  // Fetch progress map for retrievability badges
  useEffect(() => {
    fetchProgressMap();
  }, [fetchProgressMap]);

  // Compute subcategories map
  const subcategoriesMap = useMemo(() => {
    const map = new Map<string, SubcategoryData[]>();

    // Group all content by system and subcategory
    const systemSubMap = new Map<string, Map<string, number>>();
    for (const item of content) {
      const sys = item.system || 'Unknown';
      const sub = item.subcategory || 'Uncategorized';

      if (!systemSubMap.has(sys)) systemSubMap.set(sys, new Map());
      const subMap = systemSubMap.get(sys)!;
      subMap.set(sub, (subMap.get(sub) || 0) + 1);
    }

    // Convert to expected format
    for (const [system, subMap] of systemSubMap) {
      const subcats = Array.from(subMap.entries())
        .map(([subcategory, count]) => ({ subcategory, count }))
        .sort((a, b) => a.subcategory.localeCompare(b.subcategory));
      map.set(system, subcats);
    }

    return map;
  }, [content]);

  // Compute retrievability percentage for each condition
  const retrievabilityMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    Object.entries(progressMap).forEach(([conditionId, data]) => {
      if (!data || typeof data !== 'object') return;
      const { stability, lastReviewAt, fsrsParams } = data;
      const w19 = fsrsParams?.[19] ?? defaultParameters.w[19];
      const w20 = fsrsParams?.[20] ?? defaultParameters.w[20];
      const retrievability = computeConditionRetrievability(stability, lastReviewAt, w19, w20);
      map[conditionId] = retrievability;
    });
    return map;
  }, [progressMap]);

  // Filter content for display (server does FTS when search param is sent; no client-side search filter)
  const filteredContent = useMemo(() => {
    let result = content;

    // Filter by system only when a specific system is selected (when 'all', pass all items)
    if (activeSystem && activeSystem !== 'all') {
      result = result.filter((item) => item.system === activeSystem);
    }

    // Filter by subcategory if selected
    if (activeSubcategory) {
      result = result.filter((item) => item.subcategory === activeSubcategory);
    }

    // Filter by high yield
    if (highYieldOnly) {
      result = result.filter((item) => (item.pance_yield ?? 0) >= 3);
    }

    return result;
  }, [content, activeSystem, activeSubcategory, highYieldOnly]);

  const displayContent = filteredContent;

  // Group content by system + subcategory so headers always match the conditions (no ID/label mismatch).
  // When viewing "All Systems", subcategory names can repeat across systems; grouping by (system, subcategory) keeps e.g. ENT conditions under ENT headers only.
  const groupedContent = useMemo(() => {
    const map = new Map<
      string,
      { system: string; subcategory: string; items: Partial<MedicalContentDisplay>[] }
    >();
    for (const item of filteredContent) {
      const system = item.system || 'Unknown';
      const subcategory = item.subcategory || 'Uncategorized';
      const key = `${system}\0${subcategory}`;
      if (!map.has(key)) map.set(key, { system, subcategory, items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values()).sort((a, b) => {
      const sysCmp = a.system.localeCompare(b.system);
      return sysCmp !== 0 ? sysCmp : a.subcategory.localeCompare(b.subcategory);
    });
  }, [filteredContent]);

  // Handlers
  const handleSystemSelect = (systemId: string) => {
    setActiveSystem(systemId);
    setActiveSubcategory(null);
  };

  const handleSubcategorySelect = (system: string, subcategory: string | null) => {
    setActiveSystem(system);
    setActiveSubcategory(subcategory);
  };

  const handleConditionSelect = (condition: Partial<MedicalContentDisplay>, index: number) => {
    setSelected(condition);
    setSelectedIndex(index);
    addRecentCondition(condition);
  };

  const handleNextCondition = () => {
    if (selectedIndex < displayContent.length - 1) {
      const nextIndex = selectedIndex + 1;
      const nextItem = displayContent[nextIndex];
      if (nextItem) {
        setSelected(nextItem);
        setSelectedIndex(nextIndex);
      }
    }
  };

  const handlePrevCondition = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      const prevItem = displayContent[prevIndex];
      if (prevItem) {
        setSelected(prevItem);
        setSelectedIndex(prevIndex);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "?" to toggle shortcuts help (skip if typing in input)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
          return;
        }
      }

      // Escape: close shortcuts first, then detail panel
      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (selected) {
          setSelected(null);
          searchInputRef.current?.focus();
          return;
        }
        return;
      }

      // "/" to focus search (only when shortcuts closed)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !isShortcutsOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Arrow keys for navigation when detail is open
      if (selected) {
        if (e.key === 'ArrowRight' || e.key === 'j') {
          e.preventDefault();
          handleNextCondition();
        } else if (e.key === 'ArrowLeft' || e.key === 'k') {
          e.preventDefault();
          handlePrevCondition();
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [selected, selectedIndex, displayContent, isShortcutsOpen]);

  // Focus management: when detail panel opens, focus close button; when it closes, focus search
  useEffect(() => {
    if (selected) {
      // Small delay so the panel has rendered
      const t = setTimeout(() => detailPanelCloseRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
    // When closing, search is focused from Escape handler; no extra effect needed
  }, [selected]);

  // Get active system label
  const activeSystemLabel = useMemo(() => {
    if (activeSystem === 'all') return null;
    return systems.find((s) => s.id === activeSystem)?.label || activeSystem;
  }, [activeSystem, systems]);

  return (
    <div data-testid="condition-library" className="min-h-screen bg-[var(--color-bg-primary)] flex overflow-hidden">
      {/* Sidebar */}
      <LibrarySidebar
        systems={systems}
        systemsLoading={systemsLoading}
        systemsError={systemsError}
        subcategories={subcategoriesMap}
        activeSystem={activeSystem}
        activeSubcategory={activeSubcategory}
        highYieldOnly={highYieldOnly}
        onSystemSelect={handleSystemSelect}
        onSubcategorySelect={handleSubcategorySelect}
        onHighYieldToggle={setHighYieldOnly}
        onSearch={setSearchQuery}
        onRetrySystems={fetchSystems}
        recentConditions={recentConditions}
        onRecentConditionClick={(id) => {
          const idx = displayContent.findIndex((c) => c.id === id);
          if (idx >= 0) {
            const item = displayContent[idx];
            if (item) handleConditionSelect(item, idx);
          }
        }}
        onRecentRemove={removeRecentCondition}
        onRecentClearAll={clearRecentConditions}
        bookmarks={bookmarks}
        onBookmarkClick={(id) => {
          const idx = displayContent.findIndex((c) => c.id === id);
          if (idx >= 0) {
            const item = displayContent[idx];
            if (item) handleConditionSelect(item, idx);
          }
        }}
        onBookmarkRemove={removeBookmark}
        onBookmarkClearAll={clearBookmarks}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-7xl mx-auto w-full">
        {/* Header with Global Search */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm sticky top-0 z-20">
          {/* Left: Breadcrumb Navigation */}
          <div className="flex items-center gap-3 min-w-0">
            <LibraryBreadcrumb
              system={activeSystemLabel}
              subcategory={activeSubcategory}
              onHomeClick={() => handleSystemSelect('all')}
              onSystemClick={() => setActiveSubcategory(null)}
              onSubcategoryClick={() => {}}
            />
            <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
              {displayContent.length} condition{displayContent.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Center: Global Search Bar */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search conditions... (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Keyboard shortcuts (?)"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              aria-label="Refresh content"
              onClick={fetchContent}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          {systemsError && systems.length === 0 ? (
            <ErrorState
              title="Failed to load systems"
              message={systemsError}
              onRetry={fetchSystems}
            />
          ) : systemsLoading && systems.length === 0 ? (
            <LoadingOverlay message="Loading systems..." />
          ) : systems.length === 0 ? (
            <ErrorState
              title="No systems available"
              message="We couldn't find any medical systems in the database. Please try again or contact support."
              onRetry={fetchSystems}
            />
          ) : isSearchMode ? (
            // Hybrid search: list from FTS (library API), answer snippet from semantic search
            loading ? (
              <LoadingOverlay message="Searching reference library..." />
            ) : semanticError ? (
              <ErrorState title="Search failed" message={semanticError} onRetry={() => {}} />
            ) : displayContent.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                  No results found
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">
                  No reference cards matched &quot;{searchQuery}&quot;. Try different wording or
                  browse by system.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-primary)]"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {semanticLoading && (
                  <p className="text-sm text-[var(--color-text-muted)]">Finding best answer...</p>
                )}
                {semanticAnswer && askedForAnswer && !semanticLoading && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                          Answer from reference cards
                        </p>
                        <p className="text-[var(--color-text-primary)] font-medium">
                          {semanticAnswer}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4 min-h-0 flex-1">
                  {displayContent.length > 40 ? (
                    <VirtualizedConditionList
                      conditions={displayContent}
                      onConditionClick={(condition) => {
                        const idx = displayContent.findIndex((c) => c.id === condition.id);
                        handleConditionSelect(condition, idx >= 0 ? idx : 0);
                      }}
                      selectedConditionId={selected?.id}
                      retrievabilityMap={retrievabilityMap}
                      getBadge={(item) =>
                        'similarity' in item && typeof item.similarity === 'number'
                          ? `${Math.round(item.similarity * 100)}% match`
                          : undefined
                      }
                      height={500}
                      columns={1}
                    />
                  ) : (
                    displayContent.map((item, idx) => (
                      <EnhancedConditionCard
                        key={item.id}
                        condition={item}
                        isSelected={selected?.id === item.id}
                        onClick={() => handleConditionSelect(item, idx)}
                        retrievability={retrievabilityMap[item.id] ?? null}
                        badge={
                          'similarity' in item && typeof item.similarity === 'number'
                            ? `${Math.round(item.similarity * 100)}% match`
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )
          ) : error ? (
            <ErrorState title="Failed to load content" message={error} onRetry={fetchContent} />
          ) : loading ? (
            <LoadingOverlay message="Loading clinical content..." />
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No conditions found
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">
                {highYieldOnly
                  ? 'No high-yield conditions match your criteria. Try disabling the High Yield filter.'
                  : 'No conditions match your current filters.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveSystem('all');
                  setActiveSubcategory(null);
                  setHighYieldOnly(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-primary)]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedContent.map((group) => {
                const groupKey = `${group.system}\0${group.subcategory}`;
                const isExpanded = expandedSubcats.has(groupKey);
                const hasMore = group.items.length > ITEMS_PER_SUBCATEGORY;
                const displayItems = isExpanded
                  ? group.items
                  : group.items.slice(0, ITEMS_PER_SUBCATEGORY);
                const remainingCount = group.items.length - ITEMS_PER_SUBCATEGORY;
                const showSystemInHeader = activeSystem === 'all';

                return (
                  <div
                    key={groupKey}
                    className="bg-gradient-to-br from-[var(--color-bg-secondary)]/30 to-transparent rounded-2xl p-6 border border-[var(--color-border)]/40 shadow-sm"
                  >
                    {/* Subcategory Header - uses each condition's own system + subcategory so no ID/label mismatch */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent)]/30" />
                        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-primary)] font-bold flex items-center gap-3">
                          {showSystemInHeader && (
                            <span className="text-[var(--color-text-muted)] font-semibold normal-case">
                              {group.system}
                            </span>
                          )}
                          <span>{group.subcategory}</span>
                          <span className="px-2.5 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-semibold tabular-nums">
                            {group.items.length}
                          </span>
                        </h3>
                      </div>
                      {hasMore && !isExpanded && (
                        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]/50 px-3 py-1 rounded-full">
                          Showing {ITEMS_PER_SUBCATEGORY} highest yield
                        </span>
                      )}
                    </div>

                    {/* Cards Grid - Vertical stacking for better information density */}
                    <div className="flex flex-col gap-4">
                      {displayItems.map((item) => {
                        const globalIndex = filteredContent.indexOf(item);
                        return (
                          <EnhancedConditionCard
                            key={item.id}
                            condition={item}
                            isSelected={selected?.id === item.id}
                            onClick={() => handleConditionSelect(item, globalIndex)}
                            retrievability={retrievabilityMap[item.id] ?? null}
                          />
                        );
                      })}
                    </div>

                    {/* Show More / Show Less Button */}
                    {hasMore && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => {
                            setExpandedSubcats((prev) => {
                              const next = new Set(prev);
                              if (isExpanded) {
                                next.delete(groupKey);
                              } else {
                                next.add(groupKey);
                              }
                              return next;
                            });
                          }}
                          className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)]/60"
                        >
                          {isExpanded ? (
                            <>Show Less</>
                          ) : (
                            <>
                              Show {remainingCount} More Condition{remainingCount !== 1 ? 's' : ''}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Slide-Over Panel */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-40"
              onClick={() => setSelected(null)}
            />

            {/* Panel - 60% width for better readability */}
            <motion.div
              data-testid="condition-detail-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full md:w-[60%] min-w-0 md:min-w-[400px] max-w-4xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-[0_18px_42px_var(--color-shadow-soft)] z-50 flex flex-col"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevCondition}
                    disabled={selectedIndex <= 0}
                    className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous (← or k)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {selectedIndex + 1} / {filteredContent.length}
                  </span>
                  <button
                    onClick={handleNextCondition}
                    disabled={selectedIndex >= filteredContent.length - 1}
                    className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next (→ or j)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      selected && toggleBookmark({ id: selected.id!, condition: selected.condition!, system: selected.system })
                    }
                    className={`p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors ${selected && isBookmarked(selected.id!) ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    title={selected && isBookmarked(selected.id!) ? 'Remove bookmark' : 'Bookmark condition'}
                  >
                    <Bookmark
                      className={`w-5 h-5 ${selected && isBookmarked(selected.id!) ? 'fill-current' : ''}`}
                    />
                  </button>
                  <button
                    ref={detailPanelCloseRef}
                    onClick={() => setSelected(null)}
                    className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Panel Content - SmartConditionView (Triage, Recognize, Order, Manage); min-h-0 so content can scroll */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Suspense
                  fallback={
                    <div className="p-6 space-y-4">
                      <Skeleton className="h-10 w-3/4" />
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-64 w-full" />
                    </div>
                  }
                >
                  <SmartConditionView
                    conditionId={selected.conditionId ?? selected.id ?? ''}
                    onClose={() => setSelected(null)}
                    embedded
                  />
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <KeyboardShortcutsHelp
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default ClinicalReferenceLibrary;
