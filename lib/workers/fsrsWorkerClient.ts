/**
 * FSRS Worker Client — Ergonomic async interface to the FSRS Web Worker.
 *
 * Singleton pattern: one worker instance shared across the app.
 * Feature-detects Web Worker support and falls back to main-thread
 * execution if unavailable (e.g., older iOS WebView).
 *
 * Usage:
 *   const client = getFSRSWorkerClient();
 *   const results = await client.batchCalculate(items, params);
 *
 * @see lib/workers/fsrs.worker.ts — worker implementation
 * @see lib/fsrs.ts — main-thread fallback
 */

import * as Comlink from 'comlink';
import type { FSRSWorkerApi, SerializableFSRSCard, BatchItem, BatchResult } from './fsrs.worker';
import {
  FSRS,
  type FSRSCard,
  type FSRSParameters,
  type Rating,
  defaultParameters,
} from '../fsrs';

/** Whether the current environment supports Web Workers */
function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Main-thread fallback implementation matching the worker API.
 * Used when Web Workers are unavailable.
 */
class MainThreadFallback {
  calculateNext(
    card: SerializableFSRSCard,
    rating: number,
    params?: FSRSParameters,
    now?: string
  ): { card: SerializableFSRSCard; due: string } {
    const fsrs = new FSRS(params ?? defaultParameters);
    const fsrsCard: FSRSCard = { ...card, last_review: new Date(card.last_review) };
    const result = fsrs.next(fsrsCard, now ? new Date(now) : new Date(), rating as Rating);
    return {
      card: {
        ...result.card,
        last_review: result.card.last_review instanceof Date
          ? result.card.last_review.toISOString()
          : String(result.card.last_review),
      },
      due: result.due.toISOString(),
    };
  }

  batchCalculate(items: BatchItem[], params?: FSRSParameters): BatchResult[] {
    const fsrs = new FSRS(params ?? defaultParameters);
    return items.map((item) => {
      const fsrsCard: FSRSCard = { ...item.card, last_review: new Date(item.card.last_review) };
      const result = fsrs.next(
        fsrsCard,
        item.now ? new Date(item.now) : new Date(),
        item.rating as Rating
      );
      return {
        card: {
          ...result.card,
          last_review: result.card.last_review instanceof Date
            ? result.card.last_review.toISOString()
            : String(result.card.last_review),
        },
        due: result.due.toISOString(),
      };
    });
  }

  batchRetrievability(
    items: Array<{ elapsed_days: number; stability: number }>,
    params?: FSRSParameters
  ): number[] {
    const fsrs = new FSRS(params ?? defaultParameters);
    return items.map((item) =>
      fsrs.calculateRetrievability(item.elapsed_days, item.stability)
    );
  }

  ping(): string {
    return 'pong (main-thread fallback)';
  }
}

export interface FSRSWorkerClient {
  calculateNext: FSRSWorkerApi['calculateNext'];
  batchCalculate: FSRSWorkerApi['batchCalculate'];
  batchRetrievability: FSRSWorkerApi['batchRetrievability'];
  ping: FSRSWorkerApi['ping'];
  /** Whether this is the real worker or main-thread fallback */
  isWorker: boolean;
  /** Terminate the worker (no-op for fallback) */
  terminate: () => void;
}

let instance: FSRSWorkerClient | null = null;

/**
 * Get the singleton FSRS worker client.
 * Creates a Web Worker on first call (or falls back to main thread).
 */
export function getFSRSWorkerClient(): FSRSWorkerClient {
  if (instance) return instance;

  if (supportsWorkers()) {
    try {
      // Vite handles the ?worker import for bundling
      const worker = new Worker(
        new URL('./fsrs.worker.ts', import.meta.url),
        { type: 'module' }
      );
      const api = Comlink.wrap<FSRSWorkerApi>(worker);

      instance = {
        calculateNext: (...args) => api.calculateNext(...args),
        batchCalculate: (...args) => api.batchCalculate(...args),
        batchRetrievability: (...args) => api.batchRetrievability(...args),
        ping: () => api.ping(),
        isWorker: true,
        terminate: () => {
          worker.terminate();
          instance = null;
        },
      };
    } catch (err) {
      console.warn('[FSRS Worker] Failed to create worker, using main-thread fallback:', err);
      instance = createFallback();
    }
  } else {
    console.info('[FSRS Worker] Web Workers not supported, using main-thread fallback');
    instance = createFallback();
  }

  return instance;
}

function createFallback(): FSRSWorkerClient {
  const fallback = new MainThreadFallback();
  return {
    calculateNext: (...args) => Promise.resolve(fallback.calculateNext(...args)),
    batchCalculate: (...args) => Promise.resolve(fallback.batchCalculate(...args)),
    batchRetrievability: (...args) => Promise.resolve(fallback.batchRetrievability(...args)),
    ping: () => Promise.resolve(fallback.ping()),
    isWorker: false,
    terminate: () => { instance = null; },
  } as unknown as FSRSWorkerClient;
}

/**
 * Reset the singleton (for testing or cleanup).
 */
export function resetFSRSWorkerClient(): void {
  if (instance) {
    instance.terminate();
    instance = null;
  }
}
