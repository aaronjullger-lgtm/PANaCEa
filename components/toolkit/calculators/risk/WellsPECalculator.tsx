/**
 * Wells' PE Criteria Calculator
 * 
 * Estimates probability of pulmonary embolism (PE).
 * Helps guide D-dimer and CTPA ordering.
 * 
 * Score interpretation:
 * - <2: Low probability (~1.3% PE prevalence)
 * - 2-6: Moderate probability (~16% prevalence)
 * - >6: High probability (~41% prevalence)
 */

import React, { useState } from 'react';
import { CalculatorHeader, CheckboxCriteria, ResultDisplay } from '../shared';
import type { CalculatorProps, CalculatorResult, CriteriaItem } from '../types';

export const WellsPECalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [clinicalDVT, setClinicalDVT] = useState(false);
  const [peMoreLikely, setPeMoreLikely] = useState(false);
  const [tachycardia, setTachycardia] = useState(false);
  const [immobilization, setImmobilization] = useState(false);
  const [previousPE, setPreviousPE] = useState(false);
  const [hemoptysis, setHemoptysis] = useState(false);
  const [malignancy, setMalignancy] = useState(false);

  const score =
    (clinicalDVT ? 3 : 0) +
    (peMoreLikely ? 3 : 0) +
    (tachycardia ? 1.5 : 0) +
    (immobilization ? 1.5 : 0) +
    (previousPE ? 1.5 : 0) +
    (hemoptysis ? 1 : 0) +
    (malignancy ? 1 : 0);

  const getInterpretation = (): CalculatorResult => {
    if (score < 2) {
      return {
        score: score.toFixed(1),
        interpretation: 'Low Probability',
        recommendation: 'D-dimer recommended. If negative, PE excluded. If positive, obtain CTPA.',
        riskLevel: 'low',
        details: 'PE prevalence ~1.3%. Negative D-dimer safely rules out PE without need for imaging.',
      };
    } else if (score <= 6) {
      return {
        score: score.toFixed(1),
        interpretation: 'Moderate Probability',
        recommendation: 'D-dimer or CTPA. Consider clinical judgment, oxygen saturation, and patient stability.',
        riskLevel: 'moderate',
        details: 'PE prevalence ~16%. May use D-dimer or proceed directly to CTPA based on clinical context.',
      };
    } else {
      return {
        score: score.toFixed(1),
        interpretation: 'High Probability',
        recommendation: 'CTPA recommended. Consider empiric anticoagulation if imaging will be delayed.',
        riskLevel: 'high',
        details: 'PE prevalence ~41%. Skip D-dimer and proceed to definitive imaging. Consider hemodynamic status.',
      };
    }
  };

  const criteria: CriteriaItem[] = [
    {
      state: clinicalDVT,
      setState: setClinicalDVT,
      title: 'Clinical Signs/Symptoms of DVT (+3)',
      description: 'Leg swelling, tenderness along deep venous system',
      points: 3,
    },
    {
      state: peMoreLikely,
      setState: setPeMoreLikely,
      title: 'PE Most Likely Diagnosis (+3)',
      description: 'No alternative diagnosis more likely than PE',
      points: 3,
    },
    {
      state: tachycardia,
      setState: setTachycardia,
      title: 'Heart Rate >100 (+1.5)',
      description: 'Tachycardia',
      points: 1.5,
    },
    {
      state: immobilization,
      setState: setImmobilization,
      title: 'Immobilization/Surgery (+1.5)',
      description: '≥3 days bedridden or surgery in past 4 weeks',
      points: 1.5,
    },
    {
      state: previousPE,
      setState: setPreviousPE,
      title: 'Previous PE/DVT (+1.5)',
      description: 'History of prior thromboembolic disease',
      points: 1.5,
    },
    {
      state: hemoptysis,
      setState: setHemoptysis,
      title: 'Hemoptysis (+1)',
      description: 'Coughing up blood',
      points: 1,
    },
    {
      state: malignancy,
      setState: setMalignancy,
      title: 'Malignancy (+1)',
      description: 'Active cancer (treatment within 6 months or palliative)',
      points: 1,
    },
  ];

  const result = getInterpretation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Wells' PE Criteria"
        subtitle="Pulmonary Embolism Probability"
        onBack={onBack}
      />

      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
        <CheckboxCriteria items={criteria} />
      </div>

      <ResultDisplay result={result} showRiskBar />
    </div>
  );
};

export default WellsPECalculator;
