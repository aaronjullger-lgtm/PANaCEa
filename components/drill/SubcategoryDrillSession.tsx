/**
 * SubcategoryDrillSession - Disease category-based drill
 *
 * Allows users to select a disease subcategory and practice related conditions.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderTree,
  X,
  Heart,
  Zap,
  Droplets,
  Wind,
  Shield,
  AlertTriangle,
  Brain,
  Activity,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import ConditionDrillSession from './ConditionDrillSession';
import { getDrillLandingStats, getCategoryBreakdown } from '@/services/drillStatsService';

interface SubcategoryDrillSessionProps {
  onExit?: () => void;
}

const SUBCATEGORY_OPTIONS = [
  {
    id: 'infections',
    name: 'Infectious Diseases',
    icon: Shield,
    color: 'green',
    description: 'Bacterial, viral, fungal, parasitic',
  },
  {
    id: 'autoimmune',
    name: 'Autoimmune',
    icon: AlertTriangle,
    color: 'amber',
    description: 'Rheumatoid, lupus, vasculitis',
  },
  {
    id: 'neoplastic',
    name: 'Neoplastic',
    icon: Activity,
    color: 'red',
    description: 'Cancers and tumors',
  },
  {
    id: 'cardiovascular',
    name: 'Cardiovascular',
    icon: Heart,
    color: 'rose',
    description: 'Arrhythmias, CHF, MI, angina',
  },
  {
    id: 'pulmonary',
    name: 'Pulmonary',
    icon: Wind,
    color: 'blue',
    description: 'Asthma, COPD, pneumonia, ILD',
  },
  {
    id: 'neurological',
    name: 'Neurological',
    icon: Brain,
    color: 'purple',
    description: 'Stroke, seizures, dementia, MS',
  },
  {
    id: 'endocrine',
    name: 'Endocrine',
    icon: Zap,
    color: 'indigo',
    description: 'Diabetes, thyroid, adrenal',
  },
  {
    id: 'gastrointestinal',
    name: 'Gastrointestinal',
    icon: Droplets,
    color: 'amber',
    description: 'IBD, hepatitis, cirrhosis',
  },
  {
    id: 'metabolic',
    name: 'Metabolic',
    icon: Activity,
    color: 'teal',
    description: 'Electrolytes, acid-base, nutrition',
  },
];

const SubcategoryDrillSession: React.FC<SubcategoryDrillSessionProps> = ({ onExit }) => {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);

  const stats = getDrillLandingStats('subcategory_drill');
  const categoryBreakdown = getCategoryBreakdown('subcategory_drill');

  const handleStart = () => {
    setShowLanding(false);
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
  };

  const handleBackToMenu = () => {
    setSelectedSubcategory(null);
  };

  // Landing page
  if (showLanding) {
    return (
      <DrillLandingPage
        title="Subcategory Drill"
        description="Focus on specific disease groups"
        icon={FolderTree}
        accentColor="violet"
        stats={stats}
        onStart={handleStart}
        instructions={[
          'Choose a disease subcategory',
          'Practice related conditions',
          'Build category-specific expertise',
          'Connect similar disease patterns',
        ]}
        objectives={[
          'Master disease subcategories',
          'Recognize common patterns',
          'Differentiate similar conditions',
          'Build targeted knowledge',
        ]}
        estimatedMinutes={12}
      >
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
              aria-label="Exit"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Category Progress */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Category Progress
              </h3>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{cat.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {cat.attempts} attempts
                    </span>
                    <span
                      className={`font-semibold ${
                        cat.accuracy >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : cat.accuracy >= 70
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {cat.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  // If subcategory selected, show ConditionDrillSession with subcategory filter
  if (selectedSubcategory) {
    return (
      <ConditionDrillSession onExit={handleBackToMenu} initialSubcategory={selectedSubcategory} />
    );
  }

  // Subcategory selection menu
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium">Exit</span>
        </button>
        <h1 className="text-lg font-semibold">Subcategory Drill</h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">Select Disease Category</h2>
          <p className="text-[var(--color-text-secondary)]">Focus on specific disease patterns</p>
        </motion.div>

        {/* Subcategory grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {SUBCATEGORY_OPTIONS.map((subcategory, index) => {
            const Icon = subcategory.icon;
            return (
              <motion.button
                key={subcategory.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSubcategorySelect(subcategory.id)}
                className="relative p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-violet-300 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg bg-${subcategory.color}-100 dark:bg-${subcategory.color}-900/20`}
                  >
                    <Icon
                      className={`w-6 h-6 text-${subcategory.color}-600 dark:text-${subcategory.color}-400`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                      {subcategory.name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {subcategory.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SubcategoryDrillSession;
