import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Medical terminology definitions for tooltip display
 */
export interface MedicalTermDefinition {
  term: string;
  definition: string;
  category?: 'lab' | 'symptom' | 'treatment' | 'condition' | 'pharmacology';
}

/**
 * Dictionary of medical terms and their definitions
 */
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

interface TooltipState {
  isVisible: boolean;
  term: string | null;
  definition: string | null;
  position: { x: number; y: number };
}

interface TooltipContextType {
  tooltipState: TooltipState;
  showTooltip: (term: string, x: number, y: number) => void;
  hideTooltip: () => void;
  registerTerm: (term: string, definition: MedicalTermDefinition) => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

/**
 * Custom hook to access tooltip context
 */
export function useTooltip(): TooltipContextType {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('useTooltip must be used within a TooltipProvider');
  }
  return context;
}

interface TooltipProviderProps {
  children: ReactNode;
}

/**
 * Tooltip Provider Component
 * Wraps the app to provide global tooltip functionality for medical terms
 */
export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    isVisible: false,
    term: null,
    definition: null,
    position: { x: 0, y: 0 },
  });

  const [customTerms, setCustomTerms] = useState<Record<string, MedicalTermDefinition>>({});

  const showTooltip = useCallback(
    (term: string, x: number, y: number) => {
      const normalizedTerm = term.toLowerCase();
      const termData = MEDICAL_TERMS[normalizedTerm] || customTerms[normalizedTerm];

      if (termData) {
        setTooltipState({
          isVisible: true,
          term: termData.term,
          definition: termData.definition,
          position: { x, y },
        });
      }
    },
    [customTerms]
  );

  const hideTooltip = useCallback(() => {
    setTooltipState((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  const registerTerm = useCallback((term: string, definition: MedicalTermDefinition) => {
    setCustomTerms((prev) => ({
      ...prev,
      [term.toLowerCase()]: definition,
    }));
  }, []);

  const value: TooltipContextType = {
    tooltipState,
    showTooltip,
    hideTooltip,
    registerTerm,
  };

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
};
