import { describe, it, expect } from 'vitest';
import { calculateParTime } from '@/lib/utils/questionComplexity';

describe('calculateParTime', () => {
  it('returns at least 15s for empty questions', () => {
    expect(calculateParTime({})).toBeGreaterThanOrEqual(15000);
  });

  it('returns minimum 15s for very short questions', () => {
    expect(calculateParTime({ question: 'Yes or no?', options: ['A', 'B'] })).toBe(15000);
  });

  it('increases par time for longer stems', () => {
    const short = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C', 'D'] });
    const long = calculateParTime({
      question: 'A 45-year-old male presents with chest pain radiating to the left arm. He has a history of hypertension and diabetes. On examination, BP is 160/100, HR 95. ECG shows ST elevation in leads V1-V4. What is the most likely diagnosis?',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(long).toBeGreaterThan(short);
  });

  it('adds buffer for image questions', () => {
    const noImage = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C', 'D'] });
    const withImage = calculateParTime({
      question: 'What is X?',
      options: ['A', 'B', 'C', 'D'],
      imageUrl: 'test.jpg',
    });
    expect(withImage).toBe(noImage + 10000); // 10s image buffer
  });

  it('adds buffer for lab questions (mmol/L in stem)', () => {
    const noLabs = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C', 'D'] });
    const withLabs = calculateParTime({
      question: 'Na 140 mmol/L, K 4.0 mmol/L. What is X?',
      options: ['A', 'B', 'C', 'D'],
    });
    // Lab buffer is 15s but reading time also increases from more words
    expect(withLabs).toBeGreaterThan(noLabs + 14000); // at least 14s more
  });

  it('adds buffer for explicit hasLabs flag', () => {
    const noLabs = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C', 'D'] });
    const withLabs = calculateParTime({
      question: 'What is X?',
      options: ['A', 'B', 'C', 'D'],
      hasLabs: true,
    });
    expect(withLabs).toBe(noLabs + 15000);
  });

  it('scales with option count', () => {
    const threeOpts = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C'] });
    const sixOpts = calculateParTime({ question: 'What is X?', options: ['A', 'B', 'C', 'D', 'E', 'F'] });
    // 3 extra options × 2s = 6s = 6000ms
    expect(sixOpts).toBeGreaterThan(threeOpts);
  });

  it('userSpeedFactor > 1.0 reduces reading time', () => {
    const normal = calculateParTime({
      question: 'A long clinical vignette with many details about patient history and current presentation.',
      options: ['A', 'B', 'C', 'D'],
    });
    const fast = calculateParTime({
      question: 'A long clinical vignette with many details about patient history and current presentation.',
      options: ['A', 'B', 'C', 'D'],
    }, 1.5);
    expect(fast).toBeLessThan(normal);
  });

  it('userSpeedFactor < 1.0 increases reading time', () => {
    const normal = calculateParTime({
      question: 'A long clinical vignette with many details about patient history and current presentation.',
      options: ['A', 'B', 'C', 'D'],
    });
    const slow = calculateParTime({
      question: 'A long clinical vignette with many details about patient history and current presentation.',
      options: ['A', 'B', 'C', 'D'],
    }, 0.7);
    expect(slow).toBeGreaterThan(normal);
  });

  it('uses "choices" field as alternative to "options"', () => {
    const viaOptions = calculateParTime({ question: 'X?', options: ['A', 'B'] });
    const viaChoices = calculateParTime({ question: 'X?', choices: ['A', 'B'] });
    expect(viaOptions).toBe(viaChoices);
  });

  it('handles null/undefined question gracefully', () => {
    expect(calculateParTime(null)).toBeGreaterThanOrEqual(15000);
    expect(calculateParTime(undefined as any)).toBeGreaterThanOrEqual(15000);
  });
});
