/**
 * Ventilator Hero Simulator Data
 * High-fidelity ventilator management cases
 */

import type { VentilatorCase, VentilatorSettings, VentilatorAttempt } from '@/types/drill-modes';

export const VENTILATOR_CASES: VentilatorCase[] = [
  {
    id: 'ards-moderate',
    title: 'Moderate ARDS',
    patientInfo: 'A 45-year-old with bilateral pneumonia. CXR shows diffuse infiltrates. PaO2/FiO2 ratio = 120.',
    initialLabs: {
      ph: 7.28,
      pco2: 52,
      po2: 65,
      hco3: 24,
      lactate: 2.1,
    },
    currentSettings: {
      tidalVolume: 500,
      respiratoryRate: 12,
      peep: 5,
      fio2: 60,
    },
    targetGoals: {
      ph: { min: 7.35, max: 7.45 },
      po2: { min: 60, max: 80 },
      pco2: { min: 35, max: 45 },
    },
    condition: 'ards',
    explanation: 'ARDS requires lung-protective ventilation: low tidal volumes (6ml/kg IBW), higher PEEP, and permissive hypercapnia if needed.',
    teachingPoints: [
      'Target tidal volume: 6 ml/kg ideal body weight (IBW)',
      'Higher PEEP (10-15) improves oxygenation in ARDS',
      'Increase FiO2 before increasing tidal volume',
      'Accept permissive hypercapnia (pH >7.20) to protect lungs',
      'Plateau pressure should be <30 cmH2O',
    ],
  },
  {
    id: 'copd-exacerbation',
    title: 'COPD Exacerbation',
    patientInfo: '68-year-old with severe COPD, increased dyspnea. Patient is a CO2 retainer at baseline.',
    initialLabs: {
      ph: 7.31,
      pco2: 68,
      po2: 55,
      hco3: 32,
    },
    currentSettings: {
      tidalVolume: 450,
      respiratoryRate: 16,
      peep: 8,
      fio2: 40,
    },
    targetGoals: {
      ph: { min: 7.32, max: 7.40 },
      po2: { min: 55, max: 65 },
      pco2: { min: 60, max: 70 },
    },
    condition: 'copd',
    explanation: 'COPD patients with chronic CO2 retention need careful ventilation to avoid respiratory alkalosis and allow their baseline hypercapnia.',
    teachingPoints: [
      'Lower minute ventilation to avoid "blowing off" their chronic CO2',
      'Use lower PEEP (5-8) to prevent auto-PEEP/breath stacking',
      'Target O2 sat 88-92% (avoid hyperoxia)',
      "Don't normalize CO2 - accept their baseline elevated PCO2",
      'Monitor for auto-PEEP with expiratory hold',
    ],
  },
  {
    id: 'severe-asthma',
    title: 'Status Asthmaticus',
    patientInfo: '22-year-old with severe asthma attack, not responding to bronchodilators.',
    initialLabs: {
      ph: 7.20,
      pco2: 58,
      po2: 68,
      hco3: 22,
    },
    currentSettings: {
      tidalVolume: 480,
      respiratoryRate: 18,
      peep: 6,
      fio2: 80,
    },
    targetGoals: {
      ph: { min: 7.30, max: 7.45 },
      po2: { min: 70, max: 90 },
      pco2: { min: 35, max: 50 },
    },
    condition: 'asthma',
    explanation: 'Severe asthma requires strategies to prevent auto-PEEP while maintaining adequate ventilation and oxygenation.',
    teachingPoints: [
      'Reduce respiratory rate to allow complete exhalation',
      'Use lower PEEP to avoid further air trapping',
      'Consider permissive hypercapnia',
      'Ensure adequate sedation/paralysis to prevent breath-stacking',
      'Monitor peak pressures and plateau pressures',
    ],
  },
  {
    id: 'pulmonary-edema',
    title: 'Cardiogenic Pulmonary Edema',
    patientInfo: '72-year-old with CHF, flash pulmonary edema. Rales bilaterally, elevated JVP.',
    initialLabs: {
      ph: 7.32,
      pco2: 48,
      po2: 58,
      hco3: 24,
    },
    currentSettings: {
      tidalVolume: 500,
      respiratoryRate: 14,
      peep: 5,
      fio2: 100,
    },
    targetGoals: {
      ph: { min: 7.35, max: 7.45 },
      po2: { min: 70, max: 90 },
      pco2: { min: 35, max: 45 },
    },
    condition: 'other',
    explanation: 'Cardiogenic pulmonary edema benefits from higher PEEP to recruit collapsed alveoli and improve oxygenation.',
    teachingPoints: [
      'Increase PEEP (10-15) to recruit fluid-filled alveoli',
      'Higher PEEP also reduces preload (helpful in fluid overload)',
      'High FiO2 initially, then wean as oxygenation improves',
      'Consider diuresis and afterload reduction',
      'Watch for improvement as medical management works',
    ],
  },
];

/**
 * Evaluate ventilator settings and provide feedback
 */
export function evaluateVentilatorSettings(
  caseData: VentilatorCase,
  newSettings: VentilatorSettings
): VentilatorAttempt['outcome'] {
  const { condition, targetGoals } = caseData;
  
  // Simplified physiologic model
  let newPo2 = caseData.initialLabs.po2;
  let newPco2 = caseData.initialLabs.pco2;
  let newPh = caseData.initialLabs.ph;
  
  // FiO2 affects PO2
  const fio2Change = newSettings.fio2 - caseData.currentSettings.fio2;
  newPo2 += fio2Change * 0.3; // Simplified: 1% FiO2 ≈ 0.3 mmHg PO2
  
  // PEEP affects PO2
  const peepChange = newSettings.peep - caseData.currentSettings.peep;
  newPo2 += peepChange * 2; // PEEP recruitment effect
  
  // Minute ventilation (TV × RR) affects PCO2
  const oldMV = caseData.currentSettings.tidalVolume * caseData.currentSettings.respiratoryRate;
  const newMV = newSettings.tidalVolume * newSettings.respiratoryRate;
  const mvRatio = newMV / oldMV;
  newPco2 = newPco2 / mvRatio; // Inverse relationship
  
  // Calculate pH from CO2 (Henderson-Hasselbalch approximation)
  const pco2Change = newPco2 - caseData.initialLabs.pco2;
  newPh = caseData.initialLabs.ph - (pco2Change * 0.008); // Simplified
  
  // Check against targets
  const poSuccess = targetGoals.po2 
    ? newPo2 >= targetGoals.po2.min && newPo2 <= targetGoals.po2.max
    : true;
  const pcoSuccess = targetGoals.pco2
    ? newPco2 >= targetGoals.pco2.min && newPco2 <= targetGoals.pco2.max
    : true;
  const phSuccess = targetGoals.ph
    ? newPh >= targetGoals.ph.min && newPh <= targetGoals.ph.max
    : true;
    
  const success = poSuccess && pcoSuccess && phSuccess;
  
  // Generate feedback
  let feedback = '';
  
  if (!success) {
    const issues: string[] = [];
    
    if (!poSuccess) {
      if (newPo2 < (targetGoals.po2?.min || 0)) {
        issues.push('Hypoxemia persists. Consider increasing FiO2 or PEEP.');
      } else {
        issues.push('Hyperoxia - reduce FiO2.');
      }
    }
    
    if (!pcoSuccess) {
      if (newPco2 > (targetGoals.pco2?.max || 100)) {
        issues.push('Hypercapnia - increase minute ventilation (RR or TV).');
      } else {
        issues.push('Hypocapnia - reduce minute ventilation.');
      }
    }
    
    if (!phSuccess) {
      if (newPh < (targetGoals.ph?.min || 7.35)) {
        issues.push('Acidosis - correct underlying cause (ventilation or metabolic).');
      } else {
        issues.push('Alkalosis - reduce ventilation.');
      }
    }
    
    // Condition-specific feedback
    if (condition === 'ards') {
      if (newSettings.tidalVolume > 450) {
        issues.push('⚠️ Tidal volume too high for ARDS! Risk of barotrauma. Use 6ml/kg IBW.');
      }
      if (newSettings.peep < 10) {
        issues.push('PEEP likely too low for ARDS. Consider 10-15 cmH2O.');
      }
    }
    
    if (condition === 'copd') {
      if (newSettings.peep > 8) {
        issues.push('⚠️ High PEEP in COPD can worsen auto-PEEP. Keep PEEP 5-8.');
      }
      const newMVHigh = newMV > oldMV * 1.2;
      if (newMVHigh) {
        issues.push('Minute ventilation too high - may cause respiratory alkalosis in COPD patient.');
      }
    }
    
    if (condition === 'asthma') {
      if (newSettings.respiratoryRate > 16) {
        issues.push('⚠️ RR too high - prevents complete exhalation, worsens air trapping.');
      }
      if (newSettings.peep > 8) {
        issues.push('PEEP too high for status asthmaticus - increases auto-PEEP.');
      }
    }
    
    feedback = issues.join(' ');
  } else {
    feedback = '✓ Excellent! Settings corrected the respiratory failure. Patient stabilizing.';
  }
  
  return {
    ph: Math.round(newPh * 100) / 100,
    pco2: Math.round(newPco2),
    po2: Math.round(newPo2),
    success,
    feedback,
  };
}

/**
 * Get a random ventilator case
 */
export function getRandomVentilatorCase(): VentilatorCase {
  const randomIndex = Math.floor(Math.random() * VENTILATOR_CASES.length);
  return VENTILATOR_CASES[randomIndex];
}
