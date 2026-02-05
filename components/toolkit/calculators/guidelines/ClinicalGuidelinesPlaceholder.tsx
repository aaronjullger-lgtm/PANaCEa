/**
 * Clinical Guidelines Browser - Placeholder
 * Practice guidelines and criteria reference coming soon.
 */

import React from 'react';
import { CalculatorHeader } from '../shared';
import type { CalculatorProps } from '../types';

export const ClinicalGuidelinesPlaceholder: React.FC<CalculatorProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Clinical Guidelines"
        subtitle="Practice guidelines and criteria"
        onBack={onBack}
      />
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-center">
        <p className="text-[var(--color-text-muted)] mb-2">
          Evidence-based guidelines, scoring criteria, and management protocols by condition.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">Coming soon.</p>
      </div>
    </div>
  );
};
