/**
 * Calculator Type System
 * 
 * Shared types and interfaces for clinical calculators
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Calculator category classification
 */
export type CalculatorCategory = 'risk' | 'diagnosis' | 'dosing' | 'lab' | 'guidelines';

/**
 * Risk level for clinical decision-making
 */
export type RiskLevel = 'low' | 'moderate' | 'high';

/**
 * Calculator result with interpretation
 */
export interface CalculatorResult {
  score: number | string;
  interpretation: string;
  recommendation: string;
  riskLevel: RiskLevel;
  /** Optional additional details */
  details?: string;
  /** Optional reference/citation */
  reference?: string;
}

/**
 * Calculator configuration metadata
 */
export interface Calculator {
  id: string;
  name: string;
  description: string;
  category: CalculatorCategory;
  icon: LucideIcon;
  /** Search synonyms/aliases for better discoverability */
  synonyms?: string[];
  /** Formula preview shown in search results */
  formula?: string;
  /** Keywords for search matching */
  keywords?: string[];
  /** System classification (Cardiac, Pulmonary, etc.) */
  system?: CalculatorSystem;
}

/**
 * System classification for tab organization
 */
export type CalculatorSystem = 
  | 'cardiac'
  | 'pulmonary'
  | 'vascular'
  | 'renal'
  | 'pediatric'
  | 'neurology'
  | 'gastro'
  | 'general';

/**
 * Checkbox criteria item for calculators
 */
export interface CriteriaItem {
  state: boolean;
  setState: (value: boolean) => void;
  title: string;
  description: string;
  points?: number;
  disabled?: boolean;
}

/**
 * Input field configuration for numeric/select calculators
 */
export interface InputFieldConfig {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (value: string) => void;
  type: 'number' | 'select';
  unit?: string;
  range?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Calculator component props (standardized)
 */
export interface CalculatorProps {
  onBack: () => void;
}

export default CalculatorResult;
