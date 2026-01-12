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
import { AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Refs for keyboard navigation
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch systems
  const fetchSystems = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch('/api/content/systems', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Systems fetch failed: ${res.status}`);
      const data = await res.json();
      setSystems(data);
    } catch (err) {
      console.warn('[ClinicalReferenceLibrary] systems fetch failed', err);
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
      result = result.filter(item => item.subcategory === activeSubcategory);
    }

    // Filter by high yield
    if (highYieldOnly) {
      result = result.filter(item => (item.pance_yield ?? 0) >= 3);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.condition?.toLowerCase().includes(query) ||
        item.classic_patient?.toLowerCase().includes(query) ||
        (Array.isArray(item.buzzwords) && item.buzzwords.some(b => b.toLowerCase().includes(query)))
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
      setSelected(filteredContent[nextIndex]);
      setSelectedIndex(nextIndex);
    }
  };

  const handlePrevCondition = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelected(filteredContent[prevIndex]);
      setSelectedIndex(prevIndex);
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
    return systems.find(s => s.id === activeSystem)?.label || activeSystem;
  }, [activeSystem, systems]);

  return (
    <div className="h-screen bg-[var(--color-bg-primary)] flex overflow-hidden">
      {/* Sidebar */}
      <LibrarySidebar
        systems={systems}
        subcategories={subcategoriesMap}
        activeSystem={activeSystem}
        activeSubcategory={activeSubcategory}
        highYieldOnly={highYieldOnly}
        onSystemSelect={handleSystemSelect}
        onSubcategorySelect={handleSubcategorySelect}
        onHighYieldToggle={setHighYieldOnly}
        onSearch={setSearchQuery}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-4">
            <LibraryBreadcrumb
              system={activeSystemLabel}
              subcategory={activeSubcategory}
              onHomeClick={() => handleSystemSelect('all')}
              onSystemClick={() => setActiveSubcategory(null)}
              onSubcategoryClick={() => {}} // Already at subcategory level
            />
            <span className="text-sm text-[var(--color-text-muted)]">
              {filteredContent.length} condition{filteredContent.length !== 1 ? 's' : ''}
            </span>
          </div>

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
          {error && (
            <ErrorState
              title="Failed to load content"
              message={error}
              onRetry={fetchContent}
            />
          )}

          {loading ? (
            <LoadingOverlay message="Loading clinical content..." />
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
                    : 'Select a system or subcategory from the sidebar to browse conditions.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedContent.map((group) => (
                <div key={group.subcategory}>
                  {/* Subcategory Header */}
                  <h3 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] font-semibold mb-4 flex items-center gap-2">
                    <span>{group.subcategory}</span>
                    <span className="text-xs font-normal">({group.items.length})</span>
                  </h3>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.items.map((item, idx) => {
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
                </div>
              ))}
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

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col"
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
 * ConditionMasterEmbedded - Reusable content from ConditionMaster without the modal
 */
import ReactMarkdown from 'react-markdown';
import { Info, Stethoscope, ClipboardList, Activity } from 'lucide-react';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';
import { parseListField, parseTextField, normalizeMedicalContent } from '@/lib/utils/normalization';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';

const ConditionMasterEmbedded: React.FC<{ content: Partial<MedicalContentDisplay> }> = ({ content }) => {
  const normalized = useMemo(() => normalizeMedicalContent(content), [content]);

  const getValue = (data: Record<string, unknown>, keys: string[]): unknown => {
    for (const key of keys) {
      if (key in data) {
        const value = data[key];
        if (value !== undefined && value !== null) return value;
      }
    }
    return undefined;
  };

  const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-secondary)]/30">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        <Icon className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );

  const TextField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const text = parseTextField(value);
    if (!text) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
        <ContentFieldRenderer value={text} />
      </div>
    );
  };

  const MarkdownField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const text = parseTextField(value);
    if (!text) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
        <ReactMarkdown className="condition-markdown prose prose-sm prose-invert max-w-none">{text}</ReactMarkdown>
      </div>
    );
  };

  const ListField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const items = parseListField(value);
    if (!items.length) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
        <ContentFieldRenderer value={items} variant="clinical" />
      </div>
    );
  };

  const PillListField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
    const items = parseListField(value);
    if (!items.length) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">{label}</h4>
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] text-sm font-medium"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
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

      {/* Sections */}
      <div className="space-y-4">
        {/* Section 1: Essentials */}
        <Section title="Essentials" icon={Info}>
          <TextField label="Classic Patient" value={normalized.classic_patient} />
          <TextField label="Epidemiology" value={normalized.epidemiology} />
          <TextField label="Etiology" value={normalized.etiology} />
          <TextField label="Risk Factors" value={getValue(normalized, ['riskFactors', 'risk_factors'])} />
        </Section>

        {/* Section 2: Pathophysiology */}
        <Section title="Pathophysiology" icon={Activity}>
          <MarkdownField label="Pathophysiology" value={normalized.pathophysiology} />
          <ListField label="Related Systems" value={normalized.relatedSystems} />
        </Section>

        {/* Section 3: Clinical Presentation */}
        <Section title="Clinical Presentation" icon={Stethoscope}>
          <TextField label="Symptoms" value={normalized.symptoms} />
          <TextField label="Physical Exam" value={getValue(normalized, ['physicalExam', 'physical_exam', 'signs'])} />
          <ListField label="Classic Triad" value={normalized.classic_triad} />
          <PillListField label="Buzzwords" value={normalized.buzzwords} />
        </Section>

        {/* Section 4: Workup & Treatment */}
        <Section title="Workup & Treatment" icon={ClipboardList}>
          <TextField label="Best Initial Test" value={getValue(normalized, ['best_initial_test'])} />
          <TextField label="Gold Standard" value={getValue(normalized, ['gold_standard', 'gold_standard_dx'])} />
          <TextField label="Diagnostics" value={getValue(normalized, ['diagnostics'])} />
          <MarkdownField label="Treatment" value={normalized.treatment} />
          <TextField label="First-Line Treatment" value={getValue(normalized, ['first_line_rx'])} />
          <TextField label="Complications" value={normalized.complications} />
          <TextField label="Prognosis" value={normalized.prognosis} />
        </Section>
      </div>
    </div>
  );
};

export default ClinicalReferenceLibrary;
