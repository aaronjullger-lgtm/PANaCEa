/**
 * Polypharmacy Drill Hook
 *
 * Database-driven hook for polypharmacy puzzle mode.
 * Manages case loading, deprescribing evaluation, and progress tracking.
 */

import { useState, useEffect } from 'react';
import type { PolypharmacyCase, PolypharmacyAttempt, Medication } from '@/types/drill-modes';

export interface PolypharmacyDrillState {
  currentCase: PolypharmacyCase | null;
  loading: boolean;
  error: string | null;
  attempts: PolypharmacyAttempt[];
  score: {
    correct: number;
    total: number;
    partialCreditTotal: number;
  };
}

export interface UsePolypharmacyDrillReturn {
  state: PolypharmacyDrillState;
  loadNewCase: () => Promise<void>;
  submitDeprescribingDecision: (medicationIds: string[]) => Promise<{
    correct: boolean;
    partialCredit: number;
    feedback: string;
  }>;
  reset: () => void;
}

/**
 * Hook for managing polypharmacy drill sessions
 */
export function usePolypharmacyDrill(
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): UsePolypharmacyDrillReturn {
  const [state, setState] = useState<PolypharmacyDrillState>({
    currentCase: null,
    loading: false,
    error: null,
    attempts: [],
    score: {
      correct: 0,
      total: 0,
      partialCreditTotal: 0,
    },
  });

  /**
   * Load a new polypharmacy case from the database
   */
  const loadNewCase = async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `/api/questions/polypharmacy-drill?count=1&difficulty=${difficulty}`
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to load case');
      }

      const data = (await response.json()) as { cases?: PolypharmacyCase[] };

      const cases = data.cases;
      if (!cases?.length) {
        throw new Error('No cases returned from server');
      }

      setState((prev) => ({
        ...prev,
        currentCase: cases[0]!,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load case',
      }));
    }
  };

  /**
   * Evaluate deprescribing decision with partial credit
   */
  const evaluateDeprescribingDecision = (
    selectedMedications: string[],
    correctMedications: string[]
  ): { correct: boolean; partialCredit: number; feedback: string } => {
    const correctSet = new Set(correctMedications);
    const selectedSet = new Set(selectedMedications);

    // Calculate true positives, false positives, false negatives
    const truePositives = selectedMedications.filter((med) => correctSet.has(med)).length;
    const falsePositives = selectedMedications.filter((med) => !correctSet.has(med)).length;
    const falseNegatives = correctMedications.filter((med) => !selectedSet.has(med)).length;

    // Perfect match
    if (truePositives === correctMedications.length && falsePositives === 0) {
      return {
        correct: true,
        partialCredit: 100,
        feedback:
          '✅ Perfect! You correctly identified all medications that should be deprescribed.',
      };
    }

    // Calculate partial credit
    const partialCredit = Math.max(
      0,
      Math.round((truePositives / correctMedications.length) * 100 - falsePositives * 20)
    );

    // Generate feedback
    let feedback = '';

    if (falseNegatives > 0) {
      feedback += `⚠️ You missed ${falseNegatives} medication(s) that should be stopped. `;
    }

    if (falsePositives > 0) {
      feedback += `⚠️ You selected ${falsePositives} medication(s) that should continue. `;
    }

    if (truePositives > 0) {
      feedback += `✅ You correctly identified ${truePositives} out of ${correctMedications.length} problematic medications. `;
    }

    feedback += `\nPartial credit: ${partialCredit}%`;

    return {
      correct: false,
      partialCredit,
      feedback,
    };
  };

  /**
   * Submit deprescribing decision and get feedback
   */
  const submitDeprescribingDecision = async (
    medicationIds: string[]
  ): Promise<{ correct: boolean; partialCredit: number; feedback: string }> => {
    if (!state.currentCase) {
      return {
        correct: false,
        partialCredit: 0,
        feedback: 'No active case',
      };
    }

    const result = evaluateDeprescribingDecision(
      medicationIds,
      state.currentCase.correctMedicationsToStop
    );

    // Record attempt
    const attempt: PolypharmacyAttempt = {
      caseId: state.currentCase.id,
      selectedMedications: medicationIds,
      correct: result.correct,
      partialCredit: result.partialCredit,
      feedback: result.feedback,
      timestamp: Date.now(),
    };

    // Update state
    setState((prev) => ({
      ...prev,
      attempts: [...prev.attempts, attempt],
      score: {
        correct: prev.score.correct + (result.correct ? 1 : 0),
        total: prev.score.total + 1,
        partialCreditTotal: prev.score.partialCreditTotal + result.partialCredit,
      },
    }));

    return result;
  };

  /**
   * Reset the drill session
   */
  const reset = (): void => {
    setState({
      currentCase: null,
      loading: false,
      error: null,
      attempts: [],
      score: {
        correct: 0,
        total: 0,
        partialCreditTotal: 0,
      },
    });
  };

  return {
    state,
    loadNewCase,
    submitDeprescribingDecision,
    reset,
  };
}
