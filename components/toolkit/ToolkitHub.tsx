import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Calculator as CalculatorIcon,
  BookOpen,
  Pill,
  Activity,
  Video,
  Headphones,
  ChevronRight,
  X,
  Menu,
  Star,
  StarOff,
  Clock,
  Sparkles,
  Lightbulb,
  FileText,
  FileImage,
} from 'lucide-react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';
import { CalculatorHub } from './calculators/CalculatorHub';
import { CALCULATORS as REGISTRY_CALCULATORS } from './calculators/calculatorRegistry';
import { StorageKeys } from '@/lib/storage/storageRegistry';
import { MnemonicGenerator } from './MnemonicGenerator';
import { StudyGuideGenerator } from './StudyGuideGenerator';
import { ClinicalMotionFlashcards } from './ClinicalMotionFlashcards';
import { LectureConverter } from './LectureConverter';
import { ABGInterpreter, EKGInterpreter } from './interpreters';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ToolkitHubProps {
  onNavigateToItem?: (mode: string) => void;
  onClose: () => void;
}

type TabId = 'calculators' | 'generators' | 'interpreters' | 'imaging';

/** Calculator card type (registry entries used in ToolkitHub grid) */
type Calculator = (typeof REGISTRY_CALCULATORS)[number];

interface NavTab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Navigation tabs - Clinical Utilities only (calculators, generators, interpreters) */
const NAV_TABS: NavTab[] = [
  { id: 'calculators', label: 'Calculators', icon: CalculatorIcon },
  { id: 'generators', label: 'Generators', icon: Lightbulb },
  { id: 'interpreters', label: 'Interpretation Assistants', icon: Activity },
];

/** Single source of truth: use shared registry */
const CALCULATORS = REGISTRY_CALCULATORS;

/** Local alias for storage key (avoids undefined if chunk loads before StorageKeys) */
const PINNED_CALCULATORS_KEY = StorageKeys.PINNED_CALCULATORS;
const RECENT_CALCULATORS_KEY = StorageKeys.RECENT_CALCULATORS;

// ============================================================================
// Custom Hook: useCalculatorPreferences
// ============================================================================

interface CalculatorPreferences {
  pinnedCalcs: string[];
  recentCalcs: string[];
  togglePin: (calcId: string) => void;
  recordUsage: (calcId: string) => void;
}

/**
 * Custom hook for managing calculator preferences (pinned & recent) in localStorage.
 * Encapsulates all localStorage read/write logic for better testability and reuse.
 */
function useCalculatorPreferences(): CalculatorPreferences {
  const getStoredArray = (key: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const [pinnedCalcs, setPinnedCalcs] = useState<string[]>(() =>
    getStoredArray(PINNED_CALCULATORS_KEY)
  );
  const [recentCalcs, setRecentCalcs] = useState<string[]>(() =>
    getStoredArray(RECENT_CALCULATORS_KEY)
  );

  const togglePin = useCallback((calcId: string) => {
    setPinnedCalcs((prev) => {
      const newPinned = prev.includes(calcId)
        ? prev.filter((id) => id !== calcId)
        : [...prev, calcId];
      try {
        localStorage.setItem(PINNED_CALCULATORS_KEY, JSON.stringify(newPinned));
      } catch {
        // Ignore storage errors
      }
      return newPinned;
    });
  }, []);

  const recordUsage = useCallback((calcId: string) => {
    setRecentCalcs((prev) => {
      const updated = [calcId, ...prev.filter((id) => id !== calcId)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_CALCULATORS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  return { pinnedCalcs, recentCalcs, togglePin, recordUsage };
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Get calculator category color classes */
const getCategoryColor = (category: Calculator['category']): string => {
  switch (category) {
    case 'risk':
      return 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10';
    case 'diagnosis':
      return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10';
    case 'dosing':
      return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10';
    case 'lab':
      return 'text-[var(--color-data-pass)] bg-[var(--color-data-pass)]/10';
    case 'guidelines':
      return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10';
  }
};

// ============================================================================
// Subcomponents
// ============================================================================

/** Calculator Card Component with enhanced hover states and pin functionality */
interface CalculatorCardProps {
  calc: Calculator;
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  showFormula?: boolean;
}

const CalculatorCard: React.FC<CalculatorCardProps> = ({
  calc,
  isPinned,
  onSelect,
  onTogglePin,
  showFormula = false,
}) => (
  <motion.button
    whileHover={{ y: -2, scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onSelect}
    className={`group text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border transition-all duration-200 relative overflow-hidden ${
      isPinned
        ? 'border-[var(--color-data-provisional)]/50 ring-1 ring-[var(--color-data-provisional)]/20'
        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
    } hover:shadow-lg hover:shadow-[var(--color-accent)]/5`}
  >
    {/* Hover gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/0 to-[var(--color-accent)]/0 group-hover:from-[var(--color-accent)]/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />

    <div className="relative">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2.5 rounded-xl ${getCategoryColor(calc.category)} transition-transform group-hover:scale-110 duration-200`}
        >
          <calc.icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1">
          {/* Pin button */}
          <button
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-all ${
              isPinned
                ? 'text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/10'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/10 opacity-0 group-hover:opacity-100'
            }`}
            title={isPinned ? 'Unpin calculator' : 'Pin calculator'}
          >
            {isPinned ? (
              <Star className="w-4 h-4 fill-[var(--color-data-provisional)]" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 group-hover:text-[var(--color-accent)] transition-colors">
        {calc.name}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">{calc.description}</p>

      {/* Formula preview (shown when searching) */}
      {showFormula && calc.formula && (
        <div className="mt-2 px-2 py-1 bg-[var(--color-bg-tertiary)] rounded text-xs font-mono text-[var(--color-accent)] truncate">
          {calc.formula}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-muted)] capitalize px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded-full">
          {calc.category}
        </span>
        {isPinned && (
          <span className="text-xs text-[var(--color-data-provisional)] font-medium">Pinned</span>
        )}
      </div>
    </div>
  </motion.button>
);

/** Sidebar navigation button */
interface SidebarNavButtonProps {
  tab: NavTab;
  isActive: boolean;
  onClick: () => void;
  variant?: 'desktop' | 'mobile';
}

const SidebarNavButton: React.FC<SidebarNavButtonProps> = ({
  tab,
  isActive,
  onClick,
  variant = 'desktop',
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 ${
      isActive
        ? `bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] ${variant === 'desktop' ? 'shadow-md' : ''}`
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
    }`}
  >
    <tab.icon className="w-5 h-5" />
    <span className={variant === 'desktop' ? 'font-medium' : ''}>{tab.label}</span>
  </button>
);

// ============================================================================
// Main Component
// ============================================================================

const VALID_UTILITY_TAB_IDS: TabId[] = ['calculators', 'generators', 'interpreters'];

const ToolkitHub: React.FC<ToolkitHubProps> = ({ onNavigateToItem, onClose }) => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && VALID_UTILITY_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'calculators'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedGenerator, setSelectedGenerator] = useState<
    'mnemonic' | 'study_guide' | 'clinical_motion' | 'lecture_script' | null
  >(null);
  const [selectedInterpreter, setSelectedInterpreter] = useState<'abg' | 'ekg' | null>(null);
  const [mnemonicConcept, setMnemonicConcept] = useState('');

  const { pinnedCalcs, recentCalcs, togglePin, recordUsage } = useCalculatorPreferences();

  useEffect(() => {
    if (tabFromUrl && VALID_UTILITY_TAB_IDS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Enhanced search with synonyms, keywords, and formula matching
  const filteredCalculators = useMemo(() => {
    if (!searchQuery) return CALCULATORS;
    const query = searchQuery.toLowerCase();
    return CALCULATORS.filter((calc) => {
      if (calc.name.toLowerCase().includes(query)) return true;
      if (calc.description.toLowerCase().includes(query)) return true;
      if (calc.synonyms?.some((s) => s.toLowerCase().includes(query))) return true;
      if (calc.keywords?.some((k) => k.toLowerCase().includes(query))) return true;
      if (calc.formula?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [searchQuery]);

  // Get search suggestions (top 4 matches with formula preview)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return filteredCalculators.slice(0, 4);
  }, [searchQuery, filteredCalculators]);

  // Get pinned calculators data
  const pinnedCalculatorData = useMemo(
    () => CALCULATORS.filter((calc) => pinnedCalcs.includes(calc.id)),
    [pinnedCalcs]
  );

  // Get recently used calculators data (excluding pinned)
  const recentCalculatorData = useMemo(
    () =>
      recentCalcs
        .filter((id) => !pinnedCalcs.includes(id))
        .map((id) => CALCULATORS.find((c) => c.id === id))
        .filter((calc): calc is Calculator => calc !== undefined)
        .slice(0, 3),
    [recentCalcs, pinnedCalcs]
  );

  // Handle calculator selection (tracks recent usage)
  const handleSelectCalculator = useCallback(
    (calcId: string) => {
      setSelectedCalculator(calcId);
      recordUsage(calcId);
      setShowSearchSuggestions(false);
      setSearchQuery('');
    },
    [recordUsage]
  );

  // Handle pin toggle
  const handleTogglePin = useCallback(
    (calcId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      togglePin(calcId);
    },
    [togglePin]
  );

  // Handle tab change
  const handleTabChange = useCallback((tabId: TabId, closeSidebar = false) => {
    setActiveTab(tabId);
    setSelectedCalculator(null);
    setSelectedGenerator(null);
    setSelectedInterpreter(null);
    if (closeSidebar) {
      setSidebarOpen(false);
    }
  }, []);

  // Close mobile sidebar on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    if (sidebarOpen) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    return undefined;
  }, [sidebarOpen]);

  // Tab titles and descriptions
  const tabMeta: Record<TabId, { title: string; description: string }> = {
    calculators: {
      title: 'Clinical Calculators',
      description: 'Risk scores, diagnostic criteria, and clinical decision tools',
    },
    generators: {
      title: 'Generators & Study Aids',
      description: 'Mnemonics, study guides, clinical motion, and lecture scripts',
    },
    interpreters: {
      title: 'Interpretation Assistants',
      description: 'Input clinical data → Get diagnostic interpretation (ABG, EKG, etc.)',
    },
    imaging: {
      title: 'Radiology Scroll',
      description: 'Classic imaging findings and diagnostic radiology atlas',
    },
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex min-w-0 flex-1 overflow-hidden">
      {/* Sidebar Navigation - Desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] overflow-y-auto overflow-x-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <BackLink to={ROUTES.STUDY} className="mb-4 w-full justify-start" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Clinical Utilities
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Tools & Calculators</p>
          </div>

          <nav className="p-2">
            {NAV_TABS.map((tab) => (
              <SidebarNavButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                variant="desktop"
              />
            ))}
          </nav>
      </div>

      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 z-30 bg-[var(--color-overlay)] backdrop-blur-md"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Clinical Toolkit navigation"
            className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-[0_18px_42px_var(--color-shadow-soft)]"
          >
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-category-toolkit)]">
                Clinical Toolkit
              </h2>
            </div>
            <nav className="p-2">
              {NAV_TABS.map((tab) => (
                <SidebarNavButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id, true)}
                  variant="mobile"
                />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Header with Search */}
          <div className="mb-6">
            <div className="lg:hidden mb-4">
              <BackLink to={ROUTES.STUDY} />
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                {tabMeta[activeTab].title}
              </h1>
              <p className="text-[var(--color-text-muted)] mb-4">
                {tabMeta[activeTab].description}
              </p>
            </motion.div>

            {/* Global Search with Auto-Suggest */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder={
                  activeTab === 'calculators'
                    ? "Search calculators (e.g. 'afib', 'pneumonia', 'pe')"
                    : activeTab === 'generators'
                      ? 'Search generators'
                      : 'Search interpretation assistants'
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(e.target.value.length >= 2);
                }}
                onFocus={() => searchQuery.length >= 2 && setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchSuggestions(false);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Clear
                </button>
              )}

              {/* Auto-Suggest Dropdown */}
              <AnimatePresence>
                {showSearchSuggestions &&
                  searchSuggestions.length > 0 &&
                  activeTab === 'calculators' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      {searchSuggestions.map((calc, idx) => (
                        <button
                          key={calc.id}
                          onClick={() => handleSelectCalculator(calc.id)}
                          className={`w-full text-left p-3 hover:bg-[var(--color-bg-tertiary)] transition-colors flex items-center gap-3 ${
                            idx !== searchSuggestions.length - 1
                              ? 'border-b border-[var(--color-border)]'
                              : ''
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg ${getCategoryColor(calc.category)} flex-shrink-0`}
                          >
                            <calc.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--color-text-primary)] truncate">
                              {calc.name}
                            </div>
                            {calc.formula && (
                              <div className="text-xs text-[var(--color-accent)] font-mono truncate mt-0.5">
                                {calc.formula}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                        </button>
                      ))}
                    </motion.div>
                  )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* CALCULATORS TAB */}
            {activeTab === 'calculators' && (
              <motion.div
                key="calculators"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {selectedCalculator ? (
                  <CalculatorHub
                    initialCalculatorId={selectedCalculator}
                    onClose={() => setSelectedCalculator(null)}
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Search Results */}
                    {searchQuery && (
                      <div className="text-sm text-[var(--color-text-muted)] mb-4">
                        Found {filteredCalculators.length} calculator
                        {filteredCalculators.length !== 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Pinned Calculators Section */}
                    {!searchQuery && pinnedCalculatorData.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="w-4 h-4 text-[var(--color-data-provisional)] fill-[var(--color-data-provisional)]" />
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                            Pinned
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {pinnedCalculatorData.map((calc) => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={true}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(e) => handleTogglePin(calc.id, e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Recently Used Section */}
                    {!searchQuery && recentCalculatorData.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                            Recently Used
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {recentCalculatorData.map((calc) => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={pinnedCalcs.includes(calc.id)}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(e) => handleTogglePin(calc.id, e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* All Calculators Section */}
                    <section>
                      {!searchQuery &&
                        (pinnedCalculatorData.length > 0 || recentCalculatorData.length > 0) && (
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                              All Calculators
                            </h3>
                          </div>
                        )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(searchQuery ? filteredCalculators : CALCULATORS).map((calc) => (
                          <CalculatorCard
                            key={calc.id}
                            calc={calc}
                            isPinned={pinnedCalcs.includes(calc.id)}
                            onSelect={() => handleSelectCalculator(calc.id)}
                            onTogglePin={(e) => handleTogglePin(calc.id, e)}
                            showFormula={!!searchQuery}
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </motion.div>
            )}

            {/* INTERPRETATION ASSISTANTS TAB */}
            {activeTab === 'interpreters' && (
              <motion.div
                key="interpreters"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {selectedInterpreter ? (
                  <div className="space-y-4">
                    <BackLink
                      asButton
                      onClick={() => setSelectedInterpreter(null)}
                      label="Back to Interpretation Assistants"
                    />
                    {selectedInterpreter === 'abg' && <ABGInterpreter />}
                    {selectedInterpreter === 'ekg' && <EKGInterpreter />}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.button
                      type="button"
                      onClick={() => setSelectedInterpreter('abg')}
                      className="text-left p-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-data-pass)] bg-[var(--color-data-pass)]/10">
                          <Activity className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                        ABG Interpreter
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)] mb-3">
                        pH, pCO₂, HCO₃, O₂ → Acidosis/alkalosis, metabolic/respiratory, compensation
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-accent)]">
                        <span className="px-2 py-1 bg-[var(--color-accent)]/10 rounded">
                          Rule-based
                        </span>
                        <span className="px-2 py-1 bg-[var(--color-accent)]/10 rounded">
                          Winter&apos;s Formula
                        </span>
                      </div>
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={() => setSelectedInterpreter('ekg')}
                      className="text-left p-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-data-fail)] bg-[var(--color-data-fail)]/10">
                          <Activity className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                        EKG Interpreter
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)] mb-3">
                        Rhythm, rate, PR, QRS, QT, ST, T-wave → Diagnostic interpretation & DDx
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-accent)]">
                        <span className="px-2 py-1 bg-[var(--color-accent)]/10 rounded">
                          Interactive
                        </span>
                        <span className="px-2 py-1 bg-[var(--color-accent)]/10 rounded">
                          ECGPattern
                        </span>
                      </div>
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* IMAGING ATLAS TAB */}
            {activeTab === 'imaging' && (
              <motion.div
                key="imaging"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileImage className="w-8 h-8 text-[var(--color-text-muted)]" />
                    <div>
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                        Radiology Scroll
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        X-ray, CT, MRI findings library
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateToItem?.('radiology_scroll')}
                    className="w-full p-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>Open Imaging Library</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* GENERATORS TAB */}
            {activeTab === 'generators' && (
              <motion.div
                key="generators"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {selectedGenerator ? (
                  <div className="space-y-4">
                    <BackLink
                      asButton
                      onClick={() => setSelectedGenerator(null)}
                      label="Back to Generators"
                    />
                    {selectedGenerator === 'mnemonic' && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                        <div className="mb-4">
                          <label
                            htmlFor="toolkit-mnemonic-concept"
                            className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                          >
                            Medical concept
                          </label>
                          <input
                            id="toolkit-mnemonic-concept"
                            type="text"
                            value={mnemonicConcept}
                            onChange={(e) => setMnemonicConcept(e.target.value)}
                            placeholder="e.g. MUDPILES, causes of DKA"
                            className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          />
                        </div>
                        <MnemonicGenerator concept={mnemonicConcept || 'Medical concept'} />
                      </div>
                    )}
                    {selectedGenerator === 'study_guide' && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                        <StudyGuideGenerator
                          questions={[]}
                          onClose={() => setSelectedGenerator(null)}
                          title="Study Guide"
                        />
                      </div>
                    )}
                    {selectedGenerator === 'clinical_motion' && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                        <ClinicalMotionFlashcards
                          onClose={() => setSelectedGenerator(null)}
                          showBackButton={false}
                        />
                      </div>
                    )}
                    {selectedGenerator === 'lecture_script' && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                        <LectureConverter
                          onClose={() => setSelectedGenerator(null)}
                          showBackButton={false}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.button
                      type="button"
                      onClick={() => setSelectedGenerator('mnemonic')}
                      className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-accent)] bg-[var(--color-accent)]/10">
                          <Lightbulb className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Mnemonic Generator
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Generate acronyms, stories, or rhymes for medical concepts
                      </p>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedGenerator('study_guide')}
                      className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-accent)] bg-[var(--color-accent)]/10">
                          <FileText className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Study Guide Generator
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Export questions to a printable study guide
                      </p>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedGenerator('clinical_motion')}
                      className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-accent)] bg-[var(--color-accent)]/10">
                          <Video className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Clinical Motion Flashcards
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        AI-generated video clips of gait and movement pathologies
                      </p>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setSelectedGenerator('lecture_script')}
                      className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2.5 rounded-xl text-[var(--color-accent)] bg-[var(--color-accent)]/10">
                          <Headphones className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] ml-auto transition-all" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Lecture Converter
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Turn lecture text into a Host A / Host B podcast script
                      </p>
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ToolkitHub;
