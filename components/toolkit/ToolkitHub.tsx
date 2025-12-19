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
import { ABBREVIATION_TO_TOPIC_MAP } from '@/constants';

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

interface CalculatorResult {
  score: number | string;
  interpretation: string;
  recommendation: string;
  riskLevel: 'low' | 'moderate' | 'high';
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
                  <CalculatorView
                    calculatorId={selectedCalculator}
                    onBack={() => setSelectedCalculator(null)}
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

// Calculator View Component (reusing existing CURB-65 and CHA2DS2-VASc implementations)
interface CalculatorViewProps {
  calculatorId: string;
  onBack: () => void;
}

const CalculatorView: React.FC<CalculatorViewProps> = ({ calculatorId, onBack }) => {
  const calculator = CALCULATORS.find(c => c.id === calculatorId);
  
  if (!calculator) return null;

  // Render specific calculator based on ID
  switch (calculatorId) {
    case 'curb65':
      return <CURB65Calculator onBack={onBack} />;
    case 'chads2vasc':
      return <CHADS2VAScCalculator onBack={onBack} />;
    case 'wells_dvt':
      return <WellsDVTCalculator onBack={onBack} />;
    case 'wells_pe':
      return <WellsPECalculator onBack={onBack} />;
    case 'perc':
      return <PERCCalculator onBack={onBack} />;
    case 'gfr':
      return <GFRCalculator onBack={onBack} />;
    case 'anion_gap':
      return <AnionGapCalculator onBack={onBack} />;
    case 'pediatric_dosing':
      return <PediatricDosingCalculator onBack={onBack} />;
    case 'clinical_guidelines':
      return <ClinicalGuidelinesBrowser onBack={onBack} />;
    default:
      return (
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
          <button onClick={onBack} className="text-[var(--color-accent)] mb-4 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{calculator.name}</h3>
          <p className="text-[var(--color-text-muted)]">Calculator implementation coming soon...</p>
        </div>
      );
  }
};

// CURB-65 Calculator (keeping existing implementation)
const CURB65Calculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [confusion, setConfusion] = useState(false);
  const [urea, setUrea] = useState(false);
  const [respiratory, setRespiratory] = useState(false);
  const [bloodPressure, setBloodPressure] = useState(false);
  const [age, setAge] = useState(false);

  const score = [confusion, urea, respiratory, bloodPressure, age].filter(Boolean).length;

  const getInterpretation = (): CalculatorResult => {
    if (score <= 1) {
      return {
        score,
        interpretation: 'Low Risk',
        recommendation: 'Consider outpatient management. Ensure close follow-up.',
        riskLevel: 'low'
      };
    } else if (score === 2) {
      return {
        score,
        interpretation: 'Moderate Risk',
        recommendation: 'Consider short hospital admission or closely supervised outpatient care.',
        riskLevel: 'moderate'
      };
    } else {
      return {
        score,
        interpretation: 'High Risk (Severe Pneumonia)',
        recommendation: 'Hospital admission recommended. Consider ICU evaluation if score ≥4.',
        riskLevel: 'high'
      };
    }
  };

  const result = getInterpretation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">CURB-65 Score</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Pneumonia Severity Assessment</p>
        </div>
        <button
          onClick={onBack}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-4">
        <div className="space-y-3">
          {[
            { state: confusion, setState: setConfusion, title: 'Confusion', desc: 'New onset disorientation' },
            { state: urea, setState: setUrea, title: 'Urea', desc: 'BUN > 19 mg/dL (>7 mmol/L)' },
            { state: respiratory, setState: setRespiratory, title: 'Respiratory Rate', desc: '≥ 30 breaths/min' },
            { state: bloodPressure, setState: setBloodPressure, title: 'Blood Pressure', desc: 'SBP < 90 mmHg or DBP ≤ 60 mmHg' },
            { state: age, setState: setAge, title: 'Age', desc: '≥ 65 years' }
          ].map((item, idx) => (
            <label key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-primary)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={item.state}
                onChange={(e) => item.setState(e.target.checked)}
                className="w-5 h-5 text-[var(--color-accent)] rounded focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">{item.title}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Result */}
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
    </div>
  );
};

// CHA2DS2-VASc Calculator (keeping existing implementation)
const CHADS2VAScCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [chf, setChf] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [age75, setAge75] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [vascular, setVascular] = useState(false);
  const [age65, setAge65] = useState(false);
  const [female, setFemale] = useState(false);

  const score = 
    (chf ? 1 : 0) +
    (hypertension ? 1 : 0) +
    (age75 ? 2 : 0) +
    (diabetes ? 1 : 0) +
    (stroke ? 2 : 0) +
    (vascular ? 1 : 0) +
    (age65 && !age75 ? 1 : 0) +
    (female ? 1 : 0);

  const getInterpretation = (): CalculatorResult => {
    if (score === 0) {
      return {
        score,
        interpretation: 'Low Risk',
        recommendation: 'No anticoagulation recommended. Consider aspirin or no therapy.',
        riskLevel: 'low'
      };
    } else if (score === 1) {
      return {
        score,
        interpretation: 'Low-Moderate Risk',
        recommendation: 'Consider anticoagulation (preferred) or aspirin. Shared decision-making.',
        riskLevel: 'moderate'
      };
    } else {
      return {
        score,
        interpretation: 'Moderate-High Risk',
        recommendation: 'Oral anticoagulation recommended (warfarin, DOAC). Annual stroke risk ≥2.2%.',
        riskLevel: 'high'
      };
    }
  };

  const result = getInterpretation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">CHA₂DS₂-VASc Score</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Stroke Risk in Atrial Fibrillation</p>
        </div>
        <button
          onClick={onBack}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-4">
        <div className="space-y-3">
          {[
            { state: chf, setState: setChf, title: 'CHF/LV Dysfunction (+1)', desc: 'Congestive heart failure or LVEF <40%' },
            { state: hypertension, setState: setHypertension, title: 'Hypertension (+1)', desc: 'History or treated hypertension' },
            { state: age75, setState: setAge75, title: 'Age ≥75 (+2)', desc: 'Age 75 years or older' },
            { state: diabetes, setState: setDiabetes, title: 'Diabetes (+1)', desc: 'Diabetes mellitus' },
            { state: stroke, setState: setStroke, title: 'Stroke/TIA/Thromboembolism (+2)', desc: 'Prior stroke, TIA, or systemic embolism' },
            { state: vascular, setState: setVascular, title: 'Vascular Disease (+1)', desc: 'Prior MI, PAD, or aortic plaque' },
            { state: age65, setState: setAge65, title: 'Age 65-74 (+1)', desc: 'Age between 65-74 years', disabled: age75 },
            { state: female, setState: setFemale, title: 'Female Sex (+1)', desc: 'Female gender' }
          ].map((item, idx) => (
            <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-primary)] cursor-pointer transition-colors ${item.disabled ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={item.state}
                onChange={(e) => item.setState(e.target.checked)}
                disabled={item.disabled}
                className="w-5 h-5 text-[var(--color-accent)] rounded disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">{item.title}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Result */}
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
    </div>
  );
};

// Wells' DVT Calculator
const WellsDVTCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeCA, setActiveCA] = useState(false);
  const [paralysis, setParalysis] = useState(false);
  const [bedridden, setBedridden] = useState(false);
  const [tenderness, setTenderness] = useState(false);
  const [entireLegSwollen, setEntireLegSwollen] = useState(false);
  const [calfSwelling, setCalfSwelling] = useState(false);
  const [pittingEdema, setPittingEdema] = useState(false);
  const [collateralVeins, setCollateralVeins] = useState(false);
  const [previousDVT, setPreviousDVT] = useState(false);
  const [alternativeDiagnosis, setAlternativeDiagnosis] = useState(false);

  const score = 
    (activeCA ? 1 : 0) +
    (paralysis ? 1 : 0) +
    (bedridden ? 1 : 0) +
    (tenderness ? 1 : 0) +
    (entireLegSwollen ? 1 : 0) +
    (calfSwelling ? 1 : 0) +
    (pittingEdema ? 1 : 0) +
    (collateralVeins ? 1 : 0) +
    (previousDVT ? 1 : 0) +
    (alternativeDiagnosis ? -2 : 0);

  const getInterpretation = (): CalculatorResult => {
    if (score <= 0) {
      return {
        score,
        interpretation: 'Low Probability (≤5%)',
        recommendation: 'D-dimer recommended. If negative, DVT excluded. If positive, obtain ultrasound.',
        riskLevel: 'low'
      };
    } else if (score <= 2) {
      return {
        score,
        interpretation: 'Moderate Probability (~17%)',
        recommendation: 'D-dimer or ultrasound. Consider clinical judgment and risk factors.',
        riskLevel: 'moderate'
      };
    } else {
      return {
        score,
        interpretation: 'High Probability (~53%)',
        recommendation: 'Ultrasound recommended. Consider empiric anticoagulation pending results.',
        riskLevel: 'high'
      };
    }
  };

  const result = getInterpretation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Wells' DVT Criteria</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Deep Vein Thrombosis Probability</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-3">
        {[
          { state: activeCA, setState: setActiveCA, points: 1, title: 'Active cancer', desc: 'Treatment within 6 months or palliative' },
          { state: paralysis, setState: setParalysis, points: 1, title: 'Paralysis/paresis', desc: 'Recent immobilization of lower extremity' },
          { state: bedridden, setState: setBedridden, points: 1, title: 'Bedridden >3 days', desc: 'Or major surgery within 12 weeks' },
          { state: tenderness, setState: setTenderness, points: 1, title: 'Localized tenderness', desc: 'Along deep venous system' },
          { state: entireLegSwollen, setState: setEntireLegSwollen, points: 1, title: 'Entire leg swollen', desc: 'Unilateral swelling' },
          { state: calfSwelling, setState: setCalfSwelling, points: 1, title: 'Calf swelling >3cm', desc: 'Compared to asymptomatic leg' },
          { state: pittingEdema, setState: setPittingEdema, points: 1, title: 'Pitting edema', desc: 'Greater in symptomatic leg' },
          { state: collateralVeins, setState: setCollateralVeins, points: 1, title: 'Collateral superficial veins', desc: 'Non-varicose' },
          { state: previousDVT, setState: setPreviousDVT, points: 1, title: 'Previous DVT', desc: 'Documented previously' },
          { state: alternativeDiagnosis, setState: setAlternativeDiagnosis, points: -2, title: 'Alternative diagnosis (-2)', desc: 'At least as likely as DVT', highlight: true }
        ].map((item, idx) => (
          <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-primary)] cursor-pointer transition-colors ${item.highlight ? 'border-2 border-orange-500 dark:border-orange-400' : ''}`}>
            <input
              type="checkbox"
              checked={item.state}
              onChange={(e) => item.setState(e.target.checked)}
              className="w-5 h-5 text-[var(--color-accent)] rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text-primary)]">{item.title}</div>
              <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
            </div>
            <span className={`text-sm font-bold ${item.points < 0 ? 'text-orange-600' : 'text-[var(--color-text-muted)]'}`}>
              {item.points > 0 ? '+' : ''}{item.points}
            </span>
          </label>
        ))}
      </div>

      <ResultCard result={result} />
    </div>
  );
};

// Wells' PE Calculator
const WellsPECalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [clinicalDVT, setClinicalDVT] = useState(false);
  const [alternativeDiagnosis, setAlternativeDiagnosis] = useState(false);
  const [tachycardia, setTachycardia] = useState(false);
  const [immobilization, setImmobilization] = useState(false);
  const [previousPE, setPreviousPE] = useState(false);
  const [hemoptysis, setHemoptysis] = useState(false);
  const [malignancy, setMalignancy] = useState(false);

  const score =
    (clinicalDVT ? 3 : 0) +
    (alternativeDiagnosis ? 0 : 3) +
    (tachycardia ? 1.5 : 0) +
    (immobilization ? 1.5 : 0) +
    (previousPE ? 1.5 : 0) +
    (hemoptysis ? 1 : 0) +
    (malignancy ? 1 : 0);

  const getInterpretation = (): CalculatorResult => {
    if (score < 2) {
      return {
        score: score.toFixed(1),
        interpretation: 'Low Probability (1.3%)',
        recommendation: 'D-dimer recommended. If negative, PE excluded. If positive, obtain CTPA.',
        riskLevel: 'low'
      };
    } else if (score <= 6) {
      return {
        score: score.toFixed(1),
        interpretation: 'Moderate Probability (16%)',
        recommendation: 'D-dimer or CTPA. Consider clinical judgment and oxygen saturation.',
        riskLevel: 'moderate'
      };
    } else {
      return {
        score: score.toFixed(1),
        interpretation: 'High Probability (41%)',
        recommendation: 'CTPA recommended. Consider empiric anticoagulation if delay expected.',
        riskLevel: 'high'
      };
    }
  };

  const result = getInterpretation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Wells' PE Criteria</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Pulmonary Embolism Probability</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-3">
        {[
          { state: clinicalDVT, setState: setClinicalDVT, points: 3, title: 'Clinical signs/symptoms of DVT', desc: 'Leg swelling, tenderness along deep veins' },
          { state: alternativeDiagnosis, setState: setAlternativeDiagnosis, points: 3, title: 'PE most likely diagnosis', desc: 'No alternative diagnosis more likely', inverted: true },
          { state: tachycardia, setState: setTachycardia, points: 1.5, title: 'Heart rate >100', desc: 'Tachycardia' },
          { state: immobilization, setState: setImmobilization, points: 1.5, title: 'Immobilization/surgery', desc: '≥3 days bedridden or surgery in past 4 weeks' },
          { state: previousPE, setState: setPreviousPE, points: 1.5, title: 'Previous PE/DVT', desc: 'History of prior thromboembolic disease' },
          { state: hemoptysis, setState: setHemoptysis, points: 1, title: 'Hemoptysis', desc: 'Coughing up blood' },
          { state: malignancy, setState: setMalignancy, points: 1, title: 'Malignancy', desc: 'Active cancer (treatment within 6 months or palliative)' }
        ].map((item, idx) => (
          <label key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-primary)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={item.inverted ? !item.state : item.state}
              onChange={(e) => item.setState(item.inverted ? !e.target.checked : e.target.checked)}
              className="w-5 h-5 text-[var(--color-accent)] rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text-primary)]">{item.title}</div>
              <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
            </div>
            <span className="text-sm font-bold text-[var(--color-text-muted)]">+{item.points}</span>
          </label>
        ))}
      </div>

      <ResultCard result={result} />
    </div>
  );
};

// PERC Rule Calculator
const PERCCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [age50, setAge50] = useState(false);
  const [heartRate100, setHeartRate100] = useState(false);
  const [o2sat95, setO2sat95] = useState(false);
  const [unilateralLegSwelling, setUnilateralLegSwelling] = useState(false);
  const [hemoptysis, setHemoptysis] = useState(false);
  const [recentSurgery, setRecentSurgery] = useState(false);
  const [priorPE, setPriorPE] = useState(false);
  const [hormoneUse, setHormoneUse] = useState(false);

  const criteria = [age50, heartRate100, o2sat95, unilateralLegSwelling, hemoptysis, recentSurgery, priorPE, hormoneUse];
  const positiveCount = criteria.filter(Boolean).length;
  const percNegative = positiveCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">PERC Rule</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Pulmonary Embolism Rule-out Criteria</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
        <p className="text-sm text-[var(--color-text-primary)]">
          <strong>Use only in low-risk patients.</strong> If ALL criteria are absent (PERC negative), PE can be ruled out without further testing.
        </p>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-3">
        {[
          { state: age50, setState: setAge50, title: 'Age ≥50', desc: 'Patient 50 years or older' },
          { state: heartRate100, setState: setHeartRate100, title: 'Heart rate ≥100', desc: 'Tachycardia present' },
          { state: o2sat95, setState: setO2sat95, title: 'O₂ saturation <95%', desc: 'On room air' },
          { state: unilateralLegSwelling, setState: setUnilateralLegSwelling, title: 'Unilateral leg swelling', desc: 'Clinical signs of DVT' },
          { state: hemoptysis, setState: setHemoptysis, title: 'Hemoptysis', desc: 'Coughing up blood' },
          { state: recentSurgery, setState: setRecentSurgery, title: 'Recent surgery/trauma', desc: 'Within 4 weeks requiring general anesthesia' },
          { state: priorPE, setState: setPriorPE, title: 'Prior PE or DVT', desc: 'History of venous thromboembolism' },
          { state: hormoneUse, setState: setHormoneUse, title: 'Hormone use', desc: 'Oral contraceptives, hormone replacement, or estrogenic hormones' }
        ].map((item, idx) => (
          <label key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-primary)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={item.state}
              onChange={(e) => item.setState(e.target.checked)}
              className="w-5 h-5 text-[var(--color-accent)] rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--color-text-primary)]">{item.title}</div>
              <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className={`rounded-lg p-6 border-2 ${
        percNegative
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : 'bg-red-50 dark:bg-red-900/20 border-red-500'
      }`}>
        <div className="flex items-start gap-4">
          {percNegative ? (
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              {percNegative ? 'PERC Negative' : 'PERC Positive'}
            </div>
            <p className="text-[var(--color-text-primary)] font-medium mb-2">Interpretation:</p>
            <p className="text-[var(--color-text-muted)]">
              {percNegative
                ? 'All criteria absent. In low-risk patients, PE can be ruled out without D-dimer or imaging. No further workup needed.'
                : `${positiveCount} criteria present. Cannot rule out PE with PERC. Proceed with D-dimer or imaging based on clinical probability.`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// GFR Calculator
const GFRCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [race, setRace] = useState<'black' | 'other'>('other');
  const [creatinine, setCreatinine] = useState('');

  const calculateGFR = (): number | null => {
    const ageNum = parseFloat(age);
    const crNum = parseFloat(creatinine);
    
    if (!ageNum || !crNum || ageNum <= 0 || crNum <= 0) return null;

    // MDRD equation
    let gfr = 175 * Math.pow(crNum, -1.154) * Math.pow(ageNum, -0.203);
    
    if (sex === 'female') gfr *= 0.742;
    if (race === 'black') gfr *= 1.212;
    
    return Math.round(gfr);
  };

  const gfr = calculateGFR();

  const getStage = (gfr: number): { stage: string; description: string; color: string } => {
    if (gfr >= 90) return { stage: 'Stage 1', description: 'Normal or high (with kidney damage)', color: 'green' };
    if (gfr >= 60) return { stage: 'Stage 2', description: 'Mild reduction (with kidney damage)', color: 'green' };
    if (gfr >= 45) return { stage: 'Stage 3a', description: 'Mild to moderate reduction', color: 'yellow' };
    if (gfr >= 30) return { stage: 'Stage 3b', description: 'Moderate to severe reduction', color: 'yellow' };
    if (gfr >= 15) return { stage: 'Stage 4', description: 'Severe reduction', color: 'orange' };
    return { stage: 'Stage 5', description: 'Kidney failure', color: 'red' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">GFR Calculator (MDRD)</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Glomerular Filtration Rate Estimation</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Age (years)</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Enter age"
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Sex</label>
          <div className="flex gap-4">
            {['male', 'female'].map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sex === s}
                  onChange={() => setSex(s as 'male' | 'female')}
                  className="w-4 h-4 text-[var(--color-accent)]"
                />
                <span className="capitalize text-[var(--color-text-primary)]">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Race</label>
          <div className="flex gap-4">
            {[{ value: 'black', label: 'Black' }, { value: 'other', label: 'Other' }].map((r) => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={race === r.value}
                  onChange={() => setRace(r.value as 'black' | 'other')}
                  className="w-4 h-4 text-[var(--color-accent)]"
                />
                <span className="text-[var(--color-text-primary)]">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Serum Creatinine (mg/dL)</label>
          <input
            type="number"
            step="0.1"
            value={creatinine}
            onChange={(e) => setCreatinine(e.target.value)}
            placeholder="Enter creatinine"
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          />
        </div>
      </div>

      {gfr !== null && (
        <div className={`rounded-lg p-6 border-2 ${
          getStage(gfr).color === 'green' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
          getStage(gfr).color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
          getStage(gfr).color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
          'bg-red-50 dark:bg-red-900/20 border-red-500'
        }`}>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            eGFR: {gfr} mL/min/1.73m²
          </div>
          <div className="font-semibold text-lg text-[var(--color-text-primary)] mb-1">
            {getStage(gfr).stage}
          </div>
          <p className="text-[var(--color-text-muted)]">
            {getStage(gfr).description}
          </p>
        </div>
      )}
    </div>
  );
};

// Anion Gap Calculator
const AnionGapCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [sodium, setSodium] = useState('');
  const [chloride, setChloride] = useState('');
  const [bicarb, setBicarb] = useState('');
  const [albumin, setAlbumin] = useState('');
  const [showMudpiles, setShowMudpiles] = useState(false);

  const calculateAnionGap = (): number | null => {
    const na = parseFloat(sodium);
    const cl = parseFloat(chloride);
    const hco3 = parseFloat(bicarb);
    
    if (!na || !cl || !hco3) return null;
    return Math.round(na - cl - hco3);
  };

  const calculateCorrectedAG = (ag: number): number | null => {
    const alb = parseFloat(albumin);
    if (!alb) return null;
    return Math.round(ag + 2.5 * (4 - alb));
  };

  const ag = calculateAnionGap();
  const correctedAG = ag !== null ? calculateCorrectedAG(ag) : null;
  const displayAG = correctedAG ?? ag;

  const getInterpretation = (gap: number | null): { text: string; level: 'normal' | 'low' | 'elevated' | 'high' } => {
    if (gap === null) return { text: 'Enter values to calculate', level: 'normal' };
    if (gap < 3) return { text: 'Low anion gap', level: 'low' };
    if (gap <= 12) return { text: 'Normal anion gap', level: 'normal' };
    if (gap <= 20) return { text: 'Elevated anion gap', level: 'elevated' };
    return { text: 'Significantly elevated', level: 'high' };
  };

  const interpretation = getInterpretation(displayAG);

  // MUDPILES mnemonic data
  const mudpiles = [
    { letter: 'M', cause: 'Methanol', details: 'Osmolar gap, visual changes' },
    { letter: 'U', cause: 'Uremia', details: 'Elevated BUN/Cr, ESRD' },
    { letter: 'D', cause: 'DKA', details: 'Hyperglycemia, ketones, osmolar gap' },
    { letter: 'P', cause: 'Propylene glycol', details: 'IV medications (lorazepam, phenobarbital)' },
    { letter: 'I', cause: 'Iron / INH', details: 'Iron overdose, isoniazid toxicity' },
    { letter: 'L', cause: 'Lactic acidosis', details: 'Shock, sepsis, metformin, seizures' },
    { letter: 'E', cause: 'Ethylene glycol', details: 'Osmolar gap, calcium oxalate crystals' },
    { letter: 'S', cause: 'Salicylates', details: 'Mixed respiratory alkalosis + metabolic acidosis' },
  ];

  const inputFields = [
    { label: 'Sodium', sublabel: 'Na⁺', value: sodium, setValue: setSodium, range: '135-145', unit: 'mEq/L', color: 'blue' },
    { label: 'Chloride', sublabel: 'Cl⁻', value: chloride, setValue: setChloride, range: '95-105', unit: 'mEq/L', color: 'green' },
    { label: 'Bicarbonate', sublabel: 'HCO₃⁻', value: bicarb, setValue: setBicarb, range: '22-28', unit: 'mEq/L', color: 'purple' },
    { label: 'Albumin', sublabel: 'Optional', value: albumin, setValue: setAlbumin, range: '3.5-5.0', unit: 'g/dL', color: 'amber' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Anion Gap Calculator</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Metabolic Acidosis Assessment</p>
        </div>
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* Formula Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <Beaker className="w-6 h-6 text-blue-600" />
          <div>
            <div className="font-mono text-lg font-semibold text-blue-800 dark:text-blue-300">
              AG = Na⁺ − (Cl⁻ + HCO₃⁻)
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Normal range: 8-12 mEq/L
            </div>
          </div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-2 gap-4">
        {inputFields.map((field, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-[var(--color-text-primary)]">{field.label}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{field.sublabel}</div>
              </div>
              <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                {field.range}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={field.value}
                onChange={(e) => field.setValue(e.target.value)}
                placeholder="—"
                className="w-full px-4 py-3 text-xl font-semibold rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 text-center"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">
                {field.unit}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Result Display */}
      <AnimatePresence>
        {ag !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-xl p-6 border-2 ${
              interpretation.level === 'normal' 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                : interpretation.level === 'low'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                : interpretation.level === 'elevated'
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Calculated Anion Gap
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[var(--color-text-primary)]">
                    {ag}
                  </span>
                  <span className="text-lg text-[var(--color-text-muted)]">mEq/L</span>
                </div>
                
                {correctedAG !== null && (
                  <div className="mt-2 pt-2 border-t border-current/10">
                    <div className="text-sm text-[var(--color-text-muted)]">Albumin-Corrected</div>
                    <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                      {correctedAG} mEq/L
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`p-3 rounded-xl ${
                interpretation.level === 'normal' ? 'bg-emerald-100 dark:bg-emerald-800/30' :
                interpretation.level === 'low' ? 'bg-blue-100 dark:bg-blue-800/30' :
                interpretation.level === 'elevated' ? 'bg-amber-100 dark:bg-amber-800/30' :
                'bg-red-100 dark:bg-red-800/30'
              }`}>
                {interpretation.level === 'normal' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                ) : interpretation.level === 'low' ? (
                  <Info className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="font-medium text-[var(--color-text-primary)]">
                {interpretation.text}
              </p>
              {interpretation.level === 'low' && (
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Consider: Hypoalbuminemia, multiple myeloma, lithium toxicity, lab error
                </p>
              )}
              {(interpretation.level === 'elevated' || interpretation.level === 'high') && (
                <button
                  onClick={() => setShowMudpiles(!showMudpiles)}
                  className="mt-2 text-sm font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1"
                >
                  {showMudpiles ? 'Hide' : 'View'} MUDPILES Differential
                  <ChevronRight className={`w-4 h-4 transition-transform ${showMudpiles ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MUDPILES Mnemonic */}
      <AnimatePresence>
        {showMudpiles && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-[var(--color-border)]">
                <h3 className="font-bold text-[var(--color-text-primary)]">MUDPILES Mnemonic</h3>
                <p className="text-sm text-[var(--color-text-muted)]">Common causes of elevated anion gap metabolic acidosis</p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {mudpiles.map((item, idx) => (
                  <motion.div
                    key={item.letter}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-4 p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-amber-700 dark:text-amber-400">{item.letter}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{item.cause}</div>
                      <div className="text-sm text-[var(--color-text-muted)]">{item.details}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Reference */}
      {ag === null && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Quick Reference
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg">
              <span className="text-[var(--color-text-muted)]">Normal AG</span>
              <span className="font-mono font-semibold text-emerald-600">8-12 mEq/L</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg">
              <span className="text-[var(--color-text-muted)]">Low AG</span>
              <span className="font-mono font-semibold text-blue-600">&lt;3 mEq/L</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg">
              <span className="text-[var(--color-text-muted)]">Elevated AG</span>
              <span className="font-mono font-semibold text-amber-600">12-20 mEq/L</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg">
              <span className="text-[var(--color-text-muted)]">High AG</span>
              <span className="font-mono font-semibold text-red-600">&gt;20 mEq/L</span>
            </div>
          </div>
        </div>
      )}
    </div>
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
