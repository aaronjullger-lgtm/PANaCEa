// src/types/content.ts
// Type definitions for generated medical case content

/**
 * Individual lab value with flag indicator
 */
export interface LabValue {
  name: string;
  value: string;
  unit: string;
  flag: 'H' | 'L' | 'N'; // High, Low, Normal
}

/**
 * Lab panel groupings (legacy - for backward compatibility)
 * Note: Additional panels can be added dynamically as orderable tests
 */
export interface LabPanels {
  BMP: LabValue[];
  CBC: LabValue[];
  LFT: LabValue[];
  // Additional orderable test panels are added at runtime
  // but not defined here to maintain type safety
}

/**
 * Lab case for Mini Mode training
 * Focuses on interpreting laboratory values to reach a diagnosis
 */
export interface LabCase {
  id: string;
  correctDiagnosis: string;
  clinicalVignette: string;
  labs: LabPanels;
  /** Optional: Additional orderable tests that are available but not shown initially */
  orderableTests?: Record<string, LabValue[]>;
}

/**
 * Physical exam finding or buzzword clue
 */
export interface PresentationClue {
  type: 'buzzword' | 'physical_exam' | 'history';
  description: string;
}

/**
 * Clinical case for Mini Mode training
 * Focuses on presentation clues and differential diagnosis
 */
export interface ClinicalCase {
  id: string;
  correctDiagnosis: string;
  vignette: string;
  presentationClues: PresentationClue[];
}
