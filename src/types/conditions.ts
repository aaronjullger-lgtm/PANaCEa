/**
 * Condition Type Definitions
 * 
 * Core type definitions for medical conditions in the PANaCEa platform.
 * These types are used throughout the application for type safety and consistency.
 * 
 * IMPORTANT: This file replaces type exports from conditionRegistry.ts.
 * Use these types instead of importing from the registry.
 */

import type { SystemCode } from '../../types';

/**
 * ConditionMeta - Metadata for a medical condition
 * 
 * This interface defines the structure of condition metadata used throughout
 * the application. It includes system classification, subcategory, aliases,
 * and optional enrichment fields.
 */
export interface ConditionMeta {
  /** Primary PANCE system code (CV, PULM, GI, etc.) */
  system: SystemCode;

  /** Secondary systems this condition is relevant for (cross-listed) */
  relatedSystems?: SystemCode[];

  /** Subcategory within the system (e.g., "Arrhythmias", "Valvular Disease") */
  subcategory: string;

  /** Human-readable condition name */
  condition: string;

  /** Alternative names and abbreviations for search/matching */
  aliases?: string[];

  /** Media asset IDs associated with this condition */
  mediaIds?: string[];

  // Optional enrichment fields
  /** 1-3 sentence summary of the condition */
  overview?: string;

  /** High-yield buzzword bullets */
  keyPoints?: string[];

  /** "Do not miss" findings and red flags */
  redFlags?: string[];

  /** High-yield management bullets */
  treatmentPearls?: string[];

  /** Canonical name for grouping related conditions */
  canonicalName?: string;
}

/**
 * CategoryCode - Subcategory classification
 * 
 * Common subcategories used across different systems.
 * This is not exhaustive - conditions can have custom subcategories.
 */
export type CategoryCode =
  // Cardiovascular
  | "ECG"
  | "Ischemic Heart Disease"
  | "Blood Pressure"
  | "Heart Failure"
  | "Valvular Disease"
  | "Cardiomyopathy"
  | "Carditis"
  | "Conduction Disorders"
  | "Arrhythmia"
  | "Vascular Disease"
  | "Congenital Heart Disease"

  // Pulmonary
  | "Obstructive"
  | "Restrictive"
  | "Infectious"
  | "Neoplasm"
  | "Pleural Disease"
  | "Vascular"

  // Gastrointestinal
  | "Esophagus"
  | "Stomach"
  | "Small Bowel"
  | "Colon"
  | "Hepatobiliary"
  | "Pancreas"

  // Musculoskeletal
  | "Fracture"
  | "Dislocation"
  | "Ligament Injury"
  | "Arthritis"
  | "Myopathy"
  | "Bone Disorder"

  // Endocrine
  | "Thyroid"
  | "Adrenal"
  | "Pituitary"
  | "Diabetes"
  | "Parathyroid"

  // Infectious Disease
  | "Bacterial"
  | "Viral"
  | "Fungal"
  | "Parasitic"
  | "Tick-Borne"

  // Hematology
  | "Anemia"
  | "Coagulation Disorder"
  | "Leukemia"
  | "Lymphoma"

  // Neurology
  | "Stroke"
  | "Seizure"
  | "Dementia"
  | "Movement Disorder"
  | "Peripheral Neuropathy"

  // Dermatology
  | "Infection"
  | "Inflammatory"
  | "Neoplasm"
  | "Autoimmune"

  // Renal
  | "Glomerular"
  | "Tubular"
  | "Vascular"
  | "Electrolyte Disorder"

  // Genitourinary
  | "Infection"
  | "Neoplasm"
  | "Structural"

  // Reproductive
  | "Pregnancy"
  | "Menstrual Disorder"
  | "Neoplasm"
  | "Infection"

  // HEENT
  | "Eye"
  | "Ear"
  | "Nose"
  | "Throat"

  // Psychiatry
  | "Mood Disorder"
  | "Anxiety Disorder"
  | "Psychotic Disorder"
  | "Substance Use"

  // Other
  | "Environmental"
  | "Toxicology"
  | "Trauma"
  | "Congenital"
  | "Other";

/**
 * Re-export SystemCode for convenience
 * 
 * This allows consumers to import both ConditionMeta and SystemCode
 * from the same module.
 */
export type { SystemCode };
