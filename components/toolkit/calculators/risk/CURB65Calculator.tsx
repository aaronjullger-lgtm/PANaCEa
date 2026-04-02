/**
 * CURB-65 Calculator
 *
 * Pneumonia severity assessment for community-acquired pneumonia (CAP).
 * Helps determine admission vs outpatient management.
 *
 * Score interpretation:
 * - 0-1: Low risk (outpatient)
 * - 2: Moderate risk (short admission or close supervision)
 * - 3-5: High risk (hospital admission, consider ICU if ≥4)
 */

import React, { useState } from 'react';
import { CalculatorHeader, CheckboxCriteria, ResultDisplay, ResetButton } from '../shared';
import type { CalculatorProps, CalculatorResult, CriteriaItem } from '../types';
import { calculateCURB65 } from '@/lib/calculators';

export const CURB65Calculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [confusion, setConfusion] = useState(false);
  const [urea, setUrea] = useState(false);
  const [respiratory, setRespiratory] = useState(false);
  const [bloodPressure, setBloodPressure] = useState(false);
  const [age, setAge] = useState(false);

  const score = calculateCURB65({
    confusion,
    urea,
    respiratory,
    bloodPressure,
    age,
  });

  const getInterpretation = (): CalculatorResult => {
    if (score <= 1) {
      return {
        score,
        interpretation: 'Low Risk',
        recommendation: 'Consider outpatient management with close follow-up. Mortality <3%.',
        riskLevel: 'low',
        details:
          'Patients may be safely treated as outpatients with oral antibiotics and arranged follow-up within 24-48 hours.',
      };
    } else if (score === 2) {
      return {
        score,
        interpretation: 'Moderate Risk',
        recommendation:
          'Consider short hospital admission or closely supervised outpatient care. Mortality ~9%.',
        riskLevel: 'moderate',
        details:
          'Hospital admission for observation may be warranted. Some patients with adequate home support may be managed as outpatients with daily follow-up.',
      };
    } else {
      return {
        score,
        interpretation: 'High Risk (Severe Pneumonia)',
        recommendation:
          'Hospital admission recommended. Consider ICU evaluation if score ≥4. Mortality 15-40%.',
        riskLevel: 'high',
        details:
          'These patients require inpatient treatment with IV antibiotics. Scores ≥4 have significant mortality risk and may require intensive care.',
      };
    }
  };

  const criteria: CriteriaItem[] = [
    {
      state: confusion,
      setState: setConfusion,
      title: 'Confusion',
      description: 'New onset disorientation to person, place, or time',
      points: 1,
    },
    {
      state: urea,
      setState: setUrea,
      title: 'Urea',
      description: 'BUN > 19 mg/dL (>7 mmol/L)',
      points: 1,
    },
    {
      state: respiratory,
      setState: setRespiratory,
      title: 'Respiratory Rate',
      description: '≥30 breaths per minute',
      points: 1,
    },
    {
      state: bloodPressure,
      setState: setBloodPressure,
      title: 'Blood Pressure',
      description: 'Systolic <90 mmHg or Diastolic ≤60 mmHg',
      points: 1,
    },
    {
      state: age,
      setState: setAge,
      title: 'Age',
      description: '≥65 years old',
      points: 1,
    },
  ];

  const result = getInterpretation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <CalculatorHeader
          title="CURB-65 Score"
          subtitle="Pneumonia Severity Assessment"
          onBack={onBack}
        />
        <ResetButton onReset={() => { setConfusion(false); setUrea(false); setRespiratory(false); setBloodPressure(false); setAge(false); }} />
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
        <CheckboxCriteria items={criteria} />
      </div>

      <ResultDisplay result={result} showRiskBar />
    </div>
  );
};

export default CURB65Calculator;
