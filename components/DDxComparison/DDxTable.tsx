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

const toSafeList = (items?: string[] | null): string[] => {
  if (!items) return [];
  if (Array.isArray(items)) return items.filter(Boolean);
  return [];
};

const toSafePair = (pair?: { A?: string[] | null; B?: string[] | null }) => ({
  A: toSafeList(pair?.A),
  B: toSafeList(pair?.B),
});

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
      bg: 'bg-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]',
      border: 'border-[var(--color-category-practice)] border-[var(--color-category-practice)]',
      text: 'text-[var(--color-category-practice)] text-[var(--color-category-practice)]',
      bullet: 'text-[var(--color-category-practice)]',
    },
    emerald: {
      bg: 'bg-data-pass dark:bg-data-pass/30',
      border: 'border-data-pass dark:border-data-pass',
      text: 'text-data-pass dark:text-data-pass',
      bullet: 'text-data-pass',
    },
  };

  const colorsA = colorClasses[colorA as keyof typeof colorClasses] || colorClasses.blue;
  const colorsB = colorClasses[colorB as keyof typeof colorClasses] || colorClasses.emerald;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-data-neutral dark:text-data-neutral uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Condition A Column */}
        <div className={`p-4 rounded-xl ${colorsA.bg} border ${colorsA.border}`}>
          <h4 className={`font-semibold mb-2 ${colorsA.text}`}>{conditionA}</h4>
          <ul className="space-y-1.5">
            {itemsA.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-data-neutral dark:text-data-neutral"
              >
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
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-data-neutral dark:text-data-neutral"
              >
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
    <h3 className="text-sm font-semibold text-data-neutral dark:text-data-neutral uppercase tracking-wide mb-3">
      Shared Features
    </h3>
    <div className="p-4 rounded-xl bg-data-provisional dark:bg-data-provisional/30 border border-data-provisional dark:border-data-provisional">
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-sm text-data-neutral dark:text-data-neutral"
          >
            <span className="text-data-provisional mt-1">•</span>
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
  const similarities = toSafeList(comparison.similarities);
  const differences = toSafePair(comparison.differences);
  const buzzwords = toSafePair(comparison.buzzwords);
  const diagnostic = toSafePair(comparison.diagnostic);
  const treatments = toSafePair(comparison.treatments);
  const keyDiffs = toSafePair(comparison.keyDifferentiators);
  const triadItems = toSafeList(comparison.triad);

  return (
    <div>
      {/* Similarities */}
      <SimilaritiesSection items={similarities} />

      {/* Key Differences */}
      <ComparisonSection
        title="Key Differences"
        itemsA={differences.A}
        itemsB={differences.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />

      {/* Buzzwords */}
      <ComparisonSection
        title="Distinguishing Buzzwords"
        itemsA={buzzwords.A}
        itemsB={buzzwords.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
        colorA="blue"
        colorB="emerald"
      />

      {/* Diagnostic Clues */}
      <ComparisonSection
        title="Diagnostic Clues"
        itemsA={diagnostic.A}
        itemsB={diagnostic.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />

      {/* Treatments */}
      <ComparisonSection
        title="Treatment Distinctions"
        itemsA={treatments.A}
        itemsB={treatments.B}
        conditionA={comparison.conditionA}
        conditionB={comparison.conditionB}
      />

      {/* Key Differentiators (optional) */}
      {(keyDiffs.A.length > 0 || keyDiffs.B.length > 0) && (
        <ComparisonSection
          title="Key Differentiators"
          itemsA={keyDiffs.A}
          itemsB={keyDiffs.B}
          conditionA={comparison.conditionA}
          conditionB={comparison.conditionB}
        />
      )}

      {/* Classic Triad (optional) */}
      {triadItems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-data-neutral dark:text-data-neutral uppercase tracking-wide mb-3">
            Classic Triad
          </h3>
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <ul className="space-y-1.5">
              {triadItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-data-neutral dark:text-data-neutral"
                >
                  <span className="text-rose-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default DDxTable;
