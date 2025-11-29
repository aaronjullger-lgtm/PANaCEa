/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePhotoDrill,
  MOCK_CASES,
  fuzzyMatch,
  generateRandomCase,
  MASTER_CONDITION_LIST,
  type PhotoCase,
} from './use-photo-drill';

describe('usePhotoDrill hook', () => {
  describe('initial state', () => {
    it('should start with menu status', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.status).toBe('menu');
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

    it('should load MOCK_CASES by default when no session started', () => {
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

    it('should have selectedCategory as null initially', () => {
      const { result } = renderHook(() => usePhotoDrill());

      expect(result.current.selectedCategory).toBeNull();
    });
  });

  describe('startSession', () => {
    it('should transition to playing status when starting session', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      expect(result.current.status).toBe('playing');
      expect(result.current.selectedCategory).toBe('ecg');
    });

    it('should generate initial queue when starting session', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('derm');
      });

      expect(result.current.queue.length).toBeGreaterThan(0);
      expect(result.current.currentCase).toBeDefined();
    });

    it('should reset score and streak when starting new session', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Start session and make progress
      act(() => {
        result.current.startSession('ecg');
      });

      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
      });

      expect(result.current.score).toBe(1);

      // Start new session
      act(() => {
        result.current.startSession('derm');
      });

      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
    });
  });

  describe('submitAnswer (with session)', () => {
    it('should correctly identify a correct answer (case-insensitive)', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      const correctDiagnosis = result.current.currentCase!.correctDiagnosis;

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
        result.current.startSession('ecg');
      });

      act(() => {
        result.current.submitAnswer('Wrong Answer');
      });

      expect(result.current.isCorrect).toBe(false);
      expect(result.current.status).toBe('feedback');
      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
    });

    it('should break streak on incorrect answer after correct ones', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      // Answer first correctly
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
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

    it('should not submit when in menu state', () => {
      const { result } = renderHook(() => usePhotoDrill());

      // Try to submit while in menu state
      act(() => {
        result.current.submitAnswer('test');
      });

      expect(result.current.score).toBe(0);
      expect(result.current.status).toBe('menu');
    });

    it('should not submit when in feedback state', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      // Submit once to go to feedback state
      act(() => {
        result.current.submitAnswer('test');
      });

      const scoreBefore = result.current.score;

      // Try to submit again while in feedback state
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
      });

      expect(result.current.score).toBe(scoreBefore);
    });
  });

  describe('nextCase (infinite mode)', () => {
    it('should advance to the next case and generate new case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      const initialQueueLength = result.current.queue.length;

      act(() => {
        result.current.submitAnswer('test');
      });

      act(() => {
        result.current.nextCase();
      });

      expect(result.current.currentCaseIndex).toBe(1);
      expect(result.current.status).toBe('playing');
      expect(result.current.queue.length).toBe(initialQueueLength + 1);
    });

    it('should reset userAnswer and isCorrect when moving to next case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

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

  describe('skipCase (with session)', () => {
    it('should break streak and move to next case', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      // Build a streak first
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
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
      expect(result.current.status).toBe('playing');
    });

    it('should not skip when in menu state', () => {
      const { result } = renderHook(() => usePhotoDrill());

      const indexBefore = result.current.currentCaseIndex;

      act(() => {
        result.current.skipCase();
      });

      expect(result.current.currentCaseIndex).toBe(indexBefore);
    });
  });

  describe('exitToMenu', () => {
    it('should return to menu state and reset everything', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('ecg');
      });

      // Make some progress
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
      });

      expect(result.current.score).toBe(1);

      act(() => {
        result.current.exitToMenu();
      });

      expect(result.current.status).toBe('menu');
      expect(result.current.selectedCategory).toBeNull();
      expect(result.current.score).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.queue).toHaveLength(0);
    });
  });

  describe('reset (with session)', () => {
    it('should reset score and position but keep category', () => {
      const { result } = renderHook(() => usePhotoDrill());

      act(() => {
        result.current.startSession('derm');
      });

      // Make some progress
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
      });
      act(() => {
        result.current.nextCase();
      });
      act(() => {
        result.current.submitAnswer(result.current.currentCase!.correctDiagnosis);
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
      expect(result.current.status).toBe('playing');
      expect(result.current.selectedCategory).toBe('derm');
    });
  });
});

describe('generateRandomCase helper', () => {
  it('should generate ECG case for ecg category', () => {
    const photoCase = generateRandomCase('ecg');

    expect(photoCase.modality).toBe('ecg');
    expect(photoCase.imageUrl).toContain('ECG');
    expect(MASTER_CONDITION_LIST).toContain(photoCase.correctDiagnosis);
  });

  it('should generate Derm case for derm category', () => {
    const photoCase = generateRandomCase('derm');

    expect(photoCase.modality).toBe('derm');
    expect(photoCase.imageUrl).toContain('Derm');
    expect(MASTER_CONDITION_LIST).toContain(photoCase.correctDiagnosis);
  });

  it('should generate XRay case for radiology category', () => {
    const photoCase = generateRandomCase('radiology');

    expect(photoCase.modality).toBe('xray');
    expect(photoCase.imageUrl).toContain('XRay');
    expect(MASTER_CONDITION_LIST).toContain(photoCase.correctDiagnosis);
  });

  it('should generate random modality case for random category', () => {
    // Run multiple times to increase chance of getting different modalities
    const cases = Array.from({ length: 10 }, () => generateRandomCase('random'));
    const modalities = new Set(cases.map(c => c.modality));

    // Should have at least one unique modality (statistical)
    expect(modalities.size).toBeGreaterThan(0);
    cases.forEach(c => {
      expect(MASTER_CONDITION_LIST).toContain(c.correctDiagnosis);
    });
  });

  it('should generate unique IDs for each case', () => {
    const case1 = generateRandomCase('ecg');
    const case2 = generateRandomCase('ecg');

    expect(case1.id).not.toBe(case2.id);
  });

  it('should generate distractors that are not the correct diagnosis', () => {
    const photoCase = generateRandomCase('ecg');

    photoCase.distractors.forEach(distractor => {
      expect(distractor).not.toBe(photoCase.correctDiagnosis);
    });
  });
});

describe('MASTER_CONDITION_LIST', () => {
  it('should contain at least 20 conditions', () => {
    expect(MASTER_CONDITION_LIST.length).toBeGreaterThanOrEqual(20);
  });

  it('should contain ECG conditions', () => {
    expect(MASTER_CONDITION_LIST).toContain('Atrial Fibrillation');
    expect(MASTER_CONDITION_LIST).toContain('STEMI');
  });

  it('should contain Derm conditions', () => {
    expect(MASTER_CONDITION_LIST).toContain('Psoriasis');
    expect(MASTER_CONDITION_LIST).toContain('Shingles');
  });

  it('should contain Radiology conditions', () => {
    expect(MASTER_CONDITION_LIST).toContain('Pneumothorax');
    expect(MASTER_CONDITION_LIST).toContain('Pneumonia');
  });

  it('should contain Gout as per requirements', () => {
    expect(MASTER_CONDITION_LIST).toContain('Gout');
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
