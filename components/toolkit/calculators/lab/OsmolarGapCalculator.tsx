/**
 * Osmolar Gap Calculator
 *
 * Calculated osmolarity: 2×Na + glucose/18 + BUN/2.8 (mOsm/kg).
 * Osmolar gap = Measured osmolality − Calculated (elevated in toxic alcohols).
 */

import React, { useState } from 'react';
import { Beaker } from 'lucide-react';
import { CalculatorHeader, ClinicalInput, ResultDisplay } from '../shared';
import type { CalculatorProps, CalculatorResult } from '../types';

export const OsmolarGapCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [sodium, setSodium] = useState('');
  const [glucose, setGlucose] = useState('');
  const [bun, setBun] = useState('');
  const [measuredOsm, setMeasuredOsm] = useState('');

  const calculatedOsm = ((): number | null => {
    const na = parseFloat(sodium);
    const glu = parseFloat(glucose);
    const b = parseFloat(bun);
    if (!na) return null;
    return 2 * na + (glu || 0) / 18 + (b || 0) / 2.8;
  })();

  const measured = measuredOsm ? parseFloat(measuredOsm) : null;
  const gap =
    calculatedOsm !== null && measured !== null && !Number.isNaN(measured)
      ? Math.round((measured - calculatedOsm) * 10) / 10
      : null;

  const getResult = (): CalculatorResult | null => {
    if (gap === null) return null;
    if (gap > 10) {
      return {
        score: gap,
        interpretation: 'Elevated osmolar gap',
        recommendation:
          'Consider toxic alcohols (methanol, ethylene glycol), acetone, isopropyl alcohol. Check toxicology, lactate, ABG.',
        riskLevel: 'high',
        details: 'Osmolar gap >10 suggests unmeasured osmoles (e.g. toxic alcohols).',
      };
    }
    return {
      score: gap,
      interpretation: 'Normal osmolar gap',
      recommendation: 'Gap ≤10 is normal. Elevated AG metabolic acidosis without elevated gap suggests DKA, lactic acidosis, uremia.',
      riskLevel: 'low',
      details: 'Normal range: ≤10 mOsm/kg.',
    };
  };

  const result = getResult();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Osmolar Gap"
        subtitle="Toxic alcohol / unmeasured osmoles"
        onBack={onBack}
      />
      <div className="bg-gradient-to-r from-[var(--color-bg-primary)]/40 to-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Beaker className="w-6 h-6 text-[var(--color-accent)]" />
          <div>
            <div className="font-mono text-lg font-semibold text-slate-200">
              Calculated = 2×Na + Glu/18 + BUN/2.8
            </div>
            <div className="text-sm text-slate-300 mt-1">Gap = Measured − Calculated (normal ≤10)</div>
          </div>
        </div>
      </div>
      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ClinicalInput
            label="Sodium"
            value={sodium}
            onChange={setSodium}
            type="number"
            unit="mEq/L"
            placeholder="Na"
          />
          <ClinicalInput
            label="Glucose"
            value={glucose}
            onChange={setGlucose}
            type="number"
            unit="mg/dL"
            placeholder="Glu"
          />
          <ClinicalInput
            label="BUN"
            value={bun}
            onChange={setBun}
            type="number"
            unit="mg/dL"
            placeholder="BUN"
          />
          <ClinicalInput
            label="Measured osmolality (optional)"
            value={measuredOsm}
            onChange={setMeasuredOsm}
            type="number"
            unit="mOsm/kg"
            placeholder="If available"
          />
        </div>
        {calculatedOsm !== null && (
          <div className="text-slate-300">
            Calculated osmolarity = <strong className="text-slate-100">{calculatedOsm.toFixed(1)}</strong> mOsm/kg
            {gap !== null && (
              <> &nbsp;| &nbsp;Osmolar gap = <strong className="text-slate-100">{gap}</strong> mOsm/kg</>
            )}
          </div>
        )}
        {result && <ResultDisplay result={result} />}
      </div>
    </div>
  );
};
