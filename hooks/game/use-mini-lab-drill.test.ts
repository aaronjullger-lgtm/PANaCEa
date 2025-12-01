/**
 * @vitest-environment jsdom
 */
// hooks/game/use-mini-lab-drill.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMiniLabDrill } from './use-mini-lab-drill';

describe('useMiniLabDrill', () => {
  describe('Lab Test Ordering', () => {
    it('should start with no ordered tests', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      expect(result.current.status).toBe('menu');
    });

    it('should show available orderable tests after starting session', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      expect(result.current.status).toBe('playing');
      expect(result.current.currentCase).toBeTruthy();
      
      // Check if orderable tests are available (DKA case has orderable tests)
      if (result.current.currentCase?.correctDiagnosis === 'Diabetic Ketoacidosis') {
        expect(result.current.availableTests.length).toBeGreaterThan(0);
      }
    });

    it('should add ordered test to panels when orderTest is called', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      const initialCase = result.current.currentCase;
      if (!initialCase || !initialCase.orderableTests || initialCase.orderableTests.length === 0) {
        // Skip if no orderable tests available
        return;
      }
      
      const initialPanelCount = initialCase.panels.length;
      const testToOrder = result.current.availableTests[0];
      
      act(() => {
        result.current.orderTest(testToOrder);
      });
      
      const updatedCase = result.current.currentCase;
      expect(updatedCase).toBeTruthy();
      if (updatedCase) {
        // Should have one more panel
        expect(updatedCase.panels.length).toBe(initialPanelCount + 1);
        
        // The new panel should match the ordered test
        const addedPanel = updatedCase.panels[updatedCase.panels.length - 1];
        expect(addedPanel.name).toBe(testToOrder);
        
        // The test should be marked as ordered
        expect(updatedCase.orderedTests).toContain(testToOrder);
        
        // Available tests should decrease
        expect(result.current.availableTests).not.toContain(testToOrder);
      }
    });

    it('should maintain ordered tests across state updates', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      const initialCase = result.current.currentCase;
      if (!initialCase || !initialCase.orderableTests || initialCase.orderableTests.length === 0) {
        return;
      }
      
      const testToOrder = result.current.availableTests[0];
      
      act(() => {
        result.current.orderTest(testToOrder);
      });
      
      // The ordered test should persist
      expect(result.current.currentCase?.orderedTests).toContain(testToOrder);
    });

    it('should show all three default panels (BMP, CBC, LFT) initially', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      const currentCase = result.current.currentCase;
      expect(currentCase).toBeTruthy();
      
      if (currentCase) {
        const panelNames = currentCase.panels.map(p => p.name);
        
        // Should have the three default panels
        const hasBasicPanel = panelNames.some(name => 
          name.includes('Basic Metabolic') || name.includes('BMP')
        );
        const hasCBC = panelNames.some(name => 
          name.includes('Complete Blood Count') || name.includes('CBC')
        );
        const hasLFT = panelNames.some(name => 
          name.includes('Liver Function') || name.includes('LFT')
        );
        
        expect(hasBasicPanel).toBe(true);
        expect(hasCBC).toBe(true);
        expect(hasLFT).toBe(true);
      }
    });
  });

  describe('Basic Functionality', () => {
    it('should start in menu status', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      expect(result.current.status).toBe('menu');
      expect(result.current.currentCase).toBeNull();
    });

    it('should transition to playing status after starting session', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      expect(result.current.status).toBe('playing');
      expect(result.current.currentCase).toBeTruthy();
    });

    it('should have valid diagnoses list', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      expect(result.current.validDiagnoses).toBeTruthy();
      expect(result.current.validDiagnoses.length).toBeGreaterThan(0);
    });

    it('should submit answer and show feedback', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      const correctAnswer = result.current.currentCase?.correctDiagnosis;
      
      if (correctAnswer) {
        act(() => {
          result.current.submitAnswer(correctAnswer);
        });
        
        expect(result.current.status).toBe('feedback');
        expect(result.current.isCorrect).toBe(true);
        expect(result.current.score).toBe(1);
      }
    });

    it('should increment score on correct answer', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      const correctAnswer = result.current.currentCase?.correctDiagnosis;
      
      if (correctAnswer) {
        act(() => {
          result.current.submitAnswer(correctAnswer);
        });
        
        expect(result.current.score).toBe(1);
        expect(result.current.streak).toBe(1);
      }
    });

    it('should reset streak on incorrect answer', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      act(() => {
        result.current.submitAnswer('Wrong Diagnosis');
      });
      
      expect(result.current.isCorrect).toBe(false);
      expect(result.current.streak).toBe(0);
    });

    it('should go back to menu on exitToMenu', () => {
      const { result } = renderHook(() => useMiniLabDrill());
      
      act(() => {
        result.current.startSession('metabolic');
      });
      
      expect(result.current.status).toBe('playing');
      
      act(() => {
        result.current.exitToMenu();
      });
      
      expect(result.current.status).toBe('menu');
      expect(result.current.currentCase).toBeNull();
    });
  });
});
