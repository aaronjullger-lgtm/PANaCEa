/**
 * ABG Interpreter
 *
 * Rule-based arterial blood gas interpretation:
 * pH, pCO₂, HCO₃, PaO₂ → acidosis/alkalosis, metabolic/respiratory, compensation
 * Uses Winter's formula for metabolic acidosis compensation.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Beaker } from 'lucide-react';
import { CalculatorHeader, ClinicalInput } from '../calculators/shared';
import type { CalculatorProps } from '../calculators/types';

type Compensation = 'none' | 'partial' | 'full' | 'over';

interface ABGInterpretation {
  primaryDisorder: string;
  acidBaseStatus: 'acidosis' | 'alkalosis' | 'normal';
  metabolicOrRespiratory: 'metabolic' | 'respiratory' | 'mixed' | 'none';
  compensation: Compensation;
  compensationNote: string;
  wintersExpected?: number;
  oxygenStatus?: string;
  differential: string[];
  recommendation: string;
}

function interpretABG(
  pH: number,
  pCO2: number,
  hco3: number,
  pao2?: number
): ABGInterpretation | null {
  const isAcidosis = pH < 7.35;
  const isAlkalosis = pH > 7.45;
  if (!isAcidosis && !isAlkalosis) {
    return {
      primaryDisorder: 'Normal acid-base balance',
      acidBaseStatus: 'normal',
      metabolicOrRespiratory: 'none',
      compensation: 'none',
      compensationNote: 'pH within normal range (7.35–7.45).',
      differential: [],
      recommendation: 'No acid-base disturbance. Consider clinical context.',
    };
  }

  const lowPCO2 = pCO2 < 35;
  const highPCO2 = pCO2 > 45;
  const lowHCO3 = hco3 < 22;
  const highHCO3 = hco3 > 26;

  let primary: 'metabolic' | 'respiratory';
  let differential: string[] = [];
  let compensation: Compensation = 'none';
  let compensationNote = '';

  if (isAcidosis) {
    if (highPCO2 && !lowHCO3) {
      primary = 'respiratory';
      differential = [
        'COPD exacerbation',
        'Opioid/sedative overdose',
        'Neuromuscular weakness',
        'Severe asthma',
        'Chest wall deformity',
      ];
      const expectedHCO3Acute = 24 + (pCO2 - 40) * 0.1;
      const expectedHCO3Chronic = 24 + (pCO2 - 40) * 0.4;
      if (hco3 < expectedHCO3Acute - 2) compensation = 'none';
      else if (Math.abs(hco3 - expectedHCO3Chronic) < 3) compensation = 'full';
      else compensation = 'partial';
      compensationNote =
        compensation === 'full'
          ? 'Chronic compensation present.'
          : compensation === 'partial'
            ? 'Partial renal compensation.'
            : 'Acute respiratory acidosis; compensation incomplete.';
    } else if (lowHCO3) {
      primary = 'metabolic';
      differential = [
        'DKA',
        'Lactic acidosis (sepsis, shock)',
        'Renal failure',
        'Toxic ingestions (methanol, ethylene glycol)',
        'Diarrhea',
        'RTA',
      ];
      const wintersExpected = 1.5 * hco3 + 8;
      const wintersMin = wintersExpected - 2;
      const wintersMax = wintersExpected + 2;
      if (pCO2 > wintersMax) {
        compensation = 'none';
        compensationNote = `Expected pCO₂ ${wintersMin.toFixed(0)}–${wintersMax.toFixed(0)} (Winter's). Concurrent respiratory acidosis.`;
      } else if (pCO2 >= wintersMin && pCO2 <= wintersMax) {
        compensation = 'full';
        compensationNote = `Expected pCO₂ ≈ ${wintersExpected.toFixed(0)} mmHg (Winter's formula). Appropriate respiratory compensation.`;
      } else if (pCO2 < wintersMin) {
        compensation = 'over';
        compensationNote = `Expected pCO₂ ${wintersMin.toFixed(0)}–${wintersMax.toFixed(0)}. Concurrent respiratory alkalosis (overcompensation).`;
      } else {
        compensation = 'partial';
        compensationNote = 'Compensation in progress.';
      }

      return {
        primaryDisorder: 'Metabolic Acidosis',
        acidBaseStatus: 'acidosis',
        metabolicOrRespiratory: pCO2 > wintersMax ? 'mixed' : 'metabolic',
        compensation,
        compensationNote,
        wintersExpected: Math.round(wintersExpected),
        oxygenStatus: pao2 !== undefined && pao2 < 80 ? 'Hypoxemia present' : undefined,
        differential,
        recommendation:
          'Evaluate MUDPILES if elevated anion gap. Check lactate, ketones, osmolar gap. Address underlying cause.',
      };
    } else {
      primary = 'respiratory';
      compensationNote = 'Acidosis with borderline values; re-check or consider mixed disorder.';
    }
  } else {
    if (lowPCO2 && !highHCO3) {
      primary = 'respiratory';
      differential = [
        'Anxiety / hyperventilation',
        'PE',
        'Pneumonia',
        'Pregnancy',
        'Salicylate toxicity',
        'Liver failure',
      ];
      const expectedHCO3 = 24 - (40 - pCO2) * 0.2;
      if (Math.abs(hco3 - expectedHCO3) < 3) compensation = 'full';
      else if (hco3 > 22) compensation = 'partial';
      compensationNote =
        compensation === 'full'
          ? 'Appropriate renal compensation.'
          : 'Acute respiratory alkalosis.';
    } else if (highHCO3) {
      primary = 'metabolic';
      differential = [
        'Vomiting / NG suction',
        'Diuretic use',
        'Hypokalemia',
        'Contraction alkalosis',
        'Mineralocorticoid excess',
      ];
      const expectedPCO2 = 0.7 * hco3 + 20;
      const expectedMin = expectedPCO2 - 2;
      const expectedMax = expectedPCO2 + 2;
      if (pCO2 >= expectedMin && pCO2 <= expectedMax) {
        compensation = 'full';
        compensationNote = `Expected pCO₂ ≈ ${expectedPCO2.toFixed(0)} mmHg. Appropriate hypoventilation.`;
      } else if (pCO2 > expectedMax) {
        compensation = 'none';
        compensationNote = 'Concurrent respiratory acidosis.';
      } else {
        compensation = 'over';
        compensationNote = 'Concurrent respiratory alkalosis.';
      }

      return {
        primaryDisorder: 'Metabolic Alkalosis',
        acidBaseStatus: 'alkalosis',
        metabolicOrRespiratory: 'metabolic',
        compensation,
        compensationNote,
        oxygenStatus: pao2 !== undefined && pao2 < 80 ? 'Hypoxemia present' : undefined,
        differential,
        recommendation:
          'Check urine chloride. Saline-responsive vs saline-resistant. Correct hypokalemia.',
      };
    } else {
      primary = 'respiratory';
      compensationNote = 'Alkalosis; assess for mixed disorder.';
    }
  }

  const disorderName =
    primary === 'respiratory'
      ? isAcidosis
        ? 'Respiratory Acidosis'
        : 'Respiratory Alkalosis'
      : isAcidosis
        ? 'Metabolic Acidosis'
        : 'Metabolic Alkalosis';

  return {
    primaryDisorder: disorderName,
    acidBaseStatus: isAcidosis ? 'acidosis' : 'alkalosis',
    metabolicOrRespiratory: primary,
    compensation,
    compensationNote,
    oxygenStatus: pao2 !== undefined && pao2 < 80 ? 'Hypoxemia present' : undefined,
    differential,
    recommendation:
      'Address underlying cause. Monitor electrolytes and repeat ABG as clinically indicated.',
  };
}

export const ABGInterpreter: React.FC<CalculatorProps> = ({ onBack }) => {
  const [pH, setPH] = useState('');
  const [pCO2, setPCO2] = useState('');
  const [hco3, setHCO3] = useState('');
  const [pao2, setPaO2] = useState('');

  const interpretation = useMemo(() => {
    const p = parseFloat(pH);
    const pc = parseFloat(pCO2);
    const h = parseFloat(hco3);
    const o2 = pao2 ? parseFloat(pao2) : undefined;
    if (!p || !pc || !h) return null;
    if (p < 6.8 || p > 7.8 || pc < 10 || pc > 100 || h < 5 || h > 50) return null;
    return interpretABG(p, pc, h, o2);
  }, [pH, pCO2, hco3, pao2]);

  const hasValidInput = pH && pCO2 && hco3;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="ABG Interpreter"
        subtitle="pH, pCO₂, HCO₃, PaO₂ → Acidosis/alkalosis, metabolic/respiratory, compensation"
        onBack={onBack}
      />

      <div className="bg-gradient-to-r from-[var(--color-bg-primary)]/40 to-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Beaker className="w-6 h-6 text-[var(--color-accent)]" />
          <div>
            <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
              Winter&apos;s formula (metabolic acidosis): Expected pCO₂ = 1.5 × HCO₃ + 8 ± 2
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Normal: pH 7.35–7.45 | pCO₂ 35–45 mmHg | HCO₃ 22–26 mEq/L | PaO₂ 80–100 mmHg
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ClinicalInput
            label="pH"
            value={pH}
            onChange={setPH}
            type="number"
            range="7.35–7.45"
            placeholder="7.40"
            min={6.8}
            max={7.8}
            step={0.01}
          />
          <ClinicalInput
            label="pCO₂"
            value={pCO2}
            onChange={setPCO2}
            type="number"
            unit="mmHg"
            range="35–45"
            placeholder="40"
            min={10}
            max={100}
          />
          <ClinicalInput
            label="HCO₃"
            value={hco3}
            onChange={setHCO3}
            type="number"
            unit="mEq/L"
            range="22–26"
            placeholder="24"
            min={5}
            max={50}
          />
          <ClinicalInput
            label="PaO₂ (optional)"
            value={pao2}
            onChange={setPaO2}
            type="number"
            unit="mmHg"
            range="80–100"
            placeholder="—"
            min={20}
            max={600}
          />
        </div>
      </div>

      <AnimatePresence>
        {hasValidInput && interpretation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div
              className={`rounded-2xl p-6 border-2 ${
                interpretation.acidBaseStatus === 'normal'
                  ? 'bg-emerald-950/40 border-emerald-700'
                  : interpretation.acidBaseStatus === 'acidosis'
                    ? 'bg-red-950/40 border-red-700'
                    : 'bg-cyan-950/40 border-cyan-700'
              }`}
            >
              <div className="flex items-start gap-4">
                <Activity
                  className={`w-10 h-10 flex-shrink-0 ${
                    interpretation.acidBaseStatus === 'normal'
                      ? 'text-emerald-400'
                      : interpretation.acidBaseStatus === 'acidosis'
                        ? 'text-red-400'
                        : 'text-cyan-400'
                  }`}
                />
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                    {interpretation.primaryDisorder}
                  </h3>
                  <p className="text-[var(--color-text-secondary)]">
                    {interpretation.compensationNote}
                  </p>
                  {interpretation.wintersExpected && (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Winter&apos;s expected pCO₂: {interpretation.wintersExpected} mmHg
                    </p>
                  )}
                  {interpretation.oxygenStatus && (
                    <p className="text-sm text-amber-400 font-medium">
                      {interpretation.oxygenStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {interpretation.differential.length > 0 && (
              <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6">
                <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Differential
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                  {interpretation.differential.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4">
              <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Recommendation
              </h4>
              <p className="text-[var(--color-text-primary)]">{interpretation.recommendation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ABGInterpreter;
