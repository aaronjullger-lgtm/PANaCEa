import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Calculator as CalculatorIcon,
  BookOpen,
  Pill,
  Activity,
  Beaker,
  FileImage,
  Heart,
  Droplet,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronRight,
  X,
  Menu,
  Microscope,
  Dna,
  Brain,
  Stethoscope,
  Target,
  FlaskConical,
  Star,
  StarOff,
  Clock,
  Sparkles
} from 'lucide-react';
import type { SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { CalculatorHub } from './calculators/CalculatorHub';

interface ToolkitHubProps {
  onNavigateToItem?: (mode: string) => void;
  onClose: () => void;
}

type TabId = 'calculators' | 'clinical' | 'pharmacopeia' | 'physiology' | 'imaging';

interface Calculator {
  id: string;
  name: string;
  description: string;
  category: 'risk' | 'diagnosis' | 'dosing' | 'lab' | 'guidelines';
  icon: React.ComponentType<{ className?: string }>;
  /** Search synonyms/aliases for better discoverability */
  synonyms?: string[];
  /** Formula preview shown in search results */
  formula?: string;
  /** Keywords for search matching */
  keywords?: string[];
}

// Clinical calculators registry with enhanced search metadata
const CALCULATORS: Calculator[] = [
  {
    id: 'curb65',
    name: 'CURB-65',
    description: 'Pneumonia severity assessment',
    category: 'risk',
    icon: Activity,
    synonyms: ['pneumonia', 'cap', 'community acquired pneumonia', 'severity'],
    formula: 'Confusion + Urea + RR + BP + Age ≥65',
    keywords: ['respiratory', 'infection', 'lung', 'inpatient', 'outpatient']
  },
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc',
    description: 'Stroke risk in atrial fibrillation',
    category: 'risk',
    icon: Heart,
    synonyms: ['afib', 'a-fib', 'stroke', 'anticoagulation', 'chadsvasc'],
    formula: 'CHF + HTN + Age + DM + Stroke + Vasc + Sex',
    keywords: ['cardiac', 'arrhythmia', 'warfarin', 'coumadin', 'eliquis', 'xarelto']
  },
  {
    id: 'gfr',
    name: 'GFR (MDRD)',
    description: 'Glomerular filtration rate estimation',
    category: 'lab',
    icon: Droplet,
    synonyms: ['egfr', 'kidney function', 'renal function', 'creatinine clearance', 'ckd'],
    formula: '186 × (Cr)^-1.154 × (Age)^-0.203 × [factors]',
    keywords: ['nephrology', 'chronic kidney disease', 'dialysis', 'renal']
  },
  {
    id: 'wells_dvt',
    name: "Wells' DVT Criteria",
    description: 'Deep vein thrombosis probability',
    category: 'diagnosis',
    icon: Activity,
    synonyms: ['dvt', 'blood clot', 'leg swelling', 'venous thrombosis'],
    formula: 'Clinical criteria scoring (0-9 points)',
    keywords: ['vascular', 'thrombosis', 'ultrasound', 'd-dimer']
  },
  {
    id: 'wells_pe',
    name: "Wells' PE Criteria",
    description: 'Pulmonary embolism probability',
    category: 'diagnosis',
    icon: Activity,
    synonyms: ['pe', 'pulmonary embolism', 'clot lung', 'sob', 'chest pain'],
    formula: 'Clinical probability: Low/Mod/High',
    keywords: ['respiratory', 'emergency', 'ct angio', 'vq scan']
  },
  {
    id: 'perc',
    name: 'PERC Rule',
    description: 'Pulmonary embolism exclusion',
    category: 'diagnosis',
    icon: AlertCircle,
    synonyms: ['pe rule out', 'pulmonary embolism', 'low risk pe'],
    formula: '8 criteria: Age, HR, O2, hemoptysis, estrogen, surgery, DVT hx, unilateral swelling',
    keywords: ['emergency', 'exclusion', 'safe discharge']
  },
  {
    id: 'anion_gap',
    name: 'Anion Gap',
    description: 'Metabolic acidosis assessment',
    category: 'lab',
    icon: Beaker,
    synonyms: ['ag', 'metabolic acidosis', 'mudpiles', 'dka', 'lactic acidosis'],
    formula: 'Na⁺ - (Cl⁻ + HCO₃⁻) = Normal 8-12',
    keywords: ['electrolytes', 'acid-base', 'abg', 'bmp']
  },
  {
    id: 'pediatric_dosing',
    name: 'Pediatric Dosing',
    description: 'Weight-based medication calculator',
    category: 'dosing',
    icon: Pill,
    synonyms: ['kids', 'children', 'weight based', 'mg/kg', 'peds'],
    formula: 'Dose = mg/kg × weight',
    keywords: ['pediatrics', 'medication', 'antibiotic', 'tylenol', 'motrin']
  },
  {
    id: 'clinical_guidelines',
    name: 'Clinical Guidelines',
    description: 'Practice guidelines and criteria',
    category: 'guidelines',
    icon: BookOpen,
    synonyms: ['protocols', 'criteria', 'recommendations', 'standards'],
    keywords: ['evidence-based', 'treatment', 'management']
  }
];

// Storage key for recently used calculators
const RECENT_CALCULATORS_KEY = 'panceai_recent_calculators';
const PINNED_CALCULATORS_KEY = 'panceai_pinned_calculators';

// Helper to get recently used calculator IDs
const getRecentCalculators = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_CALCULATORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Helper to save recently used calculator
const saveRecentCalculator = (calcId: string) => {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentCalculators().filter(id => id !== calcId);
    recent.unshift(calcId);
    localStorage.setItem(RECENT_CALCULATORS_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {
    // Ignore storage errors
  }
};

// Helper to get pinned calculator IDs
const getPinnedCalculators = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PINNED_CALCULATORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Helper to toggle pinned calculator
const togglePinnedCalculator = (calcId: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const pinned = getPinnedCalculators();
    const newPinned = pinned.includes(calcId)
      ? pinned.filter(id => id !== calcId)
      : [...pinned, calcId];
    localStorage.setItem(PINNED_CALCULATORS_KEY, JSON.stringify(newPinned));
    return newPinned;
  } catch {
    return [];
  }
};

const ToolkitHub: React.FC<ToolkitHubProps> = ({ onNavigateToItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('calculators');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [pinnedCalcs, setPinnedCalcs] = useState<string[]>(() => getPinnedCalculators());
  const [recentCalcs, setRecentCalcs] = useState<string[]>(() => getRecentCalculators());

  // Enhanced search with synonyms, keywords, and formula matching
  const filteredCalculators = useMemo(() => {
    if (!searchQuery) return CALCULATORS;
    const query = searchQuery.toLowerCase();
    return CALCULATORS.filter(calc => {
      // Search in name
      if (calc.name.toLowerCase().includes(query)) return true;
      // Search in description
      if (calc.description.toLowerCase().includes(query)) return true;
      // Search in synonyms
      if (calc.synonyms?.some(s => s.toLowerCase().includes(query))) return true;
      // Search in keywords
      if (calc.keywords?.some(k => k.toLowerCase().includes(query))) return true;
      // Search in formula
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
  const pinnedCalculatorData = useMemo(() => {
    return CALCULATORS.filter(calc => pinnedCalcs.includes(calc.id));
  }, [pinnedCalcs]);

  // Get recently used calculators data (excluding pinned)
  const recentCalculatorData = useMemo(() => {
    return recentCalcs
      .filter(id => !pinnedCalcs.includes(id))
      .map(id => CALCULATORS.find(c => c.id === id))
      .filter((calc): calc is Calculator => calc !== undefined)
      .slice(0, 3);
  }, [recentCalcs, pinnedCalcs]);

  // Handle calculator selection (tracks recent usage)
  const handleSelectCalculator = (calcId: string) => {
    setSelectedCalculator(calcId);
    saveRecentCalculator(calcId);
    setRecentCalcs(getRecentCalculators());
    setShowSearchSuggestions(false);
    setSearchQuery('');
  };

  // Handle pin toggle
  const handleTogglePin = (calcId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = togglePinnedCalculator(calcId);
    setPinnedCalcs(newPinned);
  };

  // Get calculator category color
  const getCategoryColor = (category: Calculator['category']) => {
    switch (category) {
      case 'risk': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'diagnosis': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'dosing': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
      case 'lab': return 'text-teal-600 bg-teal-50 dark:bg-teal-900/20';
      case 'guidelines': return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex">
      {/* Sidebar Navigation - Desktop */}
      <div className="hidden lg:block w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex-shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <div className="p-4 border-b border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4 group w-full"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm">Dashboard</span>
            </button>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Clinical Toolkit</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Reference & Calculators</p>
          </div>

          <nav className="p-2">
            {[
              { id: 'calculators' as TabId, label: 'Calculators', icon: CalculatorIcon },
              { id: 'clinical' as TabId, label: 'Clinical Library', icon: BookOpen },
              { id: 'pharmacopeia' as TabId, label: 'Pharmacopeia', icon: Pill },
              { id: 'physiology' as TabId, label: 'Physiology', icon: Activity },
              { id: 'imaging' as TabId, label: 'Imaging Atlas', icon: FileImage },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedCalculator(null);
                  setSelectedSystem(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-accent)] text-white shadow-md'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
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

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-2xl"
          >
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Clinical Toolkit</h2>
            </div>
            <nav className="p-2">
              {[
                { id: 'calculators' as TabId, label: 'Calculators', icon: CalculatorIcon },
                { id: 'clinical' as TabId, label: 'Clinical Library', icon: BookOpen },
                { id: 'pharmacopeia' as TabId, label: 'Pharmacopeia', icon: Pill },
                { id: 'physiology' as TabId, label: 'Physiology', icon: Activity },
                { id: 'imaging' as TabId, label: 'Imaging Atlas', icon: FileImage },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                    setSelectedCalculator(null);
                    setSelectedSystem(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 ${
                    activeTab === tab.id
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
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
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                {activeTab === 'calculators' && 'Clinical Calculators'}
                {activeTab === 'clinical' && 'Clinical Medicine Library'}
                {activeTab === 'pharmacopeia' && 'Pharmacopeia'}
                {activeTab === 'physiology' && 'Physiology & Lab Values'}
                {activeTab === 'imaging' && 'Imaging Atlas'}
              </h1>
              <p className="text-[var(--color-text-muted)] mb-4">
                {activeTab === 'calculators' && 'Risk scores, diagnostic criteria, and clinical decision tools'}
                {activeTab === 'clinical' && 'Conditions organized by system and subcategory'}
                {activeTab === 'pharmacopeia' && 'Drug reference with mechanisms, indications, and interactions'}
                {activeTab === 'physiology' && 'Normal values, pathophysiology, and anatomy'}
                {activeTab === 'imaging' && 'X-ray, CT, and MRI findings library'}
              </p>
            </motion.div>

            {/* Global Search with Auto-Suggest */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search calculators, conditions, drugs... (try 'afib', 'pneumonia', 'pe')"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(e.target.value.length >= 2);
                }}
                onFocus={() => searchQuery.length >= 2 && setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all font-['Inter']"
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
                {showSearchSuggestions && searchSuggestions.length > 0 && activeTab === 'calculators' && (
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
                          idx !== searchSuggestions.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${getCategoryColor(calc.category)} flex-shrink-0`}>
                          <calc.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--color-text-primary)] truncate">{calc.name}</div>
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
                    onClose={() => setSelectedCalculator(null)}
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Search Results */}
                    {searchQuery && (
                      <div className="text-sm text-[var(--color-text-muted)] mb-4">
                        Found {filteredCalculators.length} calculator{filteredCalculators.length !== 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Pinned Calculators Section */}
                    {!searchQuery && pinnedCalculatorData.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                            Pinned
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {pinnedCalculatorData.map(calc => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={true}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(e) => handleTogglePin(calc.id, e)}
                              getCategoryColor={getCategoryColor}
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
                          {recentCalculatorData.map(calc => (
                            <CalculatorCard
                              key={calc.id}
                              calc={calc}
                              isPinned={pinnedCalcs.includes(calc.id)}
                              onSelect={() => handleSelectCalculator(calc.id)}
                              onTogglePin={(e) => handleTogglePin(calc.id, e)}
                              getCategoryColor={getCategoryColor}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* All Calculators Section */}
                    <section>
                      {!searchQuery && (pinnedCalculatorData.length > 0 || recentCalculatorData.length > 0) && (
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                            All Calculators
                          </h3>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(searchQuery ? filteredCalculators : CALCULATORS).map(calc => (
                          <CalculatorCard
                            key={calc.id}
                            calc={calc}
                            isPinned={pinnedCalcs.includes(calc.id)}
                            onSelect={() => handleSelectCalculator(calc.id)}
                            onTogglePin={(e) => handleTogglePin(calc.id, e)}
                            getCategoryColor={getCategoryColor}
                            showFormula={!!searchQuery}
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </motion.div>
            )}

            {/* CLINICAL LIBRARY TAB */}
            {activeTab === 'clinical' && (
              <motion.div
                key="clinical"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {!selectedSystem ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]).map(system => (
                      <button
                        key={system}
                        onClick={() => setSelectedSystem(system)}
                        className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-md transition-all group"
                      >
                        <div className="font-bold text-[var(--color-accent)] mb-1">{system}</div>
                        <div className="text-sm text-[var(--color-text-muted)] truncate">
                          {ABBREVIATION_TO_TOPIC_MAP[system]}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] mt-2 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {ABBREVIATION_TO_TOPIC_MAP[selectedSystem]}
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)]">Clinical Medicine Reference</p>
                      </div>
                      <button
                        onClick={() => setSelectedSystem(null)}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      >
                        Back to Systems
                      </button>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-6 text-center">
                      <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                      <p className="text-[var(--color-text-muted)]">
                        Content connected to conditionRegistry.ts - displaying conditions for {selectedSystem}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* PHARMACOPEIA TAB */}
            {activeTab === 'pharmacopeia' && (
              <motion.div
                key="pharmacopeia"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {!selectedSystem ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]).map(system => (
                      <button
                        key={system}
                        onClick={() => setSelectedSystem(system)}
                        className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-md transition-all group"
                      >
                        <div className="font-bold text-[var(--color-accent)] mb-1">{system}</div>
                        <div className="text-sm text-[var(--color-text-muted)] truncate">
                          {ABBREVIATION_TO_TOPIC_MAP[system]}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] mt-2 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {ABBREVIATION_TO_TOPIC_MAP[selectedSystem]} Medications
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)]">Drug Reference</p>
                      </div>
                      <button
                        onClick={() => setSelectedSystem(null)}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      >
                        Back to Systems
                      </button>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-6 text-center">
                      <Pill className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                      <p className="text-[var(--color-text-muted)]">
                        Content connected to pharmRegistry.ts - displaying medications for {selectedSystem}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* PHYSIOLOGY TAB */}
            {activeTab === 'physiology' && (
              <motion.div
                key="physiology"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Beaker className="w-8 h-8 text-emerald-600" />
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Lab Normal Values</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-[var(--color-text-muted)]">Sodium</span>
                        <span className="font-mono text-[var(--color-text-primary)]">135-145 mEq/L</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-[var(--color-text-muted)]">Potassium</span>
                        <span className="font-mono text-[var(--color-text-primary)]">3.5-5.0 mEq/L</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-[var(--color-text-muted)]">Creatinine</span>
                        <span className="font-mono text-[var(--color-text-primary)]">0.6-1.2 mg/dL</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-[var(--color-text-muted)]">Hemoglobin</span>
                        <span className="font-mono text-[var(--color-text-primary)]">12-16 (F), 14-18 (M) g/dL</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-[var(--color-text-muted)]">WBC</span>
                        <span className="font-mono text-[var(--color-text-primary)]">4-11 × 10³/μL</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Dna className="w-8 h-8 text-blue-600" />
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Anatomy & Physiology</h3>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Browse anatomical structures and physiological processes organized by system
                    </p>
                  </div>
                </div>
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
                    <FileImage className="w-8 h-8 text-slate-600" />
                    <div>
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Radiology Scroll</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">X-ray, CT, MRI findings library</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateToItem?.('radiology_scroll')}
                    className="w-full p-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>Open Imaging Library</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Calculator Card Component with enhanced hover states and pin functionality
interface CalculatorCardProps {
  calc: Calculator;
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  getCategoryColor: (category: Calculator['category']) => string;
  showFormula?: boolean;
}

const CalculatorCard: React.FC<CalculatorCardProps> = ({
  calc,
  isPinned,
  onSelect,
  onTogglePin,
  getCategoryColor,
  showFormula = false,
}) => {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`group text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl border transition-all duration-200 relative overflow-hidden ${
        isPinned 
          ? 'border-amber-400/50 ring-1 ring-amber-400/20' 
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
      } hover:shadow-lg hover:shadow-[var(--color-accent)]/5`}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/0 to-[var(--color-accent)]/0 group-hover:from-[var(--color-accent)]/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${getCategoryColor(calc.category)} transition-transform group-hover:scale-110 duration-200`}>
            <calc.icon className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1">
            {/* Pin button */}
            <button
              onClick={onTogglePin}
              className={`p-1.5 rounded-lg transition-all ${
                isPinned 
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                  : 'text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 opacity-0 group-hover:opacity-100'
              }`}
              title={isPinned ? 'Unpin calculator' : 'Pin calculator'}
            >
              {isPinned ? (
                <Star className="w-4 h-4 fill-amber-500" />
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
        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
          {calc.description}
        </p>
        
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
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Pinned
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
};

// Pediatric Dosing Calculator
const PediatricDosingCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [weight, setWeight] = useState('');
  const [medication, setMedication] = useState('amoxicillin');
  
  const medications = {
    amoxicillin: { name: 'Amoxicillin', dose: 40, unit: 'mg/kg/day', divided: 'TID', max: 3000 },
    ibuprofen: { name: 'Ibuprofen', dose: 10, unit: 'mg/kg/dose', divided: 'Q6-8H', max: 800 },
    acetaminophen: { name: 'Acetaminophen', dose: 15, unit: 'mg/kg/dose', divided: 'Q4-6H', max: 1000 },
    azithromycin: { name: 'Azithromycin', dose: 10, unit: 'mg/kg/day', divided: 'Day 1, then 5mg/kg days 2-5', max: 500 }
  };

  const calculateDose = (): { perDose: number; perDay: number; maxNote: string } | null => {
    const wt = parseFloat(weight);
    if (!wt || wt <= 0) return null;

    const med = medications[medication as keyof typeof medications];
    const perDay = Math.round(wt * med.dose * 10) / 10;
    const perDose = medication === 'amoxicillin' ? Math.round(perDay / 3 * 10) / 10 : perDay;
    
    const maxNote = perDose > med.max ? ` (exceeds adult max of ${med.max}mg)` : '';
    
    return { perDose, perDay, maxNote };
  };

  const result = calculateDose();
  const med = medications[medication as keyof typeof medications];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Pediatric Dosing</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Weight-Based Medication Calculator</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Medication</label>
          <select
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            {Object.entries(medications).map(([key, med]) => (
              <option key={key} value={key}>{med.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Enter weight"
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg p-3">
          <div className="text-sm">
            <strong>Standard Dose:</strong> {med.dose} {med.unit}
          </div>
          <div className="text-sm">
            <strong>Frequency:</strong> {med.divided}
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border-2 border-[var(--color-accent)]">
          <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {result.perDose} mg per dose{result.maxNote}
          </div>
          {medication === 'amoxicillin' && (
            <div className="text-lg text-[var(--color-text-muted)]">
              Total daily dose: {result.perDay} mg
            </div>
          )}
          <div className="text-sm text-[var(--color-text-muted)] mt-2">
            Frequency: {med.divided}
          </div>
        </div>
      )}
    </div>
  );
};

// Clinical Guidelines Browser
const ClinicalGuidelinesBrowser: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const guidelines = [
    { category: 'Hypertension', title: 'JNC 8 Guidelines', org: 'ACC/AHA' },
    { category: 'Diabetes', title: 'ADA Standards of Care', org: 'ADA' },
    { category: 'COPD', title: 'GOLD Guidelines', org: 'GOLD' },
    { category: 'Asthma', title: 'GINA Guidelines', org: 'GINA' },
    { category: 'Heart Failure', title: 'ACC/AHA HF Guidelines', org: 'ACC/AHA' },
    { category: 'Stroke', title: 'Stroke Prevention Guidelines', org: 'ASA/AHA' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Clinical Guidelines</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Evidence-Based Practice Guidelines</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="grid gap-3">
        {guidelines.map((guideline, idx) => (
          <div key={idx} className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-[var(--color-accent)] mb-1">{guideline.category}</div>
                <div className="font-semibold text-[var(--color-text-primary)]">{guideline.title}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{guideline.org}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Reusable Result Card Component
const ResultCard: React.FC<{ result: CalculatorResult }> = ({ result }) => (
  <div className={`rounded-lg p-6 border-2 ${
    result.riskLevel === 'low' 
      ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
      : result.riskLevel === 'moderate'
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
      : 'bg-red-50 dark:bg-red-900/20 border-red-500'
  }`}>
    <div className="flex items-start gap-4">
      {result.riskLevel === 'low' ? (
        <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : result.riskLevel === 'moderate' ? (
        <Info className="w-8 h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-bold text-[var(--color-text-primary)]">
            Score: {result.score}
          </span>
          <span className={`font-semibold ${
            result.riskLevel === 'low' 
              ? 'text-green-700 dark:text-green-400'
              : result.riskLevel === 'moderate'
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-red-700 dark:text-red-400'
          }`}>
            {result.interpretation}
          </span>
        </div>
        <p className="text-[var(--color-text-primary)] font-medium mb-2">
          Clinical Recommendation:
        </p>
        <p className="text-[var(--color-text-muted)]">
          {result.recommendation}
        </p>
      </div>
    </div>
  </div>
);

export default ToolkitHub;
