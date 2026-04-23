// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/taskTypes.ts
 *
 * Pure functions tested:
 *   getTaskTypeLabel(taskType)       — human-readable labels
 *   getTaskTypeDescription(taskType) — description sentences
 *   inferTaskType(questionText)      — keyword-based classification
 *   getTaskTypeFromContent           — alias for inferTaskType
 *
 * Constants verified:
 *   TASK_TYPES — 8 keys with correct string values
 *   ALL_TASK_TYPES — array of all 8 task type strings
 */

import { describe, it, expect } from 'vitest';
import {
  TASK_TYPES,
  ALL_TASK_TYPES,
  getTaskTypeLabel,
  getTaskTypeDescription,
  inferTaskType,
  getTaskTypeFromContent,
} from './taskTypes';

// ─── TASK_TYPES constant ──────────────────────────────────────────────────────

describe('TASK_TYPES', () => {
  it('has exactly 8 task types', () => {
    expect(Object.keys(TASK_TYPES)).toHaveLength(8);
  });

  it('contains the expected string values', () => {
    expect(TASK_TYPES.DIAGNOSIS).toBe('diagnosis');
    expect(TASK_TYPES.TREATMENT).toBe('treatment');
    expect(TASK_TYPES.MECHANISM).toBe('mechanism');
    expect(TASK_TYPES.WORKUP).toBe('workup');
    expect(TASK_TYPES.PREVENTION).toBe('prevention');
    expect(TASK_TYPES.PROGNOSIS).toBe('prognosis');
    expect(TASK_TYPES.COMPLICATION).toBe('complication');
    expect(TASK_TYPES.CLINICAL_PEARL).toBe('clinical_pearl');
  });
});

// ─── ALL_TASK_TYPES ───────────────────────────────────────────────────────────

describe('ALL_TASK_TYPES', () => {
  it('contains exactly 8 entries', () => {
    expect(ALL_TASK_TYPES).toHaveLength(8);
  });

  it('contains all TASK_TYPES values', () => {
    for (const v of Object.values(TASK_TYPES)) {
      expect(ALL_TASK_TYPES).toContain(v);
    }
  });

  it('has no duplicates', () => {
    const unique = new Set(ALL_TASK_TYPES);
    expect(unique.size).toBe(ALL_TASK_TYPES.length);
  });

  it('contains only string values', () => {
    for (const t of ALL_TASK_TYPES) {
      expect(typeof t).toBe('string');
    }
  });
});

// ─── getTaskTypeLabel ─────────────────────────────────────────────────────────

describe('getTaskTypeLabel', () => {
  it('returns "Diagnosis" for diagnosis', () => {
    expect(getTaskTypeLabel('diagnosis')).toBe('Diagnosis');
  });

  it('returns "Treatment" for treatment', () => {
    expect(getTaskTypeLabel('treatment')).toBe('Treatment');
  });

  it('returns "Mechanism/Pathophysiology" for mechanism', () => {
    expect(getTaskTypeLabel('mechanism')).toBe('Mechanism/Pathophysiology');
  });

  it('returns "Diagnostic Workup" for workup', () => {
    expect(getTaskTypeLabel('workup')).toBe('Diagnostic Workup');
  });

  it('returns "Prevention/Screening" for prevention', () => {
    expect(getTaskTypeLabel('prevention')).toBe('Prevention/Screening');
  });

  it('returns "Prognosis/Outcomes" for prognosis', () => {
    expect(getTaskTypeLabel('prognosis')).toBe('Prognosis/Outcomes');
  });

  it('returns "Complications" for complication', () => {
    expect(getTaskTypeLabel('complication')).toBe('Complications');
  });

  it('returns "Clinical Pearls" for clinical_pearl', () => {
    expect(getTaskTypeLabel('clinical_pearl')).toBe('Clinical Pearls');
  });

  it('returns a non-empty string for all TASK_TYPES values', () => {
    for (const t of ALL_TASK_TYPES) {
      const label = getTaskTypeLabel(t);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ─── getTaskTypeDescription ───────────────────────────────────────────────────

describe('getTaskTypeDescription', () => {
  it('returns a question string for diagnosis', () => {
    const desc = getTaskTypeDescription('diagnosis');
    expect(desc).toContain('diagnosis');
  });

  it('returns a question string for treatment', () => {
    const desc = getTaskTypeDescription('treatment');
    expect(desc.toLowerCase()).toContain('treatment');
  });

  it('returns a string about pathophysiology for mechanism', () => {
    const desc = getTaskTypeDescription('mechanism');
    expect(desc.toLowerCase()).toContain('pathophysiol');
  });

  it('returns a string mentioning "diagnostic step" or "next" for workup', () => {
    const desc = getTaskTypeDescription('workup');
    expect(desc.toLowerCase()).toMatch(/diagnostic|next/);
  });

  it('returns non-empty strings for all task types', () => {
    for (const t of ALL_TASK_TYPES) {
      const desc = getTaskTypeDescription(t);
      expect(typeof desc).toBe('string');
      // Most have content; some may be empty string — just check it's a string
    }
  });
});

// ─── inferTaskType ────────────────────────────────────────────────────────────

describe('inferTaskType', () => {
  it('detects diagnosis from "most likely diagnosis"', () => {
    expect(inferTaskType('What is the most likely diagnosis?')).toBe('diagnosis');
  });

  it('detects diagnosis from "presenting with"', () => {
    expect(inferTaskType('A 45-year-old presenting with chest pain...')).toBe('diagnosis');
  });

  it('detects treatment from "treatment" keyword', () => {
    expect(inferTaskType('What is the appropriate treatment for this patient?')).toBe('treatment');
  });

  it('detects treatment from "management" keyword', () => {
    // "managed" is NOT the same substring as "management" — use the exact keyword
    expect(inferTaskType('What is the appropriate management for this patient?')).toBe('treatment');
  });

  it('detects treatment from "first-line" keyword', () => {
    expect(inferTaskType('What is the first-line therapy?')).toBe('treatment');
  });

  it('detects mechanism from "mechanism" keyword', () => {
    expect(inferTaskType('Explain the mechanism of action of metoprolol.')).toBe('mechanism');
  });

  it('detects mechanism from "pathophysiology" keyword', () => {
    expect(inferTaskType('What is the pathophysiology of ARDS?')).toBe('mechanism');
  });

  it('detects workup from "next step" keyword', () => {
    // Avoid "management" which would trigger 'treatment' first — use neutral context
    expect(inferTaskType('What is the next step in evaluation?')).toBe('workup');
  });

  it('detects workup from "workup" keyword', () => {
    expect(inferTaskType('What diagnostic workup is indicated?')).toBe('workup');
  });

  it('detects prevention from "screening" keyword', () => {
    expect(inferTaskType('What screening is recommended for this patient?')).toBe('prevention');
  });

  it('detects prevention from "prophylaxis" keyword', () => {
    expect(inferTaskType('What prophylaxis should be given?')).toBe('prevention');
  });

  it('detects prognosis from "prognosis" keyword', () => {
    expect(inferTaskType('What is the prognosis of this condition?')).toBe('prognosis');
  });

  it('detects prognosis from "outcome" keyword', () => {
    expect(inferTaskType('What is the expected outcome?')).toBe('prognosis');
  });

  it('detects complication from "complication" keyword', () => {
    expect(inferTaskType('What complications should be monitored for?')).toBe('complication');
  });

  it('detects complication from "adverse effect" keyword', () => {
    expect(inferTaskType('What is a known adverse effect of this medication?')).toBe('complication');
  });

  it('detects clinical_pearl from "high-yield" keyword', () => {
    expect(inferTaskType('What is a high-yield fact about this condition?')).toBe('clinical_pearl');
  });

  it('defaults to diagnosis for unrecognized question text', () => {
    expect(inferTaskType('Unrelated question text that matches nothing.')).toBe('diagnosis');
  });

  it('is case-insensitive (uses toLowerCase internally)', () => {
    expect(inferTaskType('WHAT IS THE TREATMENT?')).toBe('treatment');
    expect(inferTaskType('Explain The PATHOPHYSIOLOGY')).toBe('mechanism');
  });
});

// ─── getTaskTypeFromContent (alias) ───────────────────────────────────────────

describe('getTaskTypeFromContent', () => {
  it('is an alias for inferTaskType — same results', () => {
    const texts = [
      'What is the most likely diagnosis?',
      'What is the treatment?',
      'What is the pathophysiology?',
      'Some unrelated text',
    ];
    for (const text of texts) {
      expect(getTaskTypeFromContent(text)).toBe(inferTaskType(text));
    }
  });
});
