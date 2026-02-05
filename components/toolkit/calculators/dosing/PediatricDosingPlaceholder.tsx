/**
 * Pediatric Dosing Calculator - Placeholder
 * Full weight-based medication calculator coming soon.
 */

import React from 'react';
import { CalculatorHeader } from '../shared';
import type { CalculatorProps } from '../types';

export const PediatricDosingPlaceholder: React.FC<CalculatorProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Pediatric Dosing"
        subtitle="Weight-based medication calculator"
        onBack={onBack}
      />
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-center">
        <p className="text-[var(--color-text-muted)] mb-2">
          Weight-based dosing (mg/kg), common pediatric medications, and dose range checks.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">Coming soon.</p>
      </div>
    </div>
  );
};
