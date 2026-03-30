/**
 * CalculatorHub - Modern calculator organization with system-based tabs
 *
 * Refactored from ToolkitHub.tsx monolith.
 * Features:
 * - Tab switcher by organ system (Cardiac, Pulmonary, Vascular, Renal)
 * - Search across all calculators
 * - Dark sportsbook aesthetic
 * - Extracted calculator components
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, Activity, Droplet, ArrowLeft, Wind, Baby, Sparkles } from 'lucide-react';

// Import calculator components
import { InstantCalcView } from './InstantCalcView';
import { CURB65Calculator } from './risk/CURB65Calculator';
import { CHADS2VAScCalculator } from './risk/CHADS2VAScCalculator';
import { WellsDVTCalculator } from './risk/WellsDVTCalculator';
import { WellsPECalculator } from './risk/WellsPECalculator';
import { PERCCalculator } from './diagnosis/PERCCalculator';
import { GFRCalculator } from './lab/GFRCalculator';
import { AnionGapCalculator } from './lab/AnionGapCalculator';

import type { Calculator, CalculatorSystem } from './types';

interface CalculatorHubProps {
  initialCalculatorId?: string;
  onClose: () => void;
}

// Calculator registry with system classification
const CALCULATORS: Calculator[] = [
  {
    id: 'curb65',
    name: 'CURB-65',
    description: 'Pneumonia severity assessment',
    category: 'risk',
    icon: Activity,
    system: 'pulmonary',
    synonyms: ['pneumonia', 'cap', 'community acquired pneumonia'],
    formula: 'Confusion + Urea + RR + BP + Age ≥65',
  },
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc',
    description: 'Stroke risk in atrial fibrillation',
    category: 'risk',
    icon: Heart,
    system: 'cardiac',
    synonyms: ['afib', 'stroke', 'anticoagulation'],
    formula: 'CHF + HTN + Age + DM + Stroke + Vasc + Sex',
  },
  {
    id: 'wells_dvt',
    name: "Wells' DVT",
    description: 'Deep vein thrombosis probability',
    category: 'diagnosis',
    icon: Activity,
    system: 'vascular',
    synonyms: ['dvt', 'blood clot', 'venous thrombosis'],
  },
  {
    id: 'wells_pe',
    name: "Wells' PE",
    description: 'Pulmonary embolism probability',
    category: 'diagnosis',
    icon: Activity,
    system: 'pulmonary',
    synonyms: ['pe', 'pulmonary embolism', 'clot'],
  },
  {
    id: 'perc',
    name: 'PERC Rule',
    description: 'PE rule-out criteria',
    category: 'diagnosis',
    icon: Activity,
    system: 'pulmonary',
    synonyms: ['pulmonary embolism', 'rule out'],
  },
  {
    id: 'gfr',
    name: 'GFR (MDRD)',
    description: 'Glomerular filtration rate',
    category: 'lab',
    icon: Droplet,
    system: 'renal',
    synonyms: ['egfr', 'kidney function', 'creatinine clearance'],
    formula: '186 × (Cr)^-1.154 × (Age)^-0.203',
  },
  {
    id: 'anion_gap',
    name: 'Anion Gap',
    description: 'Metabolic acidosis assessment',
    category: 'lab',
    icon: Droplet,
    system: 'renal',
    synonyms: ['ag', 'metabolic acidosis', 'mudpiles'],
    formula: 'Na⁺ − (Cl⁻ + HCO₃⁻)',
  },
  {
    id: 'instant_calc',
    name: 'Instant Calc',
    description: 'Generate a calculator from a description (e.g. TIMI, HEART)',
    category: 'risk',
    icon: Sparkles,
    system: 'cardiac',
    synonyms: ['spark', 'timi', 'heart score', 'micro-app'],
  },
];

// Calculator category tabs
const CALCULATOR_CATEGORIES: Array<{
  id: string;
  label: string;
  icon: typeof Heart;
  calculatorIds: string[];
}> = [
  { id: 'cardiac', label: 'Cardiac', icon: Heart, calculatorIds: ['chads2vasc', 'instant_calc'] },
  {
    id: 'pulmonary',
    label: 'Pulmonary',
    icon: Wind,
    calculatorIds: ['curb65', 'wells_pe', 'perc'],
  },
  { id: 'vascular', label: 'Vascular', icon: Activity, calculatorIds: ['wells_dvt'] },
  { id: 'renal', label: 'Renal/Labs', icon: Droplet, calculatorIds: ['gfr', 'anion_gap'] },
  { id: 'pediatric', label: 'Pediatric', icon: Baby, calculatorIds: ['pediatric_dosing'] },
];

export const CalculatorHub: React.FC<CalculatorHubProps> = ({ initialCalculatorId, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('cardiac');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(initialCalculatorId ?? null);

  // Filter calculators by system and search
  const filteredCalculators = useMemo(() => {
    const category = CALCULATOR_CATEGORIES.find((cat) => cat.id === activeCategory);
    let filtered = category
      ? CALCULATORS.filter((calc) => category.calculatorIds.includes(calc.id))
      : CALCULATORS;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (calc) =>
          calc.name.toLowerCase().includes(query) ||
          calc.description.toLowerCase().includes(query) ||
          calc.synonyms?.some((s) => s.toLowerCase().includes(query)) ||
          calc.formula?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeCategory, searchQuery]);

  // Render selected calculator component
  const renderCalculator = () => {
    const onBack = () => setSelectedCalculator(null);

    switch (selectedCalculator) {
      case 'instant_calc':
        return <InstantCalcView onBack={onBack} />;
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
      default:
        return null;
    }
  };

  if (selectedCalculator) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-6">
        {renderCalculator()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-5xl font-bold text-[var(--color-text-primary)] tracking-wide mb-2 font-teko">
              Clinical Calculators
            </h1>
            <p className="text-[var(--color-text-muted)]">Evidence-based decision support tools</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:opacity-90 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* Category Tabs with animated underline */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CALCULATOR_CATEGORIES.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            const count = tab.calculatorIds.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className="relative px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 text-[var(--color-text-primary)] hover:opacity-90 transition-colors flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                />
                <span>{tab.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">({count})</span>
                {isActive && (
                  <motion.div
                    layoutId="calculator-tab-underline"
                    className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-[var(--color-accent)]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Calculator Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + searchQuery}
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCalculators.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <p className="text-[var(--color-text-muted)]">
                  No calculators found matching your search
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('cardiac');
                  }}
                  className="mt-4 text-[var(--color-accent)] hover:opacity-90 text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredCalculators.map((calc, idx) => {
                const Icon = calc.icon;
                return (
                  <motion.button
                    key={calc.id}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedCalculator(calc.id)}
                    className="group text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-accent)] hover:shadow-xl hover:shadow-[var(--color-accent)]/20 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex items-center justify-center bg-[var(--color-bg-primary)] rounded-lg group-hover:bg-[var(--color-accent)] transition-colors">
                        <Icon className="w-6 h-6 text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors mb-1">
                          {calc.name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                          {calc.description}
                        </p>
                        {calc.formula && (
                          <p className="text-xs text-[var(--color-text-muted)] font-mono bg-[var(--color-bg-primary)]/50 px-2 py-1 rounded">
                            {calc.formula}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CalculatorHub;
