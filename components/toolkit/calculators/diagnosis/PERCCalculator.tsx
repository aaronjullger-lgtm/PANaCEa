/**
 * PERC Rule Calculator
 *
 * Pulmonary Embolism Rule-out Criteria.
 * Binary decision tool for LOW-RISK patients only.
 *
 * If ALL 8 criteria are ABSENT → PERC negative → PE ruled out (no D-dimer/imaging needed)
 * If ANY criterion present → PERC positive → Cannot rule out PE (proceed with workup)
 *
 * Important: Only use in patients with LOW clinical suspicion (<15% pre-test probability)
 */

import React, { useState } from 'react';
import { CalculatorHeader, CheckboxCriteria, ResultDisplay, ResetButton } from '../shared';
import type { CalculatorProps, CalculatorResult, CriteriaItem } from '../types';
import { isPERCNegative, percPositiveCount } from '@/lib/calculators';

export const PERCCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [age50, setAge50] = useState(false);
  const [heartRate100, setHeartRate100] = useState(false);
  const [o2sat95, setO2sat95] = useState(false);
  const [unilateralLegSwelling, setUnilateralLegSwelling] = useState(false);
  const [hemoptysis, setHemoptysis] = useState(false);
  const [recentSurgery, setRecentSurgery] = useState(false);
  const [priorPE, setPriorPE] = useState(false);
  const [hormoneUse, setHormoneUse] = useState(false);

  const criteriaInput = {
    age50,
    heartRate100,
    o2sat95,
    unilateralLegSwelling,
    hemoptysis,
    recentSurgery,
    priorPE,
    hormoneUse,
  };
  const positiveCount = percPositiveCount(criteriaInput);
  const percNegative = isPERCNegative(criteriaInput);

  const getInterpretation = (): CalculatorResult => {
    if (percNegative) {
      return {
        score: 'NEGATIVE',
        interpretation: 'All Criteria Absent',
        recommendation:
          'In low-risk patients, PE can be ruled out without D-dimer or imaging. No further workup needed.',
        riskLevel: 'low',
        details:
          'PERC Rule has 96-100% sensitivity when applied to low-risk patients. Risk of missed PE is <2%.',
      };
    } else {
      return {
        score: 'POSITIVE',
        interpretation: `${positiveCount} Criteria Present`,
        recommendation:
          'Cannot rule out PE with PERC. Proceed with D-dimer or imaging based on clinical probability (e.g., Wells score).',
        riskLevel: 'high',
        details:
          'PERC Rule cannot be used to exclude PE. Consider Wells score or other clinical decision rules to guide further testing.',
      };
    }
  };

  const criteriaItems: CriteriaItem[] = [
    {
      state: age50,
      setState: setAge50,
      title: 'Age ≥50',
      description: 'Patient 50 years or older',
    },
    {
      state: heartRate100,
      setState: setHeartRate100,
      title: 'Heart Rate ≥100',
      description: 'Tachycardia present',
    },
    {
      state: o2sat95,
      setState: setO2sat95,
      title: 'O₂ Saturation <95%',
      description: 'On room air',
    },
    {
      state: unilateralLegSwelling,
      setState: setUnilateralLegSwelling,
      title: 'Unilateral Leg Swelling',
      description: 'Clinical signs of DVT',
    },
    {
      state: hemoptysis,
      setState: setHemoptysis,
      title: 'Hemoptysis',
      description: 'Coughing up blood',
    },
    {
      state: recentSurgery,
      setState: setRecentSurgery,
      title: 'Recent Surgery/Trauma',
      description: 'Within 4 weeks requiring general anesthesia',
    },
    {
      state: priorPE,
      setState: setPriorPE,
      title: 'Prior PE or DVT',
      description: 'History of venous thromboembolism',
    },
    {
      state: hormoneUse,
      setState: setHormoneUse,
      title: 'Hormone Use',
      description: 'Oral contraceptives, HRT, or estrogenic hormones',
    },
  ];

  const result = getInterpretation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <CalculatorHeader
          title="PERC Rule"
          subtitle="Pulmonary Embolism Rule-out Criteria"
          onBack={onBack}
        />
        <ResetButton onReset={() => {
          setAge50(false);
          setHeartRate100(false);
          setO2sat95(false);
          setUnilateralLegSwelling(false);
          setHemoptysis(false);
          setRecentSurgery(false);
          setPriorPE(false);
          setHormoneUse(false);
        }} />
      </div>

      <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)] rounded-xl p-4">
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          <strong className="text-[var(--color-text-primary)]">
            ⚠️ Use only in LOW-RISK patients
          </strong>{' '}
          (clinical gestalt {'<'}15% pre-test probability). If ALL criteria are absent (PERC
          negative), PE can be ruled out without further testing.
        </p>
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
        <CheckboxCriteria items={criteriaItems} />
      </div>

      <ResultDisplay result={result} showRiskBar={false} />
    </div>
  );
};

export default PERCCalculator;
