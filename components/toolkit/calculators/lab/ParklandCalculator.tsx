/**
 * Parkland Formula Calculator
 *
 * Burn resuscitation: 4 mL × kg × % TBSA in first 24 hours.
 * Half in first 8 hours from burn, half over next 16 hours.
 */

import React, { useState } from 'react';
import { Droplet } from 'lucide-react';
import { CalculatorHeader, ClinicalInput, ResetButton, CopyResultButton } from '../shared';
import type { CalculatorProps } from '../types';
import { parkland as parklandFormula } from '@/lib/calculators';

export const ParklandCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [weightKg, setWeightKg] = useState('');
  const [tbsaPercent, setTbsaPercent] = useState('');

  const weight = parseFloat(weightKg);
  const tbsa = parseFloat(tbsaPercent);
  const result = weight > 0 && tbsa > 0 ? parklandFormula(weight, tbsa) : null;
  const total24 = result?.total24 ?? null;
  const first8h = result?.first8h ?? null;
  const next16h = result?.next16h ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <CalculatorHeader
          title="Parkland Formula"
          subtitle="Burn resuscitation (first 24 hours)"
          onBack={onBack}
        />
        <div className="flex gap-2">
          <ResetButton
            onReset={() => {
              setWeightKg('');
              setTbsaPercent('');
            }}
          />
          {total24 !== null && (
            <CopyResultButton
              getText={() =>
                `Parkland Formula\nWeight: ${weightKg} kg | TBSA: ${tbsaPercent}%\n\nTotal 24h: ${total24?.toLocaleString()} mL LR\nFirst 8h: ${first8h?.toLocaleString()} mL\nNext 16h: ${next16h?.toLocaleString()} mL`
              }
            />
          )}
        </div>
      </div>
      <div className="bg-gradient-to-r from-[var(--color-bg-primary)]/40 to-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Droplet className="w-6 h-6 text-[var(--color-accent)]" />
          <div>
            <div className="font-mono text-lg font-semibold text-[var(--color-text-primary)]">
              4 mL × kg × % TBSA = total mL in 24 h
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">
              Half in first 8 h from burn, half over next 16 h. Use LR.
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ClinicalInput
            label="Weight"
            value={weightKg}
            onChange={setWeightKg}
            type="number"
            unit="kg"
            placeholder="kg"
          />
          <ClinicalInput
            label="% TBSA burned"
            value={tbsaPercent}
            onChange={setTbsaPercent}
            type="number"
            unit="%"
            placeholder="%"
          />
        </div>
        {total24 !== null && (
          <div className="space-y-2 p-4 bg-[var(--color-bg-tertiary)] rounded-xl border border-[var(--color-border)]">
            <div className="text-[var(--color-text-primary)] font-semibold">
              Total first 24 h:{' '}
              <span className="text-[var(--color-accent)]">{total24.toLocaleString()}</span> mL LR
            </div>
            <div className="text-[var(--color-text-secondary)] text-sm">
              First 8 h (from burn):{' '}
              <strong className="text-[var(--color-text-primary)]">
                {first8h?.toLocaleString()}
              </strong>{' '}
              mL &nbsp;|&nbsp; Next 16 h:{' '}
              <strong className="text-[var(--color-text-primary)]">
                {next16h?.toLocaleString()}
              </strong>{' '}
              mL
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
