import React, { useState, useMemo } from 'react';
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
  FlaskConical
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
}

interface CalculatorResult {
  score: number | string;
  interpretation: string;
  recommendation: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

// Clinical calculators registry
const CALCULATORS: Calculator[] = [
  {
    id: 'curb65',
    name: 'CURB-65',
    description: 'Pneumonia severity assessment',
    category: 'risk',
    icon: Activity
  },
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc',
    description: 'Stroke risk in atrial fibrillation',
    category: 'risk',
    icon: Heart
  },
  {
    id: 'gfr',
    name: 'GFR (MDRD)',
    description: 'Glomerular filtration rate estimation',
    category: 'lab',
    icon: Droplet
  },
  {
    id: 'wells_dvt',
    name: "Wells' DVT Criteria",
    description: 'Deep vein thrombosis probability',
    category: 'diagnosis',
    icon: Activity
  },
  {
    id: 'wells_pe',
    name: "Wells' PE Criteria",
    description: 'Pulmonary embolism probability',
    category: 'diagnosis',
    icon: Activity
  },
  {
    id: 'perc',
    name: 'PERC Rule',
    description: 'Pulmonary embolism exclusion',
    category: 'diagnosis',
    icon: AlertCircle
  },
  {
    id: 'anion_gap',
    name: 'Anion Gap',
    description: 'Metabolic acidosis assessment',
    category: 'lab',
    icon: Beaker
  },
  {
    id: 'pediatric_dosing',
    name: 'Pediatric Dosing',
    description: 'Weight-based medication calculator',
    category: 'dosing',
    icon: Pill
  },
  {
    id: 'clinical_guidelines',
    name: 'Clinical Guidelines',
    description: 'Practice guidelines and criteria',
    category: 'guidelines',
    icon: BookOpen
  }
];

const ToolkitHub: React.FC<ToolkitHubProps> = ({ onNavigateToItem, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('calculators');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter calculators by search
  const filteredCalculators = useMemo(() => {
    if (!searchQuery) return CALCULATORS;
    const query = searchQuery.toLowerCase();
    return CALCULATORS.filter(calc => 
      calc.name.toLowerCase().includes(query) ||
      calc.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

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

            {/* Global Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search calculators, conditions, drugs, lab values..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all font-['Inter']"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Clear
                </button>
              )}
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
                  <>
                    {searchQuery && (
                      <div className="text-sm text-[var(--color-text-muted)] mb-4">
                        Found {filteredCalculators.length} calculator{filteredCalculators.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCalculators.map(calc => (
                        <button
                          key={calc.id}
                          onClick={() => setSelectedCalculator(calc.id)}
                          className="group text-left p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className={`p-2 rounded-lg ${getCategoryColor(calc.category)}`}>
                              <calc.icon className="w-5 h-5" />
                            </div>
                            <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all" />
                          </div>
                          <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                            {calc.name}
                          </h3>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {calc.description}
                          </p>
                          <div className="mt-2 text-xs font-medium text-[var(--color-text-muted)] capitalize">
                            {calc.category}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
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

  const getInterpretation = (gap: number): string => {
    if (gap < 3) return 'Low anion gap - consider hypoalbuminemia, multiple myeloma, lithium toxicity';
    if (gap <= 12) return 'Normal anion gap (8-12 mEq/L)';
    if (gap <= 20) return 'Elevated anion gap - mild metabolic acidosis';
    return 'Significantly elevated anion gap - consider MUDPILES (Methanol, Uremia, DKA, Propylene glycol, Iron/INH, Lactic acidosis, Ethylene glycol, Salicylates)';
  };

  return (
    <div className="space-y-6">
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

      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 border border-[var(--color-border)] space-y-4">
        <div className="text-sm text-[var(--color-text-muted)] mb-4">
          Formula: AG = Na⁺ - (Cl⁻ + HCO₃⁻)
        </div>

        {[
          { label: 'Sodium (mEq/L)', value: sodium, setValue: setSodium, range: 'Normal: 135-145' },
          { label: 'Chloride (mEq/L)', value: chloride, setValue: setChloride, range: 'Normal: 95-105' },
          { label: 'Bicarbonate (mEq/L)', value: bicarb, setValue: setBicarb, range: 'Normal: 22-28' },
          { label: 'Albumin (g/dL) - Optional', value: albumin, setValue: setAlbumin, range: 'Normal: 3.5-5.0' }
        ].map((field, idx) => (
          <div key={idx}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{field.label}</label>
            <input
              type="number"
              step="0.1"
              value={field.value}
              onChange={(e) => field.setValue(e.target.value)}
              placeholder="Enter value"
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
            />
            <div className="text-xs text-[var(--color-text-muted)] mt-1">{field.range}</div>
          </div>
        ))}
      </div>

      {ag !== null && (
        <div className="space-y-3">
          <div className={`rounded-lg p-6 border-2 ${
            ag >= 3 && ag <= 12 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
          }`}>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Anion Gap: {ag} mEq/L
            </div>
            {correctedAG !== null && (
              <div className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                Albumin-Corrected AG: {correctedAG} mEq/L
              </div>
            )}
            <p className="text-[var(--color-text-muted)]">
              {getInterpretation(correctedAG || ag)}
            </p>
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
