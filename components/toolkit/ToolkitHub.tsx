import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  BookMarked,
  Calculator as CalculatorIcon,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Headphones,
  Lightbulb,
  Search,
  Sparkles,
  Star,
  StarOff,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkspaceEmptyState,
  WorkspaceFilterBar,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { CalculatorHub } from './calculators/CalculatorHub';
import { CALCULATORS as REGISTRY_CALCULATORS } from './calculators/calculatorRegistry';
import { ScoringSystemBrowser } from './calculators/scoring';
import { MnemonicGenerator } from './MnemonicGenerator';
import { StudyGuideGenerator } from './StudyGuideGenerator';
import { ClinicalMotionFlashcards } from './ClinicalMotionFlashcards';
import { LectureConverter } from './LectureConverter';
import { ABGInterpreter, EKGInterpreter } from './interpreters';
import { QuickRefHub } from './quickref';
import { StorageKeys } from '@/lib/storage/storageRegistry';

interface ToolkitHubProps {
  onNavigateToItem?: (mode: string) => void;
  onClose: () => void;
}

type TabId = 'calculators' | 'generators' | 'interpreters' | 'scoring' | 'quickref';
type GeneratorId = 'mnemonic' | 'study_guide' | 'clinical_motion' | 'lecture_script';
type InterpreterId = 'abg' | 'ekg';

type Calculator = (typeof REGISTRY_CALCULATORS)[number];

interface NavTab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

interface ToolCardConfig<TId extends string> {
  id: TId;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  tags: string[];
  searchTerms: string[];
}

const NAV_TABS: NavTab[] = [
  { id: 'calculators', label: 'Calculators', icon: CalculatorIcon },
  { id: 'generators', label: 'Generators', icon: Lightbulb },
  { id: 'interpreters', label: 'Interpretation', icon: Activity },
  { id: 'scoring', label: 'Scoring Systems', icon: ClipboardCheck },
  { id: 'quickref', label: 'Quick Reference', icon: BookMarked },
];

const TAB_META: Record<
  TabId,
  { title: string; description: string; accent: string; searchPlaceholder?: string }
> = {
  calculators: {
    title: 'Clinical Calculators',
    description: 'Risk scores, dosing support, diagnostic criteria, and fast decision tools.',
    accent: '#c4b78a',
    searchPlaceholder: "Search calculators (e.g. 'afib', 'pneumonia', 'pe')",
  },
  generators: {
    title: 'Generators & Study Aids',
    description: 'Mnemonic builders, study-guide exports, motion flashcards, and lecture tools.',
    accent: '#b39b6c',
    searchPlaceholder: 'Search generators, prompts, and study aids',
  },
  interpreters: {
    title: 'Interpretation Assistants',
    description: 'Translate raw clinical values into a more legible first-pass interpretation.',
    accent: '#7a8f6e',
    searchPlaceholder: 'Search interpreters and diagnostic helpers',
  },
  scoring: {
    title: 'Scoring Systems',
    description: 'Structured bedside scores and decision thresholds from the shared registry.',
    accent: '#728ba6',
  },
  quickref: {
    title: 'Quick Reference Cards',
    description: 'High-yield algorithms, ranges, and bedside summaries for fast recall.',
    accent: '#9a7f9a',
  },
};

const GENERATOR_TOOLS: ToolCardConfig<GeneratorId>[] = [
  {
    id: 'mnemonic',
    title: 'Mnemonic Generator',
    description: 'Generate acronyms, stories, or rhymes for medical concepts.',
    icon: Lightbulb,
    accent: '#c4b78a',
    tags: ['Memory aids', 'Acronyms'],
    searchTerms: ['mnemonic', 'acronym', 'memory', 'story', 'rhyme'],
  },
  {
    id: 'study_guide',
    title: 'Study Guide Generator',
    description: 'Turn selected content into a cleaner printable study guide.',
    icon: FileText,
    accent: '#728ba6',
    tags: ['Export', 'Review packets'],
    searchTerms: ['study guide', 'export', 'print', 'packet', 'summary'],
  },
  {
    id: 'clinical_motion',
    title: 'Clinical Motion Flashcards',
    description: 'Use AI-generated movement pathology clips as a study aid.',
    icon: Video,
    accent: '#9a7f9a',
    tags: ['Video', 'Movement'],
    searchTerms: ['motion', 'video', 'gait', 'movement', 'flashcards'],
  },
  {
    id: 'lecture_script',
    title: 'Lecture Converter',
    description: 'Turn lecture text into a Host A / Host B podcast-style script.',
    icon: Headphones,
    accent: '#a67f7f',
    tags: ['Audio', 'Lecture prep'],
    searchTerms: ['lecture', 'podcast', 'audio', 'script', 'converter'],
  },
];

const INTERPRETER_TOOLS: ToolCardConfig<InterpreterId>[] = [
  {
    id: 'abg',
    title: 'ABG Interpreter',
    description:
      'Translate pH, pCO2, HCO3, and oxygenation into acid-base interpretation and compensation.',
    icon: Activity,
    accent: '#7a8f6e',
    tags: ['Rule-based', "Winter's formula"],
    searchTerms: ['abg', 'acid base', 'compensation', 'winter', 'arterial blood gas'],
  },
  {
    id: 'ekg',
    title: 'EKG Interpreter',
    description: 'Walk rhythm, rate, intervals, ST/T changes, and diagnostic patterns more clearly.',
    icon: Activity,
    accent: '#a67f7f',
    tags: ['Interactive', 'ECG patterns'],
    searchTerms: ['ekg', 'ecg', 'rhythm', 'stemi', 'arrhythmia'],
  },
];

const CALCULATORS = REGISTRY_CALCULATORS;
const PINNED_CALCULATORS_KEY = StorageKeys.PINNED_CALCULATORS;
const RECENT_CALCULATORS_KEY = StorageKeys.RECENT_CALCULATORS;
const VALID_UTILITY_TAB_IDS: TabId[] = [
  'calculators',
  'generators',
  'interpreters',
  'scoring',
  'quickref',
];

interface CalculatorPreferences {
  pinnedCalcs: string[];
  recentCalcs: string[];
  togglePin: (calcId: string) => void;
  recordUsage: (calcId: string) => void;
}

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

  const [pinnedCalcs, setPinnedCalcs] = useState<string[]>(() => getStoredArray(PINNED_CALCULATORS_KEY));
  const [recentCalcs, setRecentCalcs] = useState<string[]>(() => getStoredArray(RECENT_CALCULATORS_KEY));

  const togglePin = useCallback((calcId: string) => {
    setPinnedCalcs((prev) => {
      const next = prev.includes(calcId) ? prev.filter((id) => id !== calcId) : [...prev, calcId];
      try {
        localStorage.setItem(PINNED_CALCULATORS_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  const recordUsage = useCallback((calcId: string) => {
    setRecentCalcs((prev) => {
      const next = [calcId, ...prev.filter((id) => id !== calcId)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_CALCULATORS_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  return { pinnedCalcs, recentCalcs, togglePin, recordUsage };
}

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

const getCategoryAccent = (category: Calculator['category']): string => {
  switch (category) {
    case 'risk':
      return '#b39b6c';
    case 'diagnosis':
      return '#728ba6';
    case 'dosing':
      return '#c4b78a';
    case 'lab':
      return '#7a8f6e';
    case 'guidelines':
      return '#9a7f9a';
  }
};

function matchesSearch(query: string, values: string[]) {
  const lowered = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(lowered));
}

function ToolkitTabButton({
  tab,
  active,
  onClick,
}: {
  tab: NavTab;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  const accent = TAB_META[tab.id].accent;

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[12rem] rounded-[1.2rem] border px-4 py-3 text-left transition-all duration-300"
      style={{
        background: active
          ? `linear-gradient(145deg, color-mix(in srgb, ${accent} 16%, var(--color-bg-secondary)), color-mix(in srgb, var(--color-bg-secondary) 82%, var(--color-bg-primary) 18%))`
          : 'color-mix(in srgb, var(--color-bg-secondary) 76%, var(--color-bg-primary) 24%)',
        borderColor: active
          ? `color-mix(in srgb, ${accent} 44%, var(--color-text-primary))`
          : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
        boxShadow: active ? `0 20px 40px -30px ${accent}` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl border"
          style={{
            background: `color-mix(in srgb, ${accent} 16%, var(--color-bg-secondary))`,
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
          }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: accent }} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div
            className="text-sm font-semibold tracking-[-0.02em]"
            style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
          >
            {tab.label}
          </div>
          <p className="text-xs leading-5 text-[var(--color-text-muted)]">
            {TAB_META[tab.id].description}
          </p>
        </div>
      </div>
    </button>
  );
}

interface CalculatorCardProps {
  calc: Calculator;
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  showFormula?: boolean;
}

function CalculatorCard({
  calc,
  isPinned,
  onSelect,
  onTogglePin,
  showFormula = false,
}: CalculatorCardProps) {
  const accent = getCategoryAccent(calc.category);

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className="group h-full w-full text-left"
    >
      <WorkspaceSurface accent={accent} className="h-full">
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div
              className={`rounded-xl p-2.5 ${getCategoryColor(calc.category)} transition-transform duration-200 group-hover:scale-105`}
            >
              <calc.icon className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onTogglePin}
                className={`rounded-lg p-1.5 transition-all ${
                  isPinned
                    ? 'text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/10'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-data-provisional)]/10 hover:text-[var(--color-data-provisional)] opacity-0 group-hover:opacity-100 focus:opacity-100'
                }`}
                title={isPinned ? 'Unpin calculator' : 'Pin calculator'}
                aria-label={isPinned ? 'Unpin calculator' : 'Pin calculator'}
              >
                {isPinned ? (
                  <Star className="h-4 w-4 fill-[var(--color-data-provisional)]" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </button>
              <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--color-accent)]" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {calc.name}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {calc.description}
            </p>
          </div>

          {showFormula && calc.formula ? (
            <div className="rounded-xl bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs font-mono text-[var(--color-accent)]">
              {calc.formula}
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            <span className="workspace-chip rounded-full px-2.5 py-1 text-xs font-medium capitalize text-[var(--color-text-muted)]">
              {calc.category}
            </span>
            {isPinned ? (
              <span className="text-xs font-medium text-[var(--color-data-provisional)]">
                Pinned
              </span>
            ) : null}
          </div>
        </div>
      </WorkspaceSurface>
    </motion.button>
  );
}

function ToolSelectionCard<TId extends string>({
  tool,
  onSelect,
}: {
  tool: ToolCardConfig<TId>;
  onSelect: () => void;
}) {
  const Icon = tool.icon;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className="h-full w-full text-left"
    >
      <WorkspaceSurface accent={tool.accent} className="h-full">
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border"
              style={{
                background: `color-mix(in srgb, ${tool.accent} 16%, var(--color-bg-secondary))`,
                borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
              }}
            >
              <Icon className="h-5 w-5" style={{ color: tool.accent }} aria-hidden="true" />
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-[var(--color-text-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--color-accent)]" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {tool.title}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {tool.description}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {tool.tags.map((tag) => (
              <span
                key={tag}
                className="workspace-chip rounded-full px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </WorkspaceSurface>
    </motion.button>
  );
}

const ToolkitHub: React.FC<ToolkitHubProps> = ({ onClose }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && VALID_UTILITY_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'calculators'
  );
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('toolkit.searchQuery') || '';
    } catch {
      return '';
    }
  });
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedGenerator, setSelectedGenerator] = useState<GeneratorId | null>(null);
  const [selectedInterpreter, setSelectedInterpreter] = useState<InterpreterId | null>(null);
  const [mnemonicConcept, setMnemonicConcept] = useState('');

  const { pinnedCalcs, recentCalcs, togglePin, recordUsage } = useCalculatorPreferences();

  useEffect(() => {
    if (tabFromUrl && VALID_UTILITY_TAB_IDS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    try {
      localStorage.setItem('toolkit.searchQuery', searchQuery);
    } catch {
      /* ignore storage errors */
    }
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedCalculator) {
        setSelectedCalculator(null);
        return;
      }
      if (selectedGenerator) {
        setSelectedGenerator(null);
        return;
      }
      if (selectedInterpreter) {
        setSelectedInterpreter(null);
        return;
      }
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, selectedCalculator, selectedGenerator, selectedInterpreter]);

  const filteredCalculators = useMemo(() => {
    if (!searchQuery) return CALCULATORS;
    const query = searchQuery.toLowerCase();
    return CALCULATORS.filter((calc) => {
      if (calc.name.toLowerCase().includes(query)) return true;
      if (calc.description.toLowerCase().includes(query)) return true;
      if (calc.synonyms?.some((value) => value.toLowerCase().includes(query))) return true;
      if (calc.keywords?.some((value) => value.toLowerCase().includes(query))) return true;
      if (calc.formula?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [searchQuery]);

  const filteredGenerators = useMemo(() => {
    if (!searchQuery) return GENERATOR_TOOLS;
    return GENERATOR_TOOLS.filter((tool) =>
      matchesSearch(searchQuery, [tool.title, tool.description, ...tool.searchTerms, ...tool.tags])
    );
  }, [searchQuery]);

  const filteredInterpreters = useMemo(() => {
    if (!searchQuery) return INTERPRETER_TOOLS;
    return INTERPRETER_TOOLS.filter((tool) =>
      matchesSearch(searchQuery, [tool.title, tool.description, ...tool.searchTerms, ...tool.tags])
    );
  }, [searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2 || activeTab !== 'calculators') return [];
    return filteredCalculators.slice(0, 4);
  }, [activeTab, filteredCalculators, searchQuery]);

  const pinnedCalculatorData = useMemo(
    () => CALCULATORS.filter((calc) => pinnedCalcs.includes(calc.id)),
    [pinnedCalcs]
  );

  const recentCalculatorData = useMemo(
    () =>
      recentCalcs
        .filter((id) => !pinnedCalcs.includes(id))
        .map((id) => CALCULATORS.find((calc) => calc.id === id))
        .filter((calc): calc is Calculator => calc !== undefined)
        .slice(0, 3),
    [recentCalcs, pinnedCalcs]
  );

  const activeMeta = TAB_META[activeTab];
  const searchable = activeTab === 'calculators' || activeTab === 'generators' || activeTab === 'interpreters';
  const quickActions = NAV_TABS.filter((tab) => tab.id !== activeTab).slice(0, 2);
  const primaryQuickAction = quickActions[0];
  const secondaryQuickAction = quickActions[1];

  const handleSelectCalculator = useCallback(
    (calcId: string) => {
      setSelectedCalculator(calcId);
      recordUsage(calcId);
      setShowSearchSuggestions(false);
    },
    [recordUsage]
  );

  const handleTogglePin = useCallback(
    (calcId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      togglePin(calcId);
    },
    [togglePin]
  );

  const handleTabChange = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      setSelectedCalculator(null);
      setSelectedGenerator(null);
      setSelectedInterpreter(null);
      setShowSearchSuggestions(false);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tabId === 'calculators') {
            next.delete('tab');
          } else {
            next.set('tab', tabId);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const selectedGeneratorConfig = selectedGenerator
    ? GENERATOR_TOOLS.find((tool) => tool.id === selectedGenerator) ?? null
    : null;
  const selectedInterpreterConfig = selectedInterpreter
    ? INTERPRETER_TOOLS.find((tool) => tool.id === selectedInterpreter) ?? null
    : null;

  return (
    <WorkspacePage density="wide" mode="toolkit">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Toolkit Workspace',
            badgeTone: 'gold',
            title: 'Reach for the right aid before the guesswork starts.',
            subtitle:
              'Search the right tool quickly, keep recents and pins close, and avoid scrolling through passive counts before you launch.',
            status: activeMeta.title,
            actionPosition: 'under-title',
            backLabel: 'Back to Study',
            onBack: onClose,
            primaryAction: primaryQuickAction
              ? {
                  label: `Open ${primaryQuickAction.label}`,
                  onClick: () => handleTabChange(primaryQuickAction.id),
                }
              : undefined,
            secondaryActions: secondaryQuickAction
              ? [
                  {
                    label: secondaryQuickAction.label,
                    onClick: () => handleTabChange(secondaryQuickAction.id),
                  },
                ]
              : undefined,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <WorkspaceHeroStrip tone="toolkit">
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">
                Start with the launcher
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Search or reopen a tool first. Counts should never be the main event here.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Use search when you know what you need, recents when you are returning to a tool,
                and pinned shortcuts when a calculator should stay one click away.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Recent launches
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {recentCalculatorData.length > 0
                    ? `${recentCalculatorData.length} tool${recentCalculatorData.length === 1 ? '' : 's'} ready to reopen quickly.`
                    : 'Recent history will appear here after the first launch.'}
                </p>
              </div>
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Pinned tools
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {pinnedCalculatorData.length > 0
                    ? `${pinnedCalculatorData.length} shortcut${pinnedCalculatorData.length === 1 ? '' : 's'} stay visible for repeat use.`
                    : 'Pin the calculators you reach for repeatedly.'}
                </p>
              </div>
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Calculator library
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {CALCULATORS.length} registry-backed calculators are ready for fast launch.
                </p>
              </div>
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Active lane
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {activeMeta.description}
                </p>
              </div>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceFilterBar>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Lane selector
                </p>
                <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  Switch lanes without leaving the page. Search stays focused on calculators,
                  generators, and interpreters where it adds the most value.
                </p>
              </div>
              <div className="workspace-chip rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                {activeMeta.title}
              </div>
            </div>

            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {NAV_TABS.map((tab) => (
                <ToolkitTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                />
              ))}
            </div>

            {searchable ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder={activeMeta.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setShowSearchSuggestions(event.target.value.length >= 2);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setShowSearchSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                  className="workspace-field w-full rounded-[1.15rem] py-3 pl-12 pr-20 text-sm focus:border-[var(--color-accent)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchSuggestions(false);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    Clear
                  </button>
                ) : null}

                <AnimatePresence>
                  {showSearchSuggestions && searchSuggestions.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[color:var(--color-bg-secondary)] shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]"
                    >
                      {searchSuggestions.map((calc, index) => (
                        <button
                          key={calc.id}
                          type="button"
                          onClick={() => handleSelectCalculator(calc.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-tertiary)] ${
                            index < searchSuggestions.length - 1 ? 'border-b workspace-divider' : ''
                          }`}
                        >
                          <div className={`rounded-xl p-2 ${getCategoryColor(calc.category)}`}>
                            <calc.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                              {calc.name}
                            </div>
                            {calc.formula ? (
                              <div className="truncate text-xs text-[var(--color-accent)]">
                                {calc.formula}
                              </div>
                            ) : null}
                          </div>
                          <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <div className="workspace-subsurface-soft rounded-[1.15rem] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Search is intentionally simplified here. Scoring systems and quick reference keep
                their own internal browsing flows inside the content area.
              </div>
            )}
          </div>
        </WorkspaceFilterBar>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetricCard
            label="Pinned tools"
            value={pinnedCalculatorData.length}
            detail="Keep repeat-use calculators and shortcuts visible so the launcher does not reset your working memory."
            accent="#b39b6c"
            icon={Star}
            variant={pinnedCalculatorData.length > 0 ? 'progress' : 'guidance'}
          />
          <WorkspaceMetricCard
            label="Recent launches"
            value={recentCalculatorData.length}
            detail="Recent usage gives this page a faster re-entry path than a static registry list."
            accent="#728ba6"
            icon={Clock}
            variant={recentCalculatorData.length > 0 ? 'progress' : 'reference'}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title={activeMeta.title}
          subtitle={activeMeta.description}
          action={
            selectedCalculator || selectedGenerator || selectedInterpreter ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedCalculator(null);
                  setSelectedGenerator(null);
                  setSelectedInterpreter(null);
                }}
              >
                Back to lane overview
              </Button>
            ) : activeTab === 'calculators' ? (
              <span className="workspace-chip rounded-full px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
                {pinnedCalculatorData.length} pinned
              </span>
            ) : null
          }
        >
          <AnimatePresence mode="wait">
            {activeTab === 'calculators' ? (
              <motion.div
                key="calculators"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {selectedCalculator ? (
                  <CalculatorHub
                    initialCalculatorId={selectedCalculator}
                    onClose={() => setSelectedCalculator(null)}
                  />
                ) : (
                  <div className="space-y-6">
                    {searchQuery ? (
                      <div className="text-sm text-[var(--color-text-muted)]">
                        Found {filteredCalculators.length} calculator
                        {filteredCalculators.length === 1 ? '' : 's'} matching &ldquo;{searchQuery}
                        &rdquo;.
                      </div>
                    ) : null}

                    {!searchQuery && pinnedCalculatorData.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-[var(--color-data-provisional)] fill-[var(--color-data-provisional)]" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
                            Pinned
                          </h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {pinnedCalculatorData.map((calc) => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={true}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(event) => handleTogglePin(calc.id, event)}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {!searchQuery && recentCalculatorData.length > 0 ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
                            Recently used
                          </h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {recentCalculatorData.map((calc) => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={pinnedCalcs.includes(calc.id)}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(event) => handleTogglePin(calc.id, event)}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {(searchQuery ? filteredCalculators : CALCULATORS).length === 0 ? (
                      <WorkspaceEmptyState
                        icon={Search}
                        title="No calculators match this search yet."
                        description="Try a diagnosis name, syndrome, medication class, or common abbreviation instead."
                        action={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSearchQuery('')}
                          >
                            Clear search
                          </Button>
                        }
                      />
                    ) : (
                      <section className="space-y-3">
                        {!searchQuery && (pinnedCalculatorData.length > 0 || recentCalculatorData.length > 0) ? (
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[var(--color-text-muted)]" />
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
                              All calculators
                            </h3>
                          </div>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {(searchQuery ? filteredCalculators : CALCULATORS).map((calc) => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={pinnedCalcs.includes(calc.id)}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(event) => handleTogglePin(calc.id, event)}
                              showFormula={Boolean(searchQuery)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </motion.div>
            ) : null}

            {activeTab === 'generators' ? (
              <motion.div
                key="generators"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {selectedGenerator ? (
                  <div className="space-y-4">
                    {selectedGeneratorConfig ? (
                      <WorkspaceSurface accent={selectedGeneratorConfig.accent}>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                              {selectedGeneratorConfig.title}
                            </p>
                            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                              {selectedGeneratorConfig.description}
                            </p>
                          </div>

                          {selectedGenerator === 'mnemonic' ? (
                            <div className="space-y-4">
                              <div>
                                <label
                                  htmlFor="toolkit-mnemonic-concept"
                                  className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]"
                                >
                                  Medical concept
                                </label>
                                <input
                                  id="toolkit-mnemonic-concept"
                                  type="text"
                                  value={mnemonicConcept}
                                  onChange={(event) => setMnemonicConcept(event.target.value)}
                                  placeholder="e.g. MUDPILES, causes of DKA"
                                  className="workspace-field w-full rounded-[1rem] px-4 py-3 text-sm focus:border-[var(--color-accent)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15"
                                />
                              </div>
                              <MnemonicGenerator concept={mnemonicConcept || 'Medical concept'} />
                            </div>
                          ) : null}

                          {selectedGenerator === 'study_guide' ? (
                            <StudyGuideGenerator
                              questions={[]}
                              onClose={() => setSelectedGenerator(null)}
                              title="Study Guide"
                            />
                          ) : null}

                          {selectedGenerator === 'clinical_motion' ? (
                            <ClinicalMotionFlashcards
                              onClose={() => setSelectedGenerator(null)}
                              showBackButton={false}
                            />
                          ) : null}

                          {selectedGenerator === 'lecture_script' ? (
                            <LectureConverter
                              onClose={() => setSelectedGenerator(null)}
                              showBackButton={false}
                            />
                          ) : null}
                        </div>
                      </WorkspaceSurface>
                    ) : null}
                  </div>
                ) : filteredGenerators.length === 0 ? (
                  <WorkspaceEmptyState
                    icon={Search}
                    title="No generators match this search."
                    description="Try terms like mnemonic, study guide, audio, lecture, or motion."
                    action={
                      <Button type="button" size="sm" variant="outline" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredGenerators.map((tool) => (
                      <ToolSelectionCard
                        key={tool.id}
                        tool={tool}
                        onSelect={() => setSelectedGenerator(tool.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : null}

            {activeTab === 'interpreters' ? (
              <motion.div
                key="interpreters"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {selectedInterpreter ? (
                  <div className="space-y-4">
                    {selectedInterpreterConfig ? (
                      <WorkspaceSurface accent={selectedInterpreterConfig.accent}>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                              {selectedInterpreterConfig.title}
                            </p>
                            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                              {selectedInterpreterConfig.description}
                            </p>
                          </div>
                          {selectedInterpreter === 'abg' ? <ABGInterpreter /> : null}
                          {selectedInterpreter === 'ekg' ? <EKGInterpreter /> : null}
                        </div>
                      </WorkspaceSurface>
                    ) : null}
                  </div>
                ) : filteredInterpreters.length === 0 ? (
                  <WorkspaceEmptyState
                    icon={Search}
                    title="No interpreters match this search."
                    description="Try ABG, EKG, rhythm, acid-base, or compensation."
                    action={
                      <Button type="button" size="sm" variant="outline" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredInterpreters.map((tool) => (
                      <ToolSelectionCard
                        key={tool.id}
                        tool={tool}
                        onSelect={() => setSelectedInterpreter(tool.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : null}

            {activeTab === 'scoring' ? (
              <motion.div
                key="scoring"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <ScoringSystemBrowser />
              </motion.div>
            ) : null}

            {activeTab === 'quickref' ? (
              <motion.div
                key="quickref"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <QuickRefHub />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSurface accent="#728ba6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Daily rhythm
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Use this page before question blocks, during missed-question review, or when you
                need fast structured support without losing focus.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => handleTabChange('calculators')}>
              Reset to calculators
            </Button>
          </div>
        </WorkspaceSurface>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ToolkitHub;
