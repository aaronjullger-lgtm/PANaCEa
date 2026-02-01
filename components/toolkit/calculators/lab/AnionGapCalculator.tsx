/**
 * Anion Gap Calculator
 *
 * Calculates serum anion gap for metabolic acidosis assessment.
 * Formula: AG = Na⁺ − (Cl⁻ + HCO₃⁻)
 *
 * Optional albumin correction: Corrected AG = AG + 2.5 × (4 − albumin)
 *
 * Interpretation:
 * - <3: Low AG (hypoalbuminemia, lab error)
 * - 8-12: Normal AG
 * - >12: Elevated AG (MUDPILES differential)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker } from 'lucide-react';
import { CalculatorHeader, ClinicalInput, ResultDisplay } from '../shared';
import type { CalculatorProps, CalculatorResult } from '../types';

export const AnionGapCalculator: React.FC<CalculatorProps> = ({ onBack }) => {
  const [sodium, setSodium] = useState('');
  const [chloride, setChloride] = useState('');
  const [bicarb, setBicarb] = useState('');
  const [albumin, setAlbumin] = useState('');

  const calculateAnionGap = (): number | null => {
    const na = parseFloat(sodium);
    const cl = parseFloat(chloride);
    const hco3 = parseFloat(bicarb);

    if (!na || !cl || !hco3) return null;
    return Math.round(na - cl - hco3);
  };

  const calculateCorrectedAG = (ag: number): number | null => {
    const alb = parseFloat(albumin);
    if (!alb) return null;
    // Corrected AG = AG + 2.5 × (4 − albumin)
    return Math.round(ag + 2.5 * (4 - alb));
  };

  const ag = calculateAnionGap();
  const correctedAG = ag !== null ? calculateCorrectedAG(ag) : null;
  const displayAG = correctedAG ?? ag;

  const getInterpretation = (gap: number | null): CalculatorResult | null => {
    if (gap === null) return null;

    if (gap < 3) {
      return {
        score: gap,
        interpretation: 'Low Anion Gap',
        recommendation:
          'Consider hypoalbuminemia, hypercalcemia, hypermag nesemia, lithium toxicity, or lab error.',
        riskLevel: 'low',
        details: 'Low AG is uncommon. Verify lab values and consider repeat testing.',
      };
    } else if (gap <= 12) {
      return {
        score: gap,
        interpretation: 'Normal Anion Gap',
        recommendation: 'No metabolic acidosis or normal AG acidosis (non-AG metabolic acidosis).',
        riskLevel: 'low',
        details:
          'Normal range: 8-12 mEq/L. If acidotic with normal AG, consider diarrhea, RTA, or early kidney disease.',
      };
    } else if (gap <= 20) {
      return {
        score: gap,
        interpretation: 'Elevated Anion Gap',
        recommendation:
          'Evaluate for MUDPILES causes (methanol, uremia, DKA, propylene glycol, INH/iron, lactic acidosis, ethylene glycol, salicylates).',
        riskLevel: 'moderate',
        details:
          'Mild elevation (12-20). Consider lactic acidosis (most common) or early ketoacidosis.',
      };
    } else {
      return {
        score: gap,
        interpretation: 'Significantly Elevated',
        recommendation:
          'High AG metabolic acidosis. Urgent workup for MUDPILES causes. Check lactate, ketones, osmolar gap, and toxicology screen.',
        riskLevel: 'high',
        details:
          'Severe elevation (>20). Common causes: severe DKA, uremia, lactic acidosis (sepsis/shock), toxic alcohols.',
      };
    }
  };

  const result = getInterpretation(displayAG);

  // MUDPILES Differential
  const mudpiles = [
    { letter: 'M', cause: 'Methanol', details: 'Osmolar gap, visual changes' },
    { letter: 'U', cause: 'Uremia', details: 'Elevated BUN/Cr, ESRD' },
    { letter: 'D', cause: 'DKA', details: 'Hyperglycemia, ketones' },
    { letter: 'P', cause: 'Propylene glycol', details: 'IV lorazepam, phenobarbital' },
    { letter: 'I', cause: 'Iron / INH', details: 'Overdose, isoniazid toxicity' },
    { letter: 'L', cause: 'Lactic acidosis', details: 'Shock, sepsis, metformin' },
    { letter: 'E', cause: 'Ethylene glycol', details: 'Osmolar gap, oxalate crystals' },
    { letter: 'S', cause: 'Salicylates', details: 'Mixed respiratory alk + metabolic acidosis' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Anion Gap Calculator"
        subtitle="Metabolic Acidosis Assessment"
        onBack={onBack}
      />

      {/* Formula Display */}
      <div className="bg-gradient-to-r from-[var(--color-bg-primary)]/40 to-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Beaker className="w-6 h-6 text-[var(--color-accent)]" />
          <div>
            <div className="font-mono text-lg font-semibold text-slate-200">
              AG = Na⁺ − (Cl⁻ + HCO₃⁻)
            </div>
            <div className="text-sm text-slate-300 mt-1">Normal range: 8-12 mEq/L</div>
          </div>
        </div>
      </div>

      {/* Input Fields */}
      <div className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ClinicalInput
            label="Sodium (Na⁺)"
            value={sodium}
            onChange={setSodium}
            type="number"
            unit="mEq/L"
            range="135-145"
            placeholder="Enter Na⁺"
            step={0.1}
          />
          <ClinicalInput
            label="Chloride (Cl⁻)"
            value={chloride}
            onChange={setChloride}
            type="number"
            unit="mEq/L"
            range="95-105"
            placeholder="Enter Cl⁻"
            step={0.1}
          />
          <ClinicalInput
            label="Bicarbonate (HCO₃⁻)"
            value={bicarb}
            onChange={setBicarb}
            type="number"
            unit="mEq/L"
            range="22-28"
            placeholder="Enter HCO₃⁻"
            step={0.1}
          />
          <ClinicalInput
            label="Albumin (optional)"
            sublabel="For corrected anion gap"
            value={albumin}
            onChange={setAlbumin}
            type="number"
            unit="g/dL"
            range="3.5-5.0"
            placeholder="Enter albumin"
            step={0.1}
          />
        </div>

        {correctedAG && ag && correctedAG !== ag && (
          <div className="p-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)] rounded-lg">
            <p className="text-sm text-[var(--color-text-primary)]">
              <strong>Albumin-corrected:</strong> Uncorrected AG = {ag}, Corrected AG ={' '}
              {correctedAG}
            </p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && <ResultDisplay result={result} showRiskBar />}

      {/* MUDPILES Differential */}
      <AnimatePresence>
        {displayAG && displayAG > 12 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] rounded-2xl p-6"
          >
            <h3
              className="text-xl font-bold text-[var(--color-text-primary)] mb-4"
              style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
            >
              MUDPILES Differential
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mudpiles.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-[var(--color-bg-secondary)]/50 rounded-lg border border-[var(--color-border)]"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-[var(--color-accent)] text-white font-bold rounded-lg flex-shrink-0">
                    {item.letter}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--color-text-primary)]">
                      {item.cause}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{item.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnionGapCalculator;
