/**
 * Pediatric Dosing Calculator
 * Weight-based medication dosing for common pediatric drugs
 */

import React, { useState, useMemo } from 'react';
import { CalculatorHeader, CalculatorInput, SimpleCalculatorResult } from '../shared';
import type { CalculatorProps } from '../types';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface PediatricDrug {
  name: string;
  indication: string;
  dosePerKg: number;
  unit: string;
  frequency: string;
  maxDose: number;
  minWeight: number;
  route: string;
}

const COMMON_PEDS_DRUGS: PediatricDrug[] = [
  {
    name: 'Amoxicillin',
    indication: 'Otitis media',
    dosePerKg: 40,
    unit: 'mg',
    frequency: 'divided q8h',
    maxDose: 1500,
    minWeight: 3,
    route: 'PO',
  },
  {
    name: 'Acetaminophen',
    indication: 'Fever/Pain',
    dosePerKg: 15,
    unit: 'mg',
    frequency: 'q4-6h PRN',
    maxDose: 1000,
    minWeight: 3,
    route: 'PO',
  },
  {
    name: 'Ibuprofen',
    indication: 'Fever/Pain',
    dosePerKg: 10,
    unit: 'mg',
    frequency: 'q6h PRN',
    maxDose: 600,
    minWeight: 6,
    route: 'PO',
  },
  {
    name: 'Azithromycin',
    indication: 'Pneumonia',
    dosePerKg: 10,
    unit: 'mg',
    frequency: 'day 1, then 5 mg/kg days 2-5',
    maxDose: 500,
    minWeight: 6,
    route: 'PO',
  },
  {
    name: 'Ceftriaxone',
    indication: 'Severe infection',
    dosePerKg: 50,
    unit: 'mg',
    frequency: 'q12-24h',
    maxDose: 2000,
    minWeight: 3,
    route: 'IV/IM',
  },
  {
    name: 'Ondansetron',
    indication: 'Nausea/vomiting',
    dosePerKg: 0.15,
    unit: 'mg',
    frequency: 'q8h PRN',
    maxDose: 16,
    minWeight: 6,
    route: 'PO/IV',
  },
];

export const PediatricDosingPlaceholder: React.FC<CalculatorProps> = ({ onBack }) => {
  const [weight, setWeight] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<PediatricDrug>(COMMON_PEDS_DRUGS[0]!);

  const calculation = useMemo(() => {
    const weightKg = parseFloat(weight);
    if (!weightKg || weightKg < 0 || weightKg > 100) return null;

    const calculatedDose = weightKg * selectedDrug.dosePerKg;
    const actualDose = Math.min(calculatedDose, selectedDrug.maxDose);
    const isMaxed = calculatedDose > selectedDrug.maxDose;
    const isTooLight = weightKg < selectedDrug.minWeight;

    return {
      calculatedDose,
      actualDose,
      isMaxed,
      isTooLight,
      perDose: actualDose,
      dailyMax: actualDose,
    };
  }, [weight, selectedDrug]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Pediatric Dosing Calculator"
        subtitle="Weight-based medication dosing for common pediatric drugs"
        onBack={onBack}
      />

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 space-y-6">
        {/* Drug Selection */}
        <div>
          <label
            htmlFor="drug-select"
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
          >
            Select Medication
          </label>
          <select
            id="drug-select"
            value={selectedDrug.name}
            onChange={(e) => {
              const drug = COMMON_PEDS_DRUGS.find((d) => d.name === e.target.value);
              if (drug) setSelectedDrug(drug);
            }}
            aria-label="Select pediatric medication"
            className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {COMMON_PEDS_DRUGS.map((drug) => (
              <option key={drug.name} value={drug.name}>
                {drug.name} - {drug.indication}
              </option>
            ))}
          </select>
        </div>

        {/* Weight Input */}
        <CalculatorInput
          label="Patient Weight"
          type="number"
          value={weight}
          onChange={setWeight}
          placeholder="kg"
          unit="kg"
        />

        {/* Drug Info */}
        <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-muted)]">Standard Dose:</span>
              <p className="font-medium text-[var(--color-text-primary)]">
                {selectedDrug.dosePerKg} {selectedDrug.unit}/kg
              </p>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Frequency:</span>
              <p className="font-medium text-[var(--color-text-primary)]">
                {selectedDrug.frequency}
              </p>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Max Single Dose:</span>
              <p className="font-medium text-[var(--color-text-primary)]">
                {selectedDrug.maxDose} {selectedDrug.unit}
              </p>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Route:</span>
              <p className="font-medium text-[var(--color-text-primary)]">{selectedDrug.route}</p>
            </div>
          </div>
        </div>

        {/* Results */}
        {calculation && (
          <div className="space-y-4">
            {calculation.isTooLight && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-300">Weight Below Minimum</p>
                  <p className="text-amber-200/80">
                    Minimum weight: {selectedDrug.minWeight} kg. Consult pharmacy for dosing.
                  </p>
                </div>
              </div>
            )}

            {!calculation.isTooLight && (
              <>
                <SimpleCalculatorResult
                  label="Calculated Dose"
                  value={`${calculation.calculatedDose.toFixed(1)} ${selectedDrug.unit}`}
                  highlight={!calculation.isMaxed}
                />

                {calculation.isMaxed && (
                  <>
                    <SimpleCalculatorResult
                      label="Actual Dose (Max Capped)"
                      value={`${calculation.actualDose} ${selectedDrug.unit}`}
                      highlight
                    />
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-300">Maximum Dose Reached</p>
                        <p className="text-blue-200/80">
                          Calculated dose exceeds max safe dose. Using maximum:{' '}
                          {selectedDrug.maxDose} {selectedDrug.unit}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-300">Dosing Recommendation</p>
                    <p className="text-green-200/80">
                      Give {calculation.actualDose.toFixed(1)} {selectedDrug.unit}{' '}
                      {selectedDrug.route} {selectedDrug.frequency}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <p className="text-sm text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Always verify dosing with institutional protocols and consult pharmacy for complex cases.
        </p>
      </div>
    </div>
  );
};
