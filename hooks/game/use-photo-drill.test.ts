/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePhotoDrill,
  MOCK_CASES,
  fuzzyMatch,
  type PhotoCase,
} from './use-photo-drill';

describe('usePhotoDrill hook', () => {
  describe('initial state', () => {
    it('should start with active status', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.status).toBe('active');
    });

    it('should start at case index 0', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.currentCaseIndex).toBe(0);
    });

    it('should have score and streak at 0', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
    });

    it('should load MOCK_CASES by default', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.totalCases).toBe(MOCK_CASES.length);
      expect(result.current.currentCase).toEqual(MOCK_CASES[0]);
    });

    it('should accept custom cases', () => {
      const customCases: PhotoCase[] = [
        {
          id: 'custom-1',
          imageUrl: 'https://example.com/img.jpg',
          modality: 'ecg',
          correctDiagnosis: 'Test Diagnosis',
          distractors: ['A', 'B', 'C'],
          explanation: 'Test explanation',
        },
      ];

      const { result } = renderHook(() => usePhotoDrill(customCases));

      expect(result.current.totalCases).toBe(1);
      expect(result.current.currentCase?.id).toBe('custom-1');
    });
  });

  describe('submitAnswer', () => {
    it('should correctly identify a correct answer (case-insensitive)', () => {
      const { result } = renderHook(() => usePhotoDrill());
      const correctDiagnosis = MOCK_CASES[0].correctDiagnosis;

      act(() => {
        result.current.submitAnswer(correctDiagnosis.toUpperCase());
      });

      expect(result.current.isCorrect).toBe(true);
      expect(result.current.status).toBe('feedback');
      expect(result.current.score).toBe(1);
      expect(result.current.streak).toBe(1);
    });

    it('should correctly identify an incorrect answer', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.submitAnswer('Wrong Answer');
      });

      expect(result.current.isCorrect).toBe(false);
      expect(result.current.status).toBe('feedback');
      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
    });

    it('should break streak on incorrect answer after correct ones', () => {
      const customCases: PhotoCase[] = [
        {
          id: '1',
          imageUrl: 'url',
          modality: 'ecg',
          correctDiagnosis: 'Answer1',
          distractors: [],
          explanation: '',
        },
        {
          id: '2',
          imageUrl: 'url',
          modality: 'ecg',
          correctDiagnosis: 'Answer2',
          distractors: [],
          explanation: '',
        },
      ];

      const { result } = renderHook(() => usePhotoDrill(customCases));

      // Answer first correctly
      act(() => {
        result.current.submitAnswer('Answer1');
      });
      expect(result.current.streak).toBe(1);

      // Move to next case
      act(() => {
        result.current.nextCase();
      });

      // Answer second incorrectly
      act(() => {
        result.current.submitAnswer('Wrong');
      });
      expect(result.current.streak).toBe(0);
      expect(result.current.score).toBe(1);
    });

    it('should not submit when not in active state', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Submit once to go to feedback state
      act(() => {
        result.current.submitAnswer('test');
      });

      const scoreBefore = result.current.score;

      // Try to submit again while in feedback state
      act(() => {
        result.current.submitAnswer(MOCK_CASES[0].correctDiagnosis);
      });

      expect(result.current.score).toBe(scoreBefore);
    });
  });

  describe('nextCase', () => {
    it('should advance to the next case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.submitAnswer('test');
      });

      act(() => {
        result.current.nextCase();
      });

      expect(result.current.currentCaseIndex).toBe(1);
      expect(result.current.status).toBe('active');
      expect(result.current.currentCase).toEqual(MOCK_CASES[1]);
    });

    it('should go to summary when reaching end of cases', () => {
      const customCases: PhotoCase[] = [
        {
          id: '1',
          imageUrl: 'url',
          modality: 'ecg',
          correctDiagnosis: 'Test',
          distractors: [],
          explanation: '',
        },
      ];

      const { result } = renderHook(() => usePhotoDrill(customCases));

      act(() => {
        result.current.submitAnswer('Test');
      });

      act(() => {
        result.current.nextCase();
      });

      expect(result.current.status).toBe('summary');
    });

    it('should reset userAnswer and isCorrect when moving to next case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.submitAnswer('test');
      });

      expect(result.current.userAnswer).toBe('test');

      act(() => {
        result.current.nextCase();
      });

      expect(result.current.userAnswer).toBeNull();
      expect(result.current.isCorrect).toBeNull();
    });
  });

  describe('skipCase', () => {
    it('should break streak and move to next case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Build a streak first
      act(() => {
        result.current.submitAnswer(MOCK_CASES[0].correctDiagnosis);
      });

      act(() => {
        result.current.nextCase();
      });

      expect(result.current.streak).toBe(1);

      act(() => {
        result.current.skipCase();
      });

      expect(result.current.streak).toBe(0);
      expect(result.current.currentCaseIndex).toBe(2);
      expect(result.current.status).toBe('active');
    });

    it('should go to summary when skipping last case', () => {
      const customCases: PhotoCase[] = [
        {
          id: '1',
          imageUrl: 'url',
          modality: 'ecg',
          correctDiagnosis: 'Test',
          distractors: [],
          explanation: '',
        },
      ];

      const { result } = renderHook(() => usePhotoDrill(customCases));

      act(() => {
        result.current.skipCase();
      });

      expect(result.current.status).toBe('summary');
    });

    it('should not skip when not in active state', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Go to feedback state
      act(() => {
        result.current.submitAnswer('test');
      });

      const indexBefore = result.current.currentCaseIndex;

      act(() => {
        result.current.skipCase();
      });

      expect(result.current.currentCaseIndex).toBe(indexBefore);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Make some progress
      act(() => {
        result.current.submitAnswer(MOCK_CASES[0].correctDiagnosis);
      });
      act(() => {
        result.current.nextCase();
      });
      act(() => {
        result.current.submitAnswer(MOCK_CASES[1].correctDiagnosis);
      });

      expect(result.current.score).toBe(2);
      expect(result.current.currentCaseIndex).toBe(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.currentCaseIndex).toBe(0);
      expect(result.current.userAnswer).toBeNull();
      expect(result.current.isCorrect).toBeNull();
      expect(result.current.status).toBe('active');
    });
  });
});

describe('fuzzyMatch helper', () => {
  it('should match exact strings (case-insensitive)', () => {
    expect(fuzzyMatch('Hello', 'hello')).toBe(true);
    expect(fuzzyMatch('HELLO', 'hello')).toBe(true);
    expect(fuzzyMatch('hello', 'HELLO')).toBe(true);
  });

  it('should handle whitespace trimming', () => {
    expect(fuzzyMatch('  hello  ', 'hello')).toBe(true);
    expect(fuzzyMatch('hello', '  hello  ')).toBe(true);
  });

  it('should return false for non-matching strings', () => {
    expect(fuzzyMatch('hello', 'world')).toBe(false);
    expect(fuzzyMatch('test', 'testing')).toBe(false);
  });
});

describe('MOCK_CASES data', () => {
  it('should have 5 cases', () => {
    expect(MOCK_CASES).toHaveLength(5);
  });

  it('should have variety of modalities', () => {
    const modalities = MOCK_CASES.map((c) => c.modality);
    expect(modalities).toContain('ecg');
    expect(modalities).toContain('derm');
    expect(modalities).toContain('xray');
  });

  it('should have valid structure for all cases', () => {
    MOCK_CASES.forEach((c) => {
      expect(c.id).toBeDefined();
      expect(c.imageUrl).toMatch(/^https:\/\//);
      expect(['ecg', 'xray', 'derm']).toContain(c.modality);
      expect(c.correctDiagnosis).toBeTruthy();
      expect(Array.isArray(c.distractors)).toBe(true);
      expect(c.distractors.length).toBeGreaterThan(0);
      expect(c.explanation).toBeTruthy();
    });
  });
});
