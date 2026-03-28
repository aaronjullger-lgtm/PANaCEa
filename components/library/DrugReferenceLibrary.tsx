import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';

const SEARCH_DEBOUNCE_MS = 320;
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Search,
  RefreshCw,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pill,
  TrendingUp,
  Star,
} from 'lucide-react';

import DrugMaster from './DrugMaster';

// Types
interface DrugClass {
  id: string;
  label: string;
  count: number;
}

interface Drug {
  id: string;
  genericName: string;
  brandName?: string | null;
  displayName?: string | null;
  drugClass: string[];
  mechanismOfAction?: string | null;
  indications: string[];
  isHighYield: boolean;
  isFirstLine: boolean;
  panceYield?: number | null;
  // Additional fields for detail view loaded via API
  [key: string]: any;
}

interface ClinicalReferenceLibraryProps {
  onExit?: () => void;
}

// Loading overlay component
const LoadingOverlay: React.FC<{ message?: string }> = ({
  message = 'Loading drug reference…',
}) => (
  <div className="flex flex-col items-center justify-center h-full">
    <div className="w-12 h-12 border-4 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin mb-4" />
    <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
  </div>
);

// Error state component
const ErrorState: React.FC<{ title: string; message: string; onRetry?: () => void }> = ({
  title,
  message,
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6">
    <AlertCircle className="w-12 h-12 text-data-fail mb-4" />
    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
    <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

// Drug card component
const DrugCard: React.FC<{
  drug: Drug;
  isSelected: boolean;
  onClick: () => void;
}> = ({ drug, isSelected, onClick }) => {
  const displayName = drug.displayName || drug.genericName;
  const brandText = drug.brandName ? `(${drug.brandName})` : '';

  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ x: 4 }}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] shadow-lg'
          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:shadow-md'
      }`}
    >
      {/* Drug Name */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-[var(--color-text-primary)] text-base truncate">
            {displayName}
          </h4>
          {brandText && (
            <p className="text-sm text-[var(--color-text-muted)] truncate">{brandText}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {drug.isFirstLine && (
            <span className="px-2 py-0.5 rounded-full bg-data-pass/20 text-data-pass text-xs font-semibold">
              1st
            </span>
          )}
          {drug.isHighYield && <Star className="w-4 h-4 text-[var(--color-data-provisional)] fill-yellow-400" />}
        </div>
      </div>

      {/* Drug Classes */}
      <div className="flex flex-wrap gap-1 mb-2">
        {drug.drugClass.slice(0, 2).map((cls, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--color-category-practice)_15%,transparent)] text-[var(--color-category-practice)] text-xs border border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]"
          >
            {cls}
          </span>
        ))}
        {drug.drugClass.length > 2 && (
          <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] text-xs">
            +{drug.drugClass.length - 2}
          </span>
        )}
      </div>

      {/* Mechanism */}
      {drug.mechanismOfAction && (
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
          {drug.mechanismOfAction}
        </p>
      )}

      {/* Indications Preview */}
      {drug.indications.length > 0 && (
        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
          Used for: {drug.indications.slice(0, 2).join(', ')}
          {drug.indications.length > 2 && ` +${drug.indications.length - 2} more`}
        </div>
      )}
    </motion.button>
  );
};

// Sidebar Component
const DrugClassSidebar: React.FC<{
  drugClasses: DrugClass[];
  classesLoading: boolean;
  classesError: string | null;
  activeDrugClass: string;
  highYieldOnly: boolean;
  firstLineOnly: boolean;
  onDrugClassSelect: (classId: string) => void;
  onHighYieldToggle: (value: boolean) => void;
  onFirstLineToggle: (value: boolean) => void;
  onRetryClasses: () => void;
}> = ({
  drugClasses,
  classesLoading,
  classesError,
  activeDrugClass,
  highYieldOnly,
  firstLineOnly,
  onDrugClassSelect,
  onHighYieldToggle,
  onFirstLineToggle,
  onRetryClasses,
}) => {
  return (
    <div className="w-80 bg-[var(--color-bg-secondary)]/50 border-r border-[var(--color-border)] overflow-y-auto flex-shrink-0">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
            <Pill className="inline w-5 h-5 mr-2" />
            Pharmacopeia
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">Drug Reference Library</p>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={highYieldOnly}
              onChange={(e) => onHighYieldToggle(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)] checked:bg-[var(--color-accent)] checked:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
            />
            <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
              <Star className="inline w-3.5 h-3.5 mr-1 text-[var(--color-data-provisional)]" />
              High Yield Only
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={firstLineOnly}
              onChange={(e) => onFirstLineToggle(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)] checked:bg-[var(--color-accent)] checked:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
            />
            <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
              🥇 First-Line Only
            </span>
          </label>
        </div>

        {/* Drug Classes List */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Drug Classes
          </h3>

          {classesError ? (
            <div className="p-4 rounded-lg bg-data-fail/10 border border-data-fail/30 text-center">
              <AlertCircle className="w-6 h-6 text-data-fail mx-auto mb-2" />
              <p className="text-xs text-data-fail mb-2">{classesError}</p>
              <button
                onClick={onRetryClasses}
                className="text-xs text-data-fail hover:text-data-fail underline"
              >
                Retry
              </button>
            </div>
          ) : classesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-[var(--color-bg-primary)]/50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => onDrugClassSelect('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeDrugClass === 'all'
                    ? 'bg-[var(--color-accent)] text-white font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                All Classes
              </button>

              {drugClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => onDrugClassSelect(cls.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeDrugClass === cls.id
                      ? 'bg-[var(--color-accent)] text-white font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{cls.label}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--color-bg-primary)]/50 text-xs tabular-nums">
                      {cls.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DrugReferenceLibrary: React.FC<ClinicalReferenceLibraryProps> = ({ onExit }) => {
  const { getToken, isSignedIn } = useAuth();

  // State
  const [drugClasses, setDrugClasses] = useState<DrugClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeDrugClass, setActiveDrugClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [firstLineOnly, setFirstLineOnly] = useState(false);

  const [selected, setSelected] = useState<Drug | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Debounce search so API is not called on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch drug classes
  const fetchDrugClasses = useCallback(async () => {
    if (!isSignedIn) {
      setClassesError('Please sign in to access drug data');
      setClassesLoading(false);
      return;
    }
    setClassesLoading(true);
    setClassesError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/drugs/classes', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to access drug data');
        throw new Error(`Failed to fetch drug classes: ${res.status}`);
      }

      const data = (await res.json()) as DrugClass[] | null | undefined;
      setDrugClasses(data ?? []);
    } catch (err) {
      console.error('[DrugReferenceLibrary] classes fetch failed', err);
      setClassesError(err instanceof Error ? err.message : 'Failed to load drug classes');
    } finally {
      setClassesLoading(false);
    }
  }, [getToken, isSignedIn]);

  // Fetch drugs
  const fetchDrugs = useCallback(async () => {
    if (!isSignedIn) {
      setError('Please sign in to access drug data');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeDrugClass && activeDrugClass !== 'all') params.append('drugClass', activeDrugClass);
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (highYieldOnly) params.append('highYield', 'true');
      if (firstLineOnly) params.append('firstLine', 'true');

      const token = await getToken();
      const res = await fetch(`/api/drugs/library?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to access drug data');
        throw new Error(`Failed to fetch drugs: ${res.status}`);
      }

      const text = await res.text();
      if (!text || !text.trim()) {
        setDrugs([]);
        return;
      }
      const data = JSON.parse(text);
      setDrugs(data.drugs || []);
    } catch (err) {
      console.error('[DrugReferenceLibrary] drugs fetch failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load drug data');
    } finally {
      setLoading(false);
    }
  }, [activeDrugClass, debouncedSearchQuery, highYieldOnly, firstLineOnly, getToken, isSignedIn]);

  // Initial load
  useEffect(() => {
    fetchDrugClasses();
  }, [fetchDrugClasses]);

  useEffect(() => {
    fetchDrugs();
    setSelected(null);
    setSelectedIndex(-1);
  }, [fetchDrugs]);

  // Filter drugs for display
  const filteredDrugs = useMemo(() => {
    let result = drugs;

    if (highYieldOnly) {
      result = result.filter((d) => d.isHighYield);
    }

    if (firstLineOnly) {
      result = result.filter((d) => d.isFirstLine);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.genericName?.toLowerCase().includes(query) ||
          d.brandName?.toLowerCase().includes(query) ||
          d.indications?.some((ind) => ind.toLowerCase().includes(query))
      );
    }

    return result;
  }, [drugs, highYieldOnly, firstLineOnly, searchQuery]);

  // Group drugs by class for display
  const groupedDrugs = useMemo(() => {
    const map = new Map<string, Drug[]>();

    for (const drug of filteredDrugs) {
      // A drug can belong to multiple classes
      if (drug.drugClass && drug.drugClass.length > 0) {
        for (const cls of drug.drugClass) {
          if (!map.has(cls)) map.set(cls, []);
          map.get(cls)!.push(drug);
        }
      } else {
        if (!map.has('Uncategorized')) map.set('Uncategorized', []);
        map.get('Uncategorized')!.push(drug);
      }
    }

    return Array.from(map.entries())
      .map(([drugClass, items]) => ({ drugClass, items }))
      .sort((a, b) => a.drugClass.localeCompare(b.drugClass));
  }, [filteredDrugs]);

  // Handlers
  const handleDrugClassSelect = (classId: string) => {
    setActiveDrugClass(classId);
  };

  const handleDrugSelect = (drug: Drug, index: number) => {
    setSelected(drug);
    setSelectedIndex(index);
  };

  const handleNextDrug = () => {
    if (selectedIndex < filteredDrugs.length - 1) {
      const nextIndex = selectedIndex + 1;
      const nextDrug = filteredDrugs[nextIndex];
      if (nextDrug) {
        setSelected(nextDrug);
        setSelectedIndex(nextIndex);
      }
    }
  };

  const handlePrevDrug = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      const prevDrug = filteredDrugs[prevIndex];
      if (prevDrug) {
        setSelected(prevDrug);
        setSelectedIndex(prevIndex);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape' && selected) {
        setSelected(null);
        return;
      }

      if (selected) {
        if (e.key === 'ArrowRight' || e.key === 'j') {
          e.preventDefault();
          handleNextDrug();
        } else if (e.key === 'ArrowLeft' || e.key === 'k') {
          e.preventDefault();
          handlePrevDrug();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, selectedIndex, filteredDrugs]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex overflow-hidden">
      {/* Sidebar */}
      <DrugClassSidebar
        drugClasses={drugClasses}
        classesLoading={classesLoading}
        classesError={classesError}
        activeDrugClass={activeDrugClass}
        highYieldOnly={highYieldOnly}
        firstLineOnly={firstLineOnly}
        onDrugClassSelect={handleDrugClassSelect}
        onHighYieldToggle={setHighYieldOnly}
        onFirstLineToggle={setFirstLineOnly}
        onRetryClasses={fetchDrugClasses}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-7xl mx-auto w-full">
        {/* Header with Global Search */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm sticky top-0 z-20">
          {/* Left: Title */}
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {activeDrugClass === 'all' ? 'All Drugs' : activeDrugClass}
            </h2>
            <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
              {filteredDrugs.length} medication{filteredDrugs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Center: Global Search Bar */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search medications... (press /)"
                aria-label="Search medications"
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
              onClick={fetchDrugs}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          {classesError && drugClasses.length === 0 ? (
            <ErrorState
              title="Failed to load drug classes"
              message={classesError}
              onRetry={fetchDrugClasses}
            />
          ) : classesLoading && drugClasses.length === 0 ? (
            <LoadingOverlay message="Loading drug classes..." />
          ) : error ? (
            <ErrorState title="Failed to load drugs" message={error} onRetry={fetchDrugs} />
          ) : loading ? (
            <LoadingOverlay message="Loading medications..." />
          ) : activeDrugClass === 'all' && !searchQuery ? (
            // Drug Class Selection Prompt
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-6">
                <Pill className="w-10 h-10 text-[var(--color-category-practice)]" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                Select a Drug Class
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
                Choose a drug class from the sidebar to explore medications. This helps you focus
                your study and prevents information overload.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md">
                {drugClasses.slice(0, 6).map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleDrugClassSelect(cls.id)}
                    className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-bg-secondary)]/80 text-sm font-medium text-[var(--color-text-secondary)] transition-all"
                  >
                    {cls.label}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredDrugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No drugs found
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md">
                {searchQuery
                  ? `No results for "${searchQuery}". Try a different search term.`
                  : 'No drugs match your current filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedDrugs.map((group) => (
                <div
                  key={group.drugClass}
                  className="bg-gradient-to-br from-[var(--color-bg-secondary)]/30 to-transparent rounded-2xl p-6 border border-[var(--color-border)]/40 shadow-sm"
                >
                  {/* Class Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent)]/30" />
                      <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-primary)] font-bold flex items-center gap-3">
                        <span>{group.drugClass}</span>
                        <span className="px-2.5 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-semibold tabular-nums">
                          {group.items.length}
                        </span>
                      </h3>
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="flex flex-col gap-4">
                    {group.items.map((drug) => {
                      const globalIndex = filteredDrugs.indexOf(drug);
                      return (
                        <DrugCard
                          key={drug.id}
                          drug={drug}
                          isSelected={selected?.id === drug.id}
                          onClick={() => handleDrugSelect(drug, globalIndex)}
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

      {/* Detail Modal */}
      <DrugMaster drug={selected as any} onClose={() => setSelected(null)} />
    </div>
  );
};

export default DrugReferenceLibrary;
