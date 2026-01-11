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
import { Search, Heart, Activity, Droplet, ArrowLeft } from 'lucide-react';

// Import calculator components
import { CURB65Calculator } from './risk/CURB65Calculator';
import { CHADS2VAScCalculator } from './risk/CHADS2VAScCalculator';
import { WellsDVTCalculator } from './risk/WellsDVTCalculator';
import { WellsPECalculator } from './risk/WellsPECalculator';
import { PERCCalculator } from './diagnosis/PERCCalculator';
import { GFRCalculator } from './lab/GFRCalculator';
import { AnionGapCalculator } from './lab/AnionGapCalculator';

import type { Calculator, CalculatorSystem } from './types';

interface CalculatorHubProps {
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
];

// System tabs configuration
const SYSTEM_TABS: Array<{
  id: CalculatorSystem | 'all';
  label: string;
  icon: typeof Heart;
  color: string;
}> = [
  { id: 'all', label: 'All', icon: Activity, color: 'slate' },
  { id: 'cardiac', label: 'Cardiac', icon: Heart, color: 'red' },
  { id: 'pulmonary', label: 'Pulmonary', icon: Activity, color: 'cyan' },
  { id: 'vascular', label: 'Vascular', icon: Activity, color: 'rose' },
  { id: 'renal', label: 'Renal', icon: Droplet, color: 'blue' },
];

export const CalculatorHub: React.FC<CalculatorHubProps> = ({ onClose }) => {
  const [activeSystem, setActiveSystem] = useState<CalculatorSystem | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCalculator, setSelectedCalculator] = useState<string | null>(null);

  // Filter calculators by system and search
  const filteredCalculators = useMemo(() => {
    let filtered = CALCULATORS;

    // Filter by system
    if (activeSystem !== 'all') {
      filtered = filtered.filter((calc) => calc.system === activeSystem);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((calc) =>
        calc.name.toLowerCase().includes(query) ||
        calc.description.toLowerCase().includes(query) ||
        calc.synonyms?.some((s) => s.toLowerCase().includes(query)) ||
        calc.formula?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeSystem, searchQuery]);

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
      default:
        return null;
    }
  };

  if (selectedCalculator) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-6">
        {renderCalculator()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-5xl font-bold text-slate-100 tracking-wide mb-2"
              style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
            >
              Clinical Calculators
            </h1>
            <p className="text-slate-400">Evidence-based decision support tools</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search calculators by name, description, or formula..."
            className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* System Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SYSTEM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSystem === tab.id;
            const count = tab.id === 'all' ? CALCULATORS.length : CALCULATORS.filter((c) => c.system === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSystem(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-blue-700' : 'bg-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Calculator Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSystem + searchQuery}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCalculators.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <p className="text-slate-400">No calculators found matching your search</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSystem('all');
                  }}
                  className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
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
                    className="group text-left bg-slate-900 border border-slate-700 rounded-xl p-6 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/20 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex items-center justify-center bg-slate-800 rounded-lg group-hover:bg-blue-600 transition-colors">
                        <Icon className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors mb-1">
                          {calc.name}
                        </h3>
                        <p className="text-sm text-slate-400 mb-2">{calc.description}</p>
                        {calc.formula && (
                          <p className="text-xs text-slate-500 font-mono bg-slate-800/50 px-2 py-1 rounded">
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
