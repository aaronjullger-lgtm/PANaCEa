/**
 * DDx Table Component
 * 
 * Renders a structured comparison table between two conditions.
 * Uses color-coded sections to highlight differences.
 */

import React from 'react';
import type { DDxComparison } from '@/lib/services/confusionService';

interface DDxTableProps {
  comparison: DDxComparison;
}

interface ComparisonSectionProps {
  title: string;
  itemsA: string[];
  itemsB: string[];
  conditionA: string;
  conditionB: string;
  colorA?: string;
  colorB?: string;
}

/**
 * ComparisonSection - Side-by-side comparison for a category
 */
const ComparisonSection: React.FC<ComparisonSectionProps> = ({
  title,
  itemsA,
  itemsB,
  conditionA,
  conditionB,
  colorA = 'blue',
  colorB = 'emerald',
}) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      bullet: 'text-blue-500',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      bullet: 'text-emerald-500',
    },
  };

  const colorsA = colorClasses[colorA as keyof typeof colorClasses] || colorClasses.blue;
  const colorsB = colorClasses[colorB as keyof typeof colorClasses] || colorClasses.emerald;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Condition A Column */}
        <div className={`p-4 rounded-xl ${colorsA.bg} border ${colorsA.border}`}>
          <h4 className={`font-semibold mb-2 ${colorsA.text}`}>{conditionA}</h4>
          <ul className="space-y-1.5">
            {itemsA.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className={`${colorsA.bullet} mt-1`}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Condition B Column */}
        <div className={`p-4 rounded-xl ${colorsB.bg} border ${colorsB.border}`}>
          <h4 className={`font-semibold mb-2 ${colorsB.text}`}>{conditionB}</h4>
          <ul className="space-y-1.5">
            {itemsB.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className={`${colorsB.bullet} mt-1`}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * SimilaritiesSection - Shared features between conditions
 */
const SimilaritiesSection: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
      Shared Features
    </h3>
    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-amber-500 mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

/**
 * DDxTable - Complete comparison table
 */
const DDxTable: React.FC<DDxTableProps> = ({ comparison }) => {
  return (
    <div>
      {/* Similarities */}
      <SimilaritiesSection items={comparison.similarities} />

      {/* Key Differences */}
      <ComparisonSection
        title="Key Differences"
        itemsA={comparison.differences.A}
        itemsB={comparison.differences.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />

      {/* Buzzwords */}
      <ComparisonSection
        title="Distinguishing Buzzwords"
        itemsA={comparison.buzzwords.A}
        itemsB={comparison.buzzwords.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
        colorA="blue"
        colorB="emerald"
      />

      {/* Diagnostic Clues */}
      <ComparisonSection
        title="Diagnostic Clues"
        itemsA={comparison.diagnostic.A}
        itemsB={comparison.diagnostic.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />

      {/* Treatments */}
      <ComparisonSection
        title="Treatment Distinctions"
        itemsA={comparison.treatments.A}
        itemsB={comparison.treatments.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />
    </div>
  );
};

export default DDxTable;
