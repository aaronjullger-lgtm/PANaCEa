/**
 * Wells' DVT Criteria Calculator
 *
 * Estimates probability of deep vein thrombosis (DVT).
 * Helps guide D-dimer and ultrasound ordering.
 *
 * Score interpretation:
 * - ≤0: Low probability (~5% DVT prevalence)
 * - 1-2: Moderate probability (~17% prevalence)
 * - ≥3: High probability (~53% prevalence)
 */

import React, { useState } from 'react';
import { CalculatorHeader, CheckboxCriteria, ResultDisplay, ResetButton } from '../shared';
import type { CalculatorProps, CalculatorResult, CriteriaItem } from '../types';
import { calculateWellsDVT } from '@/lib/calculators';

export const WellsDVTCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [activeCA, setActiveCA] = useState(false);
  const [paralysis, setParalysis] = useState(false);
  const [bedridden, setBedridden] = useState(false);
  const [tenderness, setTenderness] = useState(false);
  const [entireLegSwollen, setEntireLegSwollen] = useState(false);
  const [calfSwelling, setCalfSwelling] = useState(false);
  const [pittingEdema, setPittingEdema] = useState(false);
  const [collateralVeins, setCollateralVeins] = useState(false);
  const [previousDVT, setPreviousDVT] = useState(false);
  const [alternativeDiagnosis, setAlternativeDiagnosis] = useState(false);

  const score = calculateWellsDVT({
    activeCA,
    paralysis,
    bedridden,
    tenderness,
    entireLegSwollen,
    calfSwelling,
    pittingEdema,
    collateralVeins,
    previousDVT,
    alternativeDiagnosis,
  });

  const getInterpretation = (): CalculatorResult => {
    if (score <= 0) {
      return {
        score,
        interpretation: 'Low Probability',
        recommendation:
          'D-dimer recommended. If negative, DVT excluded. If positive, obtain compression ultrasound.',
        riskLevel: 'low',
        details:
          'DVT prevalence ~5%. Negative D-dimer safely rules out DVT without need for imaging.',
      };
    } else if (score <= 2) {
      return {
        score,
        interpretation: 'Moderate Probability',
        recommendation:
          'D-dimer or compression ultrasound. Consider clinical judgment and patient risk factors.',
        riskLevel: 'moderate',
        details:
          'DVT prevalence ~17%. D-dimer may still be useful, but lower threshold for imaging.',
      };
    } else {
      return {
        score,
        interpretation: 'High Probability',
        recommendation:
          'Compression ultrasound recommended. Consider empiric anticoagulation pending results if high clinical suspicion.',
        riskLevel: 'high',
        details: 'DVT prevalence ~53%. Skip D-dimer and proceed directly to imaging.',
      };
    }
  };

  const criteria: CriteriaItem[] = [
    {
      state: activeCA,
      setState: setActiveCA,
      title: 'Active Cancer (+1)',
      description: 'Treatment within 6 months or palliative care',
      points: 1,
    },
    {
      state: paralysis,
      setState: setParalysis,
      title: 'Paralysis/Paresis (+1)',
      description: 'Recent immobilization of lower extremity',
      points: 1,
    },
    {
      state: bedridden,
      setState: setBedridden,
      title: 'Bedridden >3 Days (+1)',
      description: 'Or major surgery within 12 weeks requiring anesthesia',
      points: 1,
    },
    {
      state: tenderness,
      setState: setTenderness,
      title: 'Localized Tenderness (+1)',
      description: 'Along distribution of deep venous system',
      points: 1,
    },
    {
      state: entireLegSwollen,
      setState: setEntireLegSwollen,
      title: 'Entire Leg Swollen (+1)',
      description: 'Unilateral swelling of entire leg',
      points: 1,
    },
    {
      state: calfSwelling,
      setState: setCalfSwelling,
      title: 'Calf Swelling >3cm (+1)',
      description: 'Measured 10cm below tibial tuberosity, compared to asymptomatic leg',
      points: 1,
    },
    {
      state: pittingEdema,
      setState: setPittingEdema,
      title: 'Pitting Edema (+1)',
      description: 'Greater in symptomatic leg',
      points: 1,
    },
    {
      state: collateralVeins,
      setState: setCollateralVeins,
      title: 'Collateral Superficial Veins (+1)',
      description: 'Non-varicose, unilateral',
      points: 1,
    },
    {
      state: previousDVT,
      setState: setPreviousDVT,
      title: 'Previous DVT (+1)',
      description: 'Documented history of prior DVT',
      points: 1,
    },
    {
      state: alternativeDiagnosis,
      setState: setAlternativeDiagnosis,
      title: 'Alternative Diagnosis (−2)',
      description: 'Alternative diagnosis at least as likely as DVT',
      points: -2,
    },
  ];

  const result = getInterpretation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <CalculatorHeader
          title="Wells' DVT Criteria"
          subtitle="Deep Vein Thrombosis Probability"
          onBack={onBack}
        />
        <ResetButton onReset={() => {
          setActiveCA(false);
          setParalysis(false);
          setBedridden(false);
          setTenderness(false);
          setEntireLegSwollen(false);
          setCalfSwelling(false);
          setPittingEdema(false);
          setCollateralVeins(false);
          setPreviousDVT(false);
          setAlternativeDiagnosis(false);
        }} />
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
        <CheckboxCriteria items={criteria} />
      </div>

      <ResultDisplay result={result} showRiskBar />
    </div>
  );
};

export default WellsDVTCalculator;
