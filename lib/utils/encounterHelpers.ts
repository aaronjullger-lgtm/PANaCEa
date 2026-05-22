/**
 * Pure utility functions extracted from PatientEncounterMode.
 * Zero component dependencies — import-safe from anywhere.
 */

import type { EncounterPhase } from '@/hooks/useEncounterReducer';
import type { PatientQuestion } from '@/types/drill-modes';
import { translateToSpanish } from '@/services/domain';

// ────────────────────────────────────────────────────
// Phase navigation
// ────────────────────────────────────────────────────
export const PHASE_ORDER: EncounterPhase[] = [
  'history',
  'physical',
  'diagnostic',
  'diagnosis',
  'treatment',
];

export function canAdvancePhase(
  from: EncounterPhase,
  to: EncounterPhase,
  questionCount: number,
): { allowed: boolean; reason?: string } {
  const fromIdx = PHASE_ORDER.indexOf(from);
  const toIdx = PHASE_ORDER.indexOf(to);

  // Can always go back
  if (toIdx <= fromIdx) return { allowed: true };

  // Validate minimum requirements before advancing
  if (from === 'history' && questionCount < 2) {
    return { allowed: false, reason: 'Ask at least 2 history questions before moving on.' };
  }

  // Skipping more than one phase forward requires confirmation
  if (toIdx - fromIdx > 1) {
    return {
      allowed: true,
      reason: `Skipping ${toIdx - fromIdx - 1} phase(s). Some scoring categories may be affected.`,
    };
  }

  return { allowed: true };
}

// ────────────────────────────────────────────────────
// Question categorization
// ────────────────────────────────────────────────────
export function determineCategory(question: string): PatientQuestion['category'] {
  const lowerQ = question.toLowerCase();
  if (
    lowerQ.includes('history') ||
    lowerQ.includes('when') ||
    lowerQ.includes('how long') ||
    lowerQ.includes('family')
  ) {
    return 'history';
  }
  if (
    lowerQ.includes('exam') ||
    lowerQ.includes('physical') ||
    lowerQ.includes('abdomen') ||
    lowerQ.includes('heart')
  ) {
    return 'physical';
  }
  if (
    lowerQ.includes('lab') ||
    lowerQ.includes('test') ||
    lowerQ.includes('ecg') ||
    lowerQ.includes('xray')
  ) {
    return 'labs';
  }
  return 'other';
}

// ────────────────────────────────────────────────────
// Relevance display helpers
// ────────────────────────────────────────────────────
export function getRelevanceColor(relevance: PatientQuestion['relevance']): string {
  switch (relevance) {
    case 'essential':
      return 'text-[var(--color-data-neutral)] bg-[var(--color-data-neutral)]/10';
    case 'helpful':
      return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30';
    case 'unnecessary':
      return 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10';
    case 'redundant':
      return 'text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-[var(--color-border)]';
    default:
      return 'text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-[var(--color-border)]';
  }
}

export function getRelevanceLabel(relevance: PatientQuestion['relevance']): string {
  switch (relevance) {
    case 'essential':
      return 'Essential';
    case 'helpful':
      return 'Helpful';
    case 'unnecessary':
      return 'Unnecessary';
    case 'redundant':
      return 'Redundant';
    default:
      return 'Other';
  }
}

// ────────────────────────────────────────────────────
// Score display
// ────────────────────────────────────────────────────
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-data-pass';
  if (score >= 60) return 'text-data-provisional';
  return 'text-data-fail';
}

// ────────────────────────────────────────────────────
// Vitals display
// ────────────────────────────────────────────────────
export function getSemanticVitalClass(value: number, range?: [number, number]): string {
  if (!range) return 'text-[var(--color-text-inverse)]';
  return value < range[0] || value > range[1] ? 'text-data-fail' : 'text-data-pass';
}

// ────────────────────────────────────────────────────
// Translation
// ────────────────────────────────────────────────────
export function getTranslatedText(
  text: string,
  languageMode: 'english' | 'spanish' | 'side-by-side',
): string {
  if (languageMode === 'english') return text;
  const translated = translateToSpanish(text);
  if (languageMode === 'spanish') return translated;
  return `${text}\n\n—\n${translated}`;
}

// ────────────────────────────────────────────────────
// Trend data generation (deterministic)
// ────────────────────────────────────────────────────
export function generateTrendData(currentValueStr: string): number[] | null {
  const match = currentValueStr.match(/(\d+(\.\d+)?)/);
  if (!match) return null;

  const currentVal = parseFloat(match[0]);
  if (isNaN(currentVal)) return null;

  // Simple deterministic seed from the string
  let seed = 0;
  for (let i = 0; i < currentValueStr.length; i++) {
    seed = ((seed << 5) - seed + currentValueStr.charCodeAt(i)) | 0;
  }
  const seededRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };

  const points = 6;
  const data: number[] = [];
  const trendType = seededRandom();
  let val = currentVal;

  for (let i = 0; i < points; i++) {
    data.unshift(val);
    const noise = (seededRandom() - 0.5) * (currentVal * 0.1);
    if (trendType < 0.6) {
      val = val + noise;
    } else if (trendType < 0.8) {
      val = val - currentVal * 0.05 + noise;
    } else {
      val = val + currentVal * 0.05 + noise;
    }
  }
  return data;
}
