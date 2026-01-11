/**
 * GFR Calculator (MDRD Equation)
 * 
 * Estimates glomerular filtration rate for chronic kidney disease staging.
 * Uses the MDRD (Modification of Diet in Renal Disease) equation.
 * 
 * CKD Stages:
 * - Stage 1: ≥90 (normal/high with kidney damage)
 * - Stage 2: 60-89 (mild reduction with kidney damage)
 * - Stage 3a: 45-59 (mild-moderate reduction)
 * - Stage 3b: 30-44 (moderate-severe reduction)
 * - Stage 4: 15-29 (severe reduction)
 * - Stage 5: <15 (kidney failure)
 */

import React, { useState } from 'react';
import { CalculatorHeader, ClinicalInput, ResultDisplay } from '../shared';
import type { CalculatorProps, CalculatorResult } from '../types';

export const GFRCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [race, setRace] = useState<'black' | 'other'>('other');
  const [creatinine, setCreatinine] = useState('');

  const calculateGFR = (): number | null => {
    const ageNum = parseFloat(age);
    const crNum = parseFloat(creatinine);

    if (!ageNum || !crNum || ageNum <= 0 || crNum <= 0) return null;

    // MDRD equation: 175 × (Cr)^-1.154 × (Age)^-0.203 × [0.742 if female] × [1.212 if Black]
    let gfr = 175 * Math.pow(crNum, -1.154) * Math.pow(ageNum, -0.203);

    if (sex === 'female') gfr *= 0.742;
    if (race === 'black') gfr *= 1.212;

    return Math.round(gfr);
  };

  const gfr = calculateGFR();

  const getInterpretation = (gfr: number): CalculatorResult => {
    let stage: string;
    let interpretation: string;
    let recommendation: string;
    let riskLevel: 'low' | 'moderate' | 'high';

    if (gfr >= 90) {
      stage = 'Stage 1';
      interpretation = 'Normal or High (with kidney damage markers)';
      recommendation = 'Normal kidney function. If proteinuria or structural abnormalities present, monitor annually.';
      riskLevel = 'low';
    } else if (gfr >= 60) {
      stage = 'Stage 2';
      interpretation = 'Mild Reduction (with kidney damage markers)';
      recommendation = 'Mildly reduced GFR. Monitor annually. Address cardiovascular risk factors.';
      riskLevel = 'low';
    } else if (gfr >= 45) {
      stage = 'Stage 3a';
      interpretation = 'Mild to Moderate Reduction';
      recommendation = 'Evaluate and treat complications. Monitor every 6-12 months. Nephrology referral if rapid decline.';
      riskLevel = 'moderate';
    } else if (gfr >= 30) {
      stage = 'Stage 3b';
      interpretation = 'Moderate to Severe Reduction';
      recommendation = 'Nephrology referral recommended. Monitor every 3-6 months. Prepare for renal replacement therapy.';
      riskLevel = 'moderate';
    } else if (gfr >= 15) {
      stage = 'Stage 4';
      interpretation = 'Severe Reduction';
      recommendation = 'Nephrology co-management required. Prepare for dialysis or transplant. Monitor monthly.';
      riskLevel = 'high';
    } else {
      stage = 'Stage 5';
      interpretation = 'Kidney Failure';
      recommendation = 'Renal replacement therapy (dialysis or transplant) required. Immediate nephrology referral.';
      riskLevel = 'high';
    }

    return {
      score: `${gfr}`,
      interpretation: `${stage}: ${interpretation}`,
      recommendation,
      riskLevel,
      details: `eGFR: ${gfr} mL/min/1.73m². Consider CKD-EPI equation for improved accuracy in certain populations.`,
    };
  };

  const result = gfr !== null ? getInterpretation(gfr) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="GFR Calculator (MDRD)"
        subtitle="Glomerular Filtration Rate Estimation"
        onBack={onBack}
      />

      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 space-y-6">
        <ClinicalInput
          label="Age"
          unit="years"
          value={age}
          onChange={setAge}
          type="number"
          placeholder="Enter age"
          min={1}
          max={120}
        />

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">Sex</label>
          <div className="flex gap-4">
            {(['male', 'female'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sex === s}
                  onChange={() => setSex(s)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600"
                />
                <span className="capitalize text-slate-200">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">Race</label>
          <div className="flex gap-4">
            {([
              { value: 'black', label: 'Black/African American' },
              { value: 'other', label: 'Other' },
            ] as const).map((r) => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={race === r.value}
                  onChange={() => setRace(r.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600"
                />
                <span className="text-slate-200">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <ClinicalInput
          label="Serum Creatinine"
          unit="mg/dL"
          value={creatinine}
          onChange={setCreatinine}
          type="number"
          placeholder="Enter creatinine"
          range="0.6-1.2"
          step={0.01}
        />
      </div>

      {result && <ResultDisplay result={result} showRiskBar />}
    </div>
  );
};

export default GFRCalculator;
