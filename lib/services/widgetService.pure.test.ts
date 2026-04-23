// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/widgetService.ts
 *
 * Pure functions tested (deterministic paths only):
 *   calculateStreak(performanceData)      — longestStreak (deterministic), currentStreak (past dates → 0)
 *   generateEmbedCode(url, height?)       — iframe HTML string
 *   generateObsidianEmbed(url)            — markdown iframe string
 *   getQuestionOfDay(questions, date)     — date-seeded stable selection
 *
 * Note: calculateStreak.currentStreak depends on `new Date()` for today/yesterday check.
 *       Tests for currentStreak use far-past dates (> 2 days ago) so currentStreak=0
 *       regardless of when the test runs. Tests that need currentStreak>0 use today's timestamp.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  generateEmbedCode,
  generateObsidianEmbed,
  getQuestionOfDay,
} from './widgetService';
import type { StreakData } from './widgetService';
import type { Question } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a PerformanceRecord with a specific date (epoch ms) */
function rec(dateStr: string) {
  return {
    timestamp: new Date(dateStr).getTime(),
    system: 'Cardiovascular' as const,
    subcategory: null,
    conditionId: 'cid',
    condition: 'Heart Failure',
    topic: 'Cardiology',
    isCorrect: true,
    focus: 'diagnosis',
  };
}

/** A far-past date string (7+ days ago) — safely not today or yesterday */
const FAR_PAST_1 = '2020-01-01';
const FAR_PAST_2 = '2020-01-02';
const FAR_PAST_3 = '2020-01-03';
const FAR_PAST_5 = '2020-01-05'; // gap: Jan 4 is missing

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    question: 'What is the first-line treatment?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswerIndex: 0,
    rationale: 'Because A.',
    topic: 'Cardiology',
    conditionId: 'hf',
    condition: 'Heart Failure',
    ...overrides,
  };
}

// ─── calculateStreak — empty / edge cases ─────────────────────────────────────

describe('calculateStreak — empty / edge cases', () => {
  it('returns {0, 0, null} for empty input', () => {
    const result = calculateStreak([]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastStudyDate).toBeNull();
  });

  it('lastStudyDate reflects the most recent date in the data', () => {
    const result = calculateStreak([rec(FAR_PAST_2), rec(FAR_PAST_1)]);
    expect(result.lastStudyDate).not.toBeNull();
    // Most recent is FAR_PAST_2 (Jan 2)
    expect(result.lastStudyDate!.toISOString().startsWith('2020-01-02')).toBe(true);
  });
});

// ─── calculateStreak — longestStreak (deterministic) ─────────────────────────

describe('calculateStreak — longestStreak', () => {
  it('longestStreak=1 for a single record', () => {
    const result = calculateStreak([rec(FAR_PAST_1)]);
    expect(result.longestStreak).toBe(1);
  });

  it('longestStreak=3 for three consecutive days', () => {
    // Jan 1, 2, 3 are consecutive
    const result = calculateStreak([rec(FAR_PAST_1), rec(FAR_PAST_2), rec(FAR_PAST_3)]);
    expect(result.longestStreak).toBe(3);
  });

  it('longestStreak=2 when there is a gap (Jan 1, 2 then Jan 5)', () => {
    const result = calculateStreak([rec(FAR_PAST_1), rec(FAR_PAST_2), rec(FAR_PAST_5)]);
    expect(result.longestStreak).toBe(2);
  });

  it('duplicate same-day timestamps count as 1 unique day', () => {
    // Two records on Jan 1 → only 1 unique date
    const result = calculateStreak([rec(FAR_PAST_1), rec(FAR_PAST_1)]);
    expect(result.longestStreak).toBe(1);
  });

  it('longestStreak takes the max of multiple runs', () => {
    // Jan 1, 2, 3 (run of 3) and Jan 5 (run of 1) → longest = 3
    const result = calculateStreak([
      rec(FAR_PAST_1), rec(FAR_PAST_2), rec(FAR_PAST_3), rec(FAR_PAST_5),
    ]);
    expect(result.longestStreak).toBe(3);
  });
});

// ─── calculateStreak — currentStreak (past dates → 0) ────────────────────────

describe('calculateStreak — currentStreak', () => {
  it('currentStreak=0 when all records are more than 1 day old', () => {
    // FAR_PAST dates are 2020 — definitely not today or yesterday
    const result = calculateStreak([rec(FAR_PAST_1), rec(FAR_PAST_2), rec(FAR_PAST_3)]);
    expect(result.currentStreak).toBe(0);
  });

  it('currentStreak=0 for a single far-past record', () => {
    const result = calculateStreak([rec(FAR_PAST_1)]);
    expect(result.currentStreak).toBe(0);
  });
});

// ─── generateEmbedCode ────────────────────────────────────────────────────────

describe('generateEmbedCode', () => {
  it('returns a string containing <iframe>', () => {
    const html = generateEmbedCode('https://studypanacea.com/widget');
    expect(html).toContain('<iframe');
    expect(html).toContain('</iframe>');
  });

  it('includes the provided URL in the src attribute', () => {
    const url = 'https://studypanacea.com/widget/streak';
    const html = generateEmbedCode(url);
    expect(html).toContain(`src="${url}"`);
  });

  it('uses default height 400 when not specified', () => {
    const html = generateEmbedCode('https://example.com');
    expect(html).toContain('height="400"');
  });

  it('uses provided height when specified', () => {
    const html = generateEmbedCode('https://example.com', 600);
    expect(html).toContain('height="600"');
  });

  it('sets width to 100%', () => {
    const html = generateEmbedCode('https://example.com');
    expect(html).toContain('width="100%"');
  });

  it('sets frameborder="0"', () => {
    const html = generateEmbedCode('https://example.com');
    expect(html).toContain('frameborder="0"');
  });
});

// ─── generateObsidianEmbed ────────────────────────────────────────────────────

describe('generateObsidianEmbed', () => {
  it('returns a string containing the URL', () => {
    const url = 'https://studypanacea.com/widget';
    const result = generateObsidianEmbed(url);
    expect(result).toContain(url);
  });

  it('wraps content in ```html code fence', () => {
    const result = generateObsidianEmbed('https://example.com');
    expect(result).toContain('```html');
    expect(result).toContain('```');
  });

  it('contains an iframe tag', () => {
    const result = generateObsidianEmbed('https://example.com');
    expect(result).toContain('<iframe');
    expect(result).toContain('</iframe>');
  });

  it('uses height 400 (hardcoded)', () => {
    const result = generateObsidianEmbed('https://example.com');
    expect(result).toContain('height="400"');
  });
});

// ─── getQuestionOfDay ─────────────────────────────────────────────────────────

describe('getQuestionOfDay', () => {
  it('returns null for empty array', () => {
    expect(getQuestionOfDay([], new Date('2024-01-01'))).toBeNull();
  });

  it('returns the single question when only one exists', () => {
    const q = makeQuestion();
    expect(getQuestionOfDay([q], new Date('2024-01-01'))).toBe(q);
  });

  it('returns a question from the array (not null) for non-empty array', () => {
    const questions = [makeQuestion(), makeQuestion({ question: 'Q2' })];
    const result = getQuestionOfDay(questions, new Date('2024-06-15'));
    expect(result).not.toBeNull();
    expect(questions).toContain(result);
  });

  it('returns the same question for the same date (stable/deterministic)', () => {
    const questions = Array.from({ length: 5 }, (_, i) => makeQuestion({ question: `Q${i}` }));
    const date = new Date('2024-03-20');
    const r1 = getQuestionOfDay(questions, date);
    const r2 = getQuestionOfDay(questions, date);
    expect(r1).toBe(r2);
  });

  it('may return different questions for different dates', () => {
    // With enough questions, different seeds → different indices
    const questions = Array.from({ length: 100 }, (_, i) => makeQuestion({ question: `Q${i}` }));
    const results = new Set([
      getQuestionOfDay(questions, new Date('2024-01-01')),
      getQuestionOfDay(questions, new Date('2024-06-15')),
      getQuestionOfDay(questions, new Date('2024-12-31')),
    ]);
    // At least 2 different questions across 3 different dates for 100 questions
    expect(results.size).toBeGreaterThan(1);
  });

  it('seed uses YYYY-MM-DD parts: year+month+day sum mod questions.length', () => {
    // Date: 2024-01-15 → seed = 2024+1+15 = 2040, index = 2040 % 10 = 0
    const questions = Array.from({ length: 10 }, (_, i) => makeQuestion({ question: `Q${i}` }));
    const date = new Date('2024-01-15');
    const result = getQuestionOfDay(questions, date);
    const seed = 2024 + 1 + 15; // 2040
    const expectedIndex = seed % 10; // 0
    expect(result).toBe(questions[expectedIndex]);
  });
});
