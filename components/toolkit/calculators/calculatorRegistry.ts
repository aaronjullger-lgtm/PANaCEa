/**
 * Single source of truth for clinical calculator metadata.
 * Used by both ToolkitHub (grid, search, pinned/recent) and CalculatorHub (tabs, grid, render).
 */

import { Activity, AlertCircle, Beaker, BookOpen, Droplet, Heart, Pill, Wind } from 'lucide-react';
import type { Calculator } from './types';

export interface CalculatorCategoryTab {
  id: string;
  label: string;
  icon: typeof Heart;
  calculatorIds: string[];
}

/** Clinical calculators registry with search metadata and system classification */
export const CALCULATORS: Calculator[] = [
  {
    id: 'curb65',
    name: 'CURB-65',
    description: 'Pneumonia severity assessment',
    category: 'risk',
    icon: Activity,
    system: 'pulmonary',
    synonyms: ['pneumonia', 'cap', 'community acquired pneumonia', 'severity'],
    formula: 'Confusion + Urea + RR + BP + Age ≥65',
    keywords: ['respiratory', 'infection', 'lung', 'inpatient', 'outpatient'],
  },
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc',
    description: 'Stroke risk in atrial fibrillation',
    category: 'risk',
    icon: Heart,
    system: 'cardiac',
    synonyms: ['afib', 'a-fib', 'stroke', 'anticoagulation', 'chadsvasc'],
    formula: 'CHF + HTN + Age + DM + Stroke + Vasc + Sex',
    keywords: ['cardiac', 'arrhythmia', 'warfarin', 'coumadin', 'eliquis', 'xarelto'],
  },
  {
    id: 'wells_dvt',
    name: "Wells' DVT Criteria",
    description: 'Deep vein thrombosis probability',
    category: 'diagnosis',
    icon: Activity,
    system: 'vascular',
    synonyms: ['dvt', 'blood clot', 'leg swelling', 'venous thrombosis'],
    formula: 'Clinical criteria scoring (0-9 points)',
    keywords: ['vascular', 'thrombosis', 'ultrasound', 'd-dimer'],
  },
  {
    id: 'wells_pe',
    name: "Wells' PE Criteria",
    description: 'Pulmonary embolism probability',
    category: 'diagnosis',
    icon: Activity,
    system: 'pulmonary',
    synonyms: ['pe', 'pulmonary embolism', 'clot lung', 'sob', 'chest pain'],
    formula: 'Clinical probability: Low/Mod/High',
    keywords: ['respiratory', 'emergency', 'ct angio', 'vq scan'],
  },
  {
    id: 'perc',
    name: 'PERC Rule',
    description: 'Pulmonary embolism exclusion',
    category: 'diagnosis',
    icon: AlertCircle,
    system: 'pulmonary',
    synonyms: ['pe rule out', 'pulmonary embolism', 'low risk pe'],
    formula: '8 criteria: Age, HR, O2, hemoptysis, estrogen, surgery, DVT hx, unilateral swelling',
    keywords: ['emergency', 'exclusion', 'safe discharge'],
  },
  {
    id: 'gfr',
    name: 'GFR (MDRD)',
    description: 'Glomerular filtration rate estimation',
    category: 'lab',
    icon: Droplet,
    system: 'renal',
    synonyms: ['egfr', 'kidney function', 'renal function', 'creatinine clearance', 'ckd'],
    formula: '186 × (Cr)^-1.154 × (Age)^-0.203 × [factors]',
    keywords: ['nephrology', 'chronic kidney disease', 'dialysis', 'renal'],
  },
  {
    id: 'anion_gap',
    name: 'Anion Gap',
    description: 'Metabolic acidosis assessment',
    category: 'lab',
    icon: Beaker,
    system: 'renal',
    synonyms: ['ag', 'metabolic acidosis', 'mudpiles', 'dka', 'lactic acidosis'],
    formula: 'Na⁺ - (Cl⁻ + HCO₃⁻) = Normal 8-12',
    keywords: ['electrolytes', 'acid-base', 'abg', 'bmp'],
  },
  {
    id: 'osmolar_gap',
    name: 'Osmolar Gap',
    description: 'Toxic alcohol / unmeasured osmoles assessment',
    category: 'lab',
    icon: Beaker,
    system: 'renal',
    synonyms: ['osmolality', 'toxic alcohol', 'methanol', 'ethylene glycol'],
    formula: '2×Na + glucose/18 + BUN/2.8; gap = measured − calculated',
    keywords: ['electrolytes', 'toxicology', 'abg', 'osmolar'],
  },
  {
    id: 'parkland',
    name: 'Parkland Formula',
    description: 'Burn resuscitation fluid (first 24 hours)',
    category: 'dosing',
    icon: Droplet,
    system: 'general',
    synonyms: ['burn', 'resuscitation', 'fluid', 'tbsa', '4 ml kg'],
    formula: '4 mL × kg × % TBSA in first 24 h; half in first 8 h',
    keywords: ['trauma', 'burns', 'fluid resuscitation', 'LR'],
  },
  {
    id: 'pediatric_dosing',
    name: 'Pediatric Dosing',
    description: 'Weight-based medication calculator',
    category: 'dosing',
    icon: Pill,
    system: 'pediatric',
    synonyms: ['kids', 'children', 'weight based', 'mg/kg', 'peds'],
    formula: 'Dose = mg/kg × weight',
    keywords: ['pediatrics', 'medication', 'antibiotic', 'tylenol', 'motrin'],
  },
  {
    id: 'clinical_guidelines',
    name: 'Clinical Guidelines',
    description: 'Practice guidelines and criteria',
    category: 'guidelines',
    icon: BookOpen,
    system: 'general',
    synonyms: ['protocols', 'criteria', 'recommendations', 'standards'],
    keywords: ['evidence-based', 'treatment', 'management'],
  },
];

/** Calculator category tabs for CalculatorHub (system-based navigation) */
export const CALCULATOR_CATEGORIES: CalculatorCategoryTab[] = [
  { id: 'cardiac', label: 'Cardiac', icon: Heart, calculatorIds: ['chads2vasc'] },
  {
    id: 'pulmonary',
    label: 'Pulmonary',
    icon: Wind,
    calculatorIds: ['curb65', 'wells_pe', 'perc'],
  },
  { id: 'vascular', label: 'Vascular', icon: Activity, calculatorIds: ['wells_dvt'] },
  {
    id: 'renal',
    label: 'Renal/Labs',
    icon: Droplet,
    calculatorIds: ['gfr', 'anion_gap', 'osmolar_gap'],
  },
  { id: 'pediatric', label: 'Pediatric', icon: Pill, calculatorIds: ['pediatric_dosing'] },
  {
    id: 'general',
    label: 'Other',
    icon: Activity,
    calculatorIds: ['parkland', 'clinical_guidelines'],
  },
];
