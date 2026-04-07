/**
 * Tooltip Zustand Store
 *
 * Replaces TooltipContext with a Zustand atom store.
 * No Provider wrapper needed — components import the hook directly.
 *
 * Phase 3 migration: contexts/TooltipContext.tsx → lib/stores/useTooltipStore.ts
 *
 * Usage:
 *   import { useTooltipStore } from '@/lib/stores/useTooltipStore';
 *
 *   const { tooltipState, showTooltip, hideTooltip, registerTerm } = useTooltipStore();
 */

import { create } from 'zustand';

// ─── Medical term types ────────────────────────────────────────────────────

export interface MedicalTermDefinition {
  term: string;
  definition: string;
  category?: 'lab' | 'symptom' | 'treatment' | 'condition' | 'pharmacology';
}

// ─── Built-in medical terms dictionary ─────────────────────────────────────

export const MEDICAL_TERMS: Record<string, MedicalTermDefinition> = {
  'anion gap': {
    term: 'Anion Gap',
    definition:
      'Difference between measured cations and anions in serum, used to classify metabolic acidosis.',
    category: 'lab',
  },
  tachyphylaxis: {
    term: 'Tachyphylaxis',
    definition: 'Rapid decrease in response to a drug after repeated administration.',
    category: 'pharmacology',
  },
  troponin: {
    term: 'Troponin',
    definition: 'Cardiac biomarker released during myocardial injury, highly specific for MI.',
    category: 'lab',
  },
  fena: {
    term: 'FENa',
    definition: 'Fractional Excretion of Sodium; distinguishes pre-renal from intrinsic AKI.',
    category: 'lab',
  },
  orthopnea: {
    term: 'Orthopnea',
    definition: 'Shortness of breath when lying flat, classic symptom of heart failure.',
    category: 'symptom',
  },
  jaundice: {
    term: 'Jaundice',
    definition: 'Yellow discoloration of skin/sclera due to elevated bilirubin.',
    category: 'symptom',
  },
  cyanosis: {
    term: 'Cyanosis',
    definition: 'Bluish discoloration of skin/mucosa due to deoxygenated hemoglobin.',
    category: 'symptom',
  },
  'first-line': {
    term: 'First-Line Treatment',
    definition: 'Initial therapy recommended based on guidelines and evidence.',
    category: 'treatment',
  },
  empiric: {
    term: 'Empiric Therapy',
    definition: 'Treatment initiated before causative organism is identified.',
    category: 'treatment',
  },
  stemi: {
    term: 'STEMI',
    definition:
      'ST-Elevation Myocardial Infarction; transmural MI requiring immediate reperfusion.',
    category: 'condition',
  },
  nstemi: {
    term: 'NSTEMI',
    definition: 'Non-ST-Elevation Myocardial Infarction; partial thickness MI.',
    category: 'condition',
  },
  copd: {
    term: 'COPD',
    definition: 'Chronic Obstructive Pulmonary Disease; progressive airflow limitation.',
    category: 'condition',
  },
  mrsa: {
    term: 'MRSA',
    definition: 'Methicillin-Resistant Staphylococcus Aureus; requires vancomycin or linezolid.',
    category: 'condition',
  },
  'qt prolongation': {
    term: 'QT Prolongation',
    definition: 'Prolonged ventricular repolarization time, risk for torsades de pointes.',
    category: 'condition',
  },
  'beta-lactam': {
    term: 'Beta-Lactam',
    definition: 'Antibiotic class that inhibits cell wall synthesis (penicillins, cephalosporins).',
    category: 'pharmacology',
  },
};

// ─── Store ─────────────────────────────────────────────────────────────────

interface TooltipState {
  isVisible: boolean;
  term: string | null;
  definition: string | null;
  position: { x: number; y: number };
}

interface TooltipStore {
  tooltipState: TooltipState;
  customTerms: Record<string, MedicalTermDefinition>;
  showTooltip: (term: string, x: number, y: number) => void;
  hideTooltip: () => void;
  registerTerm: (term: string, definition: MedicalTermDefinition) => void;
}

export const useTooltipStore = create<TooltipStore>((set, get) => ({
  tooltipState: {
    isVisible: false,
    term: null,
    definition: null,
    position: { x: 0, y: 0 },
  },
  customTerms: {},

  showTooltip: (term, x, y) => {
    const normalizedTerm = term.toLowerCase();
    const termData = MEDICAL_TERMS[normalizedTerm] || get().customTerms[normalizedTerm];

    if (termData) {
      set({
        tooltipState: {
          isVisible: true,
          term: termData.term,
          definition: termData.definition,
          position: { x, y },
        },
      });
    }
  },

  hideTooltip: () =>
    set((state) => ({
      tooltipState: { ...state.tooltipState, isVisible: false },
    })),

  registerTerm: (term, definition) =>
    set((state) => ({
      customTerms: { ...state.customTerms, [term.toLowerCase()]: definition },
    })),
}));

/**
 * Backward-compatible hook alias.
 * Drop-in replacement for the old useTooltip() hook.
 */
export const useTooltip = useTooltipStore;
