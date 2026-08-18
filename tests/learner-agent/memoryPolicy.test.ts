import { describe, it, expect } from 'vitest';
import {
  proposeMemory,
  confirmMemory,
  correctMemory,
  requiresConfirmation,
  sanitizeMemoryText,
} from '@/lib/services/learnerAgent/memoryPolicy';

describe('learnerAgent memoryPolicy', () => {
  it('requires confirmation for inferred schedule memories', () => {
    expect(requiresConfirmation('schedule', 'inferred', 'Study at 5am', 0.6)).toBe(true);
  });

  it('auto-confirms learner-stated preferences', () => {
    const candidate = proposeMemory({
      proposed: 'Prefers 20-minute sessions',
      category: 'preference',
      source: 'learner_stated',
    });
    expect(candidate.requiresConfirmation).toBe(false);
    const stored = confirmMemory(candidate);
    expect(stored.confirmedAt).toBeTruthy();
  });

  it('redacts sensitive patterns', () => {
    const text = sanitizeMemoryText('Patient name: Jane Doe, MRN 12345');
    expect(text).not.toContain('MRN');
  });

  it('correctMemory preserves provenance link', () => {
    const candidate = proposeMemory({
      proposed: 'Old preference',
      category: 'preference',
      source: 'learner_stated',
    });
    const stored = confirmMemory(candidate);
    const corrected = correctMemory(stored, 'New preference');
    expect(corrected.correctedFrom).toBe('Old preference');
    expect(corrected.proposed).toBe('New preference');
  });
});
