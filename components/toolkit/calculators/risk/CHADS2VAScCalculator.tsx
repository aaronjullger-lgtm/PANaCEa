/**
 * CHA₂DS₂-VASc Calculator
 *
 * Stroke risk stratification in patients with atrial fibrillation.
 * Guides anticoagulation therapy decision-making.
 *
 * Score interpretation:
 * - 0: Low risk (no anticoagulation, consider aspirin or nothing)
 * - 1: Low-moderate risk (consider anticoagulation vs aspirin)
 * - ≥2: Moderate-high risk (oral anticoagulation recommended)
 */

import React, { useState } from 'react';
import { CalculatorHeader, CheckboxCriteria, ResultDisplay, ResetButton, CopyResultButton } from '../shared';
import type { CalculatorProps, CalculatorResult, CriteriaItem } from '../types';
import { calculateCHADS2VASc } from '@/lib/calculators';

export const CHADS2VAScCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [chf, setChf] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [age75, setAge75] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [vascular, setVascular] = useState(false);
  const [age65, setAge65] = useState(false);
  const [female, setFemale] = useState(false);

  const score = calculateCHADS2VASc({
    chf,
    hypertension,
    age75,
    diabetes,
    stroke,
    vascular,
    age65,
    female,
  });

  const getInterpretation = (): CalculatorResult => {
    const annualStrokeRisk =
      score === 0
        ? 0
        : score === 1
          ? 1.3
          : score === 2
            ? 2.2
            : score === 3
              ? 3.2
              : score === 4
                ? 4.0
                : score === 5
                  ? 6.7
                  : score === 6
                    ? 9.8
                    : score === 7
                      ? 9.6
                      : score === 8
                        ? 12.5
                        : 15.2;

    if (score === 0) {
      return {
        score,
        interpretation: 'Low Risk',
        recommendation: 'No anticoagulation recommended. Consider no therapy or aspirin.',
        riskLevel: 'low',
        details: `Annual stroke risk: ${annualStrokeRisk}%. Aspirin provides minimal benefit with bleeding risk. Most guidelines recommend no antithrombotic therapy.`,
      };
    } else if (score === 1) {
      return {
        score,
        interpretation: 'Low-Moderate Risk',
        recommendation:
          'Consider oral anticoagulation (preferred) or aspirin based on shared decision-making.',
        riskLevel: 'moderate',
        details: `Annual stroke risk: ${annualStrokeRisk}%. Current guidelines favor anticoagulation over aspirin, but patient preferences and bleeding risk should be considered.`,
      };
    } else {
      return {
        score,
        interpretation: 'Moderate-High Risk',
        recommendation:
          'Oral anticoagulation recommended (warfarin or DOAC such as apixaban, rivaroxaban, edoxaban, dabigatran).',
        riskLevel: 'high',
        details: `Annual stroke risk: ${annualStrokeRisk}%. DOACs are preferred over warfarin for most patients due to lower bleeding risk and no need for INR monitoring.`,
      };
    }
  };

  const criteria: CriteriaItem[] = [
    {
      state: chf,
      setState: setChf,
      title: 'CHF / LV Dysfunction (+1)',
      description: 'Congestive heart failure history or LVEF <40%',
      points: 1,
    },
    {
      state: hypertension,
      setState: setHypertension,
      title: 'Hypertension (+1)',
      description: 'History of hypertension or currently treated',
      points: 1,
    },
    {
      state: age75,
      setState: setAge75,
      title: 'Age ≥75 (+2)',
      description: 'Age 75 years or older',
      points: 2,
    },
    {
      state: diabetes,
      setState: setDiabetes,
      title: 'Diabetes (+1)',
      description: 'Diabetes mellitus',
      points: 1,
    },
    {
      state: stroke,
      setState: setStroke,
      title: 'Stroke/TIA/Thromboembolism (+2)',
      description: 'Prior stroke, TIA, or systemic embolism',
      points: 2,
    },
    {
      state: vascular,
      setState: setVascular,
      title: 'Vascular Disease (+1)',
      description: 'Prior MI, peripheral arterial disease, or aortic plaque',
      points: 1,
    },
    {
      state: age65,
      setState: setAge65,
      title: 'Age 65-74 (+1)',
      description: 'Age between 65 and 74 years',
      points: 1,
      disabled: age75,
    },
    {
      state: female,
      setState: setFemale,
      title: 'Female Sex (+1)',
      description: 'Female gender',
      points: 1,
    },
  ];

  const result = getInterpretation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <CalculatorHeader
          title="CHA₂DS₂-VASc Score"
          subtitle="Stroke Risk in Atrial Fibrillation"
          onBack={onBack}
        />
        <div className="flex gap-2">
          <ResetButton onReset={() => { setChf(false); setHypertension(false); setAge75(false); setDiabetes(false); setStroke(false); setVascular(false); setAge65(false); setFemale(false); }} />
          {result && (
            <CopyResultButton
              getText={() =>
                `CHA2DS2-VASc Score\nScore: ${result.score}\n${result.interpretation}\n${result.recommendation}`
              }
            />
          )}
        </div>
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
        <CheckboxCriteria items={criteria} />
      </div>

      <ResultDisplay result={result} showRiskBar />
    </div>
  );
};

export default CHADS2VAScCalculator;
