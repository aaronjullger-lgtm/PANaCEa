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

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { LibrarySidebar } from './LibrarySidebar';
import { LibraryBreadcrumb } from './LibraryBreadcrumb';
import { EnhancedConditionCard } from './EnhancedConditionCard';
import { ConditionMaster } from './ConditionMaster';
import { LoadingOverlay } from '@/components/ui/layouts';
import { ErrorState } from '@/components/ui/ErrorState';
import type { MedicalContentDisplay } from '@/types/medical-content';

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

  // Navigation state
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [activeSystem, setActiveSystem] = useState<string>('all');
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Content state
  const [content, setContent] = useState<Partial<MedicalContentDisplay>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail panel state
  const [selected, setSelected] = useState<Partial<MedicalContentDisplay> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Expansion state for subcategories (show more than default 4)
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set());
  const ITEMS_PER_SUBCATEGORY = 3; // Show top 3 highest yield by default

  // Refs for keyboard navigation
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      setSystemsError(err instanceof Error ? err.message : 'Failed to load systems');
    } finally {
      setSystemsLoading(false);
    }
  }, [getToken, isSignedIn]);

  // Fetch content
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
      if (activeSystem && activeSystem !== 'all') params.append('system', activeSystem);
      if (activeSubcategory) params.append('subcategory', activeSubcategory);
      if (searchQuery) params.append('search', searchQuery);
      if (highYieldOnly) params.append('highYield', 'true');

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
      const data = JSON.parse(text);
      setContent(data.content || []);
    } catch (err) {
      console.error('[ClinicalReferenceLibrary] content fetch failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load clinical data');
    } finally {
      setLoading(false);
    }
  }, [activeSystem, activeSubcategory, searchQuery, highYieldOnly, getToken, isSignedIn]);

  // Initial load
  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  useEffect(() => {
    fetchContent();
    setSelected(null);
    setSelectedIndex(-1);
  }, [fetchContent]);

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

  // Filter content for display
  const filteredContent = useMemo(() => {
    let result = content;

    // Filter by subcategory if selected
    if (activeSubcategory) {
      result = result.filter((item) => item.subcategory === activeSubcategory);
    }

    // Filter by high yield
    if (highYieldOnly) {
      result = result.filter((item) => (item.pance_yield ?? 0) >= 3);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.condition?.toLowerCase().includes(query) ||
          item.classic_patient?.toLowerCase().includes(query) ||
          (Array.isArray(item.buzzwords) &&
            item.buzzwords.some((b) => b.toLowerCase().includes(query)))
      );
    }

    return result;
  }, [content, activeSubcategory, highYieldOnly, searchQuery]);

  // Group content by subcategory for display
  const groupedContent = useMemo(() => {
    const map = new Map<string, Partial<MedicalContentDisplay>[]>();
    for (const item of filteredContent) {
      const key = item.subcategory || 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries())
      .map(([subcategory, items]) => ({ subcategory, items }))
      .sort((a, b) => a.subcategory.localeCompare(b.subcategory));
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
  };

  const handleNextCondition = () => {
    if (selectedIndex < filteredContent.length - 1) {
      const nextIndex = selectedIndex + 1;
      const nextItem = filteredContent[nextIndex];
      if (nextItem) {
        setSelected(nextItem);
        setSelectedIndex(nextIndex);
      }
    }
  };

  const handlePrevCondition = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      const prevItem = filteredContent[prevIndex];
      if (prevItem) {
        setSelected(prevItem);
        setSelectedIndex(prevIndex);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape to close detail
      if (e.key === 'Escape' && selected) {
        setSelected(null);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, selectedIndex, filteredContent]);

  // Get active system label
  const activeSystemLabel = useMemo(() => {
    if (activeSystem === 'all') return null;
    return systems.find((s) => s.id === activeSystem)?.label || activeSystem;
  }, [activeSystem, systems]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex overflow-hidden">
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
              {filteredContent.length} condition{filteredContent.length !== 1 ? 's' : ''}
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
            {onExit && (
              <button
                onClick={onExit}
                className="px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
            )}
            <button
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
          ) : error ? (
            <ErrorState title="Failed to load content" message={error} onRetry={fetchContent} />
          ) : loading ? (
            <LoadingOverlay message="Loading clinical content..." />
          ) : activeSystem === 'all' && !searchQuery ? (
            // System Selection Prompt - Don't load all 2000+ conditions
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-6">
                <svg
                  className="w-10 h-10 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                Select a Medical System
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
                Choose a system from the sidebar to explore conditions. This helps you focus your
                study and prevents information overload.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md">
                {systems.slice(0, 6).map((sys) => (
                  <button
                    key={sys.id}
                    onClick={() => handleSystemSelect(sys.id)}
                    className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-bg-secondary)]/80 text-sm font-medium text-[var(--color-text-secondary)] transition-all"
                  >
                    {sys.label}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No conditions found
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md">
                {highYieldOnly
                  ? 'No high-yield conditions match your criteria. Try disabling the High Yield filter.'
                  : searchQuery
                    ? `No results for "${searchQuery}". Try a different search term.`
                    : 'No conditions match your current filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedContent.map((group) => {
                const isExpanded = expandedSubcats.has(group.subcategory);
                const hasMore = group.items.length > ITEMS_PER_SUBCATEGORY;
                const displayItems = isExpanded
                  ? group.items
                  : group.items.slice(0, ITEMS_PER_SUBCATEGORY);
                const remainingCount = group.items.length - ITEMS_PER_SUBCATEGORY;

                return (
                  <div
                    key={group.subcategory}
                    className="bg-gradient-to-br from-[var(--color-bg-secondary)]/30 to-transparent rounded-2xl p-6 border border-[var(--color-border)]/40 shadow-sm"
                  >
                    {/* Subcategory Header - Enhanced */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent)]/30" />
                        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-primary)] font-bold flex items-center gap-3">
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
                                next.delete(group.subcategory);
                              } else {
                                next.add(group.subcategory);
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
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setSelected(null)}
            />

            {/* Panel - 60% width for better readability */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-[60%] min-w-[500px] max-w-4xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col"
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
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Content - Embedded ConditionMaster without modal wrapper */}
              <div className="flex-1 overflow-y-auto">
                <ConditionMasterEmbedded content={selected} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ConditionMasterEmbedded - Enhanced deep-dive view for condition details
 */
import ReactMarkdown from 'react-markdown';
import {
  Info,
  Stethoscope,
  ClipboardList,
  Activity,
  Lightbulb,
  Target,
  Pill,
  FlaskConical,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';
import { parseListField, parseTextField, normalizeMedicalContent } from '@/lib/utils/normalization';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';

// Types for display priority
interface DisplayPriority {
  primary: string;
  secondary?: string;
  tertiary?: string;
  reasoning?: string;
}

// Compute display priority from content or infer from available data
function computeDisplayPriority(content: Record<string, unknown>): DisplayPriority {
  // Check for stored display priority in content JSONB
  const storedContent = content.content as Record<string, unknown> | null;
  if (storedContent?.display_priority) {
    return storedContent.display_priority as DisplayPriority;
  }

  // Infer priority based on available data
  const classicTriad = parseListField(content.classic_triad);
  const buzzwords = parseListField(content.buzzwords);
  const classicPatient = parseTextField(content.classic_patient);
  const goldStandard = parseTextField(content.gold_standard_dx || content.gold_standard);
  const mnemonic = parseTextField(content.mnemonic);
  const physicalExam = parseTextField(content.physicalExam || content.physical_exam);

  // Priority logic: If triad exists with 3+ items, it's likely pathognomonic
  if (classicTriad.length >= 3) {
    return { primary: 'classic_triad', secondary: 'buzzwords', tertiary: 'gold_standard_dx' };
  }

  // If buzzwords are distinctive (3+ items), prioritize them
  if (buzzwords.length >= 3) {
    return { primary: 'buzzwords', secondary: 'classic_patient', tertiary: 'gold_standard_dx' };
  }

  // If classic patient description is detailed (>50 chars), it's key
  if (classicPatient && classicPatient.length > 50) {
    return { primary: 'classic_patient', secondary: 'buzzwords', tertiary: 'gold_standard_dx' };
  }

  // If mnemonic exists, it's a memory aid condition
  if (mnemonic && mnemonic.length > 5) {
    return { primary: 'mnemonic', secondary: 'classic_patient', tertiary: 'buzzwords' };
  }

  // Default to gold standard dx as primary
  return { primary: 'gold_standard_dx', secondary: 'classic_patient', tertiary: 'buzzwords' };
}

// Extracted helper components - moved outside to prevent recreation on every render
const TextField: React.FC<{ label: string; value: unknown; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => {
  const text = parseTextField(value);
  if (!text) return null;
  // Clean HTML entities and render through ReactMarkdown for proper formatting
  const cleanText = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?em>/gi, '*')
    .replace(/<\/?i>/gi, '*');
  return (
    <div
      className={
        highlight
          ? 'p-3 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
          : ''
      }
    >
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </h4>
      <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text-primary)] leading-relaxed">
        <ReactMarkdown>{cleanText}</ReactMarkdown>
      </div>
    </div>
  );
};

const MarkdownField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = parseTextField(value);
  if (!text) return null;
  // Clean HTML entities for proper markdown rendering
  const cleanText = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?em>/gi, '*')
    .replace(/<\/?i>/gi, '*');
  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
        {label}
      </h4>
      <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text-secondary)]">
        <ReactMarkdown>{cleanText}</ReactMarkdown>
      </div>
    </div>
  );
};

const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accentColor?: string;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
}> = ({ id, title, icon: Icon, children, accentColor, expandedSections, toggleSection }) => {
  const isExpanded = expandedSections.has(id);

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-secondary)]/30 overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentColor || 'text-[var(--color-accent)]'}`} />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] rotate-90" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4 border-t border-[var(--color-border)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConditionMasterEmbedded: React.FC<{ content: Partial<MedicalContentDisplay> }> = ({
  content,
}) => {
  const normalized = useMemo(() => normalizeMedicalContent(content), [content]);

  // Compute context-aware display priority
  const displayPriority = useMemo(
    () => computeDisplayPriority(normalized as Record<string, unknown>),
    [normalized]
  );

  // Track which sections are expanded (clinical starts expanded)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['clinical']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getValue = (data: Record<string, unknown>, keys: string[]): unknown => {
    for (const key of keys) {
      if (key in data) {
        const value = data[key];
        if (value !== undefined && value !== null) return value;
      }
    }
    return undefined;
  };

  // Extract key values
  const overview = parseTextField(normalized.overview);
  const goldStandard = parseTextField(getValue(normalized, ['gold_standard', 'gold_standard_dx']));
  const firstLineRx = parseTextField(getValue(normalized, ['first_line_rx']));
  const bestInitialTest = parseTextField(getValue(normalized, ['best_initial_test']));
  const classicPatient = parseTextField(normalized.classic_patient);
  const buzzwords = parseListField(normalized.buzzwords);
  const clinicalPearls = parseListField(normalized.clinical_pearls);
  const classicTriad = parseListField(normalized.classic_triad);
  const mnemonic = parseTextField((normalized as Record<string, unknown>).mnemonic);
  const physicalExam = parseTextField(
    getValue(normalized, ['physicalExam', 'physical_exam', 'signs'])
  );
  const differentialDx = parseListField(
    (normalized as Record<string, unknown>).differentialDiagnosis
  );
  const complications =
    parseListField(normalized.complications) || parseTextField(normalized.complications);
  const riskFactors =
    parseListField((normalized as Record<string, unknown>).riskFactors) ||
    parseTextField(getValue(normalized, ['riskFactors', 'risk_factors']));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-3xl font-bold text-[var(--color-text-primary)] tracking-wide mb-3"
          style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
        >
          {normalized.condition}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {normalized.system && <SystemBadge system={normalized.system} />}
          <YieldBadge yield={normalized.pance_yield} size="md" />
          {normalized.subcategory && (
            <span className="px-2 py-1 bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] rounded text-xs">
              {normalized.subcategory}
            </span>
          )}
        </div>
      </div>

      {/* Quick Facts Hero Card - Semantic colors for critical clinical info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {goldStandard && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                Gold Standard Dx
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{goldStandard}</p>
          </div>
        )}
        {firstLineRx && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Pill className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                First-Line Rx
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{firstLineRx}</p>
          </div>
        )}
        {parseTextField(getValue(normalized, ['best_initial_test'])) && (
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide">
                Best Initial Test
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {parseTextField(getValue(normalized, ['best_initial_test']))}
            </p>
          </div>
        )}
      </div>

      {/* Classic Patient Callout - Theme consistent */}
      {classicPatient && (
        <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-1">
                Classic Patient
              </h4>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">
                "{classicPatient}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buzzwords - Theme consistent pills */}
      {buzzwords.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--color-accent)]" />
            Buzzwords / Key Associations
          </h4>
          <div className="flex flex-wrap gap-2">
            {buzzwords.map((word, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 text-sm font-medium"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Pearls - Theme consistent */}
      {clinicalPearls.length > 0 && (
        <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-[var(--color-accent)]" />
            <h4 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide">
              Clinical Pearls
            </h4>
          </div>
          <ul className="space-y-2">
            {clinicalPearls.map((pearl, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
              >
                <span className="text-[var(--color-accent)] mt-1">•</span>
                <span>{pearl}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mnemonic - Prominent if exists */}
      {mnemonic && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 border border-violet-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-violet-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h4 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">
              Memory Aid / Mnemonic
            </h4>
          </div>
          <p className="text-base font-bold text-[var(--color-text-primary)] font-mono tracking-wide">
            {mnemonic}
          </p>
        </div>
      )}

      {/* Classic Triad - Keep rose for warning/important triads */}
      {classicTriad.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-500/10 to-rose-600/5 border border-rose-500/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h4 className="text-sm font-semibold text-rose-400 uppercase tracking-wide">
              Classic Triad
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {classicTriad.map((item, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-sm font-medium"
              >
                {idx + 1}. {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Overview - If exists and distinct from classic patient */}
      {overview && overview !== classicPatient && (
        <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text-secondary)] leading-relaxed">
          <ReactMarkdown>{overview}</ReactMarkdown>
        </div>
      )}

      {/* Differential Diagnosis - Important for clinical reasoning */}
      {differentialDx.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-400" />
            Differential Diagnosis
          </h4>
          <div className="flex flex-wrap gap-2">
            {differentialDx.slice(0, 8).map((dx, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-medium"
              >
                {dx}
              </span>
            ))}
            {differentialDx.length > 8 && (
              <span className="px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                +{differentialDx.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expandable Sections - Properly organized */}
      <div className="space-y-3 pt-2">
        {/* Section 1: Clinical Presentation */}
        <Section
          id="clinical"
          title="Clinical Presentation"
          icon={Stethoscope}
          accentColor="text-blue-400"
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        >
          <TextField label="Symptoms" value={normalized.symptoms} />
          <TextField
            label="Physical Exam Findings"
            value={getValue(normalized, ['physicalExam', 'physical_exam', 'signs'])}
          />
        </Section>

        {/* Section 2: Workup - Diagnostics only */}
        <Section
          id="workup"
          title="Workup & Diagnostics"
          icon={FlaskConical}
          accentColor="text-amber-400"
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        >
          <TextField label="Diagnostics" value={getValue(normalized, ['diagnostics'])} />
        </Section>

        {/* Section 3: Treatment - Separate from workup */}
        <Section
          id="treatment"
          title="Treatment"
          icon={Pill}
          accentColor="text-emerald-400"
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        >
          <MarkdownField label="Treatment Approach" value={normalized.treatment} />
          <TextField label="Mechanism of Action" value={getValue(normalized, ['rx_mechanism'])} />
          <TextField label="Side Effects" value={getValue(normalized, ['rx_side_effects'])} />
          <TextField
            label="Patient Education"
            value={getValue(normalized, ['patient_education'])}
          />
        </Section>

        {/* Section 4: Outcomes - Complications, Prognosis, Disposition */}
        <Section
          id="outcomes"
          title="Outcomes & Prognosis"
          icon={AlertTriangle}
          accentColor="text-rose-400"
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        >
          <TextField label="Complications" value={normalized.complications} />
          <TextField label="Prognosis" value={normalized.prognosis} />
          <TextField label="Disposition" value={getValue(normalized, ['disposition'])} />
          <TextField label="Prevention" value={getValue(normalized, ['prevention'])} />
        </Section>

        {/* Section 5: Background & Etiology */}
        <Section
          id="background"
          title="Background & Etiology"
          icon={Info}
          accentColor="text-purple-400"
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        >
          <TextField label="Epidemiology" value={normalized.epidemiology} />
          <TextField label="Etiology" value={normalized.etiology} />
          <TextField
            label="Risk Factors"
            value={getValue(normalized, ['riskFactors', 'risk_factors'])}
          />
          <MarkdownField label="Pathophysiology" value={normalized.pathophysiology} />
        </Section>
      </div>
    </div>
  );
};

export default ClinicalReferenceLibrary;