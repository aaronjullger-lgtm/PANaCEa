/**
 * CalculatorHub - Modern calculator organization with system-based tabs
 *
 * Refactored from ToolkitHub.tsx monolith.
 * Features:
 * - Tab switcher by organ system (Cardiac, Pulmonary, Vascular, Renal)
 * - Search across all calculators
 * - Professional dark mode aesthetic
 * - Extracted calculator components
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Activity, Droplet } from 'lucide-react';

// Import calculator components
import { CURB65Calculator } from './risk/CURB65Calculator';
import { CHADS2VAScCalculator } from './risk/CHADS2VAScCalculator';
import { WellsDVTCalculator } from './risk/WellsDVTCalculator';
import { WellsPECalculator } from './risk/WellsPECalculator';
import { PERCCalculator } from './diagnosis/PERCCalculator';
import { GFRCalculator } from './lab/GFRCalculator';
import { AnionGapCalculator } from './lab/AnionGapCalculator';
import { OsmolarGapCalculator } from './lab/OsmolarGapCalculator';
import { ParklandCalculator } from './lab/ParklandCalculator';
import { PediatricDosingPlaceholder } from './dosing/PediatricDosingPlaceholder';
import { ClinicalGuidelinesPlaceholder } from './guidelines/ClinicalGuidelinesPlaceholder';

import { CALCULATORS, CALCULATOR_CATEGORIES } from './calculatorRegistry';

interface CalculatorHubProps {
  onClose: () => void;
  /** When set, open this calculator immediately (e.g. from ToolkitHub card click) */
  initialCalculatorId?: string | null;
}

const getCategoryForCalculator = (calcId: string): string => {
  const cat = CALCULATOR_CATEGORIES.find((c) => c.calculatorIds.includes(calcId));
  return cat?.id ?? 'cardiac';
};

export const CalculatorHub: React.FC<CalculatorHubProps> = ({
  onClose,
  initialCalculatorId = null,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(() =>
    initialCalculatorId ? getCategoryForCalculator(initialCalculatorId) : 'cardiac'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(
    initialCalculatorId ?? null
  );

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
      case 'osmolar_gap':
        return <OsmolarGapCalculator onBack={onBack} />;
      case 'parkland':
        return <ParklandCalculator onBack={onBack} />;
      case 'pediatric_dosing':
        return <PediatricDosingPlaceholder onBack={onBack} />;
      case 'clinical_guidelines':
        return <ClinicalGuidelinesPlaceholder onBack={onBack} />;
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
            <h1
              className="text-5xl font-bold text-[var(--color-text-primary)] tracking-wide mb-2 font-teko"
            >
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
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
