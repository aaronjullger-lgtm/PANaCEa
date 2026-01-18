/**
 * Optimistic UI Helpers
 *
 * Provides immediate feedback before server confirmation.
 * Improves perceived performance for question submissions and stat updates.
 */

import type { Question, PerformanceRecord } from '../../types';

interface OptimisticUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  retry?: () => Promise<void>;
}

class OptimisticUIManager {
  private updates: Map<string, OptimisticUpdate<any>> = new Map();
  private listeners: Set<(updates: OptimisticUpdate<any>[]) => void> = new Set();

  /**
   * Add an optimistic update
   */
  add<T>(id: string, data: T, retry?: () => Promise<void>): void {
    const update: OptimisticUpdate<T> = {
      id,
      data,
      timestamp: Date.now(),
      status: 'pending',
      retry,
    };

    this.updates.set(id, update);
    this.notifyListeners();
  }

  /**
   * Confirm an optimistic update succeeded
   */
  confirm(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'confirmed';
      this.notifyListeners();

      // Clean up after a delay
      setTimeout(() => {
        this.updates.delete(id);
        this.notifyListeners();
      }, 1000);
    }
  }

  /**
   * Mark an optimistic update as failed
   */
  fail(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'failed';
      this.notifyListeners();
    }
  }

  /**
   * Get all pending updates
   */
  getPending(): OptimisticUpdate<any>[] {
    return Array.from(this.updates.values()).filter((u) => u.status === 'pending');
  }

  /**
   * Get all updates
   */
  getAll(): OptimisticUpdate<any>[] {
    return Array.from(this.updates.values());
  }

  /**
   * Subscribe to updates
   */
  subscribe(callback: (updates: OptimisticUpdate<any>[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const updates = this.getAll();
    this.listeners.forEach((listener) => listener(updates));
  }

  /**
   * Retry all failed updates
   */
  async retryFailed(): Promise<void> {
    const failed = Array.from(this.updates.values()).filter((u) => u.status === 'failed');

    for (const update of failed) {
      if (update.retry) {
        update.status = 'pending';
        this.notifyListeners();

        try {
          await update.retry();
          this.confirm(update.id);
        } catch (error) {
          this.fail(update.id);
        }
      }
    }
  }
}

// Global instance
const optimisticUI = new OptimisticUIManager();

/**
 * Optimistically update user stats before server confirmation
 */
export function optimisticUpdateStats(
  currentStats: {
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  },
  isCorrect: boolean
): {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
} {
  const newTotalQuestions = currentStats.totalQuestions + 1;
  const newCorrectAnswers = currentStats.correctAnswers + (isCorrect ? 1 : 0);
  const newAccuracy = Math.round((newCorrectAnswers / newTotalQuestions) * 100);

  return {
    totalQuestions: newTotalQuestions,
    correctAnswers: newCorrectAnswers,
    accuracy: newAccuracy,
  };
}

/**
 * Optimistically update system stats
 */
export function optimisticUpdateSystemStats(
  currentSystemStats: Map<string, { attempts: number; correct: number; accuracy: number }>,
  system: string,
  isCorrect: boolean
): Map<string, { attempts: number; correct: number; accuracy: number }> {
  const newStats = new Map(currentSystemStats);
  const current = newStats.get(system) || { attempts: 0, correct: 0, accuracy: 0 };

  const newAttempts = current.attempts + 1;
  const newCorrect = current.correct + (isCorrect ? 1 : 0);
  const newAccuracy = Math.round((newCorrect / newAttempts) * 100);

  newStats.set(system, {
    attempts: newAttempts,
    correct: newCorrect,
    accuracy: newAccuracy,
  });

  return newStats;
}

/**
 * Hook for managing optimistic question submissions
 */
export function useOptimisticQuestionSubmit(
  onConfirm?: (data: any) => void,
  onFail?: (error: Error) => void
) {
  const [pending, setPending] = React.useState<OptimisticUpdate<any>[]>([]);

  React.useEffect(() => {
    return optimisticUI.subscribe((updates) => {
      setPending(updates.filter((u) => u.status === 'pending'));
    });
  }, []);

  const submit = async <T>(
    id: string,
    optimisticData: T,
    apiCall: () => Promise<any>
  ): Promise<void> => {
    // Add optimistic update
    optimisticUI.add(id, optimisticData, apiCall);

    try {
      // Make actual API call
      const result = await apiCall();

      // Confirm success
      optimisticUI.confirm(id);
      onConfirm?.(result);
    } catch (error) {
      // Mark as failed
      optimisticUI.fail(id);
      onFail?.(error as Error);
    }
  };

  const retryFailed = () => optimisticUI.retryFailed();

  return {
    submit,
    pending,
    retryFailed,
    hasPending: pending.length > 0,
  };
}

/**
 * Create optimistic performance record immediately
 */
export function createOptimisticPerformanceRecord(
  question: Question,
  isCorrect: boolean,
  timeSpent: number
): PerformanceRecord {
  return {
    id: `opt-${Date.now()}-${Math.random()}`,
    userId: 'current', // Will be replaced by server
    questionId: question.id,
    system: question.system,
    conditionId: question.conditionId,
    correct: isCorrect,
    isCorrect,
    timestamp: new Date().toISOString(),
    timeSpent,
    mode: 'session',
    // Optimistic - will be confirmed/corrected by server
    _optimistic: true,
  } as any;
}

/**
 * Show toast for optimistic updates
 */
export function showOptimisticFeedback(isCorrect: boolean): void {
  const icon = isCorrect ? '✓' : '✗';
  const color = isCorrect ? 'bg-green-500' : 'bg-red-500';
  const message = isCorrect ? 'Correct!' : 'Incorrect';

  // Use lightweight notification instead of heavy modal
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 ${color} text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-slide-in`;
  toast.innerHTML = `<span class="text-xl">${icon}</span><span class="font-semibold">${message}</span>`;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('animate-slide-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

export { optimisticUI };

// React import for hook
import React from 'react';
