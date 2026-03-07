/**
 * Rotation → System mapping for Clinical Students (EOR / Rotator)
 * Selecting a rotation presets which organ systems are in scope for that rotation.
 * Used to filter questions and set "enabled systems" when user is in Clinical Year.
 *
 * Note: Time-blocked rotation UI (e.g. locking content by EOR exam date) is not yet
 * implemented; EOR countdown and daily targets are shown via EorCountdownCard.
 */

import type { ClinicalRotation, SystemCode } from '@/types';

/** All blueprint system codes (excluding PRO/OTHER for question scope). Exported for 60/40 background set. */
export const ALL_SYSTEMS: SystemCode[] = [
  'CV',
  'DERM',
  'ENDO',
  'HEENT',
  'GI',
  'GU',
  'HEME',
  'ID',
  'MSK',
  'NEURO',
  'PSYCH',
  'PULM',
  'RENAL',
  'REPRO',
];

/**
 * Systems in scope for each clinical rotation.
 * Family Med = all; Surgery = GI/CV/MSK/RENAL/HEENT (no Psych); etc.
 */
export const ROTATION_SYSTEMS: Record<ClinicalRotation, SystemCode[]> = {
  'Family Medicine': [...ALL_SYSTEMS],
  'Internal Medicine': ['CV', 'PULM', 'GI', 'RENAL', 'ENDO', 'HEME', 'ID', 'NEURO', 'GU', 'HEENT'],
  'Emergency Medicine': [
    'CV',
    'PULM',
    'GI',
    'MSK',
    'HEENT',
    'ID',
    'NEURO',
    'HEME',
    'DERM',
    'GU',
    'RENAL',
  ],
  Surgery: ['GI', 'CV', 'MSK', 'RENAL', 'HEENT', 'GU', 'ID', 'HEME'],
  Pediatrics: ['PULM', 'GI', 'ID', 'HEENT', 'CV', 'HEME', 'NEURO', 'GU', 'RENAL', 'DERM'],
  Psychiatry: ['PSYCH'],
  'Obstetrics & Gynecology': ['REPRO', 'GU', 'ENDO', 'HEME', 'ID'],
  Cardiology: ['CV', 'PULM', 'RENAL', 'ENDO'],
  Orthopedics: ['MSK', 'NEURO', 'HEENT', 'CV'],
  Dermatology: ['DERM', 'ID', 'HEME', 'REPRO'],
  Neurology: ['NEURO', 'CV', 'HEENT', 'ID', 'PSYCH'],
  Other: [...ALL_SYSTEMS],
};

/** EOR-focused rotations (show EOR Readiness / Test Date in UI) */
export const EOR_ROTATIONS: ClinicalRotation[] = [
  'Emergency Medicine',
  'Family Medicine',
  'Internal Medicine',
  'Surgery',
  'Pediatrics',
  'Psychiatry',
  'Obstetrics & Gynecology',
];

/** Default target total questions to spread over the rotation for EOR daily target calculation. */
export const EOR_TARGET_QUESTIONS_DEFAULT = 300;

/** Default denominator for system progress ring when per-system condition count is not available from API. */
export const DEFAULT_SYSTEM_PROGRESS_TOTAL = 100;

export function getSystemsForRotation(rotation: ClinicalRotation): SystemCode[] {
  return ROTATION_SYSTEMS[rotation] ?? [...ALL_SYSTEMS];
}

export function isEorRotation(rotation: ClinicalRotation): boolean {
  return EOR_ROTATIONS.includes(rotation);
}
