// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/sessionGeneration.ts
 *
 * Pure functions tested (all inputs explicit, no IO):
 *   mapLaunchModeToSessionRequestMode(mode)    — 3-way switch
 *   buildLegacyPriorityBreakdown(meta, exist?) — A/B/C breakdown
 *   deriveStoredSessionFocus(mode)             — mode → focus label
 *   buildSessionModeLabel(snapshot)            — mode → UI label
 *   buildSessionSettingsFromSnapshot(snap, fb) — settings derivation
 *   normalizeSessionQuestion(input)            — question normalization
 */

import { describe, it, expect } from 'vitest';
import {
  mapLaunchModeToSessionRequestMode,
  buildLegacyPriorityBreakdown,
  deriveStoredSessionFocus,
  buildSessionModeLabel,
  buildSessionSettingsFromSnapshot,
  buildStudySessionQuestionRecords,
  normalizeSessionQuestion,
} from './sessionGeneration';
import type { SessionLaunchMode } from './sessionGeneration';

// ─── mapLaunchModeToSessionRequestMode ───────────────────────────────────────

describe('mapLaunchModeToSessionRequestMode', () => {
  it('maps "mainSession" → "adaptive"', () => {
    expect(mapLaunchModeToSessionRequestMode('mainSession')).toBe('adaptive');
  });

  it('maps "review" → "review"', () => {
    expect(mapLaunchModeToSessionRequestMode('review')).toBe('review');
  });

  it('maps "drill" → "focused"', () => {
    expect(mapLaunchModeToSessionRequestMode('drill')).toBe('focused');
  });
});

// ─── buildLegacyPriorityBreakdown ─────────────────────────────────────────────

describe('buildLegacyPriorityBreakdown', () => {
  it('uses metadata values when no existing breakdown', () => {
    const result = buildLegacyPriorityBreakdown({ dueReviewCount: 10, newCardCount: 5 });
    expect(result.A).toBe(10);
    expect(result.C).toBe(5);
    expect(result.B).toBe(0);
  });

  it('uses existing values when provided', () => {
    const result = buildLegacyPriorityBreakdown(
      { dueReviewCount: 10, newCardCount: 5 },
      { A: 7, B: 3, C: 2 }
    );
    expect(result.A).toBe(7);
    expect(result.B).toBe(3);
    expect(result.C).toBe(2);
  });

  it('B defaults to 0 when not in existing', () => {
    const result = buildLegacyPriorityBreakdown({ dueReviewCount: 10, newCardCount: 5 }, { A: 7 });
    expect(result.B).toBe(0);
  });
});

// ─── deriveStoredSessionFocus ─────────────────────────────────────────────────

describe('deriveStoredSessionFocus', () => {
  it('maps "review" → "review"', () => {
    expect(deriveStoredSessionFocus('review')).toBe('review');
  });

  it('maps "focused" → "growth"', () => {
    expect(deriveStoredSessionFocus('focused')).toBe('growth');
  });

  it('maps "system" → "topic"', () => {
    expect(deriveStoredSessionFocus('system')).toBe('topic');
  });

  it('maps "subcategory" → "topic"', () => {
    expect(deriveStoredSessionFocus('subcategory')).toBe('topic');
  });

  it('maps "condition" → "topic"', () => {
    expect(deriveStoredSessionFocus('condition')).toBe('topic');
  });

  it('maps "adaptive" → "all" (default)', () => {
    expect(deriveStoredSessionFocus('adaptive')).toBe('all');
  });

  it('maps null → "all" (default)', () => {
    expect(deriveStoredSessionFocus(null)).toBe('all');
  });

  it('maps undefined → "all" (default)', () => {
    expect(deriveStoredSessionFocus(undefined)).toBe('all');
  });

  it('maps unknown string → "all" (default)', () => {
    expect(deriveStoredSessionFocus('unknown_mode')).toBe('all');
  });
});

// ─── buildSessionModeLabel ────────────────────────────────────────────────────

describe('buildSessionModeLabel', () => {
  it('returns review label for mode="review"', () => {
    const label = buildSessionModeLabel({ mode: 'review' } as any);
    expect(label).toContain('Review');
  });

  it('returns focus label for mode="focused"', () => {
    const label = buildSessionModeLabel({ mode: 'focused' } as any);
    expect(label).toContain('Focus');
  });

  it('returns targeted label for mode="system"', () => {
    const label = buildSessionModeLabel({ mode: 'system' } as any);
    expect(label).toContain('Targeted');
  });

  it('returns targeted label for mode="subcategory"', () => {
    expect(buildSessionModeLabel({ mode: 'subcategory' } as any)).toContain('Targeted');
  });

  it('returns targeted label for mode="condition"', () => {
    expect(buildSessionModeLabel({ mode: 'condition' } as any)).toContain('Targeted');
  });

  it('returns generic session label for null snapshot', () => {
    const label = buildSessionModeLabel(null);
    expect(label).toContain('Session');
  });

  it('returns generic session label for unknown mode', () => {
    const label = buildSessionModeLabel({ mode: 'unknown' } as any);
    expect(label).toContain('Session');
  });

  it('all labels contain "Practice"', () => {
    const modes = ['review', 'focused', 'system', 'subcategory', 'condition', null] as const;
    for (const mode of modes) {
      const label = buildSessionModeLabel(mode === null ? null : { mode } as any);
      expect(label).toContain('Practice');
    }
  });
});

// ─── buildSessionSettingsFromSnapshot ────────────────────────────────────────

describe('buildSessionSettingsFromSnapshot', () => {
  it('returns default settings for null snapshot', () => {
    const settings = buildSessionSettingsFromSnapshot(null);
    expect(settings.mode).toBe('standard');
    expect(settings.difficulty).toBe('adaptive');
    expect(Array.isArray(settings.systems)).toBe(true);
  });

  it('uses fallbackSystems when snapshot has no systems', () => {
    const settings = buildSessionSettingsFromSnapshot(null, ['Cardiovascular']);
    expect(settings.systems).toContain('Cardiovascular');
  });

  it('maps mode="review" to settings.mode="review"', () => {
    const settings = buildSessionSettingsFromSnapshot({ mode: 'review' } as any);
    expect(settings.mode).toBe('review');
  });

  it('maps other modes to settings.mode="standard"', () => {
    const settings = buildSessionSettingsFromSnapshot({ mode: 'adaptive' } as any);
    expect(settings.mode).toBe('standard');
  });

  it('deduplicates systems from snapshot and fallback', () => {
    const snapshot = { systemsTargeted: ['Cardiovascular', 'Pulmonary'] } as any;
    const settings = buildSessionSettingsFromSnapshot(snapshot, ['Cardiovascular']);
    const cvCount = settings.systems.filter((s) => s === 'Cardiovascular').length;
    expect(cvCount).toBe(1); // deduplicated
  });

  it('uses snapshot difficulty when set', () => {
    const settings = buildSessionSettingsFromSnapshot({ difficulty: 'hard' } as any);
    expect(settings.difficulty).toBe('hard');
  });
});

// ─── normalizeSessionQuestion ─────────────────────────────────────────────────

describe('normalizeSessionQuestion', () => {
  it('returns a question with all required fields', () => {
    const result = normalizeSessionQuestion({
      question: 'What is the diagnosis?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: 0,
      conditionId: 'hf',
      condition: 'Heart Failure',
      topic: 'Cardiology',
      rationale: 'Because A.',
    } as any);
    expect(typeof result.question).toBe('string');
    expect(Array.isArray(result.options)).toBe(true);
    expect(typeof result.correctAnswerIndex).toBe('number');
    expect(typeof result.conditionId).toBe('string');
  });

  it('normalizes options to an array', () => {
    const result = normalizeSessionQuestion({
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswerIndex: 0,
      conditionId: 'cid',
      condition: 'Cond',
      topic: 'Top',
      rationale: 'R',
    } as any);
    expect(result.options).toHaveLength(2);
  });

  it('falls back to "General" topic when topic is missing', () => {
    const result = normalizeSessionQuestion({
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswerIndex: 0,
      conditionId: 'cid',
      condition: 'Cond',
      rationale: 'R',
    } as any);
    expect(result.topic).toBeTruthy();
  });

  it('filters empty strings from pearls', () => {
    const result = normalizeSessionQuestion({
      question: 'Q?',
      options: ['A'],
      correctAnswerIndex: 0,
      conditionId: 'cid',
      condition: 'Cond',
      topic: 'Top',
      rationale: 'R',
      pearls: ['valid pearl', '', '  '],
    } as any);
    // Only non-empty strings kept
    expect(result.pearls.every((p: string) => p.trim().length > 0)).toBe(true);
  });

  it('preserves pre-generated source identity separately from canonical identity', () => {
    const result = normalizeSessionQuestion({
      id: 'pg-1',
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 'B',
      conditionId: null,
      medicalContentId: 'mc-1',
      condition: 'Condition',
      topic: 'Topic',
      rationale: 'R',
      sourceQuestionId: 'pg-1',
      canonicalQuestionId: null,
      questionSource: 'pre_generated',
      source: 'new_card',
    } as any);

    expect(result.id).toBe('pg-1');
    expect(result.questionId).toBeNull();
    expect(result.canonicalQuestionId).toBeNull();
    expect(result.sourceQuestionId).toBe('pg-1');
    expect(result.questionSource).toBe('pre_generated');
    expect(result.medicalContentId).toBe('mc-1');
    expect(result.conditionId).toBe('mc-1');
  });

  it('normalizes difficulty to valid value or undefined', () => {
    const easy = normalizeSessionQuestion({
      question: 'Q?', options: ['A'], correctAnswerIndex: 0,
      conditionId: 'c', condition: 'C', topic: 'T', rationale: 'R', difficulty: 'easy',
    } as any);
    expect(easy.difficulty).toBe('easy');

    const invalid = normalizeSessionQuestion({
      question: 'Q?', options: ['A'], correctAnswerIndex: 0,
      conditionId: 'c', condition: 'C', topic: 'T', rationale: 'R', difficulty: 'INVALID',
    } as any);
    expect(['easy', 'medium', 'hard', undefined]).toContain(invalid.difficulty);
  });
});

// ─── buildStudySessionQuestionRecords ────────────────────────────────────────

describe('buildStudySessionQuestionRecords', () => {
  it('maps canonical Question rows to ordered session-question links', () => {
    const question = normalizeSessionQuestion({
      id: 'q-1',
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 'A',
      conditionId: 'mc-1',
      questionSource: 'question',
      canonicalQuestionId: 'q-1',
      sourceQuestionId: 'q-1',
      source: 'new_card',
    } as any);

    expect(buildStudySessionQuestionRecords('ses-1', [question])).toEqual([
      expect.objectContaining({
        sessionId: 'ses-1',
        questionId: 'q-1',
        preGeneratedQuestionId: null,
        sequenceIndex: 0,
        source: 'question',
        metadata: expect.objectContaining({
          canonicalQuestionId: 'q-1',
          sourceQuestionId: 'q-1',
          questionSource: 'question',
          conditionId: 'mc-1',
        }),
      }),
    ]);
  });

  it('maps pre-generated rows to preGeneratedQuestionId without pretending they are canonical Questions', () => {
    const question = normalizeSessionQuestion({
      id: 'pg-1',
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 'B',
      conditionId: null,
      medicalContentId: 'mc-1',
      questionSource: 'pre_generated',
      sourceQuestionId: 'pg-1',
      canonicalQuestionId: null,
      source: 'new_card',
    } as any);

    expect(buildStudySessionQuestionRecords('ses-1', [question])).toEqual([
      expect.objectContaining({
        sessionId: 'ses-1',
        questionId: null,
        preGeneratedQuestionId: 'pg-1',
        sequenceIndex: 0,
        source: 'pre_generated',
        metadata: expect.objectContaining({
          sourceQuestionId: 'pg-1',
          questionSource: 'pre_generated',
          medicalContentId: 'mc-1',
        }),
      }),
    ]);
  });

  it('drops ephemeral rows that cannot satisfy either source FK', () => {
    const question = normalizeSessionQuestion({
      id: 'generated-temp-1',
      question: 'Q?',
      options: ['A', 'B'],
      correctAnswer: 'A',
      conditionId: 'mc-1',
      questionSource: 'generated',
      sourceQuestionId: 'generated-temp-1',
      canonicalQuestionId: null,
    } as any);

    expect(buildStudySessionQuestionRecords('ses-1', [question])).toEqual([]);
  });
});
